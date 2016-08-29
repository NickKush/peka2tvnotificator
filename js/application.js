var app = angular.module('main', ['ngTagsInput']);

var urlRegex = new RegExp('(https?:\/\/[^\\s\/$.?#].[^\\s,]*)', 'gi');
var nicknameBoldPattern = new RegExp( '\\[b\\]([\\s\\S]+?)\\[/b\\]', 'gi');

var channelsIndex = {};

var smiles;
var smilesCount;
var smileHtmlReplacement = [];

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
            for(key in $scope.tags) {
                tag = $scope.tags[key].text.toLowerCase()
                if(message.text.toLowerCase().indexOf(tag) !== -1) {
                    console.log("Send Notification by tag: " + tag);
                    sendNotification(message);
                    return;
                }
            }
        });
    }

    function sendNotification(message) {
        var jsonData = {
            name: message.from.name,
            message: message.text,
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

        // if ($scope.soundNotifications)
        //     document.getElementById('soundalert').play();

        $scope.$apply();
    }

    if (Notification.permission !== "granted")
        Notification.requestPermission();

    websocket();

    function setSmiles() {
        $.post('https://funstream.tv/api/smile', function(data) {
            smiles = data;
            smilesCount = smiles.length;
            for( i = 0; i < smilesCount; i++ ) {
                smileHtmlReplacement[i] =
                    '<img src="' + smiles[i].url +
                    '" width="' + smiles[i].width +
                    '" height="' + smiles[i].height +
                    '" class="chat-smile"/>';
            }
        });
    }

    function processReplaces( message ) {
        var message = urlReplace(message);

        message = message.replace( /:([-a-z0-9]{2,}):/gi, function( match, code ) {
            var indexOfSmileWithThatCode = -1;
            for ( var i = 0; i < smilesCount; i++ ) {
                if ( smiles[i].code == code ) {
                    indexOfSmileWithThatCode = i;
                    break;
                }
            };

            var replace = '';
            if (indexOfSmileWithThatCode != -1) {
                replace = smileHtmlReplacement[indexOfSmileWithThatCode];
            } else {
                replace = match;
            }
            return replace;
        });

        return message;
    }

    function urlReplace(inputText) {
        inputText = inputText.replace(urlRegex, function(url) {
            if(url.length > 60) {
                return '<a href="' + url + '" target="_blank">' + url.substr(0, 45) + '...' + url.slice(-15) + '</a>';
            }
            return '<a href="' + url + '" target="_blank">' + url + '</a>';
        });

        inputText = inputText.replace(nicknameBoldPattern, '<b>$1</b>' );
        return inputText;
    }

    function indexSc2Tv() {
        console.log("Indexing Sc2Tv");
        $.post("https://funstream.tv/api/content", {content: "stream", "type": "all", category: {slug: "top"}}, function(data){
            for(key in data.content) {
                stream = data.content[key];
                if(stream.owner !== null && stream.slug !== null) {
                    if(channelsIndex[stream.owner.id] === undefined) {
                        channelsIndex[stream.owner.id] = stream.slug;
                    }
                }
            }
        });
        setTimeout(indexSc2Tv, 60000);
    }

    //Это называется гавнокод
    //Люби его
    function setUrl(json) {
        if(json.url == "main") {
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
        $.post("http://funstream.tv/api/user", JSON.stringify({id : parseInt(uid)}), function(data) {
            var user = data['name'];
            json.url = 'http://funstream.tv/stream/' + user;
            $scope.$apply();
        });
    }

    function getChannelId(chan) {
        return chan.split('/')[1];
    }

});
