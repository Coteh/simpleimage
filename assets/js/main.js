var onLoginLoaded = function() {
    var overlayContainer = document.getElementById("overlay-container");
    if (this.status !== 200) {
        //TODO
        overlayContainer.innerHTML = "Error";
    } else {
        var jsonObj = JSON.parse(this.responseText);
        overlayContainer.innerHTML = jsonObj.html;
    }
};

window.openLogin = function(fromUrl) {
    var req = new XMLHttpRequest();
    req.onload = onLoginLoaded;
    req.open("get", "/login?responseType=json&fromUrl=" + fromUrl);
    req.send();
};