var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);

app.get('/', function(req, res) {
  res.sendfile('index.html');
});

io.on('connection', function(socket) {
  console.log('Socket: ' + socket.id + ' connected.');
  socket.on('new-user', function(user) {
    // Create a usr object to store some properties
    var usr = new Object();
    usr.displayName = user;
    usr.id = socket.id;
    // Broadcast the new user to all connected sockets
    socket.broadcast.emit('user-registered', usr);
    console.log('Socket: ' + usr.id + ' registered as ' + usr.displayName + '.');
  });

  // When a socket disconnects, broadcast user-left
  // so that the client view can update
  socket.on('disconnect', function() {
    socket.broadcast.emit('user-left', socket.id);
    console.log('Socket: ' + socket.id + ' disconnected.')
  })
});

server.listen(3000);
