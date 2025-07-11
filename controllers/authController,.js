const bcrypt = require("bcryptjs");
const jwt = require("../utils/jwt");
const { validationResult } = require("express-validator");
const helper = require("../utils/helper");
const User = require("../models/User");

exports.register = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            errorCode: "missing_fields",
            errorMessage: errors.array(),
        });
    }

    const { userName, email, password } = req.body;

    try {
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(409).json({
                errorCode: "conflict",
                errorMessage: "User already exists",
            });
        }

        const newUser = new User(
            userName,
            email,
            password,
            null,
            null,
            null,
        );
        const createdUser = await User.create(newUser);

        return res.status(201).json({
            userId: createdUser.id,
            email: createdUser.email,
            userName: createdUser.userName
        });
    } catch (err) {
        console.error("Error during registration:", err);
        return res.status(500).json({
            errorCode: "internal_server_error",
            errorMessage: "An error occurred during registration",
        });
    }
};

exports.login = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            errorCode: "missing_fields",
            errorMessage: errors.array(),
        });
    }

    const { email, password } = req.body;
    let user;
    try {
        user = await User.findByEmail(email);

        if (!user) {
            return res.status(404).json({
                errorCode: "not_found",
                errorMessage: "User not found",
            });
        }

        const passwordIsValid = bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) {
            return res.status(401).json({
                errorCode: "unauthorized",
                errorMessage: "Invalid password",
            });
        }

        const accessToken = jwt.generateAccessToken(user);
        const refreshToken = jwt.generateRefreshToken(user);

        return res.status(200).json({
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                userName: user.userName,
                displayName: user.displayName,
                imageUrl: user.imageUrl,
                blurhash: user.blurhash,
            },
        });
    } catch (err) {
        console.error("Error during login:", err);
        return res.status(500).json({
            errorCode: "internal_server_error",
            errorMessage: "An error occurred during login",
        });
    }
};

exports.verifyToken = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            errorCode: "missing_fields",
            errorMessage: errors.array(),
        });
    }

    const { token } = req.body;

    try {
        const user = jwt.verifyToken(token);

        if (!user) {
            return res.status(400).json({
                errorCode: "invalid_token",
                errorMessage: "Token expired or invalid",
            });
        }

        console.log(user);

        return res.json({
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            country: user.country,
            language: user.language,
            userRole: user.userRole,
            imageUrl: user.imageUrl,
            blurhash: user.blurhash,
        });
    } catch (err) {
        console.error("Error verifying token:", err);
        return res.status(400).json({
            errorCode: "invalid_token",
            errorMessage: "Token expired or invalid",
        });
    }
};

exports.refreshToken = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            errorCode: "missing_fields",
            errorMessage: errors.array(),
        });
    }

    const { token } = req.body;

    try {
        const decode = jwt.verifyToken(token, "refresh");

        if (!decode) {
            return res.status(400).json({
                errorCode: "invalid_token",
                errorMessage: "Token expired or invalid",
            });
        }

        const user = await User.findById(decode.id);

        if (!user) {
            return res.status(404).json({
                errorCode: "not_found",
                errorMessage: "User not found",
            });
        }

        const accessToken = jwt.generateAccessToken(user);
        const refreshToken = jwt.generateRefreshToken(user);

        return res.json({
            accessToken,
            refreshToken,
            user: user,
        });
    } catch (err) {
        console.error("Error during token refresh:", err);
        return res.status(500).json({
            errorCode: "internal_server_error",
            errorMessage: "An error occurred during token refresh",
        });
    }
};