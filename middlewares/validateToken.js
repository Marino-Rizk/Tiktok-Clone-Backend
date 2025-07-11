const jwt = require("../utils/jwt");

const validateBearerToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(401).json({
      errorCode: "unauthorized",
      errorMessage: "Authorization header is missing",
    });
  }

  const tokenParts = authHeader.split(" ");

  if (tokenParts[0] !== "Bearer" || tokenParts.length !== 2) {
    return res.status(401).json({
      errorCode: "unauthorized",
      errorMessage: "Invalid Authorization header format",
    });
  }

  const token = tokenParts[1];
  try {
    const decode = jwt.verifyToken(token);

    if (!decode) {
      return res.status(401).json({
        errorCode: "unauthorized",
        errorMessage: "Invalid or expired token",
      });
    }

    // Attach decoded token data to the request object
    req.user = decode;

    // Proceed to the next middleware or route handler
    next();
  } catch (err) {
    console.error("Error verifying token:", err);
    return res.status(500).json({
      errorCode: "internal_server_error",
      errorMessage: "An error occurred while verifying the token",
    });
  }
};

module.exports = validateBearerToken;
