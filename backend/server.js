// =================================================================
// 1. IMPORTS ET CONFIGURATION
// =================================================================
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const CryptoJS = require('crypto-js');
const cron = require('node-cron'); 

const app = express();
app.use(cors());
app.use(express.json());

// Fonctions de chiffrement/déchiffrement
const encrypt = (text) => {
    if (!text) return null;
    return CryptoJS.AES.encrypt(text, process.env.CRYPTO_SECRET).toString();
};
const decrypt = (ciphertext) => {
    if (!ciphertext) return null;
    const bytes = CryptoJS.AES.decrypt(ciphertext, process.env.CRYPTO_SECRET);
    return bytes.toString(CryptoJS.enc.Utf8);
};

// =================================================================
// 2. CONNEXION À MONGODB
// =================================================================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connecté à MongoDB'))
  .catch(err => console.error('Erreur de connexion à MongoDB:', err));

// =================================================================
// 3. SCHÉMAS / MODÈLES DE DONNÉES
// =================================================================
const CompanySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  whatsapp: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  emailAppPassword: { type: String },
  twilioSid: { type: String },
  twilioToken: { type: String },
  twilioWhatsappNumber: { type: String },
});
const Company = mongoose.model('Company', CompanySchema);

const ClientSchema = new mongoose.Schema({
    name: { type: String, required: true },
    whatsapp: { type: String, required: true },
    email: { type: String /*, required: true */ }, // MODIFIÉ : Email n'est plus requis
    status: { 
      type: String, 
      enum: ['Vérifié', 'Non Vérifié'], 
      default: 'Non Vérifié' // MODIFIÉ : Ajout de 'default' et suppression de 'required'
    },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  numberStatus: {
    type: String,
    enum: ['Pending', 'Valid', 'Invalid'],
    default: 'Pending'
  },
  e164Format: { type: String },
});
// AJOUT DE L'INDEX pour accélérer les recherches
ClientSchema.index({ companyId: 1, numberStatus: 1 });
const Client = mongoose.model('Client', ClientSchema);

const SurveySchema = new mongoose.Schema({
  title: { type: String, required: true },
  questions: [{
    text: { type: String, required: true },
    type: { type: String, enum: ['text', 'mcq'], required: true, default: 'text' },
    options: [{ type: String }]
  }],
  responses: [{
    clientName: String,
    answers: [String],
    submittedAt: { type: Date, default: Date.now }
  }],
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
});
// AJOUT DE L'INDEX pour accélérer les recherches
SurveySchema.index({ companyId: 1 });
const Survey = mongoose.model('Survey', SurveySchema);

// =================================================================
// 4. MIDDLEWARE D'AUTHENTIFICATION
// =================================================================
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) { return res.status(401).json({ message: 'Accès refusé, token manquant.' }); }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.company = decoded;
    next();
  } catch (error) { res.status(400).json({ message: 'Token invalide.' }); }
};

// =================================================================
// 5. FONCTIONS HELPERS (Logique Métier)
// =================================================================

const getNumberValidation = async (twilioClient, phoneNumber) => {
  try {
    let normalizedNumber = phoneNumber.replace(/[^0-9+]/g, ''); 
    if (!normalizedNumber.startsWith('+')) {
         if (normalizedNumber.length === 8) { 
            normalizedNumber = '+229' + normalizedNumber;
         } else {
             console.warn(`[Lookup] Numéro ${phoneNumber} sans '+' détecté, format incertain.`);
         }
    }
    const phoneData = await twilioClient.lookups.v1.phoneNumbers(normalizedNumber).fetch();
    return { status: 'Valid', e164Format: phoneData.phoneNumber };
  } catch (error) {
    console.warn(`[Lookup Failed] Numéro ${phoneNumber} (tentative: ${normalizedNumber || phoneNumber}): ${error.message}`);
    return { status: 'Invalid', e164Format: null };
  }
};


