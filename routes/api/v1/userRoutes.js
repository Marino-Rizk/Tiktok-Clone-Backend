const express = require("express");
const router = express.Router();
const validator = require("../../../validators/validator");
const validateBearerToken = require("../../../middlewares/validateToken");
const userController = require("../../../controllers/userController")

router.post(
  "/update",
  validateBearerToken,
  validator.updateProfileValidationSchema,
  userController.updateProfile,
);

router.get(
  "/profile",
  validateBearerToken,
  validator.followersFollowingListValidationSchema,
  userController.getProfile
);

router.get(
  "/followers",
  validateBearerToken,
  validator.followersFollowingListValidationSchema,
  userController.getFollowers
);

router.get(
  "/following",
  validateBearerToken,
  validator.followersFollowingListValidationSchema,
  userController.getFollowing
);

router.post(
  "/:id/follow",
  validateBearerToken,
  validator.followUnfollowValidationSchema,
  userController.followUser
);

router.post(
  "/:id/unfollow",
  validateBearerToken,
  validator.followUnfollowValidationSchema,
  userController.unfollowUser
);

router.get(
  "/search",
  validateBearerToken,
  userController.searchUsers
);

module.exports = router;
