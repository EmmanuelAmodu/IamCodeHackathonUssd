var express = require('express');
var app = express();
var path = require('path');
var rootPath = path.normalize(__dirname + "/../../");
var bodyParser = require('body-parser');
var http = require('http');
var request = require('request');

app.use(bodyParser.urlencoded({extented: true}));
app.use(bodyParser.json({extended: true}));

app.get('/ussd', (req, res) => {
    res.setHeader('charge', 'N');
    res.setHeader('amount', '0');
    res.setHeader('Freeflow', 'FC');
    
    console.log(req.query.MSISDN, req.query.input);
    if(req.query.userid == "dsvrt1" & req.query.password == "1trvsd1") {
        if(req.query.input == "6820") req.query.input = "*6820";
        var url = `http://localhost:8090/ussd?msisdn=${req.query.MSISDN}&data=${req.query.input}&service=*6820#`;
        request.get(url, (err, httpResponse, body) => {
            if(!err){
                var response = {
                    "error": "180",
                    "output": "Application Error"
                }, failed;
                try {
                   response = JSON.parse(body);
                   if( response.error || response.endpoint ) res.setHeader('Freeflow', 'FB');
                } catch(e){
                    failed = e;
                } finally {
                    // processing output should only happen here 
                    res.send(response.output);
                }
            }
            else res.sendStatus(500);
        });
    } else {
        res.sendStatus(401);
    }
});

app.post('', (req, res) => {
    const data = req.body,
    language = data.data.split("*")[2],
    url = `http://69.16.239.82:7070/DSIMS/home/report?reporter=${data.msisdn}&primaryLanguage=${language}&report=${data.objData.incidence}&reporterRelationship=${data.objData.anonymous}&address=${data.objData.Address}&victimSex=${data.objData.Gender}&location=${data.objData.location}`;

    request.get(url, (err, httpResponse, body) => {
        console.log(body, data, httpResponse.statusCode);
    });
    res.sendStatus(200);
});

var server = require('http').createServer(app);

var port = 7089;
app.listen(port);
console.log(`server started at ${port}`);
