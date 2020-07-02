var testImageDB = {};

module.exports.getImage = function (id) {
    return testImageDB[id];
};

module.exports.getImages = function (ids) {
    return ids.map(function (id) {
        return module.exports.getImage(id);
    });
};

module.exports.addImage = function (image) {
    testImageDB[image.id] = image;
};

module.exports.addImages = function (images) {
    images.forEach(function (image) {
        module.exports.addImage(image);
    });
};

module.exports.clearImages = function () {
    testImageDB = {};
};

module.exports.updateImage = function (id, properties) {
    testImageDB[id] = Object.assign(testImageDB[id], properties);
};

module.exports.updateManyImages = function (ids, properties) {
    ids.forEach(function (id) {
        module.exports.updateImage(id, properties);
    });
};

module.exports.unsetImageProperty = function (id, properties) {
    var propNames = Object.keys(properties);
    var image = module.exports.getImage(id);
    propNames.forEach(function (propName) {
        delete image[propName];
    });
};

module.exports.unsetImagePropertyMany = function (ids, properties) {
    ids.forEach(function (id) {
        module.exports.unsetImageProperty(id, properties);
    });
};