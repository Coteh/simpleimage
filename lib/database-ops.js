require("dotenv").config();
const MongoClient = require("mongodb").MongoClient;
const ObjectID = require("mongodb").ObjectID;
const util = require("./util");
const idGen = require("./id-gen");
const imageUtil = require("./image-util");
const auth = require("./auth");
const logger = require("./logger").logger;
const errMsgs = require("./error-msgs");
const getDBHostURI = require("./db-util").getDBHostURI;
const sanitize = require('mongo-sanitize');

const url = getDBHostURI();
var database = null;
var imageEntryCollection = null;
var usersCollection = null;
var commentsCollection = null;

class UserNotFoundError extends Error {
    constructor(username) {
        super(`Could not find user: "${username}"`);
        this.name = "UserNotFoundError";
    }
}

class UserPassComboNotFoundError extends Error {
    constructor() {
        super(errMsgs.USERPASS_COMBO_NOT_FOUND);
        this.name = "UserPassComboNotFoundError";
    }
}

const insertImageIntoDatabase = function(imageEntry, callback) {
    if (imageEntry === undefined) {
        callback({
            status: "error",
            message: "No image data provided for submission."
        }, null);
        return;
    }

    imageEntry.uploadeddate = new Date();
    idGen.generateShortIDFromObjectID(new ObjectID(), function(err, shortID) {
        if (err) {
            callback({
                status: "error",
                message: "An error occurred when uploading your image. Please try again later."
            }, null);
            return;
        }

        imageEntry.id = shortID;
        imageEntry.temp = process.env.EVALUATION_MODE === "true" ? true : false;
        imageEntryCollection.insertOne(imageEntry, function (err, result) {
            if (err) {
                logger.error("There was an error inserting image entry into the database.");
                callback({
                    status: "error",
                    message: "An error occurred when uploading your image. Please try again later."
                }, null);
                return;
            }
            callback(null, result);
        });
    });
};

const insertCommentIntoDatabase = function(commentEntry, callback) {
    commentsCollection.insertOne({
        username: commentEntry.username,
        image_id: commentEntry.imageID,
        posted_date: new Date(),
        comment: commentEntry.comment
    }, function(err, result) {
        if (err) {
            callback(err, null);
            return;
        }
        callback(null, result);
    });
};

const insertUserIntoDatabase = function(userData, callback) {
    usersCollection.insertOne({
        username: userData.username,
        password: userData.password,
        email: userData.email,
        join_date: new Date()
    }, function(err, result) {
        if (err) {
            callback(err, null);
            return;
        }
        callback(null, result);
    });
};

const changeUserPasswordInDatabase = function(userID, hashedPassword) {
    return new Promise((resolve, reject) => {
        usersCollection.updateOne({
            _id: userID
        }, {
            $set: {
                password: hashedPassword
            }
        }, (err, result) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(result);
        });
    });
};

