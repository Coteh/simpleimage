window.timeUTCToLocal = function(timeStr) {
    return (new Date(timeStr)).toString();
}

window.convertTimeElementsToLocalTime = function(elem) {
    var timeElem = $(".time", elem)
    timeElem.each(function (index, elem) {
        $elem = $(elem);
        var timeText = $elem.text();
        $elem.text(timeUTCToLocal(timeText));
    });
};

window.numberOfCommentHTMLElements = function(parentElement) {
    return $(parentElement).children().length;
};