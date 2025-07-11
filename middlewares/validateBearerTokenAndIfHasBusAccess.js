const { json } = require("body-parser");
const Business = require("../models/Business");
const jwt = require("../utils/jwt");

const validateBearerTokenAndIfHasBusAccess = async (req, res, next) => {
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

   // Retrieve businessId from body or params
   const businessId = req.body.busId || req.params.busId;

   if (!businessId) {
     return res.status(400).json({
       errorCode: "bad_request",
       errorMessage: "Business ID is required in the request body or parameters",
     });
   }


    const roles = await Business.getOwnerAndAdmin(businessId);
    // Check if the user is an admin or owner of the business
    const isAuthorized = roles.some(
      (role) => role.id === decode.id && (role.type === "owner" || role.type === "admin")
    );

    if (!isAuthorized) {
      return res.status(403).json({
        errorCode: "forbidden",
        errorMessage: "You are not authorized to access this resource",
      });
    }

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

module.exports = validateBearerTokenAndIfHasBusAccess;
