require('dotenv').config();
const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const app = express();
const port = Number(process.env.PORT) || 8080;

const SESSION_COOKIE = 'portfolio_admin_session';
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const sessions = new Map();
const loginAttempts = new Map();

app.disable('x-powered-by');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());

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

function isRateLimited(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || record.startedAt + LOGIN_WINDOW_MS <= now) {
    loginAttempts.set(ip, { count: 0, startedAt: now });
    return false;
  }
  return record.count >= MAX_LOGIN_ATTEMPTS;
}

function recordFailedLogin(ip) {
  const record = loginAttempts.get(ip);
  if (record) record.count += 1;
}

app.post('/admin/login', (req, res) => {
  const ip = req.ip;
  if (isRateLimited(ip)) {
    return res.status(429).json({ message: 'Too many attempts. Try again in 15 minutes.' });
  }

  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!passwordMatches(password)) {
    recordFailedLogin(ip);
    return res.status(401).json({ message: 'Incorrect password.' });
  }

  loginAttempts.delete(ip);
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

// Publish only the files the public site needs. This avoids exposing server
// source, configuration, and admin files by serving the whole project folder.
app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
for (const publicFile of ['index.css', 'index.js', 'admin.js']) {
  app.get(`/${publicFile}`, (req, res) => res.sendFile(path.join(__dirname, publicFile)));
}
app.use('/img', express.static(path.join(__dirname, 'img')));
app.use('/pdf_docs', express.static(path.join(__dirname, 'pdf_docs')));
app.use('/updates', express.static(path.join(__dirname, 'updates')));

// Email sending
app.post('/portfolio/send-email', (req, res) => {
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

// Remove expired sessions and rate-limit records without keeping Node running.
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
  for (const [ip, attempt] of loginAttempts) {
    if (attempt.startedAt + LOGIN_WINDOW_MS <= now) loginAttempts.delete(ip);
  }
}, 10 * 60 * 1000);
cleanupTimer.unref();

app.listen(port, function () {
  console.log('Please visit http://localhost:' + port + ' to continue.');
});
