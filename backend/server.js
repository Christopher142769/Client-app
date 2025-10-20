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
  email: { type: String, required: true },
  status: { type: String, enum: ['Vérifié', 'Non Vérifié'], required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  // --- NOUVEAUX CHAMPS POUR LA VALIDATION WHATSAPP ---
  numberStatus: { 
    type: String, 
    enum: ['Pending', 'Valid', 'Invalid'], 
    default: 'Pending' 
  },
  e164Format: { type: String }, // Pour stocker le format E.164 validé
});
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
// 5. NOUVELLES FONCTIONS HELPERS
// =================================================================

/**
 * Valide un numéro de téléphone en utilisant l'API Twilio Lookup v1.
 * Renvoie le statut et le format E.164.
 */
const getNumberValidation = async (twilioClient, phoneNumber) => {
  try {
    const phoneData = await twilioClient.lookups.v1.phoneNumbers(phoneNumber).fetch();
    return { status: 'Valid', e164Format: phoneData.phoneNumber };
  } catch (error) {
    // Le code 20404 signifie "Not Found", c'est-à-dire numéro invalide
    console.warn(`[Lookup Failed] Numéro ${phoneNumber}: ${error.message}`);
    return { status: 'Invalid', e164Format: null };
  }
};

/**
 * Tâche de fond pour valider le numéro d'un client et mettre à jour la BDD.
 */
const validateAndUpdateClient = async (companyId, clientId, phoneNumber) => {
  try {
    const company = await Company.findById(companyId);
    if (!company) return; // L'entreprise n'existe pas

    const sid = decrypt(company.twilioSid);
    const token = decrypt(company.twilioToken);
    if (!sid || !token) return; // Pas d'identifiants Twilio, on ne peut pas valider

    const twilioClient = twilio(sid, token);
    const validation = await getNumberValidation(twilioClient, phoneNumber);
    
    // Mettre à jour le client dans la BDD avec le nouveau statut
    await Client.findByIdAndUpdate(clientId, {
      numberStatus: validation.status,
      e164Format: validation.e164Format
    });

    console.log(`[Validation Job] Client ${clientId} | Numéro ${phoneNumber} | Statut: ${validation.status}`);
  } catch (error) {
    console.error(`[Validation Job CRITICAL FAIL] pour client ${clientId}: ${error.message}`);
  }
};


/**
 * Envoie des emails en arrière-plan sans bloquer la requête HTTP.
 */
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
// 6. ROUTES DE L'API (MISES À JOUR)
// =================================================================

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
  } catch (error) { res.status(500).json({ message: 'Erreur du serveur.', error: error.message }); }
});

// --- Routes des Clients (MODIFIÉES) ---
app.post('/api/clients', authMiddleware, async (req, res) => { 
  try { 
    const { name, whatsapp, email, status } = req.body; 
    const newClient = new Client({ name, whatsapp, email, status, companyId: req.company.id }); 
    await newClient.save(); 
    
    // --- NOUVEAU : Démarrer la validation en arrière-plan ---
    // (On n'attend pas "await" pour répondre immédiatement)
    validateAndUpdateClient(req.company.id, newClient._id, newClient.whatsapp);

    res.status(201).json(newClient); 
  } catch (error) { 
    res.status(500).json({ message: 'Erreur du serveur.', error: error.message }); 
  } 
});

app.get('/api/clients', authMiddleware, async (req, res) => { 
  try { 
    // On trie pour voir les "Pending" et "Invalid" en premier
    const clients = await Client.find({ companyId: req.company.id }).sort({ numberStatus: 1, name: 1 }); 
    res.json(clients); 
  } catch (error) { 
    res.status(500).json({ message: 'Erreur du serveur.', error: error.message }); 
  } 
});

app.put('/api/clients/:id', authMiddleware, async (req, res) => {
    try {
        const { name, whatsapp, email, status } = req.body;
        
        // --- NOUVEAU : Réinitialiser le statut si le numéro change ---
        const clientToUpdate = await Client.findOne({ _id: req.params.id, companyId: req.company.id });
        if (!clientToUpdate) {
            return res.status(404).json({ message: "Client non trouvé." });
        }
        
        let numberStatus = clientToUpdate.numberStatus;
        if (whatsapp !== clientToUpdate.whatsapp) {
            numberStatus = 'Pending'; // Le numéro a changé, il faut revalider
        }

        const updatedClient = await Client.findByIdAndUpdate(
            req.params.id,
            { name, whatsapp, email, status, numberStatus }, // On met à jour le statut
            { new: true } 
        );

        if (!updatedClient) {
            return res.status(404).json({ message: "Client non trouvé ou non autorisé." });
        }

        // --- NOUVEAU : Démarrer la validation si elle est "Pending" ---
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
    } catch (error) { res.status(500).json({ message: 'Erreur du serveur.', error: error.message }); }
});

