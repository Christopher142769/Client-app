import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate, Link, useParams } from 'react-router-dom';
import { Form, Button, Container, Card, Alert, Navbar, Nav, Modal, ListGroup, Table, Row, Col, Spinner, InputGroup } from 'react-bootstrap';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

// --- NOUVELLES IMPORTATIONS ---
import { motion, AnimatePresence } from 'framer-motion';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  FaPlus, FaTrash, FaChartPie, FaUserPlus, FaWpforms, FaPaperPlane,
  FaCog, FaSignOutAlt, FaEye, FaEnvelope, FaLock, FaBuilding, FaWhatsapp, FaKey, FaSignature, FaQuestionCircle
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

// --- VARIANTES D'ANIMATION (FRAMER MOTION) ---
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -20 }
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
  return token ? children : <Navigate to="/login" />;
};

// --- COMPOSANT : Inscription (Register) ---
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
      toast.success('Inscription réussie ! Vous allez être redirigé vers la page de connexion.');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Une erreur est survenue.');
    }
  };

  return (
    <motion.div initial="initial" animate="in" exit="out" variants={pageVariants}>
      <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: "100vh", padding: "40px 0"}}>
        <Card className="shadow-lg border-0" style={{ width: '650px', backdropFilter: 'blur(10px)', backgroundColor: 'rgba(255, 255, 255, 0.8)' }}>
          <Card.Body className="p-5">
            <div className="text-center mb-4">
                <FaBuilding size={40} className="text-primary mb-2" />
                <h2>Créer un Compte Entreprise</h2>
                <p className="text-muted">Rejoignez-nous et commencez à communiquer efficacement.</p>
            </div>
            <Form onSubmit={handleSubmit}>
              {/* Infos principales */}
              <Row>
                  <Col md={6}><InputGroup className="mb-3"><InputGroup.Text><FaBuilding /></InputGroup.Text><Form.Control type="text" name="name" placeholder="Nom de l'entreprise" onChange={handleChange} required /></InputGroup></Col>
                  <Col md={6}><InputGroup className="mb-3"><InputGroup.Text><FaEnvelope /></InputGroup.Text><Form.Control type="email" name="email" placeholder="Email de connexion" onChange={handleChange} required /></InputGroup></Col>
              </Row>
              <Row>
                  <Col md={6}><InputGroup className="mb-3"><InputGroup.Text><FaLock /></InputGroup.Text><Form.Control type="password" name="password" placeholder="Mot de passe" onChange={handleChange} required /></InputGroup></Col>
                  <Col md={6}><InputGroup className="mb-3"><InputGroup.Text><FaLock /></InputGroup.Text><Form.Control type="password" name="passwordConfirm" placeholder="Confirmer le mot de passe" onChange={handleChange} required /></InputGroup></Col>
              </Row>
              <hr className="my-4"/>
              {/* Configuration optionnelle */}
              <div className="text-center">
                  <h5 className="text-muted">Configuration des Envois (Optionnel)</h5>
                  <p className="text-muted small">Renseignez ces clés pour activer l'envoi d'emails et de messages WhatsApp.</p>
              </div>
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
      </Container>
    </motion.div>
  );
}

// --- COMPOSANT : Connexion (Login) ---
function Login() {
  const [formData, setFormData] = useState({ name: '', password: '' });
  const navigate = useNavigate();
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/login', formData);
      localStorage.setItem('token', data.token);
      toast.success(`Bienvenue, ${formData.name} !`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Identifiants incorrects.');
    }
  };
  return (
    <motion.div initial="initial" animate="in" exit="out" variants={pageVariants}>
        <Container className="d-flex align-items-center justify-content-center vh-100">
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
        </Container>
    </motion.div>
  );
}

