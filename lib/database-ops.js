require("dotenv").config();
const MongoClient = require("mongodb").MongoClient;
const ObjectID = require("mongodb").ObjectID;
const bcrypt = require("bcrypt");
const util = require("./util");
const idGen = require("./id-gen");

var getDBHostURI = function() {
    switch (process.env.NODE_ENV) {
        case "production":
        case "development":
            return process.env.MONGODB_URI;
        default:
            return "mongodb://localhost:27017/simpleimage";
    }
}

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
                console.log("There was an error inserting image entry into the database.");
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

var startDatabaseClient = function(callback) {
    MongoClient.connect(url, function(err, db) {
        if (err) {
            callback(err);
            return;
        }
        console.log("Successfully connected to server.");
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
                    console.log("Users collection created.");
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
    insertImageIntoDatabase(imageEntry, function(err, result) {
        if (err) {
            console.log("Error uploading image.");
        }
        callback(err, result);
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
            console.log(errStr);
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
                console.log("Error posting comment.");
                console.error(err);
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

    bcrypt.hash(userData.password, 10, function(err, hash) {
        if (err) {
            callback({
                message: "Could not register user. Error saving password."
            }, null);
            return;
        }

        var newUserData = {
            username: userData.username,
            password: hash,
            email: userData.email
        };

        insertUserIntoDatabase(newUserData, function (err, result) {
            if (err) {
                if (err.code === 11000) {
                    console.log("Could not register user. Username already exists.");
                    callback({
                        name: "DuplicateField",
                        field: "username"
                    }, null);
                    return;
                } else {
                    console.log("Error adding user.");
                }
            }
            callback(err, result);
        });
    });
};

var findImage = function(id, callback) {
    imageEntryCollection.find({ id: id }).toArray(function (err, results) {
        if (err) {
            console.log("There was an error finding image of ID " + id);
            return;
        }
        callback(err, results);
    });
};

var findImages = function(ids, callback) {
    imageEntryCollection.find({ id: { $in: ids }}).toArray(function (err, results) {
        if (err) {
            console.log("There was an error finding all images of IDs specified.");
            return;
        }
        callback(err, results);
    });
};

var findCommentsForImage = function(imageID, callback) {
    commentsCollection.find({ image_id: imageID }).toArray(function (err, results) {
        if (err) {
            console.log("There was an error finding comments for image of ID " + id);
            return;
        }
        callback(err, results);
    });
};

var findCommentsForUser = function(username, callback) {
    commentsCollection.find({ username: { "$regex": username, "$options": "i" } }).toArray(function (err, results) {
        if (err) {
            console.log("There was an error finding comments for username: " + username);
        }
        callback(err, results);
    });
};

var findUser = function(username, callback) {
    usersCollection.find({username}).toArray(function(err, results) {
        if (err) {
            console.log("There was an error finding user of username: " + username);
        }
        callback(err, results);
    });
};

var findUserByHiddenID = function(hiddenID, callback) {
    usersCollection.find({ _id: ObjectID(hiddenID) }).toArray(function (err, results) {
        if (err) {
            console.log("There was an error finding user of hidden ID " + hiddenID);
            callback(err, results);
            return;
        }
        if (results.length === 0) {
            console.log("Could not find user of hidden ID " + hiddenID);
            callback({
                name: "UserNotFound"
            }, null);
            return;
        }
        callback(err, results);
    });
}

var findUsersByHiddenIDs = function(userIDs, callback) {
    usersCollection.find({_id: {$in: userIDs}}).toArray(function (err, results) {
        if (err) {
            console.log("There was an error with gathering multiple users");
            return;
        }
        callback(err, results);
    });
};

var findImagesForUser = function(username, callback) {
    imageEntryCollection.find({username}).toArray(function (err, results) {
        if (err) {
            console.log("There was an error finding images for provided username: " + username);
            return;
        }
        callback(err, results);
    });
};

var findImagesForUnregisteredUser = function(unregisteredSessionID, callback) {
    imageEntryCollection.find({unregisteredSessionID}).toArray(function (err, results) {
        if (err) {
            console.log("There was an error finding images for provided unregistered user of unregistered session ID: " + unregisteredSessionID);
            return;
        }
        callback(err, results);
    });
};

var transferUnregisteredUserImageToRegisteredUser = function(imageID, username) {
    
};

var loginUser = function(userData, callback) {
    if (userData === undefined
        || userData.username === undefined
        || userData.password === undefined) {
            callback({
                message: "Could not login user. Malformed input."
            }, null);
            return;
    }

    usersCollection.find({username: userData.username}).toArray(function (err, results) {
        if (err || results.length === 0) {
            callback({
                message: "Could not login user. Username and password combination not found."
            }, null);
            return;
        }

        var user = results[0];

        bcrypt.compare(userData.password, user.password, function(err, result) {
            if (err) {
                callback({
                    message: "Could not login user. There was an error verifying user."
                }, null);
                return;
            }
            if (result) {
                callback(null, {
                    message: "Login successful.",
                    user
                });
            } else {
                callback({
                    message: "Could not login user. Username and password combination not found."
                }, null);
            }
        });
    });
};

var deleteImage = function(imageID, callback) {
    imageEntryCollection.deleteOne({id: imageID}, function(err, result) {
        if (err) {
            console.log(err);
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

var deleteImages = function(imageIDs, callback) {
    imageEntryCollection.deleteMany({ id: { $in: imageIDs } }, function (err, results) {
        if (err) {
            console.log(err);
            callback({
                message: "There was an error deleting all images of IDs specified."
            }, null);
            return;
        }

        if (results.deletedCount === 0) {
            callback({
                message: "No image deleted. Perhaps one or more images are not in the database."
            }, null);
            return;
        }

        callback(null, results);
    });
};

var writeLogEntry = function(logEntry, callback) {
    logCollection.insertOne({
        severity: logEntry.severity,
        text: logEntry.text,
        log_date: new Date()
    }, function(err, result) {
        if (err) {
            console.log(err);
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
        unregistered_session_id: actionEntry.unregisteredSessionID,
        ip_address: actionEntry.ipAddress,
        info: actionEntry.info,
        action_date: new Date()
    }, function (err, result) {
        if (err) {
            console.log(err);
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
module.exports.findImage = findImage;
module.exports.findImages = findImages;
module.exports.findCommentsForImage = findCommentsForImage;
module.exports.findCommentsForUser = findCommentsForUser;
module.exports.findUser = findUser;
module.exports.findUserByHiddenID = findUserByHiddenID;
module.exports.findUsersByHiddenIDs = findUsersByHiddenIDs;
module.exports.findImagesForUser = findImagesForUser;
module.exports.findImagesForUnregisteredUser = findImagesForUnregisteredUser;
module.exports.loginUser = loginUser;
module.exports.deleteImage = deleteImage;
module.exports.deleteImages = deleteImages;
module.exports.writeLogEntry = writeLogEntry;
module.exports.writeActionHistoryEntry = writeActionHistoryEntry;
