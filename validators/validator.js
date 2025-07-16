const { checkSchema, param, query } = require("express-validator");

const loginValidationSchema = checkSchema({
  email: {
    in: ["body"],
    notEmpty: {
      errorMessage: "email is required",
    },
    isEmail: {
      errorMessage: "Invalid email format",
    },
  },

  password: {
    in: ["body"],
    notEmpty: {
      errorMessage: "Password is required",
    },
    isLength: {
      options: { min: 8 },
      errorMessage: "Password must be at least 6 characters long",
    },
    matches: {
      options: /\d/, 
      errorMessage: "Password must contain at least one number",
    },
  },
});

const registerValidationSchema = checkSchema({
  email: {
    in: ["body"],
    notEmpty: {
      errorMessage: "Email is required",
    },
    isEmail: {
      errorMessage: "Invalid email format",
    },
  },
  userName: {
    in: ["body"],
    notEmpty: {
      errorMessage: "Username is required",
    },
    isLength: {
      options: { min: 3 },
      errorMessage: "Username must be at least 3 characters long",
    },
  },
  password: {
    in: ["body"],
    notEmpty: {
      errorMessage: "Password is required",
    },
    isLength: {
      options: { min: 8 },
      errorMessage: "Password must be at least 8 characters long",
    },
    matches: {
      options: /\d/,
      errorMessage: "Password must contain at least one number",
    },
  },
});

const verifyTokenValidationSchema = checkSchema({
  token: {
    in: ["body"],
    notEmpty: {
      errorMessage: "Token is required",
    },
  },
});

const updateProfileValidationSchema = checkSchema({
  displayName: {
    in: ["body"],
    isLength: {
      options: { min: 3 },
      errorMessage: "name must be at least 3 characters long",
    },
  },
  image: {
    in: ["files"],
    optional: true,
    custom: {
      options: (value, { req, res }) => {
        if (req.files && req.files.image) {
          const file = req.files.image;
          const validMimeTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp", "image/bmp"];
          if (!validMimeTypes.includes(file.mimetype)) {
            return res.status(400).json({
              errorCode: "invalid_image_type",
              errorMessage:
                "Invalid image type. Only JPEG, PNG,jpg,webp and bmp are allowed.",
            });
          }
          const maxSizeInBytes = 5 * 1024 * 1024; // 5 MB
          if (file.size > maxSizeInBytes) {
            throw new Error("Image file size should be less than 5MB");
          }
        }
        return true;
      },
    },
  },
})

const followUnfollowValidationSchema = [
  param('id')
    .notEmpty().withMessage('User ID is required')
    .isMongoId().withMessage('Invalid user ID'),
];

const followersFollowingListValidationSchema = [
  query('userId')
    .optional()
    .isMongoId().withMessage('Invalid userId'),
  query('userName')
    .optional()
    .isString().withMessage('userName must be a string'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('page must be a positive integer'),
];

const uploadVideoValidationSchema = [
  // Caption is optional, but if present, must be a string
  checkSchema({
    caption: {
      in: ["body"],
      optional: true,
      isString: {
        errorMessage: "Caption must be a string",
      },
      isLength: {
        options: { max: 300 },
        errorMessage: "Caption must be at most 300 characters long",
      },
    },
  }),
  // Custom validator for files
  (req, res, next) => {
    if (!req.files || !req.files.video || !req.files.thumbnail) {
      return res.status(400).json({
        errorCode: "bad_request",
        errorMessage: "Video and thumbnail files are required.",
      });
    }
    // Validate video file type and size
    const video = req.files.video;
    const validVideoTypes = ["video/mp4", "video/quicktime", "video/x-matroska", "video/webm", "video/avi"];
    if (!validVideoTypes.includes(video.mimetype)) {
      return res.status(400).json({
        errorCode: "invalid_video_type",
        errorMessage: "Invalid video type. Only MP4, MOV, MKV, WEBM, AVI are allowed.",
      });
    }
    const maxVideoSize = 50 * 1024 * 1024; // 50MB
    if (video.size > maxVideoSize) {
      return res.status(400).json({
        errorCode: "video_too_large",
        errorMessage: "Video file size should be less than 50MB.",
      });
    }
    // Validate thumbnail file type and size
    const thumbnail = req.files.thumbnail;
    const validImageTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp", "image/bmp"];
    if (!validImageTypes.includes(thumbnail.mimetype)) {
      return res.status(400).json({
        errorCode: "invalid_image_type",
        errorMessage: "Invalid thumbnail type. Only JPEG, PNG, JPG, WEBP, BMP are allowed.",
      });
    }
    const maxImageSize = 5 * 1024 * 1024; // 5MB
    if (thumbnail.size > maxImageSize) {
      return res.status(400).json({
        errorCode: "image_too_large",
        errorMessage: "Thumbnail file size should be less than 5MB.",
      });
    }
    next();
  },
];

const getVideosByUserValidationSchema = [
  query('userId')
    .optional()
    .isMongoId().withMessage('Invalid userId'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('page must be a positive integer'),
];

module.exports = {
  loginValidationSchema,
  registerValidationSchema,
  verifyTokenValidationSchema,
  updateProfileValidationSchema,
  followUnfollowValidationSchema,
  followersFollowingListValidationSchema,
  uploadVideoValidationSchema,
  getVideosByUserValidationSchema,
};
