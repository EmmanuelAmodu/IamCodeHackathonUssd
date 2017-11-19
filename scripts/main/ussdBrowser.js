var path = require('path');
var rootPath = path.normalize(__dirname + "/../../");
var control = require('./controls');
var MongoClient = require('mongodb').MongoClient
var assert = require('assert');

module.exports = function(req, res){
    MongoClient.connect('mongodb://localhost:27017/UssdMenuBrowser', function(err, db) {
        assert.equal(null, err);

        res.set('Access-Control-Allow-Origin', '*');
        var controls = new control(req, res, db);
        controls.shortCodeOnce(req.query.data).then(shortCode => {
            if (req.query.data == shortCode || req.query.data == "00") {
                controls.initialize(rootPath);
                console.log(18);
            }
        
            else if (req.query.data == "0") {
                 //go back through menu if 0 is entered
                 controls.goBackThroughMenu(rootPath);
                 console.log(24);
            } 
        
            else if (req.query.data == "**") {
                //go to next page in menu
                controls.goToNextPage(rootPath);
                console.log(30);
            } 
            
            else {
                //if not *123 then runs this instead
                //read user data
                db.collection('session').findOne({_id: req.query.msisdn}).then(userData => {
                    controls.checkForNegotiationState().then(d => {
                        console.log(d, 41);
                        if(d) controls.negotiate();
                        else controls.checkForOptionState().then(ed => {
                            console.log(ed, 45);
                            if(ed) controls.updateExpectedReturnData(userData);
                            else controls.finalizing(userData);
                        })
                    });
                }).catch(err => {
                    console.log(err, 52);
                    db.collection('session').remove({_id: req.query.msisdn});
                    res.send({return: "error", output: "Invalid response code"});
                });
            }
    
            setTimeout(() => db.close(), 100);

        }).catch(err => {
            console.log(err);
        });
    });
}