// --- Routes des Sondages ---
// (Inchangées)
app.post('/api/surveys', authMiddleware, async (req, res) => { try { const { title, questions } = req.body; const newSurvey = new Survey({ title, questions, companyId: req.company.id }); await newSurvey.save(); res.status(201).json(newSurvey); } catch (error) { res.status(500).json({ message: 'Erreur du serveur', error: error.message }); } });
app.get('/api/surveys', authMiddleware, async (req, res) => { try { const surveys = await Survey.find({ companyId: req.company.id }).select('-responses'); res.json(surveys); } catch (error) { res.status(500).json({ message: 'Erreur du serveur', error: error.message }); } });
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

// =================================================================
// --- ROUTE DE COMMUNICATION (MODIFIÉE) ---
// =================================================================
app.post('/api/communications/send', authMiddleware, async (req, res) => {
    try {
        const company = await Company.findById(req.company.id);
        if (!company) { return res.status(404).json({ message: "Entreprise non trouvée." }); }
        
        const { message, surveyId, channel, recipientType, status, clientIds } = req.body;
        
        // --- MODIFIÉ : Ajout du filtre de validation de numéro ---
        let baseQuery = { companyId: req.company.id };
        
        // Si c'est un envoi WhatsApp, on AJOUTE la condition que le numéro doit être valide
        if (channel === 'whatsapp') {
            baseQuery.numberStatus = 'Valid';
        }

        let recipients = [];
        if (recipientType === 'all') { 
            recipients = await Client.find(baseQuery); 
        } else if (recipientType === 'status') { 
            baseQuery.status = status; // Ajoute le statut au filtre
            recipients = await Client.find(baseQuery); 
        } else if (recipientType === 'selection') { 
            baseQuery._id = { $in: clientIds }; // Ajoute la sélection au filtre
            recipients = await Client.find(baseQuery); 
        }
        // --- FIN DE LA MODIFICATION ---
        
        if (recipients.length === 0) { 
            return res.status(400).json({ message: "Aucun destinataire valide trouvé pour cet envoi." }); 
        }
        
        let contentToSend = '';
        if (message) {
            contentToSend = message;
        } else if (surveyId) {
            const survey = await Survey.findById(surveyId);
            if (!survey) return res.status(404).json({ message: `Sondage avec ID ${surveyId} non trouvé.` });
            const surveyUrl = `https://client-app-j02r.onrender.com/survey/${survey._id}`;
            contentToSend = `Veuillez répondre à notre sondage "${survey.title}" en cliquant sur ce lien : ${surveyUrl}`;
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

            // C'est le SID de "copy_notification_service" qui est "Under Review"
            const templateSid = 'HXec8d194a315a6f200f9a9f5bf975b9b6'; // Mettez votre SID approuvé ici

            const whatsappPromises = recipients.map(recipient => twilioClient.messages.create({
                from: `whatsapp:${fromNumber}`,
                // --- MODIFIÉ : Utilisation du numéro E.164 validé ---
                to: `whatsapp:${recipient.e164Format}`, 
                contentSid: templateSid,
                contentVariables: JSON.stringify({
                    '1': contentToSend 
                })
            }));

            // Nous utilisons Promise.allSettled pour ne pas échouer si un seul numéro plante
            const results = await Promise.allSettled(whatsappPromises);

            const sentCount = results.filter(r => r.status === 'fulfilled').length;
            const failedCount = results.filter(r => r.status === 'rejected').length;

            if (failedCount > 0) {
                 console.error(`[WhatsApp Send] Échec partiel : ${failedCount} messages échoués.`);
                 // On peut logger la première erreur pour le debug
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
// (Inchangée)
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
// (Inchangées)
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
// 8. DÉMARRAGE DU SERVEUR
// =================================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));