var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
if (process.env.REDISTOGO_URL) {
  // Initiate redis connection for production
  var rtg = require('url').parse(process.env.REDISTOGO_URL);
  var redis = require('redis').createClient(rtg.port, rtg.hostname);
  redis.auth(rtg.auth.split(':')[1]);
} else {
  // Initiate redis connection for development
  var redis = require('redis').createClient();
  redis.debug_mode = true;
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
  // console.log('Socket: ' + socket.id + ' connected.');

  // Verify connection to Redis and get a list of connected sockets
  if (redis.connected) {
    var connected_socket_ids = Object.keys(io.sockets.connected);
    // Reasonably assume socket.id to be unique
    var index = connected_socket_ids.indexOf(socket.id);
    if ( index >= 0 ) {
      connected_socket_ids.splice(index, 1);
    };

    // console.log('There are ' + connected_socket_ids.length + ' users connected.');
    if (connected_socket_ids.length > 0) {
      connected_socket_ids.forEach( function(id) {
        var usr = new Object();
        usr.id = id;
        redis.hget('user-' + id, id, function(err, reply) {
          usr.displayName = reply;
          socket.emit('user-registered', usr);
        });
      });
    };
  } else {
    // The app will rely on Redis for persistence so we need to introduce some kind of error handling here
    console.error('Cannot connect to Redis. Check the logs for the root cause.');
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
    // Persist the user's vote in redis
    logVote(usr);
    // Emit the vote to *this* socket only
    socket.emit('user-voted', usr);

    // Get the number of connected sockets
    var connected_socket_ids = Object.keys(io.sockets.connected);
    var voteCount = 0;
    redis.keys('user-vote-*', function(err, reply) {
      console.log('**Connected sockets: ' + connected_socket_ids.length);
      voteCount = reply.length;
      console.log('**Vote Count: ' + voteCount);
      if (connected_socket_ids.length == voteCount) {
        // Broadcast the votes
        connected_socket_ids.forEach( function(id) {
          console.log('** Socket: ' + id);
          var vote = new Object();
          vote.id = id;
          redis.hget('user-vote-' + id, id, function(err, reply) {
            vote.vote = reply;
            io.emit('user-voted', vote);
            console.log('**vote sent for ' + vote.id);
          });
        });
      };
    });

    // redis.keys('user-vote-*', function(err, reply) {
    //   console.log(reply.length);
    // });
    // Broadcast the user's vote to all connected sockets
    // io.emit('user-voted', usr);
    console.log('Socket: ' + usr.id + ' voted with ' + usr.vote + '.');
  });

  // Listen for clear-vote
  // Match the clear-vote with the socket ID and broadcast vote-cleared to connected sockets
  socket.on('clear-vote', function() {
    var usr = new Object();
    usr.id = socket.id;
    clearVote(usr);
    io.emit('vote-cleared', usr);
  });

  socket.on('disconnect', function() {
    // Remove the user from Redis on disconnect
    redis.del('user-' + socket.id);
    var usr = new Object();
    usr.id = socket.id;
    clearVote(usr);
    io.emit('user-left', socket.id);
    console.log('Socket: ' + socket.id + ' disconnected.')
  });
});

function remember(user) {
  redis.hset('user-' + user.id, user.id, user.displayName, redis.print);
  console.log(user.displayName + ' added at key: user-' + user.id);
}

function logVote(user) {
  redis.hset('user-vote-' + user.id, user.id, user.vote);
  console.log('Vote added at key: user-vote-' + user.id + ' for ' + user.vote);
}

function clearVote(user) {
  redis.del('user-vote-' + user.id);
  console.log('Vote cleared at key: user-vote-' + user.id);
}

var port = Number(process.env.PORT || 3000);
server.listen(port);
