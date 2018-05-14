window.activateToolbarButton = function(actionName, activate) {
    window.toolbarSelector.children().each(function(index, elem) {
        if (elem.dataset.actionName === actionName) {
            if (activate) {
                elem.classList.remove("deactivated");
            } else {
                elem.classList.add("deactivated");
            }
        }
    });
};

$(function () {
    window.toolbarSelector = $(".toolbar");
});