// --- COMPOSANT : Modale d'ajout de client ---
function AddClientModal({ show, handleClose, onClientAdded }) {
    const [formData, setFormData] = useState({ name: '', whatsapp: '', email: '', status: 'Non Vérifié' });
    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const { data } = await api.post('/clients', formData);
            toast.success(`Client ${data.name} ajouté !`);
            onClientAdded(data);
            handleClose();
        } catch (error) { toast.error("Erreur lors de l'ajout du client."); console.error("Erreur ajout client", error); }
    };
    return (<Modal show={show} onHide={handleClose} centered><Modal.Header closeButton><Modal.Title><FaUserPlus className="me-2"/>Ajouter un Nouveau Client</Modal.Title></Modal.Header><Modal.Body><Form onSubmit={handleSubmit}><Form.Group className="mb-3"><Form.Label>Nom</Form.Label><Form.Control type="text" name="name" onChange={handleChange} required /></Form.Group><Form.Group className="mb-3"><Form.Label>Email</Form.Label><Form.Control type="email" name="email" onChange={handleChange} required /></Form.Group><Form.Group className="mb-3"><Form.Label>WhatsApp</Form.Label><Form.Control type="text" name="whatsapp" placeholder="+22912345678" onChange={handleChange} required /></Form.Group><Form.Group className="mb-3"><Form.Label>Statut</Form.Label><Form.Select name="status" onChange={handleChange}><option>Non Vérifié</option><option>Vérifié</option></Form.Select></Form.Group><Button variant="primary" type="submit" className="w-100">Ajouter le client</Button></Form></Modal.Body></Modal>);
}

// --- COMPOSANT : Modale de création de sondage ---
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
function SendCommunicationModal({ show, handleClose, clients, surveys }) {
    const [contentType, setContentType] = useState('message'); const [message, setMessage] = useState(''); const [surveyId, setSurveyId] = useState(''); const [channel, setChannel] = useState('whatsapp'); const [recipientType, setRecipientType] = useState('all'); const [status, setStatus] = useState('Vérifié'); const [selectedClients, setSelectedClients] = useState([]);
    useEffect(() => { if(surveys.length > 0) setSurveyId(surveys[0]._id); }, [surveys]);
    const handleSelectClient = (clientId) => { setSelectedClients(prev => prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]); };
    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = { channel, recipientType };
        if (contentType === 'message') payload.message = message;
        if (contentType === 'survey') payload.surveyId = surveyId;
        if (recipientType === 'status') payload.status = status;
        if (recipientType === 'selection') payload.clientIds = selectedClients;
        try {
            const { data } = await api.post('/communications/send', payload);
            toast.info(data.message); handleClose();
        } catch (error) { toast.error(error.response?.data?.message || "Échec de l'envoi"); }
    };
    return (
    <Modal show={show} onHide={handleClose} size="lg" centered>
        <Modal.Header closeButton><Modal.Title><FaPaperPlane className="me-2"/>Envoyer une Communication</Modal.Title></Modal.Header>
        <Modal.Body>
            <Form onSubmit={handleSubmit}>
                <Row>
                    <Col md={6}><Form.Group className="mb-3"><Form.Label>Type de Contenu</Form.Label><Form.Select onChange={e => setContentType(e.target.value)}><option value="message">Message Simple</option><option value="survey">Sondage</option></Form.Select></Form.Group></Col>
                    <Col md={6}><Form.Group className="mb-3"><Form.Label>Canal d'envoi</Form.Label><Form.Select onChange={e => setChannel(e.target.value)}><option value="whatsapp">WhatsApp</option><option value="email">Email</option></Form.Select></Form.Group></Col>
                </Row>
                {contentType === 'message' ? (<Form.Group className="mb-3"><Form.Label>Votre Message</Form.Label><Form.Control as="textarea" rows={4} value={message} onChange={e => setMessage(e.target.value)} required /></Form.Group>) : (<Form.Group className="mb-3"><Form.Label>Choisir le Sondage</Form.Label><Form.Select onChange={e => setSurveyId(e.target.value)} value={surveyId}>{surveys.map(s => <option key={s._id} value={s._id}>{s.title}</option>)}</Form.Select></Form.Group>)}
                <hr/>
                <Form.Group className="mb-3"><Form.Label>Destinataires</Form.Label><Form.Select onChange={e => setRecipientType(e.target.value)}><option value="all">Tous les clients</option><option value="status">Par Statut</option><option value="selection">Sélectionner manuellement</option></Form.Select></Form.Group>
                {recipientType === 'status' && (<Form.Group className="mb-3"><Form.Label>Choisir le statut</Form.Label><Form.Select onChange={e => setStatus(e.target.value)}><option>Vérifié</option><option>Non Vérifié</option></Form.Select></Form.Group>)}
                {recipientType === 'selection' && (<Form.Group className="mb-3" style={{maxHeight: '200px', overflowY: 'auto', border:'1px solid #dee2e6', borderRadius: '.25rem', padding: '10px'}}><Form.Label>Sélectionner les clients</Form.Label>{clients.map(client => ( <Form.Check type="checkbox" key={client._id} label={`${client.name} (${channel === 'email' ? client.email : client.whatsapp})`} onChange={() => handleSelectClient(client._id)} /> ))}</Form.Group>)}
                <Button variant="primary" type="submit" className="w-100">Envoyer</Button>
            </Form>
        </Modal.Body>
    </Modal>);
}

