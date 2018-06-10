var testImageDB = {};

module.exports.getImage = function (id) {
    return testImageDB[id];
};

module.exports.addImage = function (image) {
    testImageDB[image.id] = image;
};

module.exports.clearImages = function () {
    testImageDB = {};
};

module.exports.updateImage = function (id, properties) {
    testImageDB[id] = Object.assign(testImageDB[id], properties);
};