const startDatabaseClient = function(callback, options) {
    var dbURL = (options !== undefined && options.dbURL !== undefined) ? options.dbURL : url;
    MongoClient.connect(dbURL).then((db) => {
        logger.info("Successfully connected to database.");
        database = db;

        var finishInitialization = function () {  
            commentsCollection = database.collection("comments");
            logCollection = database.collection("logs");
            actionHistoryCollection = database.collection("action-history");

            usersCollection.createIndex({ username: 1 }, { unique: true, sparse: true });
            callback(null, database);
        };

        var createIndexForImageEntriesCollection = function(collection) {
            collection.createIndex({ uploadeddate: 1 }, { 
                name: "expire_index",
                expireAfterSeconds: parseInt(process.env.EXPIRE_AFTER_SECONDS) || 300,
                partialFilterExpression: {
                    temp: {
                        $eq: true,
                    }
                } 
            }).then(() => {
                logger.info("expire_index created for images collection.");
            });
        }

        var checkForImageEntriesCollection = function(collectionNames) {
            if(collectionNames.indexOf("image-entries") < 0) {
                database.createCollection("image-entries").then((collection) => {
                    imageEntryCollection = collection;
                    logger.info("Images collection created.");
                    createIndexForImageEntriesCollection(collection);
                    finishInitialization();
                });
            }
            else {
                imageEntryCollection = database.collection("image-entries");
                imageEntryCollection.dropIndex("expire_index").then(() => {
                    logger.info("expire_index for images collection dropped successfully. Creating new expire_index");
                    createIndexForImageEntriesCollection(imageEntryCollection);
                    finishInitialization();
                }).catch((err) => {
                    if(err.codeName === "IndexNotFound") {
                        logger.info("expire_index for images collection not found. Creating new expire_index");
                        createIndexForImageEntriesCollection(imageEntryCollection);
                        finishInitialization();
                    }
                    else {
                        callback(err, null);
                    }
                });
            }
        }

        database.listCollections().toArray().then((collections) => {
            var collectionNames = collections.map(function(collection) {
                return collection.name;
            });
            
            if (collectionNames.indexOf("users") < 0) {
                database.createCollection("users", {collation: {locale: "en", strength: 2}}).then((collection) => {
                    usersCollection = collection;
                    logger.info("Users collection created.");
                    checkForImageEntriesCollection(collectionNames);
                }).catch((err) => {
                    callback(err, null);
                });
            } else {
                usersCollection = database.collection("users");
                checkForImageEntriesCollection(collectionNames);
            }
        }).catch((err) => {
            callback(err, null);
        });
    }).catch((err) => {
        callback(err, null);
    });
};

const closeDatabaseClient = function() {
    database.close();
};

const addImage = function(imageEntry, callback) {
    var performInsertion = function (imageEntry) {
        insertImageIntoDatabase(imageEntry, function (err, result) {
            if (err) {
                logger.error("Error uploading image.");
            }
            callback(err, result);
        });
    };
    imageUtil.checkForEXIFImageEntry(imageEntry)
        .then(function (data) {
            imageUtil.rotateImageEntry(imageEntry)
                .then(function (data) {
                    imageEntry.data = data;
                    imageUtil.removeEXIFDataFromImageEntry(imageEntry)
                        .then(function (data) {
                            performInsertion(imageEntry);
                        })
                        .catch(function (err) {
                            callback(err, undefined);
                        });
                })
                .catch(function (err) {
                    callback(err, undefined);
                });
        })
        .catch(function (err) {
            if (err.code !== "NOT_A_JPEG" && err.code !== "NO_EXIF_SEGMENT") {
                callback(err, undefined);
                return;
            }
            performInsertion(imageEntry);
        });
};

const addComment = function(commentEntry, callback) {
    if (commentEntry === undefined
        || commentEntry.imageID === undefined
        || commentEntry.userHiddenID === undefined
        || commentEntry.comment === undefined) {
            callback({
                status: "error",
                message: "Could not post comment. Malformed input."
            }, null);
            return;
    }

    if (commentEntry.comment === "") {
        callback({
            status: "error",
            message: "Please add text to your comment."
        }, null);
        return;
    }

    commentEntry.comment = util.sanitizeText(commentEntry.comment);

    findUserByHiddenID(commentEntry.userHiddenID, function(err, result) {
        if (err) {
            var errStr = "Could not post comment. Could not find user.";
            logger.error(errStr);
            callback({
                status: "error",
                message: errStr
            });
            return;
        }

        var user = result[0];

        commentEntry.username = user.username;

        insertCommentIntoDatabase(commentEntry, function (err, result) {
            if (err) {
                logger.error("Error posting comment.");
                logger.error(err);
            }
            callback(err, result);
        });
    });
};