// --- COMPOSANT : Modale des résultats de sondage ---
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

// --- COMPOSANT : Page des paramètres ---
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
        <>
            <AppNavbar />
            <motion.div initial="initial" animate="in" exit="out" variants={pageVariants}>
            <Container className="mt-5"><Row className="justify-content-center"><Col md={8}>
            <Card className="shadow-lg border-0">
                <Card.Body className="p-5">
                    <div className="text-center mb-4">
                        <FaCog size={40} className="text-primary mb-2"/>
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
                        <Button type="submit" variant="primary" className="w-100">Mettre à jour les Paramètres</Button>
                    </Form>
                </Card.Body>
            </Card>
            </Col></Row></Container>
            </motion.div>
        </>
    );
}

// --- COMPOSANT : Tableau de bord (Dashboard) ---
function Dashboard() {
  const [clients, setClients] = useState([]); const [surveys, setSurveys] = useState([]);
  const [showClientModal, setShowClientModal] = useState(false); const [showSurveyModal, setShowSurveyModal] = useState(false); const [showCommunicationModal, setShowCommunicationModal] = useState(false); const [showResultsModal, setShowResultsModal] = useState(false); const [selectedSurveyId, setSelectedSurveyId] = useState(null);
  
  useEffect(() => {
    const fetchData = async () => {
        try {
            const [clientsRes, surveysRes] = await Promise.all([api.get('/clients'), api.get('/surveys')]);
            setClients(clientsRes.data); setSurveys(surveysRes.data);
        } catch (error) { toast.error("Erreur de chargement des données."); }
    };
    fetchData();
  }, []);

  const viewSurveyResults = (surveyId) => { setSelectedSurveyId(surveyId); setShowResultsModal(true); };

  return (
    <>
      <AppNavbar />
      <motion.div initial="initial" animate="in" exit="out" variants={pageVariants}>
      <Container fluid className="p-4">
        {/* Cartes de statistiques */}
        <Row className="mb-4">
            {[ {title: "Clients", value: clients.length, icon: FaUserPlus}, {title: "Sondages Créés", value: surveys.length, icon: FaWpforms} ].map((item, i) => (
                <Col md={6} key={i}>
                    <motion.div variants={cardVariants} initial="offscreen" whileInView="onscreen" viewport={{ once: true, amount: 0.5 }}>
                        <Card className="text-center shadow-sm border-0 h-100">
                            <Card.Body className="d-flex flex-column justify-content-center">
                                <item.icon size={30} className="text-primary mb-2 mx-auto"/>
                                <Card.Title>{item.title}</Card.Title>
                                <Card.Text className="fs-1 fw-bold text-primary">{item.value}</Card.Text>
                            </Card.Body>
                        </Card>
                    </motion.div>
                </Col>
            ))}
        </Row>
        {/* Boutons d'action */}
        <motion.div variants={cardVariants} initial="offscreen" whileInView="onscreen" viewport={{ once: true, amount: 0.5 }}>
            <Card className="shadow-sm border-0 mb-4">
                <Card.Body className="text-center">
                    <Button variant="primary" size="lg" onClick={() => setShowClientModal(true)} className="m-2"><FaUserPlus className="me-2"/> Ajouter Client</Button>
                    <Button variant="success" size="lg" onClick={() => setShowSurveyModal(true)} className="m-2"><FaWpforms className="me-2"/>Créer Sondage</Button>
                    <Button variant="info" size="lg" onClick={() => setShowCommunicationModal(true)} className="m-2 text-white"><FaPaperPlane className="me-2"/>Envoyer Communication</Button>
                </Card.Body>
            </Card>
        </motion.div>
        
        <Row>
            {/* Table des clients */}
            <Col xl={12} className="mb-4">
                <motion.div variants={cardVariants} initial="offscreen" whileInView="onscreen" viewport={{ once: true, amount: 0.5 }}>
                <Card className="shadow-sm border-0"><Card.Header as="h4">Vos Clients</Card.Header><Card.Body><Table striped bordered hover responsive><thead align="center"><tr><th>Nom</th><th>Email</th><th>WhatsApp</th><th>Statut</th></tr></thead><tbody>{clients.length > 0 ? clients.map(client => (<tr key={client._id}><td>{client.name}</td><td>{client.email}</td><td>{client.whatsapp}</td><td><span className={`badge bg-${client.status === 'Vérifié' ? 'success' : 'warning'}`}>{client.status}</span></td></tr>)) : <tr><td colSpan="4" className="text-center p-4 text-muted">Aucun client ajouté pour le moment.</td></tr>}</tbody></Table></Card.Body></Card>
                </motion.div>
            </Col>
            {/* Table des sondages */}
            <Col xl={12}>
                <motion.div variants={cardVariants} initial="offscreen" whileInView="onscreen" viewport={{ once: true, amount: 0.5 }}>
                <Card className="shadow-sm border-0"><Card.Header as="h4">Vos Sondages</Card.Header><Card.Body><Table striped bordered hover responsive><thead align="center"><tr><th>Titre</th><th>Questions</th><th>Actions</th></tr></thead><tbody>{surveys.length > 0 ? surveys.map(survey => (<tr key={survey._id}><td>{survey.title}</td><td className="text-center">{survey.questions.length}</td><td className="text-center"><Button variant="outline-primary" size="sm" onClick={() => viewSurveyResults(survey._id)}><FaEye className="me-1"/>Voir Résultats</Button></td></tr>)) : <tr><td colSpan="3" className="text-center p-4 text-muted">Aucun sondage créé.</td></tr>}</tbody></Table></Card.Body></Card>
                </motion.div>
            </Col>
        </Row>
      </Container>
      </motion.div>
      <AddClientModal show={showClientModal} handleClose={() => setShowClientModal(false)} onClientAdded={(newClient) => setClients(prev => [...prev, newClient])} />
      <CreateSurveyModal show={showSurveyModal} handleClose={() => setShowSurveyModal(false)} onSurveyCreated={(newSurvey) => setSurveys(prev => [...prev, newSurvey])} />
      {showCommunicationModal && <SendCommunicationModal show={showCommunicationModal} handleClose={() => setShowCommunicationModal(false)} clients={clients} surveys={surveys}/>}
      {showResultsModal && <SurveyResultsModal show={showResultsModal} handleClose={() => setShowResultsModal(false)} surveyId={selectedSurveyId} />}
    </>
  );
}

