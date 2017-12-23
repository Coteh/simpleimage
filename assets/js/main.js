window.clearOverlay = function() {
    var overlayContainer = document.getElementById("overlay-container");
    var overlayBackdrop = document.getElementById("overlay-backdrop");
    overlayContainer.innerHTML = "";
    overlayContainer.className = "";
    overlayBackdrop.className = "";
};

window.showOverlay = function(html) {
    var overlayContainer = document.getElementById("overlay-container");
    var overlayBackdrop = document.getElementById("overlay-backdrop");
    overlayContainer.innerHTML = "<button onclick='clearOverlay();'>X</button>"
    overlayContainer.innerHTML += html;
    overlayContainer.className = "open";
    overlayBackdrop.className = "activated";
};

window.errorOverlay = function(html) {
    showOverlay(html);
    var overlayBackdrop = document.getElementById("overlay-backdrop");
    overlayBackdrop.classList.add("error");
}

var onOverlayLoaded = function() {
    if (this.status !== 200) {
        //TODO
        errorOverlay("<div>Error</div>");
    } else {
        var jsonObj = JSON.parse(this.responseText);
        showOverlay(jsonObj.html);
    }
};

window.openLogin = function(fromUrl) {
    var req = new XMLHttpRequest();
    req.onload = onOverlayLoaded;
    req.open("get", "/login?responseType=json&fromUrl=" + fromUrl);
    req.send();
};

window.openRegister = function(fromUrl) {
    var req = new XMLHttpRequest();
    req.onload = onOverlayLoaded;
    req.open("get", "/register?responseType=json&fromUrl=" + fromUrl);
    req.send();
};