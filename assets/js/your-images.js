var deleteImages = function(imageIDs) {
    console.log("TODO");
};

$(function() {
    activateToolbarButton("delete", true); 
    addToolbarClickListener("delete", function() {
        var html = "<div id='delete-confirm'>"
            + "Are you sure you want to delete the selected images? "
            + "This action cannot be undone."
            + "<div id='delete-confirm-yesno'>"
            + "<span class='button' onclick='deleteImages(\"" + [] + "\");'>Yes</span>"
            + "<span class='button' onclick='clearOverlay();'>Cancel</span>"
            + "</div></div>";
        showOverlay(html, {
            close: true
        });
    });
});