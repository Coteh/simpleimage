window.YourImages = {
    imageIDs: []
};

window.deleteImages = function(imageIDs) {
    // TODO Perform delete call here
    if (imageIDs.length === 0) {
        console.error("No images selected for deletion.");
        return;
    }
    console.log("Deleting " + imageIDs.toString() + "...");
};

$(function() {
    activateToolbarButton("delete", true); 
    addToolbarClickListener("delete", function() {
        var html = "<div id='delete-confirm'>"
            + "Are you sure you want to delete the selected images? "
            + "This action cannot be undone."
            + "<div id='delete-confirm-yesno'>"
            + "<span class='button' onclick='deleteImages(\"" + YourImages.imageIDs + "\");'>Yes</span>"
            + "<span class='button' onclick='clearOverlay();'>Cancel</span>"
            + "</div></div>";
        showOverlay(html, {
            close: true
        });
    });
    SelectableActions.addOnSelectedListener(function(selectable) {
        YourImages.imageIDs = YourImages.imageIDs.concat(selectable.dataset.imageId);
        console.log(YourImages.imageIDs);
    });
    SelectableActions.addOnDeselectedListener(function (selectable) {
        YourImages.imageIDs = YourImages.imageIDs.filter(function(value) {
            return (value !== selectable.dataset.imageId);
        });
        console.log(YourImages.imageIDs);
    });
});