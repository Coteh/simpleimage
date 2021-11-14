const databaseOps = require("../../lib/database-ops");
const fs = require("fs");
const { assert } = require("chai");
const server = require("../../lib/server");
const chai = require("chai");
const chaiHTTP = require("chai-http");

chai.use(chaiHTTP);

module.exports.getServerAgent = () => {
    return chai.request.agent(server.app);
};

// TODO refactor all usages of databaseOps.addUser in tests to use this instead
module.exports.addUser = (user, password, email) => {
    return new Promise((resolve, reject) => {
        databaseOps.addUser({
            username: user,
            password: password,
            email: email,
        }, (err) => {
            if (err) {
                return reject(new Error(`User could not be created ${JSON.stringify(err)}`));
            }
            resolve();
        });
    });
};

module.exports.addImagesForUser = (imageInfoArr, user) => {
    return new Promise((resolve, reject) => {
        const imagesArr = [];
        imageInfoArr.forEach(function(item) {
            var imageFile = fs.readFileSync("./test/assets/images/" + item.fileName);
            imagesArr.push(Object.assign({
                imageBuffer: imageFile,
            }, item));
        });
    
        const imageResultsArr = [];
        let numAdded = 0;
        imagesArr.forEach((image) => {
            databaseOps.addImage({
                data: image.imageBuffer,
                mimetype: image.mimeType,
                encoding: "7bit",
                username: user,
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

module.exports.assertUserLogin = (agent, username, password) => {
    return new Promise((resolve, reject) => {
        agent.post("/login")
            .type("form")
            .send({
                username,
                password,
            })
            .then((res) => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`Cannot log in: resp: ${JSON.stringify(res.body)}`));
                }
                resolve(res);
            })
            .catch((err) => {
                reject(err);
            });
    });
};

module.exports.assertBuffers = (actualBuffer, expectedBuffer) => {
    assert(actualBuffer.equals(expectedBuffer), "Buffers don't match");
};

module.exports.getImageExt = (mimeType) => {
    switch (mimeType) {
        case "image/png":
            return "png";
        case "image/jpeg":
            return "jpeg";
        case "image/bmp":
            return "bmp";
        case "image/gif":
            return "gif";
    }
}
