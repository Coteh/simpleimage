const databaseOps = require("../../lib/database-ops");
const fs = require("fs");
const { assert } = require("chai");

module.exports.addImagesForUser = (imageInfoArr, user) => {
    return new Promise((resolve, reject) => {
        const imagesArr = [];
        imageInfoArr.forEach(function(item) {
            var imageFile = fs.readFileSync("./test/assets/images/" + item.fileName + "");
            imagesArr.push(Object.assign({
                imageBuffer: imageFile,
                mimeType: item.mimeType
            }, item));
        });
    
        const imageResultsArr = [];
        let numAdded = 0;
        imagesArr.forEach((image) => {
            databaseOps.addImage({
                data: image.imageBuffer,
                mimetype: image.mimeType,
                encoding: "7bit",
                username: "test-user"
            }, (err, result) => {
                if (err) {
                    assert.fail("Error uploading test image");
                }
                let imgResult = result.ops[0];
                imageResultsArr.push(imgResult);
                numAdded++;
                if (numAdded >= imagesArr.length) {
                    resolve(imageResultsArr);
                }
            });
        });
    });
};
