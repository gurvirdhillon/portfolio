const express = require('express');
const app = express();
const path = require('path');
const port = 8080;
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');

const staticPath = path.join(__dirname);

app.use(express.static(staticPath));
app.use(express.static(path.join(__dirname, 'img')));
app.use(express.static(path.join(__dirname, 'pdf_docs')));

// Add middleware to parse request bodies
app.use(bodyParser.urlencoded({ extended: false }));

app.listen(port, function () {
  console.log('Please visit http://localhost:' + port + ' to continue.');
});

app.post('/send-email', (req, res) => {
  const { firstName, lastName, email, phone, query } = req.body;
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'gurvirdhillon2002@gmail.com',
      pass: 'cwur lqcw xdec ayre',
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
