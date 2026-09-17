const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Chemins des données avec gestion automatique du mode Serverless (Vercel)
const isVercel = Boolean(process.env.VERCEL);
let DATA_DIR = path.join(__dirname, 'data');

// Sur Vercel, le disque local est en lecture seule sauf dans /tmp
if (isVercel) {
  DATA_DIR = path.join('/tmp', 'data');
}

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.warn('Impossible de créer DATA_DIR localement, repli sur /tmp:', err.message);
    DATA_DIR = path.join('/tmp', 'data');
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

const QUESTIONS_FILE = path.join(DATA_DIR, 'questions.json');
const ANSWERS_FILE = path.join(DATA_DIR, 'answers.json');

// Si on est sur Vercel (/tmp) et que le fichier questions.json n'existe pas encore dans /tmp,
// on copie la version d'origine fournie dans le projet
if (isVercel) {
  const originalQuestions = path.join(__dirname, 'data', 'questions.json');
  if (fs.existsSync(originalQuestions) && !fs.existsSync(QUESTIONS_FILE)) {
    try {
      fs.copyFileSync(originalQuestions, QUESTIONS_FILE);
    } catch (e) {
      console.error('Erreur copie questions vers /tmp:', e);
    }
  }
}

// Helpers de persistance
function readJSON(filePath, defaultValue = []) {
  try {
    if (!fs.existsSync(filePath)) {
      // Si c'est le fichier questions et qu'on est sur Vercel, regarder dans le dossier source
      if (filePath.includes('questions.json')) {
        const fallbackSource = path.join(__dirname, 'data', 'questions.json');
        if (fs.existsSync(fallbackSource)) {
          return JSON.parse(fs.readFileSync(fallbackSource, 'utf-8') || '[]');
        }
      }
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8');
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error(`Erreur lecture ${filePath}:`, err);
    return defaultValue;
  }
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Erreur écriture ${filePath}:`, err);
    return false;
  }
}

// Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: 'champignon_secret_key_ultra_secure_2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
      httpOnly: true,
      sameSite: 'lax'
    }
  })
);

const crypto = require('crypto');
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'champignon_ultra_secret_key_2026';

function generateAdminToken() {
  const payload = `admin_${Date.now()}`;
  const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  if (signature !== expectedSignature) return false;
  const time = parseInt(payload.replace('admin_', ''), 10);
  // Expiration 14 jours
  if (isNaN(time) || Date.now() - time > 14 * 24 * 60 * 60 * 1000) return false;
  return true;
}

function extractAdminToken(req) {
  if (req.query && req.query.token) {
    return req.query.token.trim();
  }
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    return auth.substring(7).trim();
  }
  if (req.headers['x-admin-token']) {
    return req.headers['x-admin-token'].trim();
  }
  if (req.headers.cookie) {
    const match = req.headers.cookie.match(/admin_token=([^;]+)/);
    if (match) return match[1].trim();
  }
  return null;
}

// Middleware d'authentification admin compatible Serverless
function requireAdmin(req, res, next) {
  const token = extractAdminToken(req);
  if (token && verifyAdminToken(token)) {
    return next();
  }
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ error: 'Non autorisé. Veuillez vous connecter.' });
}

// ==========================================
// ROUTES PUBLIQUES (QUESTIONNAIRE)
// ==========================================

// Obtenir la liste des questions ordonnées
app.get('/api/questions', (req, res) => {
  const questions = readJSON(QUESTIONS_FILE);
  questions.sort((a, b) => (a.order || 0) - (b.order || 0));
  res.json(questions);
});

// Soumettre une réponse anonyme
app.post('/api/submit', (req, res) => {
  const { answers } = req.body;
  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'Réponses invalides.' });
  }

  // Filtrer les réponses vides ou d'espaces
  const sanitizedAnswers = {};
  let answeredCount = 0;
  for (const [qId, ans] of Object.entries(answers)) {
    if (typeof ans === 'string' && ans.trim() !== '') {
      sanitizedAnswers[qId] = ans.trim();
      answeredCount++;
    }
  }

  if (answeredCount === 0) {
    return res.status(400).json({ error: 'Veuillez répondre à au moins une question avant d\'envoyer.' });
  }

  const submissions = readJSON(ANSWERS_FILE);
  const now = new Date();
  
  const newSubmission = {
    id: 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    submissionNumber: submissions.length + 1,
    createdAt: now.toISOString(),
    formattedDate: now.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    answeredCount,
    answers: sanitizedAnswers
  };

  submissions.unshift(newSubmission); // Plus récent en premier
  writeJSON(ANSWERS_FILE, submissions);

  res.json({
    success: true,
    message: 'Réponses anonymes enregistrées avec succès !',
    submissionId: newSubmission.id,
    submissionNumber: newSubmission.submissionNumber
  });
});

// ==========================================
// ROUTES ADMIN - AUTHENTIFICATION
// ==========================================

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  // Identifiants demandés : admin / 1234
  if (username === 'admin' && password === '1234') {
    if (req.session) req.session.isAdmin = true;
    const token = generateAdminToken();
    res.setHeader('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=1209600`);
    return res.json({
      success: true,
      token,
      message: 'Connexion réussie.'
    });
  }
  return res.status(401).json({ error: 'Pseudo ou mot de passe incorrect.' });
});

