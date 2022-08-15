var app = angular.module('main', ['ngTagsInput']);

var siteUrl = 'https://sc2tv.ru';

app.filter('reverse', function() {
    return function(items) {
        return items.slice().reverse();
    };
});

app.controller("general", function($scope, $http, $sce) {

    $scope.mentions = [];

    var soundNotificationsCookie = localStorage.getItem("soundNotifications");
    var browserNotificationsCookie = localStorage.getItem("browserNotifications");

    $scope.soundNotifications = soundNotificationsCookie == undefined ? true : (soundNotificationsCookie == "true");
    $scope.browserNotifications = browserNotificationsCookie == undefined ? true : (browserNotificationsCookie == "true");

    $('#switchSound').attr('checked', $scope.soundNotifications).on('switchChange.bootstrapSwitch', function(event, state) {
        $scope.soundNotifications = state;
        localStorage.setItem('soundNotifications', state);
    });

    $('#switchBrowserNotification').attr('checked', $scope.browserNotifications).on('switchChange.bootstrapSwitch', function(event, state) {
        $scope.browserNotifications = state;
        localStorage.setItem('browserNotifications', state);
    });

    var localTags = JSON.parse(localStorage.getItem('tags'));

    if(localTags == undefined)
        localTags = [];

    $scope.tags = localTags;

    $scope.changedTags = function() {
        localTags = $scope.tags;
        localTags.sort(compareTags);
        localStorage.setItem("tags", JSON.stringify(localTags));
    };

    //Сортируем теги для работы нашего велосипеда
    //Временный велосипед
    //Когда не будет лень переделаю всё к херам
    function compareTags(a, b) {
        var sTag = ":";
        if(a.text.lastIndexOf(sTag) !== -1 && b.text.lastIndexOf(sTag) === -1) {
            return -1;
        }
        if(a.text.lastIndexOf(sTag) === -1 && b.text.lastIndexOf(sTag) !== -1) {
            return 1;
        }
        if(a.text.lastIndexOf(sTag) !== -1 && b.text.lastIndexOf(sTag) !== -1) {
            if(a.text.lastIndexOf(tagIgnoreUser) !== -1 && b.text.lastIndexOf(tagIgnoreUser) === -1) {
                return -1;
            }
            if(a.text.lastIndexOf(tagIgnoreUser) === -1 && b.text.lastIndexOf(tagIgnoreUser) !== -1) {
                return 1;
            }
        }
        return 0;
    }

    $scope.openSettings = function() {
        $('#settingsModal').modal('show');
    };

    $(".switch").bootstrapSwitch({
        size: 'mini'
    });

    var websocket = function() {
        var socket = io('wss://chat.sc2tv.ru', {
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
                pekatv.setSmiles();
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

            var mes = message.to !== null ? '[b]' + message.to.name + '[/b], ' + message.text : message.text;
            mes = mes.toLowerCase();

            var isContains = false;

            for(key in localTags) {

                if(isContains)
                    break;

                var tag = localTags[key].text.toLowerCase();

                if(tag.lastIndexOf(tagIgnoreUser) !== -1) {
                    var nickName = message.from.name.toLowerCase();
                    var re = new RegExp('\\b' + tag.replace(tagIgnoreUser, "") + "\\b");
                    if(nickName.search(re) !== -1) {
                        isContains = false;
                        return;
                    }
                    continue;
                }

                if(tag.lastIndexOf(tagIgnore) !== -1) {
                    var re = new RegExp('\\b' + tag.replace(tagIgnore, "") + "\\b");
                    if(mes.search(re) !== -1) {
                        isContains = false;
                        mes = mes.replace(re, "");
                    }
                    continue;
                }

                isContains = tagMatcher(tag, mes, message);
            }

            if(isContains) {
                //console.log("Send Notification");
                sendNotification(message);
                return;
            }
        });
    }

    var tagUsername = ":u:";
    var tagIgnore = ":i:";
    var tagIgnoreUser = ":ui:";

    function tagMatcher(tag, currentMessage, message) {
        return tag.lastIndexOf(tagUsername) !== -1 ?
        message.from.name.toLowerCase().lastIndexOf(tag.replace(tagUsername, ""), 0) === 0 :
        currentMessage.toLowerCase().indexOf(tag) !== -1;
    }

    function sendNotification(message) {
        var jsonData = {
            name: message.from.name,
            message: message.to !== null ? '[b]' + message.to.name + '[/b], ' + message.text : message.text,
            date: message.time,
            url: message.channel
        }

        var processedText = pekatv.messageReplaces(jsonData.message);
        var parsedHtml = $.parseHTML(processedText);
        var notificationImage;

        getUrl(jsonData);

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

    function getUrl(json) {
        if(json.url === "main") {
            json.url = "http://sc2tv.ru/main/chat";
            return;
        }

        if(json.url.startsWith('comments/article')) {
            setArticleUrl(json);
            return;
        }

        setChannelUrl(json);
        return;
    }

    function setArticleUrl(json) {
        var aid = getId(json.url);
        $.post(siteUrl + '/api/article/get', JSON.stringify({id : parseInt(aid)}), function(data) {
            var atricleSlug = data['slug'];
            json.url = 'http://sc2tv.ru' + atricleSlug;
            $scope.$apply();
        });
    }

    function setChannelUrl(json) {
        var uid = getId(json.url);
        $.post(siteUrl + '/api/user', JSON.stringify({id : parseInt(uid)}), function(data) {
            var channelSlug = data['slug'];
            json.url = 'http://sc2tv.ru/' + channelSlug;
            $scope.$apply();
        });
    }

    function getId(channel) {
        return channel.split('/').pop();
    }
});
