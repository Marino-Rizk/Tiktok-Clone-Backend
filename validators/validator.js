const { checkSchema } = require("express-validator");

const authenticationValidationSchema = checkSchema({
  phoneNumber: {
    in: ["body"],
    notEmpty: {
      errorMessage: "Phone number is required",
    },
    custom: {
      options: (value) => {
        // Check if the number starts with '+9610' and remove '0'
        if (value.startsWith("+9610")) {
          value = "+961" + value.slice(5); // Remove the '0' after '+961'
        }

        // Validate phone number pattern (you can adjust this regex if needed)
        const phoneNumberRegex = /^\+[1-9]\d{1,14}$/; // E.164 format validation
        if (!phoneNumberRegex.test(value)) {
          throw new Error("Invalid phone number format");
        }

        return true;
      },
      errorMessage: "Invalid phone number",
    },
    customSanitizer: {
      options: (value) => {
        // Check if the number starts with '+9610' and remove '0'
        if (value.startsWith("+9610")) {
          value = "+961" + value.slice(5);
        }
        return value;
      },
    },
  },

  password: {
    in: ["body"],
    notEmpty: {
      errorMessage: "Password is required",
    },
    isLength: {
      options: { min: 6 },
      errorMessage: "Password must be at least 6 characters long",
    },
    matches: {
      options: /\d/, // Example: ensure password contains at least one digit
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


module.exports = {
  authenticationValidationSchema,
  verifyTokenValidationSchema,
};
