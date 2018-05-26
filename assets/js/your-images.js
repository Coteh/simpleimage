function YourImages() {
    this.imageIDs = [];
    this.selectables = [];
};

YourImages.prototype.deleteAllSelectables = function() {
    this.selectables.forEach(function(elem) {
        SelectableActions.removeSelectable(elem);
    });
};

YourImages.prototype.clearImageIDs = function() {
    this.imageIDs = [];
};

YourImages.prototype.clearSelectables = function() {
    this.selectables = [];
};

var onImageDeletionRequestCompleted = function() {
    var jsonObj = JSON.parse(this.responseText);
    var statusCode = parseInt(this.status);
    var isError = (statusCode >= 400);
    showNotification(jsonObj.message, {
        error: isError
    });
    setTimeout(clearNotification, 2000);
    if (statusCode === 200) {
        yourImages.deleteAllSelectables();
        yourImages.clearImageIDs();
        yourImages.clearSelectables();
    }
};

window.deleteImages = function(imageIDs) {
    // TODO Perform delete call here
    if (imageIDs.length === 0) {
        var errMsg = "No images selected for deletion.";
        console.error(errMsg);
        showNotification(errMsg, {
            error: true
        });
        setTimeout(clearNotification, 2000);
        return;
    }
    console.log(imageIDs);
    var req = new XMLHttpRequest();
    req.addEventListener("loadend", onImageDeletionRequestCompleted);
    req.open("delete", "/images?type=json");
    req.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    req.send(JSON.stringify({
        ids: imageIDs
    }));
};

$(function() {
    activateToolbarButton("delete", true); 
    addToolbarClickListener("delete", function() {
        var html = "<div id='delete-confirm'>"
            + "Are you sure you want to delete the selected images? "
            + "This action cannot be undone."
            + "<div id='delete-confirm-yesno'>"
            + "<span class='button' id='delete-images-btn'>Yes</span>"
            + "<span class='button' onclick='clearOverlay();'>Cancel</span>"
            + "</div></div>";
        showOverlay(html, {
            close: true
        });
        var deleteBtn = document.querySelector("#delete-confirm #delete-images-btn");
        deleteBtn.addEventListener("click", function() {
            clearOverlay();
            deleteImages(yourImages.imageIDs);
        });
    });
    SelectableActions.addOnSelectedListener(function(selectable) {
        yourImages.imageIDs = yourImages.imageIDs.concat(selectable.dataset.imageId);
        yourImages.selectables = yourImages.selectables.concat(selectable);
    });
    SelectableActions.addOnDeselectedListener(function (selectable) {
        yourImages.imageIDs = yourImages.imageIDs.filter(function(value) {
            return (value !== selectable.dataset.imageId);
        });
        yourImages.selectables = yourImages.selectables.filter(function(value) {
            return (value !== selectable);
        });
    });
});

window.yourImages = new YourImages();