const validateAndUpdateClient = async (companyId, clientId, phoneNumber) => {
  try {
    const company = await Company.findById(companyId);
    if (!company) return;

    const sid = decrypt(company.twilioSid);
    const token = decrypt(company.twilioToken);
    if (!sid || !token) {
        // Log seulement si la compagnie devrait avoir ces infos pour une validation
        if (phoneNumber.startsWith('+')) { // Si c'est un numéro international, on s'attend à Twilio
             console.warn(`[Validation Job] Pas de SID/Token Twilio pour ${companyId}, validation annulée pour ${clientId}`);
        }
        // On ne marque plus Invalid ici car le client n'est pas forcément géré par Twilio, 
        // mais on laisse le statut 'Pending' pour un nouveau job si Twilio est configuré plus tard.
        return; 
    }

    const twilioClient = twilio(sid, token);
    const validation = await getNumberValidation(twilioClient, phoneNumber);

    await Client.findByIdAndUpdate(clientId, {
      numberStatus: validation.status,
      e164Format: validation.e164Format
    });

    console.log(`[Validation Job] Client ${clientId} | Statut: ${validation.status} pour Company ${companyId}`);
  } catch (error) {
    console.error(`[Validation Job CRITICAL FAIL] pour client ${clientId}: ${error.message}`);
     // Marquer comme Invalide en cas d'erreur critique de Twilio API
    try { await Client.findByIdAndUpdate(clientId, { numberStatus: 'Invalid', e164Format: null }); } catch (updateError) {}
  }
};


// 🔄 FONCTION DE RATTRAPAGE MODIFIÉE (SANS FLAG GLOBAL)
// 🔄 FONCTION DE RATTRAPAGE MODIFIÉE (MAINTENANT ROBUSTE)
// ⚡ CORRECTION FINALE DU BACKEND
const runValidationCatchup = async (companyId) => {
    console.log(`[Validation Job] DÉMARRAGE RATTRAPAGE pour ${companyId}. Recherche des clients 'Pending' (Robuste)...`);
  
    try {
        const pendingClients = await Client.find({ 
            companyId: companyId, 
            $or: [
                { numberStatus: { $regex: /^Pending$/i } }, 
                { numberStatus: null }, 
                { numberStatus: { $exists: false } } 
            ]
        });
  
        console.log(`[Validation Job] Trouvé ${pendingClients.length} clients 'Pending' pour ${companyId}.`);
  
        if (pendingClients.length === 0) {
            console.log(`[Validation Job] Rattrapage terminé pour ${companyId}: Aucun client trouvé.`);
            return;
        }
  
        for (const client of pendingClients) {
            const currentClientState = await Client.findById(client._id).select('numberStatus whatsapp');
            
            const isPendingOrUntreated = 
                !currentClientState.numberStatus || 
                (typeof currentClientState.numberStatus === 'string' && currentClientState.numberStatus.toLowerCase() === 'pending');

            if (isPendingOrUntreated) {
                await validateAndUpdateClient(companyId, client._id, client.whatsapp);
                await new Promise(resolve => setTimeout(resolve, 500)); // Pause 0.5s
            }
        }
  
        console.log(`[Validation Job] Validation de rattrapage terminée pour ${companyId}.`);
  
    } catch (error) {
        console.error(`[Validation Job CRITICAL FAIL] Échec du rattrapage pour ${companyId}: ${error.message}`);
    }
};
const sendEmailsInBackground = async (company, recipients, contentToSend) => {
    try {
        const appPassword = decrypt(company.emailAppPassword);
        if (!appPassword) {
            console.error(`[BG JOB FAILED] Pas de mot de passe d'application pour ${company.name}`);
            return;
        }

        const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: company.email, pass: appPassword }});

        let emailsSent = 0;
        let emailsFailed = 0;
        console.log(`[BG JOB STARTED] Démarrage de l'envoi d'emails pour ${company.name} à ${recipients.length} clients.`);

        for (const recipient of recipients) {
            try {
                await transporter.sendMail({
                    from: `"${company.name}" <${company.email}>`,
                    to: recipient.email,
                    subject: `Message de ${company.name}`,
                    text: contentToSend
                });
                emailsSent++;
            } catch (emailError) {
                console.error(`[BG JOB] Échec de l'envoi à ${recipient.email}: ${emailError.message}`);
                emailsFailed++;
            }
        }
        console.log(`[BG JOB SUCCESS] Envoi d'email terminé pour ${company.name}. Succès: ${emailsSent}, Échecs: ${emailsFailed}`);
    } catch (error) {
        console.error(`[BG JOB CRITICAL FAIL] Erreur fatale lors de l'envoi d'emails pour ${company.name}: ${error.message}`);
    }
};


// =================================================================
// 6. ROUTES DE L'API
// =================================================================

// 🌐 NOUVELLE ROUTE DE BASE : Ajout d'une route racine pour les checks de santé
app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'Client-Back-rxhc API' });
});


