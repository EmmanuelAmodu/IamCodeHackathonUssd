var fs = require('fs'),
http = require('http'),
path = require('path'),
rootPath = path.normalize(__dirname + "/../../"),
request = require('request'),
MongoClient = require('mongodb').MongoClient;

var controls = (function(){
    function controls(req, res, db){
        this.req = req;
        this.res =  res;
        this.db = db;
    }
    
    controls.prototype = {

        "getUserData": async function() {
            var userData = await this.db.collection('session').findOne({_id: this.req.query.msisdn});
            return userData;
        },

        "updateUserData": async function(data) {
            data._id = this.req.query.msisdn;
            await this.getUserData() ? 
                this.db.collection('session').update({_id: this.req.query.msisdn}, data) :
                    this.db.collection('session').insertOne(data);
        },
    
        "shortCodeOnce": async function(shortCode){
            var userData = await this.getUserData();
            userData && userData["data"] ? 
                shortCode = "*" + (userData["data"].split("*"))[1] :
                    shortCode = new Promise((resolve, reject) => {
                        resolve(shortCode);
                        reject(undefined);
                    });
            return shortCode;
        },
    
        "initialize": async function(){
            if(this.req.query.data == "00") this.req.query.data = await this.shortCodeOnce();
            var userData = this.req.query;
            //using option to check if we are expecting text
            userData.option = true;
            userData.negotiate = null;
            //gets the menu for shortCodeOnce
            this.getMenu(this.req.query.data).then(menu => {
                    this.updateUserData(userData);
                    menu["run-check"] ?
                        this.runCheck(menu, userData) :
                            this.res.send(menu);
            }).catch(err => {
                console.log(err);
                this.sendError("Invalid response code", 56);
            });
        },
    
        "runCheck": function(menu, userData){
            var url = menu["run-check"] + "234" + parseInt(this.req.query.msisdn);
            request.get(url, (err, httpResponse, body) => {
                if (httpResponse.statusCode == 404) {
                    body = JSON.parse(body);
                    if (body["data"]["error_code"] == "E101") {
                        this.getMenu(menu["stepto"]).then(menu => {
                            userData = this.updateUserDataForOption(userData, menu);
                            this.updateUserData(userData);
                            this.res.send(menu);
                        }).catch(err => {
                            console.log(err, 67);
                        });
                    }
                } else if (httpResponse.statusCode == 200) {
                    this.res.send(menu);
                } else {
                    this.sendError("Application error, please try again later", 77);
                }
            });
        },
    
        "goBackThroughMenu": async function(){
            var userData = await this.getUserData();
            userData = JSON.parse(userData);
            var useDataArray = userData.data.split("*");
            //if not in root continue with this
            if (useDataArray.length > 2) useDataArray.pop();
    
            useDataArray = useDataArray.join("*");
            userData.data = useDataArray;
            userData.option = true;
            delete userData.session;
            delete userData.params;
            delete userData.values;

            this.getMenu(useDataArray).then(menu => {
                this.updateUserData(userData);
                this.res.send(menu);
            }).catch(err => {
                this.sendError("Invalid response code", 115);
            });
        },

        "goToNextPage": async function(menu, userData){
            if(userData && !userData.tree){
                userData.tree = menu; 
                userData.tree.step = 0;
                return { "output": menu.dataH + menu.dataBD[userData.tree.step], endpoint: 0};
            } else {
                // when this is called get menu and save to user session if first call 
                var userData = await this.getUserData();
                this.getMenu(userData.tree.current).then(menu => {
                    if(menu.dataBD[userData.tree.step]) {
                        this.res.send({"output": menu.dataH + menu.dataBD[userData.tree.step], endpoint: 0});
                    } else this.sendError("Invalid response code", 132);
                }).catch(err => {
                    console.log(err);
                });

                userData.tree.step += 1;
                this.updateUserData(userData);
            }
        },
        
        "updateExpectedReturnData": function(userData){
            userData.data = userData.data + "*" + this.req.query.data;
            this.getMenu(userData.data).then(menu => {
                //update user session data option to false 
                // or check for negotiation state 
                if(menu.return == 'text') {
                    userData = this.updateUserDataForOption(userData, menu);
                } else if (menu.negotiate) {
                    menu = this.negotiate(menu);
                }
                this.updateUserData(userData);
                if(menu) this.res.send(menu);
            }).catch(err => {
                this.sendError("Invalid response code line", 155);
            });
        },
    
        "finalizing": function(userData){
            var ussdCode = userData.session.destination;
            this.getMenu(ussdCode).then(menu => {
                var newUserData = this.updateUserDataForOption(userData, menu, this.req.query.data);
                if (menu.confirm){
                    this.updateUserData(newUserData);
                    menu = this.parseConfirmText(menu, newUserData);
                    this.res.send(menu);
    
                } else if (menu.endpoint == "1"){
                    this.updateUserData(newUserData).then(result => {
                        this.terminate(menu);
                    });
    
                } else if (menu.dataBD) {
                    menu = this.goToNextPage(menu, newUserData).then(d => {
                        this.res.send(d);
                    }).catch(err => {
                        console.log(err);
                    });
                    this.updateUserData(newUserData);
    
                } else {
                    this.updateUserData(newUserData);
                    this.res.send(menu);
                } 

            }).catch(err => {
                this.sendError("Invalid response code", 170);
            });
        },
    
        "getMenu": async function (ussdCode){
            var menu = await this.db.collection("menus").findOne({_id: ussdCode});
            if (!menu) {
                this.res.status(404);
                this.db.collection('session').remove({_id: this.req.query.msisdn});
                return new Promise((resolve, reject) => {
                    resolve({error: 101, message: "service do not exist"});
                    reject(null);
                });
            } 
            return menu
        },
    
        "updateUserDataForOption": function(userData, menu, params){
            userData.session = userData.session || {};
            userData.session.destination = menu.destination;
            userData.session.endpoint = menu.endpoint;
    
            if(menu.return == 'text') userData.option = false;
            if(!userData.params) userData.params = [];
            if(!userData.values) userData.values = [];
    
            if(menu.name) userData.params.push(menu.name);
            if(params) userData.values.push(params);
    
            return userData;
        },
    
        "updateUserDataForNegotiate": function(userData, menu){
            userData.negotiate = menu;
            return userData;
        },
    
        "checkForOptionState": async function(){
            var data = await this.getUserData();
            return data["option"];
        },
    
        "checkForNegotiationState": async function(){
            var data = await this.getUserData();
            return data["negotiate"];
        },
    
        "negotiate": async function(menu){
            var userData =  await this.getUserData();
            userData = JSON.parse(userData);
            if (menu) {
                userData = this.updateUserDataForNegotiate(userData, menu);
                this.menuFromUrl(menu.output);
    
                var that = this;
                setTimeout(function(){
                    this.updateUserData(userData);
                }, 5);
                
            } else {
                this.menuFromUrl(userData.negotiate.output);
            }
        },

        "menuFromUrl": function(url){
            request.get(url, (err, httpResponse, body) => {
                var menu = JSON.parse(body);
                this.res.send(menu);
            });
        },
    
        "parseConfirmText": function (menu, userData){
            var output = menu.output;
            if(output.indexOf("{{") < output.indexOf("}}")){
                var arrOfBracContent = output.match(/{{\s*[\w\.]+\s*}}/g).map(function(x) { return x.match(/[\w\.]+/)[0]; });
                for (var i = 0; i < arrOfBracContent.length; i++){
                    var session = arrOfBracContent[i];
                    output = output.replace("{{"+session+"}}", this.parseConfirmTextForParams(output, userData, session));
                }
                menu.output = output;
            }
            return menu;
        },
    
        "parseConfirmTextForParams": function (output, userData, session) {
            var priceParamPosition = userData.params.indexOf(session);
            var value = userData.values[priceParamPosition];
            return value;
        },
    
        "terminate": async function (menu){
            var userData = await this.getUserData(),
            msisdn = userData.msisdn,
            params = userData.params,
            values = userData.values,
            data = userData.data,
            url = menu.url,
            objData = {};
            
            for (var i = 0; i < params.length; i++) 
                objData[params[i]] = values[i];

            //terminate here
            this.getFinalMessage(objData).then(d => {
                menu.data.output = d;
                this.res.send(menu.data);
                this.post({"msisdn": msisdn, "objData": objData, "url": url, "handlerPort": menu.handlerPort, "data": data});
            }).catch(err => {
                console.log(err);
            });
        },

        "getFinalMessage": async function(objData){
            let messages = await this.db.collection('menus').findOne({_id: 'TerminateMessageNigeria'});
            return messages.content[objData.location - 1][objData.incidence - 1];
        },
    
        "sendError": function (message, code){
            this.db.collection('session').remove({_id: this.req.query.msisdn});
            this.res.send({return: "error", output: message, debug_code: code});
        },
    
        "post": function(data){
            const handler = `http://localhost:${data.handlerPort}`;
            request.post(handler).form(data);
        }
    }    
    return controls;
}());
module.exports = controls;
