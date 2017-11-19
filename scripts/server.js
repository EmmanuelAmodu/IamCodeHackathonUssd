var express = require('express');
var path = require('path');
var rootPath = path.normalize(__dirname + "/../");
var app = express();
var bodyParser = require('body-parser');
var ussdBrowser = require('./main/ussdBrowser');

app.use(bodyParser.urlencoded({extented: true}));
app.use(bodyParser.json({extended: true}));
app.use(express.static(rootPath + '/phone'));

app.get('/ussd', ussdBrowser);

var server = require('http').createServer(app);

var port = 8090;
app.listen(port);
console.log("server started at " + port);