// --- Routes d'Authentification ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, whatsapp, email, password, passwordConfirm, emailAppPassword, twilioSid, twilioToken, twilioWhatsappNumber } = req.body;
    if (password !== passwordConfirm) { return res.status(400).json({ message: 'Les mots de passe ne correspondent pas.' });}
    const existingCompany = await Company.findOne({ $or: [{ email }, { name }] });
    if (existingCompany) { return res.status(400).json({ message: 'Une entreprise avec cet email ou ce nom existe déjà.' }); }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newCompany = new Company({ name, whatsapp, email, password: hashedPassword, emailAppPassword: encrypt(emailAppPassword), twilioSid: encrypt(twilioSid), twilioToken: encrypt(twilioToken), twilioWhatsappNumber: encrypt(twilioWhatsappNumber) });
    await newCompany.save();
    res.status(201).json({ message: 'Entreprise enregistrée avec succès.' });
  } catch (error) { res.status(500).json({ message: 'Erreur du serveur.', error: error.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { name, password } = req.body;
    const company = await Company.findOne({ name });
    if (!company) { return res.status(400).json({ message: 'Nom d\'entreprise ou mot de passe invalide.' }); }

    const isMatch = await bcrypt.compare(password, company.password);
    if (!isMatch) { return res.status(400).json({ message: 'Nom d\'entreprise ou mot de passe invalide.' }); }

    const token = jwt.sign({ id: company._id, name: company.name }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, companyName: company.name });

  } catch (error) {
      res.status(500).json({ message: 'Erreur du serveur.', error: error.message });
  }
});


// --- Routes des Clients ---
app.post('/api/clients', authMiddleware, async (req, res) => {
    try {
      const { name, whatsapp, email, status } = req.body;
      
      // MODIFIÉ : Utilise les valeurs du body ou des valeurs par défaut/vides si elles sont absentes
      const clientData = { 
        name, 
        whatsapp, 
        email: email || '', 
        status: status || 'Non Vérifié', 
        companyId: req.company.id 
      };
  
      const newClient = new Client(clientData);
      await newClient.save();
  
      validateAndUpdateClient(req.company.id, newClient._id, newClient.whatsapp);
  
      res.status(201).json(newClient);
    } catch (error) {
    res.status(500).json({ message: 'Erreur du serveur.', error: error.message });
  }
});

app.get('/api/clients', authMiddleware, async (req, res) => {
  try {
    const clients = await Client.find({ companyId: req.company.id }).sort({ numberStatus: 1, name: 1 });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: 'Erreur du serveur.', error: error.message });
  }
});

app.put('/api/clients/:id', authMiddleware, async (req, res) => {
    try {
        const { name, whatsapp, email, status } = req.body;
        const clientToUpdate = await Client.findOne({ _id: req.params.id, companyId: req.company.id });
        if (!clientToUpdate) {
            return res.status(404).json({ message: "Client non trouvé." });
        }

        let numberStatus = clientToUpdate.numberStatus;
        if (whatsapp !== clientToUpdate.whatsapp) {
            numberStatus = 'Pending';
        }

        const updatedClient = await Client.findByIdAndUpdate(
            req.params.id,
            { name, whatsapp, email, status, numberStatus },
            { new: true }
        );

        if (updatedClient.numberStatus === 'Pending') {
            validateAndUpdateClient(req.company.id, updatedClient._id, updatedClient.whatsapp);
        }

        res.json(updatedClient);
    } catch (error) {
        res.status(500).json({ message: 'Erreur du serveur.', error: error.message });
    }
});

app.delete('/api/clients/:id', authMiddleware, async (req, res) => {
    try {
        const deletedClient = await Client.findOneAndDelete({ _id: req.params.id, companyId: req.company.id });
        if (!deletedClient) { return res.status(404).json({ message: "Client non trouvé ou non autorisé." }); }
        res.json({ message: "Client supprimé avec succès." });
    } catch (error) {
        res.status(500).json({ message: 'Erreur du serveur.', error: error.message });
    }
});

// --- ROUTE DE DÉCLENCHEMENT DE VALIDATION (Rattrapage) ---
app.post('/api/clients/trigger-pending-validation', authMiddleware, async (req, res) => {
    // 💡 Nous appelons la logique de rattrapage sur TOUTES les entreprises pour corriger le problème
    // des clients mal associés, puis sur l'entreprise actuelle pour les cas normaux.
    res.status(202).json({ message: "Lancement du rattrapage pour toutes les entreprises." });

    // 1. Lancement du Cron Job (qui va balayer TOUTES les entreprises)
    await runCronValidationJob();

    // 2. Lancement spécifique pour l'entreprise actuelle (pour l'immédiateté)
    runValidationCatchup(req.company.id); 
});


