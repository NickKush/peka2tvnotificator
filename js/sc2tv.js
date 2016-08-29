var urlRegex = new RegExp('(https?:\/\/[^\\s\/$.?#].[^\\s,]*)', 'gi');
var nicknameBoldPattern = new RegExp( '\\[b\\]([\\s\\S]+?)\\[/b\\]', 'gi');

var channelsIndex = {};

var smiles;
var smilesCount;
var smileHtmlReplacement = [];

function setSmiles() {
    $.post('https://funstream.tv/api/smile', function(data) {
        smiles = data;
        smilesCount = smiles.length;
        for(var i = 0; i < smilesCount; i++) {
            smileHtmlReplacement[i] =
                '<img src="' + smiles[i].url +
                '"width="' + smiles[i].width +
                '"height="' + smiles[i].height +
                '"class="chat-smile"/>';
        }
    });
}

function processReplaces( message ) {
    var message = urlReplace(message);

    message = message.replace( /:([-a-z0-9]{2,}):/gi, function(match, code) {
        var indexOfSmileWithThatCode = -1;
        for (var i = 0; i < smilesCount; i++) {
            if (smiles[i].code == code) {
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
