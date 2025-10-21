import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate, Link, NavLink, useLocation, useParams } from 'react-router-dom';
import { Form, Button, Container, Card, Alert, Navbar, Nav, Modal, ListGroup, Table, Row, Col, Spinner, InputGroup, Dropdown } from 'react-bootstrap';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

// --- NOUVELLES IMPORTATIONS ---
import { motion, AnimatePresence } from 'framer-motion';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  FaPlus, FaTrash, FaChartPie, FaUserPlus, FaWpforms, FaPaperPlane,
  FaCog, FaSignOutAlt, FaEye, FaEnvelope, FaLock, FaBuilding, FaWhatsapp, FaKey, FaSignature, FaQuestionCircle,
  FaUsers, FaTachometerAlt, FaEdit, FaBars, FaCheckCircle, FaSearch, FaListUl,
  FaTimesCircle
} from 'react-icons/fa';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);


// --- CONFIGURATION D'AXIOS ---
const api = axios.create({ baseURL: 'https://client-back-rxhc.onrender.com/api' });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) { config.headers.Authorization = `Bearer ${token}`; }
  return config;
});

// --- CONTEXTE D'AUTHENTIFICATION ---
const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
    const [companyName, setCompanyName] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const name = localStorage.getItem('companyName');
        if (name) setCompanyName(name);
    }, []);

    const login = (token, name) => {
        localStorage.setItem('token', token);
        localStorage.setItem('companyName', name);
        setCompanyName(name);
        toast.success(`Bienvenue, ${name} !`);
        navigate('/dashboard');
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('companyName');
        setCompanyName(null);
        toast.info("Vous avez été déconnecté.");
        navigate('/login');
    };

    return (
        <AuthContext.Provider value={{ companyName, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

const useAuth = () => useContext(AuthContext);


// --- VARIANTES D'ANIMATION (FRAMER MOTION) ---
const pageVariants = {
  initial: { opacity: 0, x: -50 },
  in: { opacity: 1, x: 0 },
  out: { opacity: 0, x: 50 }
};
const listVariants = {
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } },
  hidden: {}
};
const itemVariants = {
  visible: { y: 0, opacity: 1, transition: { y: { stiffness: 1000, velocity: -100 } } },
  hidden: { y: 50, opacity: 0, transition: { y: { stiffness: 1000 } } }
};
const cardVariants = {
    offscreen: { y: 50, opacity: 0 },
    onscreen: {
        y: 0,
        opacity: 1,
        transition: { type: "spring", bounce: 0.4, duration: 0.8 }
    }
};


// =================================================================
// --- COMPOSANTS DE L'APPLICATION ---
// =================================================================

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
};

// --- COMPOSANT : Inscription (Register) ---
// (Inchangé)
function Register() {
  const [formData, setFormData] = useState({ name: '', whatsapp: '', email: '', password: '', passwordConfirm: '', emailAppPassword: '', twilioSid: '', twilioToken: '', twilioWhatsappNumber: '' });
  const navigate = useNavigate();
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.passwordConfirm) {
        return toast.error("Les mots de passe ne correspondent pas.");
    }
    try {
      await api.post('/auth/register', formData);
      toast.success('Inscription réussie ! Vous allez être redirigé.');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Une erreur est survenue.');
    }
  };

  return (
    <motion.div initial="initial" animate="in" exit="out" variants={pageVariants}>
      <Card className="shadow-lg border-0" style={{ width: '650px', backdropFilter: 'blur(10px)', backgroundColor: 'rgba(255, 255, 255, 0.8)' }}>
        <Card.Body className="p-5">
          <div className="text-center mb-4">
              <FaBuilding size={40} className="text-primary mb-2" />
              <h2>Créer un Compte Entreprise</h2>
              <p className="text-muted">Rejoignez-nous pour une communication efficace.</p>
          </div>
          <Form onSubmit={handleSubmit}>
            <Row>
                <Col md={6}><InputGroup className="mb-3"><InputGroup.Text><FaBuilding /></InputGroup.Text><Form.Control type="text" name="name" placeholder="Nom de l'entreprise" onChange={handleChange} required /></InputGroup></Col>
                <Col md={6}><InputGroup className="mb-3"><InputGroup.Text><FaEnvelope /></InputGroup.Text><Form.Control type="email" name="email" placeholder="Email de connexion" onChange={handleChange} required /></InputGroup></Col>
            </Row>
            <Row>
                <Col md={6}><InputGroup className="mb-3"><InputGroup.Text><FaLock /></InputGroup.Text><Form.Control type="password" name="password" placeholder="Mot de passe" onChange={handleChange} required /></InputGroup></Col>
                <Col md={6}><InputGroup className="mb-3"><InputGroup.Text><FaLock /></InputGroup.Text><Form.Control type="password" name="passwordConfirm" placeholder="Confirmer le mot de passe" onChange={handleChange} required /></InputGroup></Col>
            </Row>
            <hr className="my-4"/>
            <div className="text-center"><h5 className="text-muted">Configuration des Envois (Optionnel)</h5></div>
            <InputGroup className="mb-3"><InputGroup.Text><FaKey /></InputGroup.Text><Form.Control type="password" name="emailAppPassword" placeholder="Mot de Passe d'Application Gmail" onChange={handleChange} /></InputGroup>
            <Row>
                <Col md={6}><InputGroup className="mb-3"><InputGroup.Text><FaSignature /></InputGroup.Text><Form.Control type="text" name="twilioSid" placeholder="Twilio Account SID" onChange={handleChange} /></InputGroup></Col>
                <Col md={6}><InputGroup className="mb-3"><InputGroup.Text><FaKey /></InputGroup.Text><Form.Control type="password" name="twilioToken" placeholder="Twilio Auth Token" onChange={handleChange} /></InputGroup></Col>
            </Row>
            <Row>
                  <Col md={6}><InputGroup className="mb-3"><InputGroup.Text><FaWhatsapp /></InputGroup.Text><Form.Control type="text" name="twilioWhatsappNumber" placeholder="Votre N° WhatsApp Twilio" onChange={handleChange} /></InputGroup></Col>
                  <Col md={6}><InputGroup className="mb-3"><InputGroup.Text><FaWhatsapp /></InputGroup.Text><Form.Control type="text" name="whatsapp" placeholder="Votre N° WhatsApp (Contact)" onChange={handleChange} required/></InputGroup></Col>
            </Row>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button className="w-100 mt-3" type="submit" variant="primary" size="lg">Créer le compte</Button>
            </motion.div>
            <div className="text-center mt-4">Déjà un compte ? <Link to="/login">Connectez-vous</Link></div>
          </Form>
        </Card.Body>
      </Card>
    </motion.div>
  );
}

