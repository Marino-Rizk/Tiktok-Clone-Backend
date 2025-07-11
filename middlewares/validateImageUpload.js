const validateImageUpload = (req, res, next) => {
  // Check if files are present in the request
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).json({
      errorCode: "bad_request",
      errorMessage: "No files were uploaded.",
    });
  }

  // Check if the uploaded file is an image
  const file = req.files.image; // Assuming the image field is named 'image'
  if (!file) {
    return res.status(400).json({
      errorCode: "bad_request",
      errorMessage: "No image file uploaded.",
    });
  }

  // Validate the file type
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif"];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return res.status(400).json({
      errorCode: "unsupported_media_type",
      errorMessage: "Only JPEG, PNG, and GIF images are allowed.",
    });
  }

  // Proceed to the next middleware or route handler
  next();
};

module.exports = validateImageUpload;
