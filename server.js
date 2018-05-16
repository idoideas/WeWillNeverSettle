var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var url = require("url");
fs = require('fs');
var bodyParser = require('body-parser');
app.use( bodyParser.json() );

const admin = require('firebase-admin');
var serviceAccount = require('./auth/abd411db7c30.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
var db = admin.firestore();

var isMuted = false;

documentsToUpdateLive(db);

app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

app.get('/counterRequest', function(req, res){
    if(req.headers["seed"]==="confirmed"){
        getDatabaseData(db.collection("main-documents").doc("main-counter"), updateNumberCallback);
        getDatabaseData(db.collection("users-clicks-documents").doc(req.body["username"]), updateNumberCallback);
        res.send("Thanks for never settling! " + req.body)
    } else {
        res.send("I appericate the try. However, this project doesn't support non-clean requests. Please don't do that.")
    }

});

app.use('/', express.static(__dirname + '/'));

io.on('connection', function(socket){
    socket.on('add-number', function(){
        getDatabaseData(db.collection("main-documents").doc("main-counter"), updateNumberCallback);
    });

    socket.on('set-number', function(){
        getDatabaseData(db.collection("main-documents").doc("main-counter"), function (dbQuery, doc) {
            io.emit('set-number', doc._fieldsProto.count.integerValue);
        });
    });

    socket.on("mute-unmute", function(msg){
        isMuted = !isMuted;
    });

    socket.on("send-mute-state", function(msg){
        isMuted = !isMuted;
    });
});

http.listen(process.env.PORT || 8080, function(){
    console.log('listening on *:8080');
});

function getDatabaseData(dbQuery, callback){
    dbQuery.get()
        .then(doc => {
        if (!doc.exists) {
        console.log('No such document!');
    } else {
        callback(dbQuery, doc);
    }
    })
    .catch(err => {
            console.log('Error getting document', err);
    });
}

function updateNumberCallback(dbQuery, doc){
    dbQuery.set({
        count: parseInt(doc._fieldsProto.count.integerValue)+1
    });
}

function updateDocumentLive(dbQuery, callbackFunc){
    var observer = dbQuery.onSnapshot(docSnapshot => {
        callbackFunc(docSnapshot._fieldsProto);
}, err => {
        console.log(`Encountered error: ${err}`);
    });
}

function documentsToUpdateLive(db){
    updateDocumentLive(db.collection("main-documents").doc("main-counter"), function(value){
        io.emit('add-number', value.count.integerValue);
    });
}