// --- COMPOSANT : Connexion (Login) ---
// (Inchangé)
function Login() {
  const [formData, setFormData] = useState({ name: '', password: '' });
  const { login } = useAuth();
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/login', formData);
      login(data.token, data.companyName);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Identifiants incorrects.');
    }
  };
  return (
    <motion.div initial="initial" animate="in" exit="out" variants={pageVariants}>
      <Card className="shadow-lg border-0" style={{ width: '450px', backdropFilter: 'blur(10px)', backgroundColor: 'rgba(255, 255, 255, 0.8)' }}>
        <Card.Body className="p-5">
          <div className="text-center mb-4">
              <FaBuilding size={40} className="text-primary mb-2" />
              <h2>Connexion</h2>
              <p className="text-muted">Heureux de vous revoir.</p>
          </div>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
                <Form.Label>Nom de l'entreprise</Form.Label>
                <InputGroup><InputGroup.Text><FaBuilding /></InputGroup.Text><Form.Control type="text" name="name" onChange={handleChange} required /></InputGroup>
            </Form.Group>
            <Form.Group className="mb-3">
                <Form.Label>Mot de passe</Form.Label>
                <InputGroup><InputGroup.Text><FaLock /></InputGroup.Text><Form.Control type="password" name="password" onChange={handleChange} required /></InputGroup>
            </Form.Group>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button className="w-100" type="submit" size="lg">Se Connecter</Button>
            </motion.div>
            <div className="text-center mt-4">Pas de compte ? <Link to="/register">Inscrivez-vous</Link></div>
          </Form>
      </Card.Body></Card>
    </motion.div>
  );
}


// =================================================================
// --- MODALES DE L'APPLICATION ---
// =================================================================


// --- COMPOSANT : Modale de confirmation ---
// (Inchangé)
function ConfirmationModal({ show, handleClose, onConfirm, title, body }) {
    return (
        <Modal show={show} onHide={handleClose} centered>
            <Modal.Header closeButton>
                <Modal.Title>{title}</Modal.Title>
            </Modal.Header>
            <Modal.Body>{body}</Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose}>Annuler</Button>
                <Button variant="danger" onClick={onConfirm}>Confirmer</Button>
            </Modal.Footer>
        </Modal>
    );
}

// --- COMPOSANT : Modale d'ajout/édition de client ---
// (Inchangé)
function ClientModal({ show, handleClose, onClientSaved, clientToEdit }) {
    const [formData, setFormData] = useState({ name: '', whatsapp: '', email: '', status: 'Non Vérifié' });

    useEffect(() => {
        if (clientToEdit) {
            setFormData(clientToEdit);
        } else {
            setFormData({ name: '', whatsapp: '', email: '', status: 'Non Vérifié' });
        }
    }, [clientToEdit, show]);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            let response;
            if (clientToEdit) {
                response = await api.put(`/clients/${clientToEdit._id}`, formData);
                toast.success(`Client ${response.data.name} mis à jour !`);
            } else {
                response = await api.post('/clients', formData);
                toast.success(`Client ${response.data.name} ajouté !`);
            }
            onClientSaved(response.data);
            handleClose();
        } catch (error) { toast.error("Erreur lors de l'enregistrement du client."); }
    };

    return (
        <Modal show={show} onHide={handleClose} centered>
            <Modal.Header closeButton>
                <Modal.Title>
                    {clientToEdit ? <><FaEdit className="me-2"/>Modifier le Client</> : <><FaUserPlus className="me-2"/>Ajouter un Nouveau Client</>}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3"><Form.Label>Nom</Form.Label><Form.Control type="text" name="name" value={formData.name} onChange={handleChange} required /></Form.Group>
                    <Form.Group className="mb-3"><Form.Label>Email (Optionnel)</Form.Label><Form.Control type="email" name="email" value={formData.email} onChange={handleChange} /></Form.Group>
                    <Form.Group className="mb-3"><Form.Label>WhatsApp</Form.Label><Form.Control type="text" name="whatsapp" value={formData.whatsapp} placeholder="+22912345678" onChange={handleChange} required /></Form.Group>
                    <Form.Group className="mb-3"><Form.Label>Statut (Optionnel)</Form.Label><Form.Select name="status" value={formData.status} onChange={handleChange}><option>Non Vérifié</option><option>Vérifié</option></Form.Select></Form.Group>
                    <Button variant="primary" type="submit" className="w-100">{clientToEdit ? 'Mettre à jour' : 'Ajouter le client'}</Button>
                </Form>
            </Modal.Body>
        </Modal>
    );
}


