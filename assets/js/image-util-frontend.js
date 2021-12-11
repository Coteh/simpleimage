// Read image using FileReader and return as promise
window.readImage = function (file) {
    return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function (e) {
            resolve(e.target.result);
        };
        reader.readAsDataURL(file);
    });
};

// Set image src using promise and resolve when it loads
window.setImageSrc = function (img, src) {
    return new Promise(function (resolve, reject) {
        img.onload = function () {
            resolve();
        };
        img.src = src;
    });
};
