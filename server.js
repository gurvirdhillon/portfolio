require('dotenv').config();
const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const fs = require('fs');
const { rateLimit } = require('express-rate-limit');
const app = express();
const port = Number(process.env.PORT) || 8080;

const SESSION_COOKIE = 'portfolio_admin_session';
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const sessions = new Map();
const dataDirectory = path.join(__dirname, 'data');
const projectsFile = path.join(dataDirectory, 'projects.json');
const notesFile = path.join(dataDirectory, 'notes.json');

app.disable('x-powered-by');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: 'Too many requests. Please try again later.'
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many attempts. Try again in 15 minutes.' }
});

const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: 'Too many messages sent. Please try again later.'
});

function getCookies(req) {
  return (req.headers.cookie || '').split(';').reduce((cookies, item) => {
    const separator = item.indexOf('=');
    if (separator === -1) return cookies;
    const key = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function getSession(req) {
  const token = getCookies(req)[SESSION_COOKIE];
  const session = token && sessions.get(token);

  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return { token, session };
}

function requireAdmin(req, res, next) {
  if (!getSession(req)) {
    return res.redirect(303, '/');
  }
  return next();
}

function requireAdminApi(req, res, next) {
  if (!getSession(req)) {
    return res.status(401).json({ message: 'Your admin session has expired.' });
  }
  return next();
}

function readProjects() {
  try {
    return JSON.parse(fs.readFileSync(projectsFile, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function writeProjects(projects) {
  fs.mkdirSync(dataDirectory, { recursive: true });
  const temporaryFile = `${projectsFile}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(projects, null, 2));
  fs.renameSync(temporaryFile, projectsFile);
}

function readNotes() {
  try {
    return JSON.parse(fs.readFileSync(notesFile, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function writeNotes(notes) {
  fs.mkdirSync(dataDirectory, { recursive: true });
  const temporaryFile = `${notesFile}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(notes, null, 2));
  fs.renameSync(temporaryFile, notesFile);
}

function cleanNoteInput(body) {
  return {
    title: String(body.title || '').trim().slice(0, 120),
    content: String(body.content || '').trim().slice(0, 10000),
    tag: String(body.tag || '').trim().slice(0, 30)
  };
}

function runHealthChecks() {
  const checks = [];
  const addCheck = (id, label, status, detail) => checks.push({ id, label, status, detail });
  addCheck('server', 'Web server', 'healthy', `Running on ${process.version}.`);

  try {
    fs.mkdirSync(dataDirectory, { recursive: true });
    fs.accessSync(dataDirectory, fs.constants.R_OK | fs.constants.W_OK);
    addCheck('storage', 'Private storage', 'healthy', 'Project and note storage is readable and writable.');
  } catch (error) {
    addCheck('storage', 'Private storage', 'error', 'The data directory cannot be read or written.');
  }

  if (process.env.ADMIN_PASSWORD_HASH) addCheck('authentication', 'Admin authentication', 'healthy', 'A hashed admin password is configured.');
  else if (process.env.ADMIN_PASSWORD) addCheck('authentication', 'Admin authentication', 'warning', 'Using the legacy plaintext password setting.');
  else addCheck('authentication', 'Admin authentication', 'error', 'No admin password is configured.');

  addCheck('email', 'Contact email', process.env.EMAIL_PASSWORD ? 'healthy' : 'warning', process.env.EMAIL_PASSWORD ? 'Email credentials are configured.' : 'EMAIL_PASSWORD is missing; contact emails will fail.');

  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const references = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)]
    .map((match) => match[1].split('#')[0].split('?')[0])
    .filter((reference) => reference && !/^(?:https?:|mailto:|tel:|#|javascript:)/i.test(reference));
  const missing = [...new Set(references)].filter((reference) => !fs.existsSync(path.join(__dirname, decodeURIComponent(reference))));
  addCheck('assets', 'Portfolio files', missing.length ? 'error' : 'healthy', missing.length ? `${missing.length} missing: ${missing.slice(0, 4).join(', ')}` : `${new Set(references).size} local links and assets found.`);

  const overall = checks.some((check) => check.status === 'error') ? 'error' : checks.some((check) => check.status === 'warning') ? 'warning' : 'healthy';
  return { overall, checkedAt: new Date().toISOString(), uptimeSeconds: Math.floor(process.uptime()), checks };
}

function cleanProjectInput(body) {
  const allowedStatuses = ['Idea', 'Planning', 'Building', 'Testing', 'Paused', 'Complete'];
  const status = allowedStatuses.includes(body.status) ? body.status : 'Idea';
  const progress = Math.min(100, Math.max(0, Number(body.progress) || 0));
  let link = String(body.link || '').trim().slice(0, 500);
  if (link) {
    try {
      const parsedLink = new URL(link);
      if (!['http:', 'https:'].includes(parsedLink.protocol)) link = '';
    } catch (error) {
      link = '';
    }
  }

  return {
    name: String(body.name || '').trim().slice(0, 100),
    description: String(body.description || '').trim().slice(0, 1000),
    status,
    progress,
    currentTask: String(body.currentTask || '').trim().slice(0, 300),
    nextStep: String(body.nextStep || '').trim().slice(0, 300),
    link,
    targetDate: String(body.targetDate || '').trim().slice(0, 10)
  };
}

function passwordMatches(password) {
  const storedHash = process.env.ADMIN_PASSWORD_HASH;

  if (storedHash) {
    const [algorithm, saltHex, hashHex] = storedHash.split('$');
    if (algorithm !== 'scrypt' || !saltHex || !hashHex) return false;

    try {
      const expected = Buffer.from(hashHex, 'hex');
      const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
      return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    } catch (error) {
      return false;
    }
  }

  // Backwards-compatible for local setup. Production requires a hash.
  if (process.env.NODE_ENV === 'production') return false;
  const legacyPassword = process.env.ADMIN_PASSWORD;
  if (!legacyPassword) return false;
  const expected = Buffer.from(legacyPassword);
  const actual = Buffer.from(password);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

app.post('/admin/login', loginLimiter, (req, res) => {
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!passwordMatches(password)) {
    return res.status(401).json({ message: 'Incorrect password.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { expiresAt: Date.now() + SESSION_TTL_MS });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_TTL_MS,
    path: '/'
  });
  return res.json({ success: true });
});

app.post('/admin/logout', (req, res) => {
  const activeSession = getSession(req);
  if (activeSession) sessions.delete(activeSession.token);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  return res.redirect(303, '/');
});

app.get(['/admin', '/admin.html'], requireAdmin, (req, res) => {
  res.set('Cache-Control', 'no-store');
  return res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/api/admin/projects', requireAdminApi, (req, res) => {
  return res.json(readProjects());
});

app.post('/api/admin/projects', requireAdminApi, (req, res) => {
  const input = cleanProjectInput(req.body);
  if (!input.name) return res.status(400).json({ message: 'Project name is required.' });

  const projects = readProjects();
  const now = new Date().toISOString();
  const project = {
    id: crypto.randomUUID(),
    ...input,
    archived: false,
    order: projects.length,
    createdAt: now,
    updatedAt: now
  };
  projects.push(project);
  writeProjects(projects);
  return res.status(201).json(project);
});

app.put('/api/admin/projects/:id', requireAdminApi, (req, res) => {
  const projects = readProjects();
  const project = projects.find((item) => item.id === req.params.id);
  if (!project) return res.status(404).json({ message: 'Project not found.' });

  const input = cleanProjectInput(req.body);
  if (!input.name) return res.status(400).json({ message: 'Project name is required.' });
  Object.assign(project, input, { updatedAt: new Date().toISOString() });
  writeProjects(projects);
  return res.json(project);
});

app.patch('/api/admin/projects/:id/archive', requireAdminApi, (req, res) => {
  const projects = readProjects();
  const project = projects.find((item) => item.id === req.params.id);
  if (!project) return res.status(404).json({ message: 'Project not found.' });
  project.archived = Boolean(req.body.archived);
  project.updatedAt = new Date().toISOString();
  writeProjects(projects);
  return res.json(project);
});

app.patch('/api/admin/projects/reorder', requireAdminApi, (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  const projects = readProjects();
  const orderById = new Map(ids.map((id, index) => [id, index]));
  projects.forEach((project) => {
    if (orderById.has(project.id)) project.order = orderById.get(project.id);
  });
  writeProjects(projects);
  return res.json({ success: true });
});

app.get('/api/admin/notes', requireAdminApi, (req, res) => {
  return res.json(readNotes());
});

app.post('/api/admin/notes', requireAdminApi, (req, res) => {
  const input = cleanNoteInput(req.body);
  if (!input.title && !input.content) return res.status(400).json({ message: 'Write something before saving.' });
  const notes = readNotes();
  const now = new Date().toISOString();
  const note = { id: crypto.randomUUID(), ...input, pinned: false, createdAt: now, updatedAt: now };
  notes.push(note);
  writeNotes(notes);
  return res.status(201).json(note);
});

app.put('/api/admin/notes/:id', requireAdminApi, (req, res) => {
  const notes = readNotes();
  const note = notes.find((item) => item.id === req.params.id);
  if (!note) return res.status(404).json({ message: 'Note not found.' });
  const input = cleanNoteInput(req.body);
  if (!input.title && !input.content) return res.status(400).json({ message: 'Write something before saving.' });
  Object.assign(note, input, { updatedAt: new Date().toISOString() });
  writeNotes(notes);
  return res.json(note);
});

app.patch('/api/admin/notes/:id/pin', requireAdminApi, (req, res) => {
  const notes = readNotes();
  const note = notes.find((item) => item.id === req.params.id);
  if (!note) return res.status(404).json({ message: 'Note not found.' });
  note.pinned = Boolean(req.body.pinned);
  note.updatedAt = new Date().toISOString();
  writeNotes(notes);
  return res.json(note);
});

app.delete('/api/admin/notes/:id', requireAdminApi, (req, res) => {
  const notes = readNotes();
  const remainingNotes = notes.filter((item) => item.id !== req.params.id);
  if (remainingNotes.length === notes.length) return res.status(404).json({ message: 'Note not found.' });
  writeNotes(remainingNotes);
  return res.status(204).end();
});

app.get('/api/admin/health', requireAdminApi, (req, res) => res.json(runHealthChecks()));
app.get('/health', (req, res) => res.json({ status: 'ok', uptimeSeconds: Math.floor(process.uptime()) }));

// Publish only the files the public site needs. This avoids exposing server
// source, configuration, and admin files by serving the whole project folder.
app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
for (const publicFile of ['index.css', 'index.js', 'admin.js', 'admin.css', 'admin-dashboard.js']) {
  app.get(`/${publicFile}`, (req, res) => res.sendFile(path.join(__dirname, publicFile)));
}
app.use('/img', express.static(path.join(__dirname, 'img')));
app.use('/pdf_docs', express.static(path.join(__dirname, 'pdf_docs')));
app.use('/updates', express.static(path.join(__dirname, 'updates')));

// Email sending
app.post('/portfolio/send-email', emailLimiter, (req, res) => {
  const { firstName, lastName, email, phone, query } = req.body;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'gurvirdhillon2002@gmail.com',
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: 'gurvirsinghdhillon@outlook.com',
    to: 'gurvirdhillon2002@gmail.com',
    subject: 'Website email',
    text: `First Name: ${firstName}\nLast Name: ${lastName}\nEmail: ${email}\nPhone: ${phone}\nQuery: ${query}`,
  };

  // Send the email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
      res.status(500).send('Error sending email');
    } else {
      console.log('Email sent: ' + info.response);
      res.send('<script>alert("Email sent"); window.location.href = "/";</script>');
    }
  });
});

// Remove expired sessions without keeping Node running.
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
}, 10 * 60 * 1000);
cleanupTimer.unref();

app.listen(port, function () {
  console.log('Please visit http://localhost:' + port + ' to continue.');
});
