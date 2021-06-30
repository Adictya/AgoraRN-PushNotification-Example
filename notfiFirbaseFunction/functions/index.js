const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.sendHttpPushNotification = functions.https.onRequest(
  async (req, res) => {
    const userId = req.body.userId;
    functions.logger.log("Request recieved" + req.body.userId);
    const fcmToken = await admin
      .database()
      .ref(`FCMTokens/${userId}`)
      .once("value")
      .then((snapshot) => {
        return snapshot.val();
      });

    const payload = {
      token: fcmToken,
      notification: {
        title: req.body.title,
        body: req.body.message,
      },
      data: {
        body: req.body.data,
      },
    };

    admin
      .messaging()
      .send(payload)
      .then((response) => {
        console.log("Successfully sent message:", response);
        res.sendStatus(200);
        return { success: true };
      })
      .catch((error) => {
        res.sendStatus(500);
        return { error: error.code };
      });
  }
);
