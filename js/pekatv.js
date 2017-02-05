var urlRegex = new RegExp('(https?:\/\/[^\\s\/$.?#].[^\\s,]*)', 'gi');
var nicknameBoldPattern = new RegExp( '\\[b\\]([\\s\\S]+?)\\[/b\\]', 'gi');

var pekatv = (function(){

    var smiles;
    var smilesCount;
    var smileHtmlReplacement = [];

    var setSmiles = function() {
        $.post(siteUrl + '/api/smile', function(data) {
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
    };

    var urlReplace = function( inputText ) {
        inputText = inputText.replace(urlRegex, function(url) {
            if(url.length > 60) {
                return '<a href="' + url + '" target="_blank">' + url.substr(0, 45) + '...' + url.slice(-15) + '</a>';
            }
            return '<a href="' + url + '" target="_blank">' + url + '</a>';
        });

        inputText = inputText.replace(nicknameBoldPattern, '<b>$1</b>' );
        return inputText;
    };

    var messageReplaces = function( message ) {
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
    };

    return {
        messageReplaces: messageReplaces,
        setSmiles: setSmiles
    };

})();
