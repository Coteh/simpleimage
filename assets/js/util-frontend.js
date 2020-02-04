window.timeUTCToLocal = function(timeStr) {
    return (new Date(timeStr)).toString();
}

window.convertTimeElementsToLocalTime = function(elem) {
    var timeElem = $(".time", elem);
    timeElem.each(function (index, elem) {
        var $elem = $(elem);
        var timeText = $elem.text();
        $elem.text(timeUTCToLocal(timeText));
    });
};

window.numberOfCommentHTMLElements = function(parentElement) {
    return $(parentElement).children().length;
};

window.setScalableWidth = function(elem, width, units) {
    if (units === undefined) {
        units = "px";
    }
    elem.style.width = width.toString() + units;
    elem.style.left = "calc((100vw - " + width.toString() + units + ") / 2)";
};

window.setScalableHeight = function (elem, height, units) {
    if (units === undefined) {
        units = "px";
    }
    elem.style.height = height.toString() + units;
    elem.style.top = "calc((100vh - " + height.toString() + units + ") / 2)";
};