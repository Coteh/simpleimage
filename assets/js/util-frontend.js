window.timeUTCToLocal = function (timeStr) {
    return new Date(timeStr).toString();
};

window.convertTimeElementsToLocalTime = function (elem) {
    var timeElem = $(".time", elem);
    timeElem.each(function (index, elem) {
        var $elem = $(elem);
        var timeText = $elem.text();
        $elem.text(timeUTCToLocal(timeText));
    });
};

window.numberOfCommentHTMLElements = function (parentElement) {
    return $(parentElement).children().length;
};

window.handleResponseFailure = (status) => {
    const message =
        status === 404
            ? "The server could not be reached. Please try again later."
            : "Unknown error. Please try again later.";
    showNotification(message, {
        error: true,
        clear: true,
        clearAfterMs: 10000,
    });
};
