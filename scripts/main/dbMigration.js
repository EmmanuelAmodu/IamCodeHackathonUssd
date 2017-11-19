const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const rootPath = path.normalize(__dirname + "/../../");

// Connection URL
const url = 'mongodb://localhost:27017/UssdMenuBrowser';
// Use connect method to connect to the Server
MongoClient.connect(url, function(err, db) {
    assert.equal(null, err);
    console.log("Connected correctly to db");

    const Folder = rootPath + "database";
    const files = fs.readdirSync(Folder);
    console.log(files);

    files.forEach(file => {
      if(file.indexOf('.json') == 1) {
        let contentRaw = fs.readFileSync(`${Folder}/${file}`, 'utf8');
        db.collection(file.replace('.json', '')).insertMany(JSON.parse(contentRaw));
      }
    });

    db.close();
});
