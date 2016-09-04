var app = angular.module('main', ['ngTagsInput']);

app.filter('reverse', function() {
    return function(items) {
        return items.slice().reverse();
    };
});

app.controller("general", function($scope, $http, $sce) {

    $scope.mentions = [];

    var soundNotificationsCookie = Cookies.get("soundNotifications");
    var browserNotificationsCookie = Cookies.get("browserNotifications");
    var chatLocationCookie = Cookies.get("chatLocation");

    $scope.soundNotifications = soundNotificationsCookie == undefined ? true : (soundNotificationsCookie == "true");
    $scope.browserNotifications = browserNotificationsCookie == undefined ? true : (browserNotificationsCookie == "true");
    $scope.chatLocation = chatLocationCookie == undefined ? false : (chatLocationCookie == "true");

    $('#switchSound').attr('checked', $scope.soundNotifications).on('switchChange.bootstrapSwitch', function(event, state) {
        $scope.soundNotifications = state;
        Cookies.set('soundNotifications', state);
    });

    $('#switchBrowserNotification').attr('checked', $scope.browserNotifications).on('switchChange.bootstrapSwitch', function(event, state) {
        $scope.browserNotifications = state;
        Cookies.set('browserNotifications', state);
    });

    $('#switchChatLocation').attr('checked', $scope.chatLocation).on('switchChange.bootstrapSwitch', function(event, state) {
        $scope.chatLocation = state;
        Cookies.set('chatLocation', state);
    });

    var cookieTags = Cookies.getJSON('tags');

    if(cookieTags == undefined)
        cookieTags = [];

    $scope.tags = cookieTags;

    $scope.changedTags = function() {

        var tagArray = [];

        for(key in $scope.tags) {
            var tag = $scope.tags[key].text.toLowerCase();
            tagArray.push(tag);
        }

        Cookies.set("tags", tagArray);
    };

    $scope.openSettings = function() {
        $('#settingsModal').modal('show');
    };

    $(".switch").bootstrapSwitch({
        size: 'mini'
    });

    var websocket = function() {
        var socket = io('wss://chat.funstream.tv', {
            transports: ['websocket'],
            path: '/',
            reconnection: true,
            reconnectionDelay: 500,
            reconnectionDelayMax: 2000,
            reconnectionAttemps: Infinity
        });

        socket.on('connect', function() {
            console.log('socket connected');
            socket.emit('/chat/join', {channel: 'all'}, function(data) {
                console.log('joined');
                indexSc2Tv();
                setSmiles();
            })
        });

        socket.on('connect_error', function(error) {
            console.log('socket connect error');
            console.log(error);
        });

        socket.on('reconnect', function() {
            console.log('socket recconect');
        });

        socket.on('/chat/message', function(message){
            var isContains = false;

            for(key in $scope.tags) {

                if(isContains) {
                    break;
                }

                var tag = $scope.tags[key].text.toLowerCase();
                var bMessage = message.to !== null ? '[b]' + message.to.name + '[/b], ' + message.text : message.text;

                if(tag.lastIndexOf(":ui:") !== -1) {
                    var nickName = message.from.name.toLowerCase();
                    var re = new RegExp('\\b' + tag.replace(":ui:", "") + "\\b");
                    if(nickName.search(re) !== -1) {
                        isContains = false;
                        return;
                    }
                    continue;
                }

                isContains = tagMatcher(tag, bMessage.toLowerCase(), message);
            }

            if(isContains) {
                console.log("Send Notification");
                sendNotification(message);
                return;
            }
        });
    }

    //Говнокода много не бывает
    function tagMatcher(tag, currentMessage, message) {
        if(tag.lastIndexOf(":") !== -1) {

            var nickName = message.from.name.toLowerCase();
            if(nickName.lastIndexOf(tag.replace(":u:", ""), 0) === 0) {
                return true;
            }

            var re = new RegExp('\\b' + tag.replace(":i:", "") + "\\b");
            if(currentMessage.search(re) !== -1) {
                return false
            }
        }

        return currentMessage.toLowerCase().indexOf(tag) !== -1;
    }

    function sendNotification(message) {
        var jsonData = {
            name: message.from.name,
            message: message.to !== null ? '[b]' + message.to.name + '[/b], ' + message.text : message.text,
            date: message.time,
            url: message.channel
        }

        var processedText = processReplaces(jsonData.message);
        var parsedHtml = $.parseHTML(processedText);
        var notificationImage;

        setUrl(jsonData);

        for (var i = 0; i < parsedHtml.length; i++) {
           if (parsedHtml[i].className == "chat-smile") {
               notificationImage = $(parsedHtml[i]).attr("src");
           }
        }

        if(Notification.permission == "granted") {
            if ($scope.browserNotifications) {
               var notification = new Notification(jsonData.name, {
                   icon: notificationImage,
                   body: processedText.replace(/(<([^>]+)>)/ig, "").trim()
               });

               setTimeout(function () {
                   notification.close();
               }, 10000);

               notification.onclick = function () {
                   window.open(jsonData.url);
               }
           }
        }

        jsonData.message = $sce.trustAsHtml(processedText);

        $scope.mentions.push(
            jsonData
        );

        if ($scope.soundNotifications)
            document.getElementById('soundalert').play();

        $scope.$apply();
    }

    if (Notification.permission !== "granted")
        Notification.requestPermission();

    websocket();

    //Это называется гавнокод
    //Люби его
    function setUrl(json) {
        if(json.url === "main") {
            json.url = "http://funstream.tv/chat/main";
            return;
        }
        var c = channelsIndex[getChannelId(json.url)];
        if($scope.chatLocation || c === undefined) {
            setChannelName(json);
        } else {
            json.url = "http://sc2tv.ru/channel/" + c;
        }
    }

    function setChannelName(json) {
        var uid = getChannelId(json.url);
        $.post("https://funstream.tv/api/user", JSON.stringify({id : parseInt(uid)}), function(data) {
            var user = data['name'];
            json.url = 'http://funstream.tv/stream/' + user;
            $scope.$apply();
        });
    }

    function getChannelId(chan) {
        return chan.split('/')[1];
    }
});
