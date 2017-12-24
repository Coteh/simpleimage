window.clearOverlay = function() {
    var overlayContainer = document.getElementById("overlay-container");
    var overlayBackdrop = document.getElementById("overlay-backdrop");
    overlayContainer.innerHTML = "";
    overlayContainer.className = "";
    overlayBackdrop.className = "";
};

window.clearNotification = function() {
    var notificationOverlayContainer = document.getElementById("notification-overlay-container");
    notificationOverlayContainer.innerHTML = "";
    notificationOverlayContainer.className = "";
}

window.showOverlay = function(html, options) {
    var overlayContainer = document.getElementById("overlay-container");
    var overlayBackdrop = document.getElementById("overlay-backdrop");
    overlayContainer.innerHTML = "<button onclick='clearOverlay();'>X</button>"
    overlayContainer.innerHTML += html;
    overlayContainer.className = "open";
    overlayBackdrop.className = "activated";
    if (options !== undefined) {
        if (options.error) {
            overlayBackdrop.classList.add("error");
            overlayContainer.classList.add("error");
        }
    }
};

window.showNotification = function(message, options) {
    var notificationOverlayContainer = document.getElementById("notification-overlay-container");
    notificationOverlayContainer.innerHTML = "<button onclick='clearNotification();'>X</button><br><br>"
    notificationOverlayContainer.innerHTML += message;
    notificationOverlayContainer.className = "open";
    if (options !== undefined) {
        if (options.error) {
            notificationOverlayContainer.classList.add("error");
        }
    }
};

var onOverlayLoaded = function(progressEvent, callback) {
    var err;
    if (this.status !== 200) {
        err = {
            message: this.responseText || "An error occurred"
        }
        //TODO
        showOverlay("<div>" + err.message + "</div>", {
            error: true
        });
    } else {
        var jsonObj = JSON.parse(this.responseText);
        showOverlay(jsonObj.html);
    }
    callback(err);
};

window.openLogin = function(fromUrl) {
    var req = new XMLHttpRequest();
    req.onload = function(progressEvent) {
        onOverlayLoaded.call(this, progressEvent, onLoginLoaded);
    };
    req.open("get", "/login?responseType=json&fromUrl=" + fromUrl);
    req.send();
};

window.openRegister = function(fromUrl) {
    var req = new XMLHttpRequest();
    req.onload = onOverlayLoaded;
    req.open("get", "/register?responseType=json&fromUrl=" + fromUrl);
    req.send();
};

/*--------------------------------------------*/

var onLoginSubmitted = function() {
    var jsonObj;
    if (this.status !== 200) {
        jsonObj = JSON.parse(this.responseText);
        showNotification(jsonObj.message, {
            error: true
        });
    } else {
        window.location.reload(true);
    }
};

window.submitLogin = function(e) {
    var form = e.target;
    var action = form.action;
    var req = new XMLHttpRequest();

    req.onload = onLoginSubmitted;
    req.open("post", action);
    req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    req.send($(form).serialize());
};

function onLoginLoaded(err) {
    if (err) {
        return;
    }
    $("form[id='login']").on("submit", function (e) {
        e.preventDefault();
        submitLogin(e);
        return false;
    });
}