const jwt = require("../utils/jwt");
const path = require("path");
require("dotenv").config();
const axios = require("axios");

const isTokenValid = (authHeader) => {
  if (!authHeader) {
    return false;
  }

  const tokenParts = authHeader.split(" ");

  if (tokenParts[0] !== "Bearer" || tokenParts.length !== 2) {
    return null;
  }

  const token = tokenParts[1];
  const decode = jwt.verifyToken(token);
  return decode;
};

const removeSpaces = (str) => {
  return str.replace(/\s+/g, "");
};

/**
 * Function to upload and rename file with a timestamp
 * @param {Object} file - The uploaded file
 * @param {string} uploadDir - The directory to upload the file
 * @returns {Promise<Object>} - An object containing the file path and URL
 */
function uploadAndRenameFile(file) {
  return new Promise((resolve, reject) => {
    // Get the current timestamp
    const timestamp = Date.now();

    // Extract the file extension
    const fileExtension = path.extname(file.name);

    // Create a new file name with the timestamp
    const newFileName = `${timestamp}${fileExtension}`;

    const projectDir = path.resolve(__dirname, "..");

    // Define the upload path
    const uploadPath = path.join(projectDir, "/uploads", newFileName);

    // Define the file URL
    const fileUrl = `/uploads/${newFileName}`;

    // Use the mv() method to place the file somewhere on your server
    file.mv(uploadPath, function (err) {
      if (err) {
        reject(err);
        console.log(err);
      } else {
        resolve({ filePath: uploadPath, fileUrl });
      }
    });
  });
}

function appendMainUrlToKey(jsonObj, key) {
  // Helper function to update a key's value
  if (!jsonObj) return jsonObj;

  const base = (process.env.MAIN_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');

  const updateKey = (obj) => {
    if (!obj || !obj[key]) return;
    const value = obj[key];
    if (typeof value !== 'string') return;
    if (value.startsWith('http')) return;
    const normalizedPath = value.startsWith('/') ? value : `/${value}`;
    obj[key] = `${base}${normalizedPath}`;
  };

  if (Array.isArray(jsonObj)) {
    jsonObj.forEach((item) => updateKey(item));
  } else {
    updateKey(jsonObj);
  }

  return jsonObj;
}


module.exports = appendMainUrlToKey;



module.exports = {
  isTokenValid,
  removeSpaces,
  uploadAndRenameFile,
  appendMainUrlToKey,
};
