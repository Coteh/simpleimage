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

var url = getDBHostURI();
var database = null;
var imageEntryCollection = null;
var usersCollection = null;
var commentsCollection = null;

var insertImageIntoDatabase = function(imageEntry, callback) {
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

var insertCommentIntoDatabase = function(commentEntry, callback) {
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

var insertUserIntoDatabase = function(userData, callback) {
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

var changeUserPasswordInDatabase = function(userID, hashedPassword) {
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

var startDatabaseClient = function(callback, options) {
    var dbURL = (options !== undefined && options.dbURL !== undefined) ? options.dbURL : url;
    MongoClient.connect(dbURL, function(err, db) {
        if (err) {
            callback(err);
            return;
        }
        logger.info("Successfully connected to database.");
        database = db;

        var finishInitialization = function () {
            imageEntryCollection = database.collection("image-entries");
            commentsCollection = database.collection("comments");
            logCollection = database.collection("logs");
            actionHistoryCollection = database.collection("action-history");

            usersCollection.createIndex({ username: 1 }, { unique: true, sparse: true });
            callback(err);
        };

        database.listCollections().toArray(function(err, collections) {
            if (err) {
                throw err;
            }

            var collectionNames = collections.map(function(collection) {
                return collection.name;
            });
            if (collectionNames.indexOf("users") < 0) {
                database.createCollection("users", {collation: {locale: "en", strength: 2}}, function(err, collection) {
                    if (err) {
                        throw err;
                    }
                    usersCollection = collection;
                    logger.info("Users collection created.");
                    finishInitialization();
                });
            } else {
                usersCollection = database.collection("users");
                finishInitialization();
            }
        });
    });
};

var closeDatabaseClient = function() {
    database.close();
};

var addImage = function(imageEntry, callback) {
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

var addComment = function(commentEntry, callback) {
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

var addUser = function(userData, callback) {
    if (userData === undefined
        || userData.username === undefined
        || userData.password === undefined
        || userData.email === undefined) {
            callback({
                message: "Could not register user. Malformed input."
            }, null);
            return;
    }

    var filteredUsername = util.sanitizeText(userData.username);

    var maxUsernameLength = process.env.MAX_USERNAME_LENGTH || 24;
    if(filteredUsername.length > maxUsernameLength) {
        callback({
            message: "Could not register user. Username contains too many characters."
        }, null);
        return;
    }

    if (filteredUsername !== userData.username) {
        callback({
            message: "Could not register user. Username contains an inavlid character."
        }, null);
        return;
    }

    var filteredEmail = util.sanitizeText(userData.email);

    if (filteredEmail !== userData.email) {
        callback({
            message: "Could not register user. Email contains an invalid character."
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

var changeUserPassword = function(id, password) {
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

var findImage = function(id, callback) {
    imageEntryCollection.find({ id: id }).toArray(function (err, results) {
        if (err) {
            logger.error("There was an error finding image of ID " + id);
            return;
        }
        callback(err, results);
    });
};

var findCommentsForImage = function(imageID, callback) {
    commentsCollection.find({ image_id: imageID }).toArray(function (err, results) {
        if (err) {
            logger.error("There was an error finding comments for image of ID " + id);
            return;
        }
        callback(err, results);
    });
};

var findCommentsForUser = function(username, callback) {
    commentsCollection.find({ username: { "$regex": username, "$options": "i" } }).toArray(function (err, results) {
        if (err) {
            logger.error("There was an error finding comments for username: " + username);
        }
        callback(err, results);
    });
};

var findImagesForUser = function(username, callback) {
    findUser(username, (err, results) => {
        if (err || results.length === 0) {
            callback(new Error("Could not find user"), null);
            return;
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

var findUser = function(username, callback) {
    usersCollection.find({username}).toArray(function(err, results) {
        if (err) {
            logger.error("There was an error finding user of username: " + username);
        }
        callback(err, results);
    });
};

var findUserByHiddenID = function(hiddenID, callback) {
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

var findUsersByHiddenIDs = function(userIDs, callback) {
    usersCollection.find({_id: {$in: userIDs}}).toArray(function (err, results) {
        if (err) {
            logger.error("There was an error with gathering multiple users");
            return;
        }
        callback(err, results);
    });
};

var loginUser = function(userData, callback) {
    if (userData === undefined
        || userData.username === undefined
        || userData.password === undefined
        || typeof userData.username !== "string") {
            callback({
                message: "Could not login user. Malformed input."
            }, null);
            return;
    }

    const logPrefix = "databaseOps.loginUser";

    logger.info(`${logPrefix} Searching for user ${JSON.stringify(userData.username)}...`);

    usersCollection.find({username: userData.username}).toArray(function (err, results) {
        if (err || results.length === 0) {
            if (err) {
                logger.error(err.stack);
            } else {
                logger.error("Could not find user '" + userData.username + "' in database");
            }
            callback({
                message: errMsgs.USERPASS_COMBO_NOT_FOUND
            }, null);
            return;
        }

        var user = results[0];

        logger.info(`${logPrefix} Authenticating user ${user.username}`);

        auth.authenticateUser(user, userData.password)
            .then((result) => {
                logger.info(`${logPrefix} User ${user.username} successfully authenticated`);
                callback(null, result);
            })
            .catch((err) => {
                logger.error(err.stack);
                if (err.message === errMsgs.USERPASS_COMBO_NOT_FOUND) {
                    callback(err, null);
                } else {
                    callback(new Error(errMsgs.USERAUTH_ERROR), null);
                }
            });
    });
};

var deleteImage = function(imageID, callback) {
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

var writeLogEntry = function(logEntry, callback) {
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

var writeActionHistoryEntry = function(actionEntry, callback) {
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
