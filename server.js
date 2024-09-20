const express = require('express');
const app = express();
const path = require('path');
const port = 8080;
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');


require('dotenv').config();

app.use(cors());

const staticPath = path.join(__dirname);

app.use(express.static(staticPath));
app.use(express.static(path.join(__dirname, 'img')));
app.use(express.static(path.join(__dirname, 'pdf_docs')));

app.use(bodyParser.urlencoded({ extended: false }));

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

app.post('/check-password', (req, res) => {
  const { password } = req.body;  // Get the password from the request body
  console.log("Password received from client:", password);

  const correctPassword = process.env.ADMIN_PASSWORD;
  console.log("Correct Password:", correctPassword);

  if (password === correctPassword) {
      return res.json({ success: true });
  } else {
      return res.json({ success: false });
  }
});

app.listen(port, function () {
  console.log('Please visit http://localhost:' + port + ' to continue.');
});

