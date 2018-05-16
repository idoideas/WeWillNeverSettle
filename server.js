var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var url = require("url");
fs = require('fs');
var bodyParser = require('body-parser');
app.use( bodyParser.json() );
app.use(bodyParser.urlencoded({
    extended: true
}));
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

app.post('/counterRequest', function(req, res){
    if(req.headers["seed"]==="confirmed"){
        getDatabaseDocument(db.collection("main-documents").doc("main-counter"), updateNumberCallback);
        getDatabaseDocument(db.collection("users-clicks-documents").doc(req.body.username), updateNumberCallback);
        res.send("Thanks for never settling!")
    } else {
        res.send("I appericate the try. However, this project doesn't support non-clean requests. Please don't do that.")
    }

});

app.post('/newUserRequest', function(req, res){
    isUserExists(req.body.username, function(result){
        if(!result){
            if(req.headers["seed"]==="confirmed"){
                addNewUser(req.body.username, req.body.email);
                res.send("Thanks for never settling!")
            } else {
                res.send("I appericate the try. However, this project doesn't support non-clean requests. Please don't do that.")
            }
        } else {
            res.send("user-exists");
        }
    });
});

app.use('/', express.static(__dirname + '/'));

io.on('connection', function(socket){
    socket.on('add-number', function(){
        getDatabaseDocument(db.collection("main-documents").doc("main-counter"), updateNumberCallback);
    });

    socket.on('set-number', function(){
        getDatabaseDocument(db.collection("main-documents").doc("main-counter"), function (dbQuery, doc) {
            io.emit('set-number', doc._fieldsProto.count.integerValue);
        });
    });

    socket.on('update-table', function(){
        getDatabaseSnapshots(db.collection("users-clicks-documents").orderBy("count", 'desc').limit(5), getTableLeadersRegularSnap);
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

function getDatabaseDocument(dbQuery, callback){
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

function getDatabaseSnapshots(dbQuery, callbackFunc){
    dbQuery.get()
        .then(snapshot => {
            var dict = {};
        snapshot.forEach(doc => {
        dict[doc.id] = doc.data();});
        callbackFunc(dict);
})
.catch(err => {
        console.log('Error getting documents', err);
});
}

function updateNumberCallback(dbQuery, doc){
    dbQuery.update({
        count: parseInt(doc._fieldsProto.count.integerValue)+1
    });
}

function getTableLeadersUpdateSnap(docSnap){
    var dict = [];
    var docs = docSnap._docs();
    for(var i = 0; i<docs.length; i++){
        var obj = docs[i]._fieldsProto;
        dict.push({"username": obj["username"].stringValue, "count": obj["count"].integerValue});
    }
    io.emit('update-table', dict);
}

function getTableLeadersRegularSnap(docSnap){
    var dict = [];
    for(var key in docSnap){
        var obj = docSnap[key];
        dict.push({"username": obj["username"], "count": obj["count"]});
    }
    io.emit('update-table', dict);
}

function addNewUser(username, email){
    db.collection("users-clicks-documents").doc(username).set({
        username: username,
        email: email,
        count: 0
    });
}

function isUserExists(username, callback){
    db.collection("users-clicks-documents").doc(username).get()
        .then(doc => {
        if (!doc.exists) {
            callback(false);
    } else {
         callback(true);
    }
})
.catch(err => {
        console.log('Error getting document', err);
        callback(true);
});
}

function updateDocumentLive(dbQuery, callbackFunc){
    var observer = dbQuery.onSnapshot(docSnapshot => {
        callbackFunc(docSnapshot);
}, err => {
        console.log(`Encountered error: ${err}`);
    });
}

function documentsToUpdateLive(db){
    updateDocumentLive(db.collection("main-documents").doc("main-counter"), function(value){
        io.emit('add-number', value._fieldsProto.count.integerValue);
    });
    updateDocumentLive(db.collection("users-clicks-documents").orderBy("count", 'desc').limit(5), getTableLeadersUpdateSnap)
}