app.post('/api/admin/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(() => {});
  }
  res.setHeader('Set-Cookie', `admin_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.json({ success: true, message: 'Déconnexion effectuée.' });
});

app.get('/api/admin/status', (req, res) => {
  const token = extractAdminToken(req);
  const authenticated = (token && verifyAdminToken(token)) || !!(req.session && req.session.isAdmin);
  res.json({ authenticated });
});

// ==========================================
// ROUTES ADMIN - GESTION DES QUESTIONS
// ==========================================

// Liste complète des questions
app.get('/api/admin/questions', requireAdmin, (req, res) => {
  const questions = readJSON(QUESTIONS_FILE);
  questions.sort((a, b) => (a.order || 0) - (b.order || 0));
  res.json(questions);
});

// Ajouter une question
app.post('/api/admin/questions', requireAdmin, (req, res) => {
  const { title, placeholder, type } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Le titre de la question est obligatoire.' });
  }

  const questions = readJSON(QUESTIONS_FILE);
  const maxOrder = questions.reduce((max, q) => Math.max(max, q.order || 0), 0);

  const newQuestion = {
    id: 'q_' + Date.now(),
    title: title.trim(),
    placeholder: (placeholder || 'Votre réponse...').trim(),
    type: type || 'text',
    order: maxOrder + 1
  };

  questions.push(newQuestion);
  writeJSON(QUESTIONS_FILE, questions);

  res.status(201).json(newQuestion);
});

// Modifier une question
app.put('/api/admin/questions/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { title, placeholder, type } = req.body;

  const questions = readJSON(QUESTIONS_FILE);
  const index = questions.findIndex(q => q.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Question introuvable.' });
  }

  if (title && title.trim()) {
    questions[index].title = title.trim();
  }
  if (placeholder !== undefined) {
    questions[index].placeholder = placeholder.trim();
  }
  if (type) {
    questions[index].type = type;
  }

  writeJSON(QUESTIONS_FILE, questions);
  res.json(questions[index]);
});

// Supprimer une question
app.delete('/api/admin/questions/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  let questions = readJSON(QUESTIONS_FILE);
  
  const initialLength = questions.length;
  questions = questions.filter(q => q.id !== id);

  if (questions.length === initialLength) {
    return res.status(404).json({ error: 'Question introuvable.' });
  }

  // Réajuster l'ordre de 1 à N
  questions.sort((a, b) => (a.order || 0) - (b.order || 0));
  questions.forEach((q, idx) => {
    q.order = idx + 1;
  });

  writeJSON(QUESTIONS_FILE, questions);
  res.json({ success: true, message: 'Question supprimée avec succès.' });
});

// Réordonner les questions
app.put('/api/admin/questions-reorder', requireAdmin, (req, res) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ error: 'Format invalide pour la réorganisation.' });
  }

  const questions = readJSON(QUESTIONS_FILE);
  const questionMap = new Map(questions.map(q => [q.id, q]));

  const reordered = [];
  orderedIds.forEach((id, idx) => {
    if (questionMap.has(id)) {
      const q = questionMap.get(id);
      q.order = idx + 1;
      reordered.push(q);
      questionMap.delete(id);
    }
  });

  // Ajouter les éventuelles questions restantes à la fin
  let nextOrder = reordered.length + 1;
  for (const q of questionMap.values()) {
    q.order = nextOrder++;
    reordered.push(q);
  }

  writeJSON(QUESTIONS_FILE, reordered);
  res.json({ success: true, questions: reordered });
});

// ==========================================
// ROUTES ADMIN - CONSULTATION DES REPONSES
// ==========================================

// Liste des soumissions
app.get('/api/admin/answers', requireAdmin, (req, res) => {
  const answers = readJSON(ANSWERS_FILE);
  const questions = readJSON(QUESTIONS_FILE);
  res.json({
    total: answers.length,
    submissions: answers,
    questions
  });
});

// Supprimer une soumission
app.delete('/api/admin/answers/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  let answers = readJSON(ANSWERS_FILE);
  const initialLength = answers.length;
  answers = answers.filter(a => a.id !== id);

  if (answers.length === initialLength) {
    return res.status(404).json({ error: 'Réponse introuvable.' });
  }

  writeJSON(ANSWERS_FILE, answers);
  res.json({ success: true, message: 'Réponse supprimée.' });
});

// Supprimer toutes les soumissions
app.delete('/api/admin/answers-clear-all', requireAdmin, (req, res) => {
  writeJSON(ANSWERS_FILE, []);
  res.json({ success: true, message: 'Toutes les réponses ont été effacées.' });
});

// Export CSV
app.get('/api/admin/export-csv', requireAdmin, (req, res) => {
  const answers = readJSON(ANSWERS_FILE);
  const questions = readJSON(QUESTIONS_FILE);
  questions.sort((a, b) => (a.order || 0) - (b.order || 0));

  // Préparer les en-têtes CSV
  const headers = ['N° Soumission', 'Date & Heure', ...questions.map(q => `"${q.title.replace(/"/g, '""')}"`)];
  
  const rows = answers.map(sub => {
    const row = [
      sub.submissionNumber || '-',
      `"${sub.formattedDate || sub.createdAt || ''}"`
    ];
    questions.forEach(q => {
      const val = sub.answers && sub.answers[q.id] ? sub.answers[q.id] : '';
      row.push(`"${String(val).replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`);
    });
    return row.join(';');
  });

  // UTF-8 BOM (\uFEFF) pour un rendu parfait des accents dans Excel
  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="questionnaire_reponses.csv"');
  res.send(csvContent);
});

// Servir les fichiers statiques du dossier public
app.use(express.static(path.join(__dirname, 'public')));

// Fallback pour les pages HTML
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Démarrer le serveur (si hors environnement serverless Vercel)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🍄 Serveur "Question pour un champignon" en écoute sur http://localhost:${PORT}`);
  });
}

// Export pour Vercel / serverless
module.exports = app;
