const express = require("express");
const router = express.Router();
const validator = require("../../../validators/validator");
const validateBearerToken = require("../../../middlewares/validateToken");
const videoController = require("../../../controllers/videoController")

router.post(
  '/upload',
  validateBearerToken,
  validator.uploadVideoValidationSchema,
  videoController.uploadVideo
);

router.get(
  '/user',
  validateBearerToken,
  validator.getVideosByUserValidationSchema,
  videoController.getVideosByUser
);
router.get(
  '/user/:userId',
  validateBearerToken,
  validator.getVideosByUserValidationSchema,
  videoController.getVideosByUser
);

router.get(
  '/view/:videoId',
  videoController.addView,
);

router.post(
  '/like/:videoId',
  validateBearerToken,
  videoController.likeVideo
);

router.post(
  '/dislike/:videoId',
  validateBearerToken,
  videoController.dislikeVideo
);

router.post(
  '/comment/:videoId',
  validateBearerToken,
  videoController.addComment
);

router.get(
  '/comment/:videoId',
  validateBearerToken,
  videoController.getComments
);

module.exports = router;