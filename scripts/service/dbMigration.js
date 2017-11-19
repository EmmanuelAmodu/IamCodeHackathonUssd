var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var path = require('path');
var rootPath = path.normalize(__dirname + "/../../");

// Connection URL
var url = 'mongodb://localhost:27017/UssdMenuBrowser';
// Use connect method to connect to the Server
MongoClient.connect(url, function(err, db) {
    assert.equal(null, err);
    console.log("Connected correctly to server");
    const fs = require('fs');

    var Folder = rootPath + "database";
    fs.readdir(Folder, (err, files) => {
      var content = {};

      files.forEach(file => {
        if(file.indexOf('.json') > -1) {
          var contentRaw = fs.readFileSync(`${Folder}/${file}`, 'utf8');
          var contentJSON = JSON.parse(contentRaw);
          if (Array.isArray(contentJSON)) contentJSON = {"6820TerminateMessageEnglish": {contentJSON}};
          content = Object.assign(content, contentJSON);
        }
      });

      var contentKeys = Object.keys(content);
      contentKeys.forEach(d => {
        let insertThis = content[d];
        insertThis._id = d;
        console.log(insertThis._id);
        db.collection("menus").insert(insertThis);
      });
      db.close();
    });
});