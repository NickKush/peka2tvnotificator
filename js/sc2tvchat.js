var urlRegex = new RegExp('(https?:\/\/[^\\s\/$.?#].[^\\s,]*)', 'gi');
var nicknameBoldPattern = new RegExp( '\\[b\\]([\\s\\S]+?)\\[/b\\]', 'gi');

var http;

function setHttp(hack) {
    http = hack;
}

var channelsIndex = {};

var smiles;
var smilesCount;
var smileHtmlReplacement = [];

function setSmiles() {
    http.post('https://funstream.tv/api/smile').then(function(res) {
        smiles = res.data;
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
    // console.log("Indexing Sc2Tv");
    http.post("https://funstream.tv/api/content", {content: "stream", "type": "all", category: {slug: "top"}}).then(function(res){
        for(key in res.data.content) {
            stream = res.data.content[key];
            if(stream.owner !== null && stream.slug !== null) {
                if(channelsIndex[stream.owner.id] === undefined) {
                    channelsIndex[stream.owner.id] = stream.slug;
                }
            }
        }
    });

    setTimeout(indexSc2Tv, 60000);
}

function getUrl(channel, chat) {
    if(channel == "main") {
        return "http://funstream.tv/chat/main";
    }
    else {
        if(chat) {
            return "http://funstream.tv/" + getChannelName(getChannelId(channel));
        } else {
            return "http://sc2tv.ru/" + "channel/" + channelsIndex[getChannelId(channel)];
        }
    }
}

function getChannelName(id) {
    return 'stream/' + getUserName(id)
}

function getUserId(uname) {
    return $http.post("http://funstream.tv/api/user", {id: null, name: uname}).then(function(res) {
        return res.res.data["id"];
    }).catch(function(err) { console.log(err)});
}

function getUserName(uid) {
    return $http.post("http://funstream.tv/api/user", {id : uid, name: null}).then(function(res) {
        return res.data["name"];
    }).catch(function(err) { console.log(err)});
}

function getChannelId(chan) {
    return chan.split('/')[1];
}
