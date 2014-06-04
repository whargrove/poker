var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
if (process.env.REDISTOGO_URL) {
  // Initiate redis connection for production
  var rtg = require('url').parse(process.ENV.REDISTOGO_URL);
  var redis = require('redis').createClient(rtg.port, rtg.hostname);
  redis.auth(rtg.auth.split(':')[1]);
} else {
  // Initiate redis connection for development
  var redis = require('redis').createClient();
}

app.get('/', function(req, res) {
  res.sendfile('index.html');
});

app.get('/index.css', function(req, res) {
  res.sendfile('index.css');
});

app.get('/avatar.jpg', function(req, res) {
  res.sendfile('avatar.jpg');
});

io.on('connection', function(socket) {
  console.log('Socket: ' + socket.id + ' connected.');
  if (redis.connected) {
    console.log('[Redis] is connected.');
  } else {
    console.log('[Redis] is not connected.');
  }

  socket.on('new-user', function(user) {
    // Create a usr object to store some properties
    var usr = new Object();
    usr.displayName = user;
    usr.id = socket.id;
    // Remember the user
    remember(usr);
    // Broadcast the new user to connected sockets
    io.emit('user-registered', usr);
    console.log('Socket: ' + usr.id + ' registered as ' + usr.displayName + '.');
  });

  // Listen for new votes
  // Match vote with socket.id and broadcast vote to connected sockets
  socket.on('vote', function(vote) {
    var usr = new Object();
    usr.id = socket.id;
    usr.vote = vote;
    // Broadcast the user's vote to connected sockets
    io.emit('user-voted', usr);
    console.log('Socket: ' + usr.id + ' voted with ' + usr.vote + '.');
  });

  // Listen for clear-vote
  // Match the clear-vote with the socket ID and broadcast vote-cleared to connected sockets
  socket.on('clear-vote', function() {
    var usr = new Object();
    usr.id = socket.id;
    io.emit('vote-cleared', usr);
  });

  // When a socket disconnects, broadcast user-left
  // so that the client view can update
  socket.on('disconnect', function() {
    // Remove the user from Redis on disconnect
    redis.del('user-' + socket.id);
    socket.broadcast.emit('user-left', socket.id);
    console.log('Socket: ' + socket.id + ' disconnected.')
  });
});

function remember(user) {
  redis.hset('user-' + user.id, user.id, user.displayName, redis.print);
  console.log(user.displayName + ' added at key: user-' + user.id);
}

var port = Number(process.env.PORT || 3000);
server.listen(port);
