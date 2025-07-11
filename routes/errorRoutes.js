const express = require("express");
const authController = require("../controllers/authController");
const { webAuthenticated, pageSettings } = require("../middlewares/auth");

const router = express.Router();

router.get("/", (req, res, next) => {
  return res.status(200).send(`
    <html>
      <head>
        <title>Error</title>
      </head>
      <body style="display: flex; align-items: center;justify-content: center;
      flex-direction: column;height: 100vh; margin: 0; overflow: hidden;">
        <h1>500 Internal Server Error</h1>
        <p>Something went wrong on our end. Please try again later.</p>
      </body>
    </html>
  `);
});

module.exports = router;