// --- COMPOSANT : Modale de création de sondage ---
// (Inchangé)
function CreateSurveyModal({ show, handleClose, onSurveyCreated }) {
    const [title, setTitle] = useState('');
    const [questions, setQuestions] = useState([{ text: '', type: 'text', options: [] }]);

    const handleAddQuestion = () => setQuestions([...questions, { text: '', type: 'text', options: [] }]);
    const handleRemoveQuestion = (qIndex) => setQuestions(questions.filter((_, i) => i !== qIndex));

    const handleQuestionChange = (index, field, value) => {
        const newQuestions = [...questions];
        newQuestions[index][field] = value;
        if (field === 'type' && value === 'text') { newQuestions[index].options = []; }
        setQuestions(newQuestions);
    };

    const handleOptionChange = (qIndex, oIndex, value) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].options[oIndex] = value;
        setQuestions(newQuestions);
    };

    const handleAddOption = (qIndex) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].options.push('');
        setQuestions(newQuestions);
    };

    const handleRemoveOption = (qIndex, oIndex) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].options.splice(oIndex, 1);
        setQuestions(newQuestions);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { title, questions: questions.filter(q => q.text.trim() !== '').map(q => ({ ...q, options: q.options.filter(opt => opt.trim() !== '')}))};
            const { data } = await api.post('/surveys', payload);
            toast.success("Sondage créé avec succès !");
            onSurveyCreated(data);
            handleClose();
        } catch (error) { toast.error("Erreur lors de la création du sondage."); }
    };
    return (
    <Modal show={show} onHide={handleClose} size="lg" centered>
        <Modal.Header closeButton><Modal.Title><FaWpforms className="me-2"/>Créer un Nouveau Sondage</Modal.Title></Modal.Header>
        <Modal.Body>
        <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3"><Form.Label>Titre du sondage</Form.Label><Form.Control type="text" value={title} onChange={e => setTitle(e.target.value)} required /></Form.Group>
            <hr />
            {questions.map((q, qIndex) => (
                <Card key={qIndex} className="mb-3 p-3 bg-light border-0">
                    <Row className="align-items-center">
                        <Col>
                            <Form.Group><Form.Label><strong>Question {qIndex + 1}</strong></Form.Label><Form.Control type="text" value={q.text} onChange={e => handleQuestionChange(qIndex, 'text', e.target.value)} required /></Form.Group>
                        </Col>
                        <Col md={4}>
                             <Form.Group><Form.Label>Type</Form.Label><Form.Select value={q.type} onChange={e => handleQuestionChange(qIndex, 'type', e.target.value)}><option value="text">Texte Libre</option><option value="mcq">Choix Multiples</option></Form.Select></Form.Group>
                        </Col>
                        <Col md="auto"> <Button variant="outline-danger" size="sm" onClick={() => handleRemoveQuestion(qIndex)} className="mt-4"><FaTrash /></Button></Col>
                    </Row>
                    {q.type === 'mcq' && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 ps-3">
                            <Form.Label className="text-muted">Options de réponse</Form.Label>
                            {q.options.map((opt, oIndex) => (
                                <InputGroup className="mb-2" key={oIndex}>
                                    <Form.Control value={opt} onChange={e => handleOptionChange(qIndex, oIndex, e.target.value)} placeholder={`Option ${oIndex + 1}`} />
                                    <Button variant="outline-danger" onClick={() => handleRemoveOption(qIndex, oIndex)}><FaTrash /></Button>
                                </InputGroup>
                            ))}
                            <Button variant="outline-primary" size="sm" onClick={() => handleAddOption(qIndex)}><FaPlus /> Ajouter une option</Button>
                        </motion.div>
                    )}
                </Card>
            ))}
            <Button variant="secondary" onClick={handleAddQuestion} className="mt-2"><FaPlus /> Ajouter une question</Button>
            <hr /><Button variant="primary" type="submit" className="w-100">Créer le Sondage</Button>
        </Form>
        </Modal.Body>
    </Modal>
    );
}

