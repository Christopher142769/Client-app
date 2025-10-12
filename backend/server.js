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
});
const Client = mongoose.model('Client', ClientSchema);

// --- MODIFICATION MAJEURE : Schéma de sondage amélioré ---
const SurveySchema = new mongoose.Schema({
  title: { type: String, required: true },
  questions: [{
    text: { type: String, required: true },
    type: { type: String, enum: ['text', 'mcq'], required: true, default: 'text' },
    options: [{ type: String }] // Options pour les questions de type 'mcq'
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
// 5. ROUTES DE L'API
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
    res.json({ token });
  } catch (error) { res.status(500).json({ message: 'Erreur du serveur.', error: error.message }); }
});

// --- Routes des Clients ---
app.post('/api/clients', authMiddleware, async (req, res) => { try { const { name, whatsapp, email, status } = req.body; const newClient = new Client({ name, whatsapp, email, status, companyId: req.company.id }); await newClient.save(); res.status(201).json(newClient); } catch (error) { res.status(500).json({ message: 'Erreur du serveur.', error: error.message }); } });
app.get('/api/clients', authMiddleware, async (req, res) => { try { const clients = await Client.find({ companyId: req.company.id }); res.json(clients); } catch (error) { res.status(500).json({ message: 'Erreur du serveur.', error: error.message }); } });

// --- Routes des Sondages ---
app.post('/api/surveys', authMiddleware, async (req, res) => { try { const { title, questions } = req.body; const newSurvey = new Survey({ title, questions, companyId: req.company.id }); await newSurvey.save(); res.status(201).json(newSurvey); } catch (error) { res.status(500).json({ message: 'Erreur du serveur', error: error.message }); } });
app.get('/api/surveys', authMiddleware, async (req, res) => { try { const surveys = await Survey.find({ companyId: req.company.id }).select('-responses'); res.json(surveys); } catch (error) { res.status(500).json({ message: 'Erreur du serveur', error: error.message }); } });

// --- MODIFICATION MAJEURE : Route des résultats avec calcul des statistiques ---
app.get('/api/surveys/:id/results', authMiddleware, async (req, res) => {
    try {
        const survey = await Survey.findOne({ _id: req.params.id, companyId: req.company.id });
        if (!survey) return res.status(404).json({ message: "Sondage non trouvé."});

        const results = {
            _id: survey._id,
            title: survey.title,
            questions: survey.questions,
            responses: survey.responses,
            stats: {} // Nouvel objet pour les statistiques
        };

        // On calcule les statistiques pour chaque question de type 'mcq'
        survey.questions.forEach((question, index) => {
            if (question.type === 'mcq') {
                const questionStats = {};
                // Initialise un compteur pour chaque option de la question
                question.options.forEach(option => { questionStats[option] = 0; });

                // On parcourt toutes les réponses au sondage
                survey.responses.forEach(response => {
                    const answer = response.answers[index];
                    // Si la réponse correspond à une option valide, on incrémente
                    if (questionStats.hasOwnProperty(answer)) {
                        questionStats[answer]++;
                    }
                });
                results.stats[index] = questionStats;
            }
        });

        res.json(results);
    } catch (error) {
        res.status(500).json({ message: 'Erreur du serveur', error: error.message });
    }
});

// --- Route d'envoi de communication ---
app.post('/api/communications/send', authMiddleware, async (req, res) => {
    try {
        const company = await Company.findById(req.company.id);
        if (!company) { return res.status(404).json({ message: "Entreprise non trouvée." }); }
        const { message, surveyId, channel, recipientType, status, clientIds } = req.body;
        let recipients = [];
        if (recipientType === 'all') { recipients = await Client.find({ companyId: req.company.id }); }
        else if (recipientType === 'status') { recipients = await Client.find({ companyId: req.company.id, status }); }
        else if (recipientType === 'selection') { recipients = await Client.find({ _id: { $in: clientIds }, companyId: req.company.id }); }
        if (recipients.length === 0) { return res.status(400).json({ message: "Aucun destinataire trouvé." }); }
        
        let contentToSend = '';
        if (message) { 
            contentToSend = message; 
        } else if (surveyId) { 
            const survey = await Survey.findById(surveyId);
            contentToSend = `Bonjour, veuillez répondre à notre sondage "${survey.title}" ici: http://localhost:3000/survey/${survey._id}`; 
        }

        if (channel === 'email') {
            const appPassword = decrypt(company.emailAppPassword);
            if (!appPassword) return res.status(400).json({ message: "Veuillez configurer votre mot de passe d'application Gmail." });
            const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: company.email, pass: appPassword }});
            const emailPromises = recipients.map(r => transporter.sendMail({ from: `"${company.name}" <${company.email}>`, to: r.email, subject: `Message de ${company.name}`, text: contentToSend }));
            await Promise.all(emailPromises);
        } else if (channel === 'whatsapp') {
            const sid = decrypt(company.twilioSid);
            const token = decrypt(company.twilioToken);
            const fromNumber = decrypt(company.twilioWhatsappNumber);
            if (!sid || !token || !fromNumber) return res.status(400).json({ message: "Veuillez configurer vos identifiants Twilio." });
            const twilioClient = twilio(sid, token);
            const whatsappPromises = recipients.map(r => twilioClient.messages.create({ from: fromNumber, to: `whatsapp:${r.whatsapp}`, body: contentToSend }));
            await Promise.all(whatsappPromises);
        }
        res.json({ success: true, message: `Communication envoyée via ${channel.toUpperCase()} à ${recipients.length} client(s).` });
    } catch (error) {
        console.error("ERREUR D'ENVOI:", error);
        res.status(500).json({ message: 'Erreur du serveur lors de l\'envoi', error: error.message });
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
// 6. ROUTES PUBLIQUES POUR LES SONDAGES
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
// 7. DÉMARRAGE DU SERVEUR
// =================================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
