var onUserCommentsLoaded = function (callback) {
    const parentElement = document.getElementById("comments-container");
    parentElement.innerHTML = "";
    const commentsElements = document.createElement("div");
    commentsElements.id = "comments";
    if (this.status !== 200) {
        commentsElements.innerText = "ERROR: Could not get comments.";
        parentElement.appendChild(commentsElements);
        if (callback !== undefined) {
            callback(commentsElements, 0);
        }
        return;
    }
    const commentsResp = JSON.parse(this.responseText);

    if (commentsResp.message) {
        commentsElements.innerText = commentsResp.message;
        parentElement.appendChild(commentsElements);
        if (callback !== undefined) {
            callback(commentsElements, 0);
        }
        return;
    }

    const comments = commentsResp.data;

    commentsElements.innerHTML = comments.reduce((acc, comment) => {
        return (
            acc +
            `
            <div class="comment">
                <a aria-label="Image Link" href="${comment.imagePageURL}">
                    <img alt="Image" style="width:100px" src="${comment.imageURL}">
                </a><br>
                <span class="time">${timeUTCToLocal(comment.postedDate)}</span><br>
                <p>${comment.comment}</p>
            </div>
        `
        );
    }, "");

    parentElement.appendChild(commentsElements);
    if (callback !== undefined) {
        callback(commentsElements, $(commentsElements).children().length);
    }
};

var onUserImagesLoaded = function (callback) {
    var imagesElement = document.createElement("div");
    var parentElement = document.getElementById("images-container");
    var placeholderElement = document.getElementById("images-placeholder");

    imagesElement.style.display = "none";

    if (this.status !== 200) {
        imagesElement.innerHTML =
            "<div class='info-box'>Could not get images due to an error.</div>";
        placeholderElement.style.display = "none";
        imagesElement.style.display = "";
        parentElement.appendChild(imagesElement);
        if (callback !== undefined) {
            callback(imagesElement, 0);
        }
        return;
    }

    const userImagesResp = JSON.parse(this.responseText);
    const userImages = userImagesResp.data;

    parentElement.appendChild(imagesElement);

    var userImagesCount = userImages.length;

    if (userImagesCount === 0) {
        imagesElement.innerHTML =
            "<div class='info-box'>This user has not uploaded any images.</div>";
        placeholderElement.style.display = "none";
        imagesElement.style.display = "";
    } else {
        let elem = document.createElement("div");
        elem.id = "user-images";
        elem.innerHTML = userImages.reduce((acc, userImage) => {
            return (
                acc +
                `<a href="${userImage.url}">
                <img class="user-image" style="max-width: 200px; max-height: 200px;" src="${userImage.imageURL}"/>
            </a>`
            );
        }, "");
        imagesElement.appendChild(elem);

        var loadedCount = 0;

        document.querySelectorAll(".user-image").forEach((elem) => {
            elem.addEventListener("load", function () {
                loadedCount++;
                if (loadedCount >= userImagesCount) {
                    placeholderElement.style.display = "none";
                    imagesElement.style.display = "";
                }
            });
        });
    }

    if (callback !== undefined) {
        callback(imagesElement, userImagesCount);
    }
};

window.requestCommentsUser = function (username, callback) {
    var req = new XMLHttpRequest();
    req.onload = function () {
        var func = onUserCommentsLoaded.bind(this, callback);
        func();
    };
    req.open("get", "/users/" + username + "/comments");
    req.send();
};

window.requestImagesUser = function (username, callback) {
    var req = new XMLHttpRequest();
    req.onload = function () {
        var func = onUserImagesLoaded.bind(this, callback);
        func();
    };
    req.open("get", "/users/" + username + "/images");
    req.send();
};
