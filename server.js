var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var url = require("url");
fs = require('fs');

var number = 0;
var isMuted = false;

app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

app.use('/', express.static(__dirname + '/'));

io.on('connection', function(socket){
    socket.on('add-number', function(msg){
        number++;
        io.emit('add-number', number);
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