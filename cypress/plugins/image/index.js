const fetch = require("cross-fetch");
const fs = require("fs");
const pixelmatch = require("pixelmatch");
const PNG = require("pngjs").PNG;
const mongoHelper = require("../mongo");

// https://stackoverflow.com/a/12101012
const arrayBufferToBuffer = (arrBuffer) => {
    const buffer = Buffer.alloc(arrBuffer.byteLength);
    const view = new Uint8Array(arrBuffer);
    for (let i = 0; i < buffer.length; i++) {
        buffer[i] = view[i];
    }
    return buffer;
};

async function compareImageUsingUrl(imageID, url) {
    // first grabs image from db by imageID and saves as buffer
    const imageFromMongo = (await mongoHelper.getImage(imageID)).data.buffer;
    // then grabs image from supplied url and saves it as buffer
    const imageFromUrl = arrayBufferToBuffer(await (await fetch(url)).arrayBuffer());
    // compare buffers for exact match (headers + pixel data)
    return imageFromUrl.equals(imageFromMongo);
}

async function comparePNGImagesUsingFilepath(imageID, filepath) {
    // first grabs image from db by imageID and converts buffer to PNG data using pngjs
    const pngImageFromMongo = PNG.sync.read((await mongoHelper.getImage(imageID)).data.buffer);
    // then grabs image from supplied filepath and saves it as PNG data using pngjs
    const pngImage = PNG.sync.read(fs.readFileSync(filepath));
    // then compares the images using pixelmatch with a 10% threshold to accommodate for any lossy compression
    const res = pixelmatch(
        pngImageFromMongo.data,
        pngImage.data,
        null,
        pngImage.width,
        pngImage.height,
        {
            threshold: 0.1,
        }
    );
    return res === 0;
}

module.exports = {
    compareImageUsingUrl,
    comparePNGImagesUsingFilepath,
};
