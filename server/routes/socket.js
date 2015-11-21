var Firebase = require('firebase');
var firebase = new Firebase('https://deltadage.firebaseio.com/');

//all users online that are connected to the socket
var people = {};

//all private Messaging rooms
var rooms = {};
var users = {};

//collabMessages, currently not in room format yet
var collabRooms = [];

var retrieveData = function () {
  firebase.once("value", function(data) {
    if(data.val()) {  
      rooms = data.val().rooms;
      collabRooms = data.val().collab;
      users = data.val().users;
    }
  });
}

retrieveData();

// export function for listening to the socket
module.exports = function (socket) {

  var name;
  console.log('user connected');
  
  retrieveData();
  console.log('collabRooms', collabRooms);

  //init data for the user
  socket.on('myusername', function(data) {
    name = data;
    people[data] = socket;
    var peopleArray = [];
    var roomsObj = {};

    for(var key in people) {
      peopleArray.push(key);
    }

    for(var key in rooms) {
      if(rooms[key].users.indexOf(name) > -1) {
        socket.join(key);
        roomsObj[key] = rooms[key];
        console.log('joined ' + name + ' to room: ', key);
      }
    }

    socket.emit('init', {
      name: data,
      users: peopleArray,
      rooms: roomsObj
    })
    socket.broadcast.emit('bigInit', {
      users: peopleArray
    })
  });

  // join two users into a privateMessaging room
  socket.on('join:privateRoom', function(data) {
    for(var key in people) {
      if(key === data.users[0]) {
        console.log('joined myself to Room: ', data.roomName);
        people[key].join(data.roomName);
      }
      if(key === data.users[1]) {
        console.log('joined ' + data.users[1] + ' to ' + data.roomName);
        people[key].join(data.roomName);
      }
    }
  });

  //sends Messages to room
  socket.on('send:privateMessage', function(data) {
    socket.to(data.room).emit('send:message', {
      room: data.room,
      user: name,
      text: data.message
    });
    socket.emit('insertData');
  });

  // notify other clients that a new user has joined
  socket.broadcast.emit('user:join', {
    name: name
  });

  // broadcast a user's message to other people
  socket.on('send:message', function (data) {
    socket.broadcast.emit('send:message', {
      user: name,
      text: data.message
    });
  });

  //stores private messaging data into firebase
  socket.on('storeData', function(data) {
    var userRef = firebase.child('rooms');
    if(data){
      userRef.update(data);
    }
  });

  /** Collab Page Socket Functions **/

  //intialized username and adds socket info to people array
  socket.on('initCollab', function(data) {
    name = data;
    people[data] = socket;
    socket.emit('initCollab', collabRooms);
  });

  //stores collab message data into firebase
  socket.on('store:collabData', function(data) {
    var userRef = firebase.child('collab');
    if(data) {
      userRef.update(data);
    }
  });

  socket.on('send:collabMessage', function(data) {
    socket.broadcast.emit('send:collabMessage', {
      username: name,
      message: data.message,
      date: data.date
    });
  });
  /** End of Collab Page Socket Functions **/

  socket.on('notify', function(data){
     var fireUsers = firebase.child('users');
     var fireTargetUser = fireUsers.child(data.target);
     for(var key in people){
      if(key === data){
        return
      }
     }
     fireTargetUser.transaction(function(number){
      return (number || 0) + 1;
     }, function(err, committed, snapshot){
      if(!err){
        var temporary = {};
        temporary[data.currentUser] = 0;
        fireUsers.update(temporary);
        firebase.once("value", function(values) {
          if(values.val()) {  
            users = values.val().users;
            socket.emit('theDATA', users[data.currentUser]);
          }
        });
      }
     });
  })

  // clean up when a user leaves, and broadcast it to other people
  socket.on('disconnect', function () {
    console.log('user disconnected');
    socket.broadcast.emit('user:left', {
      name: name
    });
    delete people[name];
  });
//TODO EMIT ACTUAL FIREBASE DATA SOCKET.EMIT THEDATA
  socket.on('giveMeDATA', function(data){
    socket.emit('theDATA', users[data.username]);
  })
};
