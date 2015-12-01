angular.module('myApp.collaboration-page', ['ngRoute'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/collaboration-page/:id', {
    authenticate: true,
    templateUrl: 'view/collaboration-page/collab.html',
    controller: 'collaboration-page',
    resolve: {
      getProjectInfo: ['$route', 'Project', function($route, Project) {
          return Project.getInfos($route.current.params.id);
      }],
      getProjectUsers: ['$route', 'Project', function($route, Project) {
          return Project.getUsers($route.current.params.id);
      }]
    }
  });
}])

.controller('collaboration-page', ['$scope', '$cookies', 'Cookie', 'socket', 'getProjectInfo', 'getProjectUsers', '$uibModal', 'Project', function($scope, $cookies, Cookie, socket, getProjectInfo, getProjectUsers, $uibModal, Project) {

  var projectInfos = getProjectInfo.project;
  $scope.projectInfos = projectInfos;
  //store old project info for database lookup
  var oldProjectInfo = projectInfos
  
  var projectUsers = getProjectUsers;
  $scope.projectUsers = projectUsers.users;
  console.log('project: ', projectInfos)
  console.log('users: ', projectUsers);

  var cookie = $cookies.get('gitConnectDeltaKS');
  var cookieObj = Cookie.parseCookie(cookie);
  $scope.username = cookieObj.username;
  $scope.currentRoom = $scope.projectInfos.projectId;
  $scope.avatar = cookieObj.avatar;
  $scope.messages = [];
  $scope.currentTime;
  $scope.displayName;
  $scope.actualName;
  
  var getOwnName = function() {
    for(var i = 0; i < $scope.projectUsers.length; i++) {
      if($scope.projectUsers[i].username === $scope.username) {
        $scope.actualName = $scope.projectUsers[i].name;
        return $scope.actualName + '(' + $scope.username + ')';
      }
    }
  }

  $scope.displayName = getOwnName();

  // $scope.projectInfo = {
  //   name: 'GitConnect',
  //   description: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  //   tech: ['HTML5', 'JavaScript', 'Firebase', 'MySql'],
  //   github_url: 'https://github.com/deltathesis/gitconnect'
  //   }

  // $scope.resources = {
  //   project_repo: 'https://github.com/deltathesis/gitconnect',
  //   scrum_board: 'https://trello.com/b/QNvGVucJ/gameplan',
  //   website: "",
  //   storage: "",
  //   database: "",
  //   code_library: ""
  // }


  /** Socket Listeners **/

  socket.emit('initCollab', {
    name: $scope.username,
    collabRoom: $scope.projectInfos.projectId
  });

  // listen to initializer
  socket.on('initCollab', function(data) {
    if(data[$scope.currentRoom]) {
      $scope.messages = data[$scope.currentRoom];
    }
  })

  //listens to sent message
  socket.on('send:collabMessage' , function(data) {
    $scope.messages.push(data);
  })

  $scope.messageSubmit = function(){
    if($scope.text){
    var currentTime = new Date();
      socket.emit('send:collabMessage', {
        room: $scope.currentRoom,
        message: $scope.text,
        date: currentTime,
        name: $scope.displayName,
        avatar: $scope.avatar
      })

      $scope.messages.push({
        avatar: $scope.avatar,
        username: $scope.displayName,
        message: $scope.text,
        date: currentTime
      });

      var roomObj = {};
      roomObj[$scope.currentRoom] = $scope.messages;
      socket.emit('store:collabData', angular.copy(roomObj));

      $scope.text = "";
    }
  };

  // // Remove modal backdrop bug display
  // $scope.removeModal = function() {
  //   $('.modal-backdrop').remove();
  // }

  /***********************MODALS to publish your project ***************************/

  $scope.publish = function(size){
    var modalInstance = $uibModal.open({
      animation: $scope.animationsEnabled,
      templateUrl: 'view/collaboration-page/projectForm.html',
      controller: 'publish',
      resolve: {
        project: function(){
          return $scope.projectInfos
        }
      },
      size: size
    });

    modalInstance.result.then(function(obj){
      //update the project in the database
      Project.updateProject(obj.updatedProjectInfo, oldProjectInfo);
      Project.relateProject(obj.techs);
      $scope.projectInfos = obj.updatedProjectInfo;
      //TODO:
        //make an ajax call to relate the project with all its languages

    })
  }

  /*******************MODAL to edit resources******************************/
  $scope.editResources = function(size){
    var modalInstance = $uibModal.open({
      animation: $scope.animationsEnabled,
      templateUrl: 'view/collaboration-page/resources.html',
      controller: 'editResources',
      size: size,
      resolve: {
        project: function(){
          return $scope.projectInfos
        }
      }
    });
    modalInstance.result.then(function(updatedResources){
      Project.updateProject(updatedResources, oldProjectInfo);
      $scope.projectInfos = updatedResources;
    })
  }

}])

.controller('publish', ['$scope', '$uibModal', 'techList', '$uibModalInstance', 'project', function($scope, $uibModal, techList, $uibModalInstance, project){
  
  $scope.projectInfo = project
  $scope.techList = techList.getTechList();
  $scope.yourTechList = [];
  $scope.addTech = function(tech, index){
    if ($scope.yourTechList.indexOf(tech) !== -1) {
      $scope.techList.splice(index, 1);

      //remove the default null language if it exists
    } else if ($scope.yourTechList.indexOf('null') !== -1){
      $scope.yourTechList.splice($scope.yourTechList.indexOf('null'), 1) 
    } else {
      $scope.yourTechList.push(tech);
      $scope.techList.splice(index, 1);
      $scope.searchText = '';
    }
  };
  $scope.removeTech = function(tech, index) {
    $scope.techList.push(tech); 
    $scope.yourTechList.splice(index, 1);  
  };


  $scope.ok = function(){
    // pass change published property to true, add published date and pass in list of languages used to previous controller to relate project node to those technologies

    $scope.projectInfo.published = 'true';
    $scope.projectInfo.publishDate = new Date();

    var obj = {}
    obj.projectInfo = $scope.projectInfo;
    obj.techs = $scope.yourTechList;

    $uibModalInstance.close(obj);

  }

  $scope.cancel = function(){
    $uibModalInstance.dismiss('cancel');
  }
}])

.controller('editResources', ['$scope', '$uibModal', '$uibModalInstance', 'project', function($scope, $uibModal, $uibModalInstance, project){

  $scope.projectInfo = project;

  $scope.ok = function(){
    $uibModalInstance.close($scope.projectInfo);
  }

  $scope.cancel = function(){
    $uibModalInstance.dismiss('cancel');
  }
}])

