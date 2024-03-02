const express = require('express');
const app = express();
const path = require('path');
const port = 8080;

const staticPath = path.join(__dirname);

app.use(express.static(staticPath));

app.listen(port, function () {
    console.log('please search localhost:',port, 'on the browser to continue.');
});