const addUser = function(userData, callback) {
    if (userData === undefined
        || userData.username === undefined
        || userData.password === undefined
        || userData.email === undefined) {
            callback({
                message: "Could not register user. Malformed input."
            }, null);
            return;
    }

    auth.hashPassword(userData.password)
        .then((hashedPassword) => {
            var newUserData = {
                username: userData.username,
                password: hashedPassword,
                email: userData.email
            };

            insertUserIntoDatabase(newUserData, function (err, result) {
                if (err) {
                    if (err.code === 11000) {
                        logger.error("Username already exists.");
                        callback({
                            name: "DuplicateField",
                            field: "username"
                        }, null);
                        return;
                    } else {
                        // TODO only generic errors should be reported if this branch is reached
                        logger.error("Error adding user.");
                    }
                }
                if (callback) {
                    callback(err, result);
                }
            });
        })
        .catch((err) => {
            logger.error(err.stack);
            callback(new Error(errMsgs.USERREG_ERROR), null);
        });
};

const changeUserPassword = function(id, password) {
    return new Promise((resolve, reject) => {
        auth.hashPassword(password)
            .then((hashedPassword) => {
                changeUserPasswordInDatabase(id, hashedPassword)
                    .then((result) => {
                        resolve(result);
                    })
                    .catch((err) => {
                        logger.writeError(err.stack);
                        reject(new Error(errMsgs.USERPASS_CHANGE_ERROR));
                    });
            })
            .catch((err) => {
                logger.writeError(err.stack);
                reject(new Error(errMsgs.USERPASS_CHANGE_ERROR));
            });
    });
};

const findImage = function(id, callback) {
    imageEntryCollection.find({ id: id }).toArray(function (err, results) {
        if (err) {
            logger.error("There was an error finding image of ID " + id);
            return;
        }
        callback(err, results);
    });
};

const findImageAttributes = function(id, callback) {
    imageEntryCollection.find({ id: id }).project({ data: 0 }).toArray(function (err, results) {
        if (err) {
            logger.error("There was an error finding image attributes of ID " + id);
            return;
        }
        callback(err, results);
    });
};

const findCommentsForImage = function(imageID, callback) {
    commentsCollection.find({ image_id: imageID }).toArray(function (err, results) {
        if (err) {
            logger.error("There was an error finding comments for image of ID " + id);
            return;
        }
        callback(err, results);
    });
};

const findCommentsForUser = function(username, callback) {
    commentsCollection.find({ username: { "$regex": username, "$options": "i" } }).toArray(function (err, results) {
        if (err) {
            logger.error("There was an error finding comments for username: " + username);
        }
        callback(err, results);
    });
};

const findImagesForUser = function(username, callback) {
    module.exports.findUser(username, (err, results) => {
        if (err) {
            return callback(new Error("Error finding user"), null);
        }
        if (results.length === 0) {
            return callback(new UserNotFoundError(username), null);
        }
        imageEntryCollection.find({username}).toArray(function (err, results) {
            if (err) {
                console.log("There was an error finding images for provided username: " + username);
                callback(err, null);
                return;
            }
            callback(null, results);
        });
    })
};

const findUser = function(username, callback) {
    const sanitizedUsername = sanitize(username);
    if (typeof sanitizedUsername === "object") {
        callback(new Error("Invalid username"), null);
        return;
    }
    usersCollection.find({username: sanitizedUsername}).toArray(function(err, results) {
        if (err) {
            logger.error("There was an error finding user of username: " + sanitizedUsername);
        }
        callback(err, results);
    });
};

const findUserByHiddenID = function(hiddenID, callback) {
    usersCollection.find({ _id: ObjectID(hiddenID) }).toArray(function (err, results) {
        if (err) {
            logger.error("There was an error finding user of hidden ID " + hiddenID);
            callback(err, results);
            return;
        }
        if (results.length === 0) {
            logger.error("Could not find user of hidden ID " + hiddenID);
            callback({
                name: "UserNotFound"
            }, null);
            return;
        }
        callback(err, results);
    });
};

const findUsersByHiddenIDs = function(userIDs, callback) {
    usersCollection.find({_id: {$in: userIDs}}).toArray(function (err, results) {
        if (err) {
            logger.error("There was an error with gathering multiple users");
            return;
        }
        callback(err, results);
    });
};