// --- COMPOSANT : Page publique de sondage ---
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

// --- COMPOSANT : Barre de navigation principale ---
const AppNavbar = () => {
    const [companyName, setCompanyName] = useState('');
    const navigate = useNavigate();
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) { setCompanyName(jwtDecode(token).name); }
    }, []);
    const handleLogout = () => {
        localStorage.removeItem('token');
        toast.info("Vous avez été déconnecté.");
        navigate('/login');
    };

    return (
        <Navbar bg="dark" variant="dark" expand="lg" sticky="top" className="shadow-sm">
            <Container fluid>
                <Navbar.Brand as={Link} to="/dashboard" className="fw-bold">{companyName}</Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="me-auto">
                        <Nav.Link as={Link} to="/settings"><FaCog className="me-1"/>Paramètres</Nav.Link>
                    </Nav>
                    <Button variant="outline-danger" onClick={handleLogout}><FaSignOutAlt className="me-1"/>Déconnexion</Button>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
}


// =================================================================
// --- COMPOSANT PRINCIPAL ET ROUTAGE ---
// =================================================================
function App() {
  return (
    <>
    <style type="text/css">{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
        body {
            background-color: #f4f7f6;
            background-image: linear-gradient(to top, #dfe9f3 0%, white 100%);
            font-family: 'Inter', sans-serif;
        }
        .card { border-radius: 15px; }
        .form-control, .form-select { border-radius: 8px; }
        .btn { border-radius: 8px; font-weight: 500; }
        .modal-content { border-radius: 15px; }
        .Toastify__toast { border-radius: 12px; }
    `}</style>
    <Router>
      <ToastContainer position="bottom-right" autoClose={4000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="colored" />
      <AnimatePresence mode="wait">
        <Routes>
            <Route path="/survey/:surveyId" element={<PublicSurvey />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </AnimatePresence>
    </Router>
    </>
  );
}

export default App;