// --- COMPOSANT : Modale d'envoi de communication ---
// (Inchangé)
function SendCommunicationModal({ show, handleClose, clients, surveys }) {
    const [channel, setChannel] = useState('email');
    const [contentType, setContentType] = useState('survey');
    const [message, setMessage] = useState('');
    const [surveyId, setSurveyId] = useState('');
    const [recipientType, setRecipientType] = useState('all');
    const [status, setStatus] = useState('Vérifié');
    const [selectedClients, setSelectedClients] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (surveys.length > 0) {
            setSurveyId(surveys[0]._id);
        }
        setSelectedClients([]);
    }, [surveys, show, channel]);

    const handleSelectClient = (clientId) => {
        setSelectedClients(prev => prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = { channel, recipientType };
        if (contentType === 'message') {
            if (!message) return toast.warn("Le message ne peut pas être vide.");
            payload.message = message;
        }
        if (contentType === 'survey') {
            if (!surveyId) return toast.warn("Veuillez sélectionner un sondage.");
            payload.surveyId = surveyId;
        }
        if (recipientType === 'status') payload.status = status;
        if (recipientType === 'selection') {
            if (selectedClients.length === 0) return toast.warn("Veuillez sélectionner au moins un client valide.");
            payload.clientIds = selectedClients;
        }
        try {
            const { data } = await api.post('/communications/send', payload);
            toast.info(data.message);
            handleClose();
        } catch (error) {
            toast.error(error.response?.data?.message || "Échec de l'envoi");
        }
    };

    const filteredClients = clients.filter(client =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isClientDisabled = (client) => {
        if (channel === 'email') return false;
        return client.numberStatus !== 'Valid';
    };

    const renderClientStatusIcon = (client) => {
        if (channel === 'email') return null;

        if (client.numberStatus === 'Valid') {
            return <FaCheckCircle className="text-success ms-2" title="Numéro valide"/>;
        }
        if (client.numberStatus === 'Invalid') {
            return <FaTimesCircle className="text-danger ms-2" title="Numéro invalide"/>;
        }
        if (client.numberStatus === 'Pending') {
            return <Spinner animation="border" size="sm" className="text-muted ms-2" title="Validation en cours..."/>;
        }
        return null;
    };

    return (
        <Modal show={show} onHide={handleClose} size="lg" centered>
            <Modal.Header closeButton>
                <Modal.Title><FaPaperPlane className="me-2" />Envoyer une Communication</Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-4">
                <Form onSubmit={handleSubmit}>
                    {/* Étape 1: Canal */}
                    <Card className="mb-4">
                        <Card.Header as="h5">Étape 1: Choisir le canal</Card.Header>
                        <Card.Body>
                            <Row>
                                <Col>
                                    <Card
                                        className={`text-center p-3 h-100 card-lift channel-card ${channel === 'email' ? 'selected' : ''}`}
                                        onClick={() => setChannel('email')}>
                                        <FaEnvelope size={30} className="mx-auto mb-2 text-primary"/>
                                        <h4>Email</h4>
                                        {channel === 'email' && <FaCheckCircle className="text-success checkmark-icon"/>}
                                    </Card>
                                </Col>
                                <Col>
                                    <Card
                                        className={`text-center p-3 h-100 card-lift channel-card ${channel === 'whatsapp' ? 'selected' : ''}`}
                                        onClick={() => setChannel('whatsapp')}>
                                        <FaWhatsapp size={30} className="mx-auto mb-2 text-success"/>
                                        <h4>WhatsApp</h4>
                                        {channel === 'whatsapp' && <FaCheckCircle className="text-success checkmark-icon"/>}
                                    </Card>
                                </Col>
                            </Row>
                        </Card.Body>
                    </Card>

                    {/* Étape 2: Contenu */}
                    <Card className="mb-4">
                        <Card.Header as="h5">Étape 2: Définir le contenu</Card.Header>
                        <Card.Body>
                             <Form.Group className="mb-3"><Form.Label>Type de Contenu</Form.Label><Form.Select value={contentType} onChange={e => setContentType(e.target.value)}><option value="survey">Sondage</option><option value="message">Message Simple</option></Form.Select></Form.Group>
                             {contentType === 'message' ? (<Form.Group><Form.Label>Votre Message</Form.Label><Form.Control as="textarea" rows={4} value={message} onChange={e => setMessage(e.target.value)} required /></Form.Group>) : (<Form.Group><Form.Label>Choisir le Sondage</Form.Label><Form.Select onChange={e => setSurveyId(e.target.value)} value={surveyId}>{surveys.map(s => <option key={s._id} value={s._id}>{s.title}</option>)}</Form.Select></Form.Group>)}
                        </Card.Body>
                    </Card>

                    {/* Étape 3: Destinataires */}
                    <Card className="mb-4">
                        <Card.Header as="h5">Étape 3: Choisir les destinataires</Card.Header>
                        <Card.Body>
                             <Form.Group className="mb-3"><Form.Label>Envoyer à</Form.Label><Form.Select value={recipientType} onChange={e => setRecipientType(e.target.value)}><option value="all">Tous les clients {channel === 'whatsapp' && '(N° valides)'}</option><option value="status">Par Statut {channel === 'whatsapp' && '(N° valides)'}</option><option value="selection">Sélectionner manuellement</option></Form.Select></Form.Group>
                             {recipientType === 'status' && (<Form.Group className="mb-3"><Form.Label>Statut du client</Form.Label><Form.Select value={status} onChange={e => setStatus(e.target.value)}><option>Vérifié</option><option>Non Vérifié</option></Form.Select></Form.Group>)}
                             {recipientType === 'selection' && (
                                <>
                                    <InputGroup className="mb-3">
                                        <InputGroup.Text><FaSearch /></InputGroup.Text>
                                        <Form.Control placeholder="Rechercher un client..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                    </InputGroup>
                                    <ListGroup style={{maxHeight: '200px', overflowY: 'auto'}}>
                                        {filteredClients.length > 0 ? filteredClients.map(client => (
                                            <ListGroup.Item key={client._id} disabled={isClientDisabled(client)}>
                                                <Form.Check
                                                    type="checkbox"
                                                    label={
                                                        <>
                                                          {client.name} ({channel === 'email' ? client.email : client.whatsapp})
                                                          {renderClientStatusIcon(client)}
                                                        </>
                                                    }
                                                    checked={selectedClients.includes(client._id)}
                                                    onChange={() => handleSelectClient(client._id)}
                                                    disabled={isClientDisabled(client)}
                                                />
                                            </ListGroup.Item>
                                        )) : <p className="text-muted text-center p-3">Aucun client trouvé.</p>}
                                    </ListGroup>
                                </>
                             )}
                        </Card.Body>
                    </Card>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button variant="primary" type="submit" className="w-100" size="lg">
                          <FaPaperPlane className="me-2" />
                          Envoyer la communication
                      </Button>
                    </motion.div>
                </Form>
            </Modal.Body>
        </Modal>
    );
}


// --- COMPOSANT : Modale des résultats de sondage ---
// (Inchangé)
function SurveyResultsModal({ show, handleClose, surveyId }) {
    const [surveyData, setSurveyData] = useState(null); const [loading, setLoading] = useState(false);
    useEffect(() => {
        if (surveyId) {
            setLoading(true);
            api.get(`/surveys/${surveyId}/results`).then(res => setSurveyData(res.data)).catch(err => toast.error("Erreur de chargement des résultats")).finally(() => setLoading(false));
        }
    }, [surveyId]);

    const renderChart = (questionIndex) => {
        const stats = surveyData?.stats?.[questionIndex];
        if (!stats) return null;
        const data = { labels: Object.keys(stats), datasets: [{ data: Object.values(stats), backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'], borderColor: '#fff', borderWidth: 2, }] };
        const options = { responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Répartition des réponses' } } };
        return questionIndex % 2 === 0 ? <Doughnut data={data} options={options} /> : <Bar data={data} options={options} />;
    };

    return (
    <Modal show={show} onHide={handleClose} size="xl" centered>
        <Modal.Header closeButton><Modal.Title><FaChartPie className="me-2"/>Résultats du Sondage : {surveyData?.title}</Modal.Title></Modal.Header>
        <Modal.Body>
            {loading && <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>}
            {!loading && surveyData && (
                <AnimatePresence>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <h4 className="text-center mb-4">Total de réponses : <span className="text-primary">{surveyData.responses.length}</span></h4>
                        {surveyData.questions.map((q, index) => (
                            <motion.div key={index} variants={cardVariants} initial="offscreen" whileInView="onscreen" viewport={{ once: true, amount: 0.5 }}>
                                <Card className="mb-4 shadow-sm">
                                    <Card.Header as="h5">Question {index + 1}: {q.text}</Card.Header>
                                    <Card.Body>
                                        {q.type === 'mcq' ? (
                                            <Row>
                                                <Col md={5} style={{maxHeight: '300px'}}>{renderChart(index)}</Col>
                                                <Col md={7}><h6>Toutes les réponses :</h6><ListGroup variant="flush" style={{maxHeight: '250px', overflowY: 'auto'}}>{surveyData.responses.map((resp, rIndex) => (<ListGroup.Item key={rIndex}><strong>{resp.clientName || 'Anonyme'} :</strong> {resp.answers[index]}</ListGroup.Item>))}</ListGroup></Col>
                                            </Row>
                                        ) : (
                                            <><h6>Réponses textuelles :</h6><ListGroup variant="flush" style={{maxHeight: '300px', overflowY: 'auto'}}>{surveyData.responses.map((resp, rIndex) => (<ListGroup.Item key={rIndex}><p className="mb-0"><strong>{resp.clientName || 'Anonyme'} a répondu :</strong></p><blockquote className="blockquote-footer mt-1 mb-0">{resp.answers[index]}</blockquote></ListGroup.Item>))}</ListGroup></>
                                        )}
                                    </Card.Body>
                                </Card>
                            </motion.div>
                        ))}
                    </motion.div>
                </AnimatePresence>
            )}
        </Modal.Body>
    </Modal>)
}

// =================================================================
// --- PAGES DE L'APPLICATION ---
// =================================================================


// --- MODIFIÉ --- Page: Gestion des clients ---
// --- MODIFIÉ --- Page: Gestion des clients ---
// --- MODIFIÉ --- Page: Gestion des clients ---
function Clients() {
    const [clients, setClients] = useState([]);
    const [surveys, setSurveys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showClientModal, setShowClientModal] = useState(false);
    const [showCommModal, setShowCommModal] = useState(false);
    const [clientToEdit, setClientToEdit] = useState(null);
    const [clientToDelete, setClientToDelete] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // --- CORRECTION FINALE : Fonction pour charger et déclencher la validation si nécessaire ---
    const fetchData = async () => {
        try {
            const [clientsRes, surveysRes] = await Promise.all([
                api.get('/clients'),
                api.get('/surveys')
            ]);
            
            const fetchedClients = clientsRes.data;
            setClients(fetchedClients);
            setSurveys(surveysRes.data);

            // Vérifier s'il reste des clients 'Pending'
            const hasPending = fetchedClients.some(c => c.numberStatus === 'Pending');
            if (hasPending) {
                console.log("Clients en attente détectés. Déclenchement de la validation globale...");
                
                // Appel de la route qui lance le balayage de toutes les entreprises dans le backend
                api.post('/clients/trigger-pending-validation').catch(err => {
                    console.error("Erreur lors du déclenchement de la validation:", err);
                });
            }

        } catch (error) {
            toast.error("Erreur de chargement des données.");
        } finally {
            setLoading(false);
        }
    };

    // CORRECTION FINALE : Charger les données et relancer la vérification toutes les 5 secondes 
    useEffect(() => {
        fetchData();

        // Rechargement toutes les 5 secondes pour voir les mises à jour de validation immédiates 
        const intervalId = setInterval(fetchData, 5000); 
        
        return () => clearInterval(intervalId);
    }, []);

    // --- CORRECTION FINALE : Mise à jour de l'état local après ajout/édition ---
    const handleClientSaved = (savedClient) => {
        setClients(prevClients => {
            const index = prevClients.findIndex(c => c._id === savedClient._id);
            if (index !== -1) {
                // Édition : Remplacer l'ancien client par le nouveau
                return prevClients.map((c, i) => i === index ? savedClient : c);
            } else {
                // Ajout : Ajouter le nouveau client à la liste
                return [savedClient, ...prevClients];
            }
        });
        
        // Relancer fetchData après un court délai pour assurer que la validation du nouveau client est lancée
        setTimeout(() => fetchData(), 500); 
        setClientToEdit(null);
    };

    // ... Reste du composant Clients (handleEditClick, handleDeleteClick, confirmDelete, etc.) ...
    // Le reste du code du composant (à partir de handleEditClick) reste le même que dans votre App.js actuel.

    const handleEditClick = (client) => {
        setClientToEdit(client);
        setShowClientModal(true);
    };
    // [etc... le reste du composant]
    const handleDeleteClick = (client) => {
        setClientToDelete(client);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!clientToDelete) return;
        try {
            await api.delete(`/clients/${clientToDelete._id}`);
            setClients(clients.filter(c => c._id !== clientToDelete._id));
            toast.success(`Client ${clientToDelete.name} supprimé.`);
            setShowDeleteModal(false);
            setClientToDelete(null);
        } catch (error) {
            toast.error("Erreur lors de la suppression.");
        }
    };

    const renderNumberStatusBadge = (status) => {
        switch (status) {
            case 'Valid':
                return <span className="badge bg-success">Valide</span>;
            case 'Invalid':
                return <span className="badge bg-danger">Invalide</span>;
            case 'Pending':
            default:
                return <span className="badge bg-secondary">En attente</span>;
        }
    };

    return (
        <motion.div initial="initial" animate="in" exit="out" variants={pageVariants}>
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                <h1><FaUsers className="me-2" /> Gestion des Clients</h1>
                <div className="d-flex gap-2">
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button variant="info" className="text-white" onClick={() => setShowCommModal(true)}>
                            <FaPaperPlane className="me-2" /> Envoyer une Communication
                        </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button variant="primary" onClick={() => { setClientToEdit(null); setShowClientModal(true); }}>
                            <FaUserPlus className="me-2" /> Ajouter un Client
                        </Button>
                    </motion.div>
                </div>
            </div>
            <motion.div variants={itemVariants}>
                <Card className="shadow-sm">
                    <Card.Body>
                        <Table responsive hover className="align-middle">
                            <thead className="table-light">
                                <tr>
                                    <th>Nom</th>
                                    <th>Email</th>
                                    <th>WhatsApp</th>
                                    <th>Statut N°</th>
                                    <th>Statut</th>
                                    <th className="text-center">Actions</th>
                                </tr>
                            </thead>
                            <motion.tbody initial="hidden" animate="visible" variants={listVariants}>
                                {loading ? (<tr><td colSpan="6" className="text-center p-5"><Spinner animation="border" /></td></tr>)
                                 : clients.length > 0 ? clients.map(client => (
                                    <motion.tr key={client._id} variants={itemVariants}>
                                        <td>{client.name}</td>
                                        <td>{client.email}</td>
                                        <td>{client.whatsapp}</td>
                                        <td>{renderNumberStatusBadge(client.numberStatus)}</td>
                                        <td><span className={`badge bg-${client.status === 'Vérifié' ? 'success' : 'warning'}`}>{client.status}</span></td>
                                        <td className="text-center">
                                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="btn btn-sm btn-outline-primary me-2" onClick={() => handleEditClick(client)}><FaEdit /></motion.button>
                                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteClick(client)}><FaTrash /></motion.button>
                                        </td>
                                    </motion.tr>
                                )) : (<tr><td colSpan="6" className="text-center p-4 text-muted">Aucun client.</td></tr>)}
                            </motion.tbody>
                        </Table>
                    </Card.Body>
                </Card>
            </motion.div>

            <ClientModal
                show={showClientModal}
                handleClose={() => setShowClientModal(false)}
                onClientSaved={handleClientSaved}
                clientToEdit={clientToEdit}
            />
            {clientToDelete && <ConfirmationModal
                show={showDeleteModal}
                handleClose={() => setShowDeleteModal(false)}
                onConfirm={confirmDelete}
                title="Confirmer la Suppression"
                body={`Êtes-vous sûr de vouloir supprimer le client "${clientToDelete.name}" ? Cette action est irréversible.`}
            />}
            <SendCommunicationModal
                show={showCommModal}
                handleClose={() => setShowCommModal(false)}
                clients={clients}
                surveys={surveys}
            />
        </motion.div>
    )
}

// --- Page: Gestion des Sondages ---
// (Inchangé)
function SurveysPage() {
    const [surveys, setSurveys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showSurveyModal, setShowSurveyModal] = useState(false);
    const [showResultsModal, setShowResultsModal] = useState(false);
    const [selectedSurveyId, setSelectedSurveyId] = useState(null);

    useEffect(() => {
        api.get('/surveys')
            .then(res => setSurveys(res.data))
            .catch(() => toast.error("Erreur de chargement des sondages."))
            .finally(() => setLoading(false));
    }, []);

    const viewSurveyResults = (surveyId) => {
        setSelectedSurveyId(surveyId);
        setShowResultsModal(true);
    };

    return (
        <motion.div initial="initial" animate="in" exit="out" variants={pageVariants}>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h1><FaWpforms className="me-2" /> Gestion des Sondages</h1>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button variant="success" onClick={() => setShowSurveyModal(true)}>
                        <FaPlus className="me-2" /> Créer un Sondage
                    </Button>
                </motion.div>
            </div>
             <motion.div variants={itemVariants}>
                <Card className="shadow-sm">
                    <Card.Body>
                        <Table responsive hover className="align-middle">
                            <thead className="table-light">
                                <tr><th>Titre</th><th className="text-center">Questions</th><th className="text-center">Actions</th></tr>
                            </thead>
                             <motion.tbody initial="hidden" animate="visible" variants={listVariants}>
                                {loading ? (<tr><td colSpan="3" className="text-center p-5"><Spinner animation="border" /></td></tr>)
                                 : surveys.length > 0 ? surveys.map(survey => (
                                    <motion.tr key={survey._id} variants={itemVariants}>
                                        <td>{survey.title}</td>
                                        <td className="text-center">{survey.questions.length}</td>
                                        <td className="text-center">
                                            <Button variant="outline-primary" size="sm" onClick={() => viewSurveyResults(survey._id)}>
                                                <FaEye className="me-1"/>Voir Résultats
                                            </Button>
                                        </td>
                                    </motion.tr>
                                )) : (<tr><td colSpan="3" className="text-center p-4 text-muted">Aucun sondage créé.</td></tr>)}
                            </motion.tbody>
                        </Table>
                    </Card.Body>
                </Card>
            </motion.div>
            <CreateSurveyModal show={showSurveyModal} handleClose={() => setShowSurveyModal(false)} onSurveyCreated={(newSurvey) => setSurveys(prev => [...prev, newSurvey])} />
            {showResultsModal && <SurveyResultsModal show={showResultsModal} handleClose={() => setShowResultsModal(false)} surveyId={selectedSurveyId} />}
        </motion.div>
    )
}

// --- COMPOSANT : Tableau de bord (Dashboard) ---
// (Inchangé)
function Dashboard() {
  const [stats, setStats] = useState({ clients: 0, surveys: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
        try {
            const [clientsRes, surveysRes] = await Promise.all([api.get('/clients'), api.get('/surveys')]);
            setStats({ clients: clientsRes.data.length, surveys: surveysRes.data.length });
        } catch (error) { toast.error("Erreur de chargement des données."); }
        finally { setLoading(false); }
    };
    fetchData();
  }, []);

  if (loading) {
      return <div className="d-flex justify-content-center align-items-center" style={{ height: '80vh' }}><Spinner animation="border" variant="primary" /></div>;
  }

  return (
    <motion.div initial="initial" animate="in" exit="out" variants={pageVariants}>
        <h1 className="mb-4"><FaTachometerAlt className="me-2" /> Tableau de Bord</h1>
        <motion.div initial="hidden" animate="visible" variants={listVariants}>
            <Row>
                {[ {title: "Clients", value: stats.clients, icon: FaUsers, link: "/clients"}, {title: "Sondages Créés", value: stats.surveys, icon: FaWpforms, link: "/surveys"} ].map((item, i) => (
                    <Col md={6} key={i} className="mb-4">
                        <motion.div variants={itemVariants}>
                            <Link to={item.link} className="text-decoration-none">
                                <Card className="text-center shadow-sm border-0 h-100 card-lift">
                                    <Card.Body className="d-flex flex-column justify-content-center p-4">
                                        <motion.div whileHover={{ scale: 1.2, rotate: 5 }}><item.icon size={40} className="text-primary mb-3 mx-auto"/></motion.div>
                                        <Card.Title className="h3">{item.title}</Card.Title>
                                        <Card.Text className="fs-1 fw-bold text-primary">{item.value}</Card.Text>
                                    </Card.Body>
                                </Card>
                            </Link>
                        </motion.div>
                    </Col>
                ))}
            </Row>
        </motion.div>
    </motion.div>
  );
}

// --- COMPOSANT : Page des paramètres ---
// (Inchangé)
function Settings() {
    const [formData, setFormData] = useState({ emailAppPassword: '', twilioSid: '', twilioToken: '', twilioWhatsappNumber: '' });
    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        const updatedSettings = Object.fromEntries(Object.entries(formData).filter(([_, value]) => value.trim() !== ''));
        if (Object.keys(updatedSettings).length === 0) { return toast.warn("Veuillez remplir au moins un champ à mettre à jour."); }
        try {
            const { data } = await api.put('/company/settings', updatedSettings);
            toast.success(data.message);
        } catch (err) { toast.error(err.response?.data?.message || "Erreur lors de la mise à jour."); }
    };

    return (
        <motion.div initial="initial" animate="in" exit="out" variants={pageVariants}>
            <h1 className="mb-4"><FaCog className="me-2" /> Paramètres</h1>
            <Row className="justify-content-center">
                <Col md={10} lg={8}>
                    <motion.div variants={itemVariants}>
                        <Card className="shadow-sm">
                            <Card.Body className="p-4 p-md-5">
                                <div className="text-center mb-4">
                                    <h2>Paramètres d'Envoi</h2>
                                    <p className="text-muted">Mettez à jour vos clés d'API ici. Vos informations actuelles sont chiffrées et ne sont jamais affichées.</p>
                                </div>
                                <Form onSubmit={handleSubmit}>
                                    <Form.Group className="mb-3"><Form.Label>Nouveau Mot de Passe d'Application Gmail</Form.Label><Form.Control type="password" name="emailAppPassword" placeholder="Laisser vide pour ne pas changer" onChange={handleChange} /></Form.Group>
                                    <Row>
                                        <Col md={6}><Form.Group className="mb-3"><Form.Label>Nouveau Twilio Account SID</Form.Label><Form.Control type="text" name="twilioSid" placeholder="Laisser vide pour ne pas changer" onChange={handleChange} /></Form.Group></Col>
                                        <Col md={6}><Form.Group className="mb-3"><Form.Label>Nouveau Twilio Auth Token</Form.Label><Form.Control type="password" name="twilioToken" placeholder="Laisser vide pour ne pas changer" onChange={handleChange} /></Form.Group></Col>
                                    </Row>
                                    <Form.Group className="mb-3"><Form.Label>Nouveau Numéro WhatsApp Twilio</Form.Label><Form.Control type="text" name="twilioWhatsappNumber" placeholder="Laisser vide pour ne pas changer" onChange={handleChange} /></Form.Group>
                                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                      <Button type="submit" variant="primary" className="w-100 mt-2">Mettre à jour les Paramètres</Button>
                                    </motion.div>
                                </Form>
                            </Card.Body>
                        </Card>
                    </motion.div>
                </Col>
            </Row>
        </motion.div>
    );
}

// --- COMPOSANT : Page publique de sondage ---
// (Inchangé)
function PublicSurvey() {
    const { surveyId } = useParams();
    const [survey, setSurvey] = useState(null);
    const [answers, setAnswers] = useState([]);
    const [clientName, setClientName] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        const fetchSurvey = async () => {
            try {
                const { data } = await axios.get(`https://client-back-rxhc.onrender.com/api/public/surveys/${surveyId}`);
                setSurvey(data);
                setAnswers(new Array(data.questions.length).fill(''));
            } catch (err) { setError("Sondage introuvable ou erreur de chargement."); }
            finally { setLoading(false); }
        };
        fetchSurvey();
    }, [surveyId]);

    const handleAnswerChange = (index, value) => {
        const newAnswers = [...answers];
        newAnswers[index] = value;
        setAnswers(newAnswers);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`https://client-back-rxhc.onrender.com/api/public/surveys/${surveyId}/responses`, { clientName, answers });
            setSubmitted(true);
        } catch (err) { toast.error("Erreur lors de l'envoi de vos réponses."); }
    };

    if (loading) return <Container className="text-center mt-5 vh-100 d-flex align-items-center justify-content-center"><Spinner animation="border" variant="primary" style={{width: '3rem', height: '3rem'}} /></Container>;

    if (error) return <Container className="mt-5"><Alert variant="danger">{error}</Alert></Container>;

    if (submitted) return (
      <Container className="d-flex align-items-center justify-content-center vh-100">
        <Card className="shadow-lg border-0 text-center p-5">
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
                <h2 className="text-success">Merci !</h2>
                <p className="lead">Vos réponses ont été enregistrées avec succès.</p>
            </motion.div>
        </Card>
      </Container>
    );

    return (
        <motion.div initial="initial" animate="in" exit="out" variants={pageVariants}>
        <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: "100vh", padding: "40px 0" }}>
            <Card className="shadow-lg border-0" style={{ width: '700px', backdropFilter: 'blur(10px)', backgroundColor: 'rgba(255, 255, 255, 0.85)' }}>
                <Card.Body className="p-5">
                    <div className="text-center mb-4">
                        <FaQuestionCircle size={40} className="text-primary mb-2"/>
                        <h2>{survey?.title}</h2>
                        <p className="text-muted">Merci de prendre un moment pour répondre.</p>
                    </div>
                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3"><Form.Label>Votre nom (Optionnel)</Form.Label><Form.Control type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Ex: Jean Dupont"/></Form.Group>
                        <hr/>
                        {survey?.questions.map((q, index) => (
                            <Form.Group key={index} className="mb-4">
                                <Form.Label><strong>Question {index + 1}:</strong> {q.text}</Form.Label>
                                {q.type === 'text' ? ( <Form.Control as="textarea" rows={2} value={answers[index]} onChange={(e) => handleAnswerChange(index, e.target.value)} required />)
                                : (
                                    <div className="mt-2">{q.options.map((option, oIndex) => ( <Form.Check type="radio" key={oIndex} id={`q${index}-o${oIndex}`} label={option} name={`question-${index}`} value={option} onChange={(e) => handleAnswerChange(index, e.target.value)} required /> ))}</div>
                                )}
                            </Form.Group>
                        ))}
                        <Button type="submit" className="w-100 mt-2" size="lg">Envoyer mes réponses</Button>
                    </Form>
                </Card.Body>
            </Card>
        </Container>
        </motion.div>
    );
}