const loginUser = function(userData, callback) {
    if (userData === undefined
        || userData.username === undefined
        || userData.password === undefined
        || typeof userData.username !== "string") {
            callback({
                message: "Could not login user. Malformed input."
            }, null);
            return;
    }

    usersCollection.find({username: userData.username}).toArray(function (err, results) {
        if (err || results.length === 0) {
            if (err) {
                logger.error(err.stack);
            } else {
                logger.error("Could not find user '" + userData.username + "' in database");
            }
            return callback(new UserPassComboNotFoundError(), null);
        }

        var user = results[0];

        auth.authenticateUser(user, userData.password)
            .then((result) => {
                callback(null, result);
            })
            .catch((err) => {
                logger.error(err.stack);
                if (err.message === errMsgs.USERPASS_COMBO_NOT_FOUND) {
                    callback(new UserPassComboNotFoundError(), null);
                } else {
                    callback(new Error(errMsgs.USERAUTH_ERROR), null);
                }
            });
    });
};

const deleteImage = function(imageID, callback) {
    imageEntryCollection.deleteOne({id: imageID}, function(err, result) {
        if (err) {
            logger.error(err);
            callback({
                message: "Image could not be deleted due to an error."
            }, null);
            return;
        }

        if (result.deletedCount === 0) {
            callback({
                message: "No image deleted. Perhaps it is not in the database."
            }, null);
            return;
        }

        callback(null, result);
    });
};

const writeLogEntry = function(logEntry, callback) {
    logCollection.insertOne({
        severity: logEntry.severity,
        text: logEntry.text,
        log_date: new Date()
    }, function(err, result) {
        if (err) {
            logger.error(err);
            callback({
                message: "Could not write log entry to database due to an error."
            }, null);
            return;
        }

        if (result.insertedCount == 0) {
            callback({
                message: "Could not write log entry to database."
            }, null);
            return;
        } else if (result.insertedCount > 1) {
            callback({
                message: "Could not write log entry to database."
            }, null);
            return;
        }

        callback(null, {
            message: "Inserted log entry successfully.",
            result: result.ops[0]
        });
    });
};

const writeActionHistoryEntry = function(actionEntry, callback) {
    actionHistoryCollection.insertOne({
        type: actionEntry.type,
        item: actionEntry.item,
        username: actionEntry.username,
        ip_address: actionEntry.ipAddress,
        info: actionEntry.info,
        action_date: new Date()
    }, function (err, result) {
        if (err) {
            logger.error(err);
            callback({
                message: "Could not write action history entry to database due to an error."
            }, null);
            return;
        }

        if (result.insertedCount == 0) {
            callback({
                message: "Could not write action history entry to database."
            }, null);
            return;
        } else if (result.insertedCount > 1) {
            callback({
                message: "Could not write action history entry to database."
            }, null);
            return;
        }

        callback(null, {
            message: "Inserted action history entry successfully.",
            result: result.ops[0]
        });
    });
};

module.exports.startDatabaseClient = startDatabaseClient;
module.exports.closeDatabaseClient = closeDatabaseClient;
module.exports.addImage = addImage;
module.exports.addComment = addComment;
module.exports.addUser = addUser;
module.exports.changeUserPassword = changeUserPassword;
module.exports.findImage = findImage;
module.exports.findImageAttributes = findImageAttributes;
module.exports.findCommentsForImage = findCommentsForImage;
module.exports.findCommentsForUser = findCommentsForUser;
module.exports.findImagesForUser = findImagesForUser;
module.exports.findUser = findUser;
module.exports.findUserByHiddenID = findUserByHiddenID;
module.exports.findUsersByHiddenIDs = findUsersByHiddenIDs;
module.exports.loginUser = loginUser;
module.exports.deleteImage = deleteImage;
module.exports.writeLogEntry = writeLogEntry;
module.exports.writeActionHistoryEntry = writeActionHistoryEntry;
module.exports.UserNotFoundError = UserNotFoundError;
module.exports.UserPassComboNotFoundError = UserPassComboNotFoundError;