// --- Routes des Sondages ---
app.post('/api/surveys', authMiddleware, async (req, res) => { 
    try { 
        const { title, questions } = req.body; 
        const newSurvey = new Survey({ title, questions, companyId: req.company.id }); 
        await newSurvey.save(); 
        res.status(201).json(newSurvey); 
    } catch (error) { 
        res.status(500).json({ message: 'Erreur du serveur', error: error.message }); 
    } 
});

app.get('/api/surveys', authMiddleware, async (req, res) => { 
    try { 
        const surveys = await Survey.find({ companyId: req.company.id }).select('-responses'); 
        res.json(surveys); 
    } catch (error) { 
        res.status(500).json({ message: 'Erreur du serveur', error: error.message }); 
    } 
});

app.get('/api/surveys/:id/results', authMiddleware, async (req, res) => {
    try {
        const survey = await Survey.findOne({ _id: req.params.id, companyId: req.company.id });
        if (!survey) return res.status(404).json({ message: "Sondage non trouvé."});
        const results = { _id: survey._id, title: survey.title, questions: survey.questions, responses: survey.responses, stats: {} };
        survey.questions.forEach((question, index) => {
            if (question.type === 'mcq') {
                const questionStats = {};
                question.options.forEach(option => { questionStats[option] = 0; });
                survey.responses.forEach(response => {
                    const answer = response.answers[index];
                    if (questionStats.hasOwnProperty(answer)) { questionStats[answer]++; }
                });
                results.stats[index] = questionStats;
            }
        });
        res.json(results);
    } catch (error) { res.status(500).json({ message: 'Erreur du serveur', error: error.message }); }
});

// --- Route de Communication ---
// --- Route de Communication ---
app.post('/api/communications/send', authMiddleware, async (req, res) => {
    try {
        const company = await Company.findById(req.company.id);
        if (!company) { return res.status(404).json({ message: "Entreprise non trouvée." }); }

        const { message, surveyId, channel, recipientType, status, clientIds } = req.body;

        let baseQuery = { companyId: req.company.id };
        if (channel === 'whatsapp') {
            baseQuery.numberStatus = 'Valid';
        }

        let recipients = [];
        if (recipientType === 'all') {
            recipients = await Client.find(baseQuery);
        } else if (recipientType === 'status') {
            baseQuery.status = status;
            recipients = await Client.find(baseQuery);
        } else if (recipientType === 'selection') {
            baseQuery._id = { $in: clientIds };
            recipients = await Client.find(baseQuery);
        }

        if (recipients.length === 0) {
            return res.status(400).json({ message: "Aucun destinataire valide trouvé pour cet envoi." });
        }

        let contentToSend = '';
        let useTemplate = false; // Indicateur pour savoir s'il faut utiliser le modèle Twilio

        if (message) {
            contentToSend = message;
        } else if (surveyId) {
            const survey = await Survey.findById(surveyId);
            if (!survey) return res.status(404).json({ message: `Sondage avec ID ${surveyId} non trouvé.` });
            const surveyUrl = `https://client-app-j02r.onrender.com/survey/${survey._id}`; 
            contentToSend = `Veuillez répondre à notre sondage "${survey.title}" en cliquant sur ce lien : ${surveyUrl}`;
            useTemplate = true; // Le sondage doit utiliser le modèle
        } else {
            return res.status(400).json({ message: "Veuillez fournir un 'message' ou un 'surveyId'." });
        }

        if (channel === 'email') {
            res.json({ success: true, message: `L'envoi par EMAIL a été démarré en arrière-plan pour ${recipients.length} client(s).` });
            sendEmailsInBackground(company, recipients, contentToSend);

        } else if (channel === 'whatsapp') {
            const sid = decrypt(company.twilioSid);
            const token = decrypt(company.twilioToken);
            const fromNumber = decrypt(company.twilioWhatsappNumber);
            if (!sid || !token || !fromNumber) return res.status(400).json({ message: "Veuillez configurer vos identifiants Twilio." });

            const twilioClient = twilio(sid, token);
            const templateSid = 'HXec8d194a315a6f200f9a9f5bf975b9b6'; 

            const whatsappPromises = recipients.map(recipient => {
                const messageConfig = {
                    from: `whatsapp:${fromNumber}`,
                    to: `whatsapp:${recipient.e164Format}`, 
                };

                if (useTemplate) {
                    // SONDAGE : Utilise le template pour l'envoi HORS fenêtre 24h
                    messageConfig.contentSid = templateSid;
                    messageConfig.contentVariables = JSON.stringify({
                        '1': contentToSend // <-- ENVOIE LA VARIABLE {1}
                    });
                } else {
                    // MESSAGE SIMPLE : Utilise le body (Fonctionne UNIQUEMENT DANS la fenêtre 24h)
                    messageConfig.body = contentToSend;
                }
                
                return twilioClient.messages.create(messageConfig);
            });

            const results = await Promise.allSettled(whatsappPromises);
            const sentCount = results.filter(r => r.status === 'fulfilled').length;
            const failedCount = results.filter(r => r.status === 'rejected').length;

            if (failedCount > 0) {
                 console.error(`[WhatsApp Send] Échec partiel : ${failedCount} messages échoués.`);
                 const firstError = results.find(r => r.status === 'rejected');
                 console.error(firstError.reason.message);
            }
            res.json({ success: true, message: `Communication WhatsApp envoyée. Succès: ${sentCount}, Échecs: ${failedCount}.` });
        }

    } catch (error) {
        console.error("ERREUR D'ENVOI:", error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Erreur du serveur lors de l\'envoi', error: error.message });
        }
    }
});
// --- Route pour les paramètres de l'entreprise ---
app.put('/api/company/settings', authMiddleware, async (req, res) => {
    try {
        const { emailAppPassword, twilioSid, twilioToken, twilioWhatsappNumber } = req.body;
        const updateData = {};
        if (emailAppPassword) updateData.emailAppPassword = encrypt(emailAppPassword);
        if (twilioSid) updateData.twilioSid = encrypt(twilioSid);
        if (twilioToken) updateData.twilioToken = encrypt(twilioToken);
        if (twilioWhatsappNumber) updateData.twilioWhatsappNumber = encrypt(twilioWhatsappNumber);

        await Company.findByIdAndUpdate(req.company.id, updateData);
        res.json({ message: "Paramètres mis à jour avec succès." });
    } catch (error) {
        res.status(500).json({ message: "Erreur du serveur.", error: error.message });
    }
});


