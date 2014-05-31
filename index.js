var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);

app.get('/', function(req, res) {
  res.sendfile('index.html');
});

app.get('/index.css', function(req, res) {
  res.sendfile('index.css');
});

io.on('connection', function(socket) {
  console.log('Socket: ' + socket.id + ' connected.');
  socket.on('new-user', function(user) {
    // Create a usr object to store some properties
    var usr = new Object();
    usr.displayName = user;
    usr.id = socket.id;
    // Broadcast the new user to connected sockets
    socket.emit('user-registered', usr);
    console.log('Socket: ' + usr.id + ' registered as ' + usr.displayName + '.');
  });

  // Listen for new votes
  // Match vote with socket.id and broadcast vote to connected sockets
  socket.on('vote', function(vote) {
    var usr = new Object();
    usr.id = socket.id;
    usr.vote = vote;
    // Broadcast the user's vote to connected sockets
    socket.broadcast.emit('user-voted', usr);
    console.log('Socket: ' + usr.id + ' voted with ' + usr.vote + '.');
  });

  // When a socket disconnects, broadcast user-left
  // so that the client view can update
  socket.on('disconnect', function() {
    socket.broadcast.emit('user-left', socket.id);
    console.log('Socket: ' + socket.id + ' disconnected.')
  });
});

var port = Number(process.env.PORT || 3000);
server.listen(port);
