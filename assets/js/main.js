require("./sentry");

window.isNotificationOpen = false;

window.clearOverlay = function() {
    var overlayContainer = document.getElementById("overlay-container");
    if (overlayContainer == null) {
        console.error("Cannot clear overlay. No overlay container exists on this page.");
        return;
    }
    var overlayBackdrop = document.getElementById("overlay-backdrop");
    overlayContainer.innerHTML = "";
    overlayContainer.className = "";
    overlayContainer.style = "";
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
    notificationOverlayContainer.style = "";
    window.isNotificationOpen = false;
};

window.constructCloseButton = function(html, onClose) {
    var closeButton = document.createElement("span");
    closeButton.className = "collecticons collecticons-circle-xmark head-icon close-button";
    
    var closeText = document.createElement("span");
    closeText.innerText = " Close";
    
    var closeElement = this.document.createElement("div");
    closeElement.className = "pointer-element container-close-button";
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
    if (options && options.clear) {
        clearNotification();
    }
    var notificationOverlayContainer = document.getElementById("notification-overlay-container");
    var errorMessage = document.createElement("div");
    errorMessage.innerText = message;
    errorMessage.className = "notification-message";
    notificationOverlayContainer.className = "open";
    if (options && options.error) {
        notificationOverlayContainer.classList.add("error");
    }
    if (!window.isNotificationOpen) {
        constructCloseButton(notificationOverlayContainer, clearNotification);
    }
    notificationOverlayContainer.appendChild(errorMessage);
    window.isNotificationOpen = true;
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

window.openRegister = function(callback) {
    var req = new XMLHttpRequest();
    req.onload = function (progressEvent) {
        onOverlayLoaded.call(this, progressEvent, onRegisterLoaded);
        if(callback && typeof callback === "function")
            callback();
    };
    req.open("get", "/register?responseType=json");
    req.send();
};

/*--------------------------------------------*/

const onUsernameChecked = function(username, field) {
    let jsonObj;
    if (this.status === 400) {
        try {
            jsonObj = JSON.parse(this.responseText);
        } catch (err) {
            return console.error("[onUsernameChecked]", "Error occurred when parsing response", err);
        }
        field.classList.add('input-field-error');
        const label = field.nextElementSibling;
        if (label) {
            switch (jsonObj.errorID) {
                case "usernameTooLong":
                    label.innerText = "Username is too long";
                    break;
                default:
                    label.innerText = "Unknown error checking username. Try again later.";
            }
        }
        return;
    } else if (this.status !== 200) {
        return;
    }
    try {
        jsonObj = JSON.parse(this.responseText);
    } catch (err) {
        return console.error("[onUsernameChecked]", "Error occurred when parsing response", err);
    }
    const message = jsonObj.message;
    const exists = message.exists;
    field.classList.add(`input-field-${exists ? "error" : "success"}`);
    const label = field.nextElementSibling;
    if (label) {
        label.innerText = `${username} is ${!exists ? "" : "not "}available`;
    }
}

var onLoginSubmitted = function(form) {
    var jsonObj;
    if (this.status !== 200) {
        try {
            jsonObj = JSON.parse(this.responseText);
        } catch (err) {
            handleResponseFailure(this.status);
            return console.error("[onLoginSubmitted]", "Error occurred when parsing response", err);
        }

        // Show error message on notification overlay
        showNotification(jsonObj.message, {
            error: true,
            clear: true
        });

        // Clear out error style from all input fields.
        for (const inputFieldIndex in form.elements) {
            if (form.elements[inputFieldIndex].classList) {
                form.elements[inputFieldIndex].classList.remove("input-field-error");
            }
        }

        // If there's an additional info specified with this error,
        // attempt to grab the field (or fields) property, associate with name
        // of corresponding input field, and append error style to it.
        if (jsonObj.additionalInfo) {
            var fieldObj = jsonObj.additionalInfo.field || jsonObj.additionalInfo.fields;
            var fieldElems;
            if (typeof fieldObj === "object") {
                fieldElems = fieldObj.reduce(function(obj, field) {
                    obj.push(form.elements[field]);
                    return obj;
                },[]);
            } else {
                fieldElems = [ form.elements[fieldObj] ];
            }
            fieldElems.forEach(function(fieldElem) {
                if (fieldElem) {
                    fieldElem.classList.add("input-field-error");
                }
            });
        }
    } else {
        window.location.reload(true);
    }
};

window.submitLogin = function(e) {
    var form = e.target;
    var action = form.action;
    var req = new XMLHttpRequest();

    req.onload = function() {
        onLoginSubmitted.bind(this)(form);
    };
    req.open("post", action);
    req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    req.send($(form).serialize());
};

window.performUsernameCheck = (e) => {
    const field = e.target;
    // Clear classes for username field (either error or success effects from previous check)
    field.className = "";
    // Also clear message if there was one (when last username check failed)
    const label = field.nextElementSibling;
    if (label) {
        label.innerText = "";
    }
    const username = field.value;
    // If nothing typed, do not request username check
    if (!username) {
        return;
    }
    const req = new XMLHttpRequest();

    req.onload = function () {
        onUsernameChecked.bind(this)(username, field);
    };
    req.open("get", `/check_username?username=${username}`);
    req.send();
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
        const username = $("#input-login-username").val();
        clearOverlay(e);
        openRegister(()=>{
            if (username) $("#input-register-username").val(username);
        });
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
    $("input[name='username']").focusout(function (e) {
        e.preventDefault();
        performUsernameCheck(e);
        return false;
    });
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