// =================================================================
// --- COMPOSANTS DE LAYOUT ---
// =================================================================

// --- COMPOSANT : Sidebar ---
// (Inchangé)
const Sidebar = ({ isSidebarOpen }) => {
    const { companyName } = useAuth();
    const navItems = [
        { path: "/dashboard", icon: FaTachometerAlt, label: "Dashboard" },
        { path: "/clients", icon: FaUsers, label: "Clients" },
        { path: "/surveys", icon: FaWpforms, label: "Sondages" },
        { path: "/settings", icon: FaCog, label: "Paramètres" },
    ];
    return (
        <motion.div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
                <FaBuilding className="me-2"/>
                <h3 className="fs-5 mb-0">{companyName || "Mon App"}</h3>
            </div>
            <Nav className="flex-column">
                {navItems.map(item => (
                    <motion.div key={item.path} whileHover={{ x: 5 }} whileTap={{ scale: 0.95 }}>
                         <Nav.Link as={NavLink} to={item.path} className="nav-link-custom">
                            <item.icon className="me-3" /><span>{item.label}</span>
                         </Nav.Link>
                    </motion.div>
                ))}
            </Nav>
        </motion.div>
    );
}

// --- COMPOSANT : AppHeader ---
// (Inchangé)
const AppHeader = ({ toggleSidebar }) => {
    const { companyName, logout } = useAuth();
    return (
        <Navbar bg="light" expand="lg" className="shadow-sm app-header">
            <Container fluid>
                <Button variant="outline-secondary" onClick={toggleSidebar} className="me-2 d-lg-none">
                    <FaBars />
                </Button>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="ms-auto align-items-center">
                        <Dropdown align="end">
                            <Dropdown.Toggle as={Nav.Link} className="p-0">
                                Bienvenue, <strong>{companyName}</strong>
                            </Dropdown.Toggle>
                            <Dropdown.Menu>
                                <Dropdown.Item as={Link} to="/settings"><FaCog className="me-2" />Paramètres</Dropdown.Item>
                                <Dropdown.Divider />
                                <Dropdown.Item onClick={logout} className="text-danger"><FaSignOutAlt className="me-2" />Déconnexion</Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
};

// --- LAYOUTS ---
// (Inchangés)
const AuthLayout = ({ children }) => (
    <Container fluid className="d-flex align-items-center justify-content-center auth-container">
        <AnimatePresence mode="wait">
            {children}
        </AnimatePresence>
    </Container>
);

const DashboardLayout = () => {
    const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 992);
    const location = useLocation();

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 992) {
                setSidebarOpen(false);
            } else {
                setSidebarOpen(true);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if(window.innerWidth < 992) setSidebarOpen(false);
    }, [location]);

    const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

    return (
        <div className="dashboard-layout">
            <Sidebar isSidebarOpen={isSidebarOpen} />
            <div className="main-content">
                <AppHeader toggleSidebar={toggleSidebar} />
                <main className="content-fluid p-4">
                    <AnimatePresence mode="wait">
                         <Routes location={location} key={location.pathname}>
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/clients" element={<Clients />} />
                            <Route path="/surveys" element={<SurveysPage />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="*" element={<Navigate to="/dashboard" replace />} />
                        </Routes>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
};


// =================================================================
// --- COMPOSANT PRINCIPAL ET ROUTAGE ---
// =================================================================
function App() {
  return (
    <>
    <style type="text/css">{`
        /* (CSS Inchangé) */
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
        :root {
            --primary-color: #0d6efd;
            --sidebar-bg: #111827;
            --sidebar-text: #adb5bd;
            --sidebar-text-hover: #ffffff;
            --content-bg: #F9FAFB;
        }
        body {
            background-color: var(--content-bg);
            font-family: 'Inter', sans-serif;
            overflow-x: hidden;
        }
        .card { border-radius: 15px; border: none; }
        .form-control, .form-select { border-radius: 8px; }
        .btn { border-radius: 8px; font-weight: 500; transition: all 0.2s ease-in-out; }
        .modal-content { border-radius: 15px; }
        .Toastify__toast { border-radius: 12px; }
        .auth-container {
            min-height: 100vh;
            background-color: #f4f7f6;
            background-image: linear-gradient(to top, #dfe9f3 0%, white 100%);
        }
        .dashboard-layout { display: flex; min-height: 100vh; }
        .sidebar {
            width: 260px;
            flex-shrink: 0;
            background-color: var(--sidebar-bg);
            color: var(--sidebar-text);
            padding: 1rem;
            transition: margin-left 0.3s ease-in-out;
            display: flex;
            flex-direction: column;
        }
        .sidebar-header {
            padding: 1rem;
            text-align: center;
            color: white;
            border-bottom: 1px solid #374151;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .nav-link-custom {
            color: var(--sidebar-text);
            padding: 0.8rem 1rem;
            border-radius: 8px;
            display: flex;
            align-items: center;
            margin-bottom: 0.5rem;
            font-weight: 500;
        }
        .nav-link-custom:hover, .nav-link-custom.active {
            background-color: #374151;
            color: var(--sidebar-text-hover);
        }
        .main-content {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            transition: margin-left 0.3s ease-in-out;
            overflow-x: hidden;
        }
        .app-header { background-color: #ffffff !important; }
        .card-lift { transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out; }
        .card-lift:hover {
            transform: translateY(-5px);
            box-shadow: 0 0.5rem 1rem rgba(0,0,0,.15)!important;
        }
        .table {
          --bs-table-hover-bg: #f8f9fa;
        }
        .align-middle {
          vertical-align: middle;
        }
        .channel-card {
            cursor: pointer;
            position: relative;
        }
        .channel-card.selected {
            border-color: var(--primary-color);
            box-shadow: 0 0 0 2px var(--primary-color);
        }
        .checkmark-icon {
            position: absolute;
            top: 10px;
            right: 10px;
        }
        .list-group-item.disabled, .list-group-item:disabled {
            background-color: #f8f9fa;
            color: #adb5bd;
            cursor: not-allowed;
        }

        @media (max-width: 991.98px) {
            .sidebar {
                position: fixed;
                left: 0;
                top: 0;
                height: 100%;
                z-index: 1050;
                margin-left: -260px;
            }
            .sidebar.open {
                margin-left: 0;
            }
            .main-content {
                margin-left: 0 !important;
                width: 100%;
            }
        }
    `}</style>
    <Router>
        <AuthProvider>
            <Routes>
                <Route path="/survey/:surveyId" element={<PublicSurvey />} />
                <Route path="/login" element={<AuthLayout><Login /></AuthLayout>} />
                <Route path="/register" element={<AuthLayout><Register /></AuthLayout>} />
                <Route path="/*" element={<PrivateRoute><DashboardLayout /></PrivateRoute>} />
            </Routes>
        </AuthProvider>
    </Router>
    <ToastContainer position="bottom-right" autoClose={4000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="colored" />
    </>
  );
}

export default App;