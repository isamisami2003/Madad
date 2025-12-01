const admin = require("firebase-admin");
const serviceAccount = require("./mdad-test-firebase-adminsdk-fbsvc-a71b032162.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
