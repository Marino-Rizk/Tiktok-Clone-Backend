const User = require("../models/User");
const compressFile = require("../utils/compressFile");
const getBlurHash = require("../utils/blurhash");
const { uploadAndRenameFile } = require("../utils/helper");
const path = require("path");
const { validationResult } = require("express-validator");

exports.updateProfile = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            errorCode: "validation_error",
            errorMessage: errors.array(),
        });
    }
    try {
        const userId = req.user.id;
        const {displayName } = req.body;
        const updateFields = {};
        if (displayName !== undefined) updateFields.displayName = displayName;
        // Handle file upload if present
        if (req.files && req.files.imageUrl) {
            // Upload and rename the file
            const { filePath, fileUrl } = await uploadAndRenameFile(req.files.imageUrl);
            await compressFile(filePath);
            // Determine file type by extension
            const ext = path.extname(filePath).toLowerCase();
            if ([".jpg", ".jpeg", ".png", ".webp", ".bmp"].includes(ext)) {
                const blurhash = await getBlurHash(filePath);
                updateFields.imageUrl = fileUrl;
                updateFields.blurhash = blurhash;
            }
        }

        const user = await User.findByIdWithUrls(userId);
        if (!user) {
            return res.status(404).json({
                errorCode: "not_found",
                errorMessage: "User not found",
            });
        }

        const updatedUser = await User.updateProfile(userId, updateFields);
        return res.status(200).json({
            id: updatedUser.id,
            email: updatedUser.email,
            userName: updatedUser.userName,
            displayName: updatedUser.displayName,
            imageUrl: updatedUser.imageUrl,
            videoUrl: updatedUser.videoUrl,
            blurhash: updatedUser.blurhash,
        });
    } catch (err) {
        console.error("Error updating profile:", err);
        return res.status(500).json({
            errorCode: "internal_server_error",
            errorMessage: "An error occurred while updating profile",
        });
    }
};

exports.getProfile = async (req, res) => {
    try {
        let user;
        const { userId, userName } = req.query;
        if (userId) {
            user = await User.findByIdWithUrls(userId);
        } else if (userName) {
            user = await User.findOne({ userName });
        } else if (req.user && req.user.id) {
            user = await User.findByIdWithUrls(req.user.id);
        } else {
            return res.status(400).json({
                errorCode: "bad_request",
                errorMessage: "userId, userName, or authentication required",
            });
        }
        if (!user) {
            return res.status(404).json({
                errorCode: "not_found",
                errorMessage: "User not found",
            });
        }
        // Use User model static methods for counts
        const followersCount = await User.getFollowersCount(user._id);
        const followingCount = await User.getFollowingCount(user._id);
        return res.status(200).json({
            id: user.id,
            email: user.email,
            userName: user.userName,
            displayName: user.displayName,
            imageUrl: user.imageUrl,
            blurhash: user.blurhash,
            followers: followersCount,
            following: followingCount,
        });
    } catch (err) {
        console.error("Error fetching profile:", err);
        return res.status(500).json({
            errorCode: "internal_server_error",
            errorMessage: "An error occurred while fetching profile",
        });
    }
};

exports.getFollowers = async (req, res) => {
    try {
        const { userId, userName, page = 1 } = req.query;
        let user;
        if (userId) {
            user = await User.findByIdWithUrls(userId);
        } else if (userName) {
            user = await User.findOne({ userName });
        } else if (req.user && req.user.id) {
            user = await User.findByIdWithUrls(req.user.id);
        } else {
            return res.status(400).json({
                errorCode: "bad_request",
                errorMessage: "userId, userName, or authentication required",
            });
        }
        if (!user) {
            return res.status(404).json({
                errorCode: "not_found",
                errorMessage: "User not found",
            });
        }
        const pageNum = Math.max(1, parseInt(page));
        const limit = 12;
        const followers = await User.getFollowersPaginated(user._id, pageNum, limit);
        return res.status(200).json({
            followers,
            page: pageNum,
            pageSize: limit,
        });
    } catch (err) {
        console.error("Error fetching followers:", err);
        return res.status(500).json({
            errorCode: "internal_server_error",
            errorMessage: "An error occurred while fetching followers",
        });
    }
};

exports.getFollowing = async (req, res) => {
    try {
        const { userId, userName, page = 1 } = req.query;
        let user;
        if (userId) {
            user = await User.findByIdWithUrls(userId);
        } else if (userName) {
            user = await User.findOne({ userName });
        } else if (req.user && req.user.id) {
            user = await User.findByIdWithUrls(req.user.id);
        } else {
            return res.status(400).json({
                errorCode: "bad_request",
                errorMessage: "userId, userName, or authentication required",
            });
        }
        if (!user) {
            return res.status(404).json({
                errorCode: "not_found",
                errorMessage: "User not found",
            });
        }
        const pageNum = Math.max(1, parseInt(page));
        const limit = 12;
        const following = await User.getFollowingPaginated(user._id, pageNum, limit);
        return res.status(200).json({
            following,
            page: pageNum,
            pageSize: limit,
        });
    } catch (err) {
        console.error("Error fetching following:", err);
        return res.status(500).json({
            errorCode: "internal_server_error",
            errorMessage: "An error occurred while fetching following",
        });
    }
};

exports.followUser = async (req, res) => {
    try {
        const followerId = req.user.id;
        const targetUserId = req.params.id;
        await User.followUser(followerId, targetUserId);
        return res.status(200).json({ message: 'Followed successfully' });
    } catch (err) {
        return res.status(400).json({ errorCode: 'follow_error', errorMessage: err.message });
    }
};

exports.unfollowUser = async (req, res) => {
    try {
        const followerId = req.user.id;
        const targetUserId = req.params.id;
        await User.unfollowUser(followerId, targetUserId);
        return res.status(200).json({ message: 'Unfollowed successfully' });
    } catch (err) {
        return res.status(400).json({ errorCode: 'unfollow_error', errorMessage: err.message });
    }
};