// =================================================================
// 7. ROUTES PUBLIQUES POUR LES SONDAGES
// =================================================================
app.get('/api/public/surveys/:id', async (req, res) => {
    try {
        const survey = await Survey.findById(req.params.id).select('title questions');
        if (!survey) return res.status(404).json({ message: "Sondage non trouvé."});
        res.json(survey);
    } catch (error) {
        res.status(500).json({ message: 'Erreur du serveur.', error: error.message });
    }
});

app.post('/api/public/surveys/:id/responses', async (req, res) => {
    try {
        const { clientName, answers } = req.body;
        const survey = await Survey.findById(req.params.id);
        if (!survey) return res.status(404).json({ message: "Sondage non trouvé."});

        survey.responses.push({ clientName: clientName || 'Anonyme', answers });
        await survey.save();

        res.status(201).json({ message: "Merci d'avoir répondu au sondage !" });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de la soumission.", error: error.message });
    }
});


// =================================================================
// 8. TÂCHES AUTOMATISÉES (CRON JOBS)
// =================================================================

/**
 * Fonction balayant TOUTES les entreprises pour lancer le rattrapage.
 * (Utilisée par le Cron Job et par la route /trigger-pending-validation)
 */
const runCronValidationJob = async () => {
    console.log('[CRON JOB] Démarrage de la validation globale de TOUS les numéros "Pending".');
    try {
        const allCompanies = await Company.find({}).select('_id name');
        console.log(`[CRON JOB] ${allCompanies.length} entreprise(s) trouvée(s).`);

        for (const company of allCompanies) {
            console.log(`[CRON JOB] Lancement de la validation pour : ${company.name} (${company._id})`);
            // On lance le rattrapage pour l'ID de cette entreprise
            // (La fonction runValidationCatchup utilise le filtre companyId)
            runValidationCatchup(company._id);
        }
        console.log('[CRON JOB] Tâches de validation lancées pour toutes les entreprises.');
    } catch (error) {
        console.error('[CRON JOB] Erreur critique lors du lancement des tâches de validation:', error);
    }
};

// Tâche de validation des numéros 'Pending'
// S'exécute tous les jours à minuit (fuseau horaire de Cotonou)
cron.schedule('0 0 * * *', runCronValidationJob, {
  scheduled: true,
  timezone: "Africa/Porto-Novo" 
});


// =================================================================
// 9. DÉMARRAGE DU SERVEUR
// =================================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));