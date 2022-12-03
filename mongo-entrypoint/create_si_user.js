db.createUser({
    user: "si-user",
    pwd: "hunter2",
    roles: [{ role: "readWrite", db: "simpleimage" }],
});
