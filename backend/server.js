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
  numberStatus: {
    type: String,
    enum: ['Pending', 'Valid', 'Invalid'],
    default: 'Pending'
  },
  e164Format: { type: String },
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
// 5. FONCTIONS HELPERS (Logique Métier)
// =================================================================

const getNumberValidation = async (twilioClient, phoneNumber) => {
  try {
    // Tentative de normalisation simple avant l'appel API
    let normalizedNumber = phoneNumber.replace(/[^0-9+]/g, ''); // Garde chiffres et +
    if (!normalizedNumber.startsWith('+')) {
        // Hypothèse simple : si pas de +, c'est peut-être un numéro local (Bénin?)
        // ATTENTION: Ceci est une simplification, idéalement il faudrait connaître le pays.
         if (normalizedNumber.length === 8) { // Longueur typique Bénin sans indicatif
            normalizedNumber = '+229' + normalizedNumber;
         } else {
             // Si format inconnu, on laisse Twilio essayer de deviner
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
        console.warn(`[Validation Job] Pas de SID/Token Twilio pour ${companyId}, validation annulée pour ${clientId}`);
        // On marque comme invalide si on ne peut pas vérifier
        await Client.findByIdAndUpdate(clientId, { numberStatus: 'Invalid', e164Format: null });
        return;
    }

    const twilioClient = twilio(sid, token);
    const validation = await getNumberValidation(twilioClient, phoneNumber);

    await Client.findByIdAndUpdate(clientId, {
      numberStatus: validation.status,
      e164Format: validation.e164Format
    });

    console.log(`[Validation Job] Client ${clientId} | Statut: ${validation.status}`);
  } catch (error) {
    console.error(`[Validation Job CRITICAL FAIL] pour client ${clientId}: ${error.message}`);
     // Marquer comme Invalide en cas d'erreur critique
    try { await Client.findByIdAndUpdate(clientId, { numberStatus: 'Invalid', e164Format: null }); } catch (updateError) {}
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

/**
 * MODIFIÉ : Tâche de fond pour valider TOUS les clients "En attente" d'une entreprise.
 */
const triggerPendingValidation = async (companyId) => {
  // Flag pour éviter les exécutions parallèles
  if (global.isValidationRunning && global.isValidationRunning[companyId]) {
      console.log(`[Validation Job] Le rattrapage est déjà en cours pour ${companyId}.`);
      return;
  }
  if (!global.isValidationRunning) global.isValidationRunning = {};
  global.isValidationRunning[companyId] = true;

  console.log(`[Validation Job] DÉMARRAGE TÂCHE pour ${companyId}. Recherche des clients 'Pending'...`); // Log 1

  try {
    const pendingClients = await Client.find({ companyId: companyId, numberStatus: 'Pending' });

    console.log(`[Validation Job] Trouvé ${pendingClients.length} clients 'Pending' pour ${companyId}.`); // Log 2

    if (pendingClients.length === 0) {
      global.isValidationRunning[companyId] = false;
      return;
    }

    console.log(`[Validation Job] Démarrage de la boucle de validation...`); // Log 3

    for (const client of pendingClients) {
      // Re-vérifier au cas où un autre processus l'aurait validé entre temps
      // Utilisation de findById pour être sûr
      const currentClientState = await Client.findById(client._id).select('numberStatus whatsapp');

      // Log pour voir ce qu'on trouve avant de valider
      console.log(`[Validation Job] Traitement client ${client._id}. Statut actuel: ${currentClientState?.numberStatus}. Numéro: ${client.whatsapp}`); // Log 4

      if (currentClientState && currentClientState.numberStatus === 'Pending') {
          await validateAndUpdateClient(companyId, client._id, client.whatsapp);
          // Pause de 0.5s pour ne pas surcharger l'API Twilio
          await new Promise(resolve => setTimeout(resolve, 500));
      } else {
          console.log(`[Validation Job] Client ${client._id} n'est plus 'Pending', ignoré.`); // Log 5
      }
    }

    console.log(`[Validation Job] Validation de rattrapage terminée pour ${companyId}.`); // Log 6

  } catch (error) {
    console.error(`[Validation Job CRITICAL FAIL] Échec du rattrapage pour ${companyId}: ${error.message}`);
  } finally {
      // S'assurer de toujours libérer le flag
      if (global.isValidationRunning) global.isValidationRunning[companyId] = false;
      console.log(`[Validation Job] Flag libéré pour ${companyId}.`); // Log 7
  }
};


// =================================================================
// 6. ROUTES DE L'API
// =================================================================

// --- Routes d'Authentification ---
app.post('/api/auth/register', async (req, res) => { /* ... Inchangé ... */ });
app.post('/api/auth/login', async (req, res) => { /* ... Inchangé ... */ });


// --- Routes des Clients ---
app.post('/api/clients', authMiddleware, async (req, res) => { /* ... Inchangé ... */ });
app.get('/api/clients', authMiddleware, async (req, res) => { /* ... Inchangé ... */ });
app.put('/api/clients/:id', authMiddleware, async (req, res) => { /* ... Inchangé ... */ });
app.delete('/api/clients/:id', authMiddleware, async (req, res) => { /* ... Inchangé ... */ });

// --- NOUVELLE ROUTE : Déclencher la validation des "Pending" ---
app.post('/api/clients/trigger-pending-validation', authMiddleware, async (req, res) => {
    // On répond immédiatement pour ne pas bloquer le frontend
    res.status(202).json({ message: "Demande de validation des clients en attente reçue." });

    // On lance la tâche de fond (sans await)
    triggerPendingValidation(req.company.id);
});


// --- Routes des Sondages ---
app.post('/api/surveys', authMiddleware, async (req, res) => { /* ... Inchangé ... */ });
app.get('/api/surveys', authMiddleware, async (req, res) => { /* ... Inchangé ... */ });
app.get('/api/surveys/:id/results', authMiddleware, async (req, res) => { /* ... Inchangé ... */ });

// --- Route de Communication ---
app.post('/api/communications/send', authMiddleware, async (req, res) => { /* ... Inchangé ... */ });

// --- Route pour les paramètres de l'entreprise ---
app.put('/api/company/settings', authMiddleware, async (req, res) => { /* ... Inchangé ... */ });


// =================================================================
// 7. ROUTES PUBLIQUES POUR LES SONDAGES
// =================================================================
app.get('/api/public/surveys/:id', async (req, res) => { /* ... Inchangé ... */ });
app.post('/api/public/surveys/:id/responses', async (req, res) => { /* ... Inchangé ... */ });


// =================================================================
// 8. DÉMARRAGE DU SERVEUR
// =================================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));


// --- Copier/Coller les routes inchangées depuis la version précédente ---
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


app.post('/api/clients', authMiddleware, async (req, res) => {
  try {
    const { name, whatsapp, email, status } = req.body;
    const newClient = new Client({ name, whatsapp, email, status, companyId: req.company.id });
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
            // C'est le SID de "copy_notification_service" qui est approuvé
            const templateSid = 'HXec8d194a315a6f200f9a9f5bf975b9b6';

            const whatsappPromises = recipients.map(recipient => twilioClient.messages.create({
                from: `whatsapp:${fromNumber}`,
                to: `whatsapp:${recipient.e164Format}`, // On utilise le numéro E.164 validé
                contentSid: templateSid,
                contentVariables: JSON.stringify({
                    '1': contentToSend
                })
            }));

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