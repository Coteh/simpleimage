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

var onLoginLoaded = function() {
    if (this.status !== 200) {
        //TODO
        showOverlay("Error");
    } else {
        var jsonObj = JSON.parse(this.responseText);
        showOverlay(jsonObj.html);
    }
};

window.openLogin = function(fromUrl) {
    var req = new XMLHttpRequest();
    req.onload = onLoginLoaded;
    req.open("get", "/login?responseType=json&fromUrl=" + fromUrl);
    req.send();
};