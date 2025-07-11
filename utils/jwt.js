const jwt = require("jsonwebtoken");
require("dotenv").config();

const accessTokenSecret = process.env.ACCESSTOKENSECRET;
const refreshTokenSecret = process.env.REFRESHTOKENSECRET;

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email:user.email,
      userName: user.userName,
      displayName:user.displayName,
      imageUrl: user.imageUrl,
      blurhash: user.blurhash,
    },
    accessTokenSecret,
    { expiresIn: "30d" }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email:user.email,
      userName: user.userName,
      displayName:user.displayName,
      imageUrl: user.imageUrl,
      blurhash: user.blurhash,
    },
    refreshTokenSecret,
    { expiresIn: "30d" }
  );
};

const verifyToken = (token, type = "access") => {
  try {
    // Decode the token without verifying the signature
    const decoded = jwt.decode(token, { complete: true });

    if (!decoded) {
      console.error("JWT verification error: Invalid token");
      return null;
    }

    // Verify the token
    jwt.verify(
      token,
      type == "access" ? accessTokenSecret : refreshTokenSecret
    );
    // console.log("jwt", decoded.payload);
    return decoded.payload;
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      console.error("JWT verification error: Token expired");
      return null;
    } else if (err.name === "JsonWebTokenError") {
      console.error("JWT verification error: Invalid signature");
      return null;
    } else {
      console.error("JWT verification error:", err);
      return null;
    }
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
};
