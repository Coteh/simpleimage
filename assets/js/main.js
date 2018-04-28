window.clearOverlay = function() {
    var overlayContainer = document.getElementById("overlay-container");
    if (overlayContainer == null) {
        console.error("Cannot clear overlay. No overlay container exists on this page.");
        return;
    }
    var overlayBackdrop = document.getElementById("overlay-backdrop");
    overlayContainer.innerHTML = "";
    overlayContainer.className = "";
    overlayBackdrop.className = "";
    clearNotification();
};

window.clearNotification = function() {
    var notificationOverlayContainer = document.getElementById("notification-overlay-container");
    if (notificationOverlayContainer == null) {
        console.error("Cannot clear notification overlay. No notification overlay container exists on this page.");
        return;
    }
    notificationOverlayContainer.innerHTML = "";
    notificationOverlayContainer.className = "";
};

window.constructCloseButton = function(html, onClose) {
    var closeButton = document.createElement("span");
    closeButton.className = "collecticon collecticon-circle-xmark head-icon close-button";
    
    var closeText = document.createElement("span");
    closeText.innerText = " Close";
    
    var closeElement = this.document.createElement("div");
    closeElement.className = "pointer-element";
    closeElement.appendChild(closeButton);
    closeElement.appendChild(closeText);
    closeElement.addEventListener("click", onClose);

    html.insertBefore(closeElement, html.firstChild);
};

window.showOverlay = function(html, options) {
    var overlayContainer = document.getElementById("overlay-container");
    var overlayBackdrop = document.getElementById("overlay-backdrop");
    overlayContainer.innerHTML = html;
    overlayContainer.className = "open";
    overlayBackdrop.className = "activated";
    if (options !== undefined) {
        if (options.error) {
            overlayBackdrop.classList.add("error");
            overlayContainer.classList.add("error");
        }
        if (options.close) {
            constructCloseButton(overlayContainer, clearOverlay);
        }
    }
};

window.showNotification = function(message, options) {
    var notificationOverlayContainer = document.getElementById("notification-overlay-container");
    var errorMessage = document.createElement("div");
    errorMessage.innerText = message;
    errorMessage.className = "notification-message";
    notificationOverlayContainer.className = "open";
    if (options !== undefined) {
        if (options.error) {
            notificationOverlayContainer.classList.add("error");
        }
    }
    constructCloseButton(notificationOverlayContainer, clearNotification);
    notificationOverlayContainer.appendChild(errorMessage);
};

var onOverlayLoaded = function(progressEvent, callback) {
    var err;
    if (this.status !== 200) {
        err = {
            message: this.responseText || "An error occurred"
        }
        //TODO
        showOverlay("<div>" + err.message + "</div>", {
            error: true,
            close: true
        });
    } else {
        var jsonObj = JSON.parse(this.responseText);
        showOverlay(jsonObj.html, {
            close: true
        });
    }
    callback(err);
};

window.openLogin = function() {
    var req = new XMLHttpRequest();
    req.onload = function(progressEvent) {
        onOverlayLoaded.call(this, progressEvent, onLoginLoaded);
    };
    req.open("get", "/login?responseType=json");
    req.send();
};

window.openRegister = function() {
    var req = new XMLHttpRequest();
    req.onload = function (progressEvent) {
        onOverlayLoaded.call(this, progressEvent, onRegisterLoaded);
    };
    req.open("get", "/register?responseType=json");
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
    $("form[id='login-form']").on("submit", function (e) {
        e.preventDefault();
        submitLogin(e);
        return false;
    });
    $("input[name='username']").focus();
    setScalableWidth($("#overlay-container").get(0), 300);
    setScalableHeight($("#overlay-container").get(0), 450);
    $("#register-via-login-button").click(function(e) {
        clearOverlay(e);
        openRegister(e);
    });
    $("form[id='login-form'] .submit-button").click(function() {
        $("form[id='login-form']").submit();
    });
    $("form[id='login-form'] input").on("keydown", function (e) {
        if (e.which === 13) {
            $("form[id='login-form']").submit();
        }
    });
}

function onRegisterLoaded(err) {
    if (err) {
        return;
    }
    $("form[id='register-form']").on("submit", function (e) {
        e.preventDefault();
        submitLogin(e);
        return false;
    });
    $("input[name='username']").focus();
    setScalableWidth($("#overlay-container").get(0), 420);
    setScalableHeight($("#overlay-container").get(0), 400);
    $("form[id='register-form'] .submit-button").click(function (e) {
        $("form[id='register-form']").submit();
    });
    $("form[id='register-form'] input").on("keydown", function(e) {
        if (e.which === 13) {
            $("form[id='register-form']").submit();
        }
    });
}

/*--------------------------------------------*/

function checkForPageScroll() {
    if ($(window).scrollTop() >= 360) {
        $("#top-nav").addClass("mini");
    } else {
        $("#top-nav").removeClass("mini");
    }
}

/*--------------------------------------------*/

function activateMenu(elem, activate) {
    if (activate) {
        elem.addClass("nav-active");
    } else {
        elem.removeClass("nav-active");
    }
}

/*--------------------------------------------*/

$(function() {
    $(window).scroll(function() {
        checkForPageScroll();
    });
    //Sometimes, window scroll event does not fire on page load...
    checkForPageScroll();
    var activateFunc = function () {
        activateMenu($(this), !$(this).hasClass("nav-active"));
    };
    $("#top-nav #user-menu").click(activateFunc);
    $("#top-nav #mobile-menu-button").click(function () {
        activateMenu($("#mobile-menu"), !$(this).hasClass("nav-active"));
        activateMenu($(this), !$(this).hasClass("nav-active"));
    });
    $("#contents").bind("mousedown", function (e) {
        if ($(e.target).closest("#top-nav").length === 0) {
            activateMenu($("#mobile-menu"), false);
            activateMenu($("#top-nav #mobile-menu-button"), false);
        }
    });
});