require('dotenv').config();
const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = 8080;

app.use(cors());

const staticPath = path.join(__dirname);
app.use(express.static(staticPath));
app.use(express.static(path.join(__dirname, 'img')));
app.use(express.static(path.join(__dirname, 'pdf_docs')));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());

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

// Admin password check
app.post('/check-password', (req, res) => {
  const { password } = req.body;
  console.log("Password received from client.");

  const correctPassword = process.env.ADMIN_PASSWORD;

  if (password === correctPassword) {
    res.json({ success: true });
  } else {
    res.json({ success: false }); 
  }
});

app.listen(port, function () {
  console.log('Please visit http://localhost:' + port + ' to continue.');
});
