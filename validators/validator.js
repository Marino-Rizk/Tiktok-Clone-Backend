const { checkSchema } = require("express-validator");

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


module.exports = {
  loginValidationSchema,
  registerValidationSchema,
  verifyTokenValidationSchema,
};
