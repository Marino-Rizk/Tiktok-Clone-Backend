const express = require("express");
const authController = require("../../../controllers/authController");
const router = express.Router();
const validator = require("../../../validators/validator");

router.post(
  "/register",
  validator.registerValidationSchema,
  authController.register
);

router.post(
  "/login",
  validator.loginValidationSchema,
  authController.login
);


router.post(
  "/verifyToken",
  validator.verifyTokenValidationSchema,
  authController.verifyToken
);

router.post(
  "/refreshToken",
  validator.verifyTokenValidationSchema,
  authController.refreshToken
);

module.exports = router;
