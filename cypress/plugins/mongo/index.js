const mongoist = require("mongoist");
const auth = require("../../../lib/auth");

const db = mongoist("mongodb://si-user:hunter2@localhost:27017/simpleimage");

async function deleteUser(username) {
    // TODO update mongodb driver for updated remove method
    await db.users.remove({
        username,
    });
}

async function addUser(username, password, email) {
    await db.users.insert({
        username: username,
        password: await auth.hashPassword(password),
        email: email,
        join_date: new Date(),
    });
}

async function getUser(username) {
    return await db.users.findOne({
        username,
    });
}

async function getImagesForUser(username) {
    return await db["image-entries"].find({
        username,
    });
}

async function getCommentsForUser(username) {
    return await db.comments.find({
        username,
    });
}

async function getCommentsForImage(imageID) {
    return await db.comments.find({
        image_id: imageID,
    });
}

async function getImage(imageID) {
    return await db["image-entries"].findOne({
        id: imageID,
    });
}

async function deleteImage(imageID) {
    // TODO update mongodb driver for updated remove method
    await db["image-entries"].remove({
        id: imageID,
    });
}

async function deleteImagesFromUser(username) {
    // TODO update mongodb driver for updated remove method
    await db["image-entries"].remove({
        username,
    });
}

async function deleteCommentsFromUser(username) {
    // TODO update mongodb driver for updated remove method
    await db.comments.remove({
        username,
    });
}

async function deleteCommentsFromImage(imageID) {
    // TODO update mongodb driver for updated remove method
    await db.comments.remove({
        image_id: imageID,
    });
}

async function addImagesToUser(username, images) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    await Promise.all(
        images.map((image) => {
            return db["image-entries"].insert({
                id: new Array(6)
                    .fill(0)
                    .map((_) => chars.charAt(Math.floor(Math.random() * chars.length)))
                    .join(""),
                data: Buffer.from(image.data),
                mimetype: image.mimetype,
                encoding: "7bit",
                username: username,
                uploadeddate: new Date(image.uploadeddate_str),
                temp: false,
            });
        })
    );
}

async function addCommentsToUser(username, comments) {
    await Promise.all(
        comments.map((comment) => {
            return db.comments.insert({
                username,
                image_id: comment.image_id,
                posted_date: comment.posted_date,
                comment: comment.text,
            });
        })
    );
}

async function addGuestImages(images) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    return await Promise.all(
        images.map((image) => {
            return db["image-entries"].insert({
                id: new Array(6)
                    .fill(0)
                    .map((_) => chars.charAt(Math.floor(Math.random() * chars.length)))
                    .join(""),
                data: Buffer.from(image.data),
                mimetype: image.mimetype,
                encoding: "7bit",
                username: null,
                uploadeddate: new Date(image.uploadeddate_str),
                temp: false,
            });
        })
    );
}

module.exports = {
    deleteUser,
    addUser,
    getUser,
    getImagesForUser,
    getCommentsForUser,
    getCommentsForImage,
    getImage,
    deleteImage,
    deleteImagesFromUser,
    deleteCommentsFromUser,
    deleteCommentsFromImage,
    addImagesToUser,
    addCommentsToUser,
    addGuestImages,
};
