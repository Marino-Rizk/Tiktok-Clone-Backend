const Video = require("../models/Video");
const compressFile = require("../utils/compressFile");
const getBlurHash = require("../utils/blurhash");
const { uploadAndRenameFile, appendMainUrlToKey } = require("../utils/helper");
const path = require("path");
const { validationResult } = require("express-validator");
const Like = require("../models/Like");
const Comment = require("../models/Comment");
const View = require("../models/View");
const axios = require("axios");

exports.uploadVideo = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            errorCode: "validation_error",
            errorMessage: errors.array(),
        });
    }
    try {
        // Check for files
        if (!req.files || !req.files.video || !req.files.thumbnail) {
            return res.status(400).json({
                errorCode: "bad_request",
                errorMessage: "Video and thumbnail files are required.",
            });
        }
        const { caption } = req.body;
        const videoFile = req.files.video;
        const thumbnailFile = req.files.thumbnail;

        // Upload and rename video file
        const { filePath: videoPath, fileUrl: videoUrl } = await uploadAndRenameFile(videoFile);
        // Compress video and get new path if changed
        const compressedVideoPath = await compressFile(videoPath);
        let finalVideoUrl = videoUrl;
        if (compressedVideoPath !== videoPath) {
            // If compressed file is different, update the URL
            const compressedFileName = path.basename(compressedVideoPath);
            finalVideoUrl = `/uploads/${compressedFileName}`;
        }

        // Upload and rename thumbnail file
        const { filePath: thumbnailPath, fileUrl: thumbnailUrl } = await uploadAndRenameFile(thumbnailFile);
        // Compress thumbnail (image)
        await compressFile(thumbnailPath);
        // Generate blurhash for thumbnail
        const blurhash = await getBlurHash(thumbnailPath);

        // Save video document
        const videoDoc = await Video.create({
            userId: req.user.id,
            videoUrl: finalVideoUrl,
            thumbnailUrl,
            caption,
            likeCount: 0,
            commentCount: 0,
            views: 0,
            blurhash
        });

        // Append main URL to video and thumbnail in response
        appendMainUrlToKey(videoDoc, "videoUrl");
        appendMainUrlToKey(videoDoc, "thumbnailUrl");

        return res.status(201).json({
            message: "Video uploaded successfully",
            video: videoDoc
        });
    } catch (err) {
        console.error("Error uploading video:", err);
        return res.status(500).json({
            errorCode: "internal_server_error",
            errorMessage: "An error occurred while uploading video",
        });
    }
};

exports.getVideosByUser = async (req, res) => {
    try {
        const userId = req.params.userId || req.user.id;
        const page = parseInt(req.query.page) > 0 ? parseInt(req.query.page) : 1;
        const pageSize = 9;
        const skip = (page - 1) * pageSize;
        const [videos, total] = await Promise.all([
            Video.find({ userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(pageSize),
            Video.countDocuments({ userId })
        ]);
        // Append main URL to video and thumbnail in all videos
        appendMainUrlToKey(videos, "videoUrl");
        appendMainUrlToKey(videos, "thumbnailUrl");
        return res.status(200).json({
            page,
            pageSize,
            total,
            videos
        });
    } catch (err) {
        console.error("Error fetching videos:", err);
        return res.status(500).json({
            errorCode: "internal_server_error",
            errorMessage: "An error occurred while fetching videos",
        });
    }
};

exports.addView = async (req, res) => {
    try {
        const userId = req.user && req.user.id;
        const { videoId } = req.params;
        if (!userId) {
            return res.status(401).json({ errorCode: "unauthorized", errorMessage: "Authentication required" });
        }
        // Check if the user has already viewed this video
        const existingView = await View.findOne({ userId, videoId });
        let isFirstView = false;
        if (!existingView) {
            // Save the view
            await View.create({ userId, videoId });
            // Increment the view count
            await Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } });
            isFirstView = true;
        }
        // Return the updated video
        const video = await Video.findById(videoId);
        if (!video) {
            return res.status(404).json({ errorCode: "not_found", errorMessage: "Video not found" });
        }
        appendMainUrlToKey(video, "videoUrl");
        appendMainUrlToKey(video, "thumbnailUrl");
        return res.status(200).json({ video, isFirstView });
    } catch (err) {
        console.error("Error adding view:", err);
        return res.status(500).json({
            errorCode: "internal_server_error",
            errorMessage: "An error occurred while adding view",
        });
    }
};

exports.likeVideo = async (req, res) => {
    try {
        const userId = req.user.id;
        const { videoId } = req.params;
        const existingLike = await Like.findOne({ userId, videoId });
        if (existingLike) {
            return res.status(400).json({ errorCode: "already_liked", errorMessage: "Video already liked" });
        }
        await Like.create({ userId, videoId });
        await Video.findByIdAndUpdate(videoId, { $inc: { likeCount: 1 } });
        return res.status(200).json({ message: "Video liked" });
    } catch (err) {
        console.error("Error liking video:", err);
        return res.status(500).json({ errorCode: "internal_server_error", errorMessage: "An error occurred while liking video" });
    }
};

exports.dislikeVideo = async (req, res) => {
    try {
        const userId = req.user.id;
        const { videoId } = req.params;
        const existingLike = await Like.findOne({ userId, videoId });
        if (!existingLike) {
            return res.status(400).json({ errorCode: "not_liked", errorMessage: "Video not liked yet" });
        }
        await Like.deleteOne({ userId, videoId });
        await Video.findByIdAndUpdate(videoId, { $inc: { likeCount: -1 } });
        return res.status(200).json({ message: "Video disliked" });
    } catch (err) {
        console.error("Error disliking video:", err);
        return res.status(500).json({ errorCode: "internal_server_error", errorMessage: "An error occurred while disliking video" });
    }
};

exports.addComment = async (req, res) => {
    try {
        const userId = req.user.id;
        const { videoId } = req.params;
        const { text } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({ errorCode: "empty_comment", errorMessage: "Comment text is required" });
        }
        const comment = await Comment.create({ userId, videoId, text });
        await Video.findByIdAndUpdate(videoId, { $inc: { commentCount: 1 } });
        return res.status(201).json({ message: "Comment added", comment });
    } catch (err) {
        console.error("Error adding comment:", err);
        return res.status(500).json({ errorCode: "internal_server_error", errorMessage: "An error occurred while adding comment" });
    }
};

exports.getComments = async (req, res) => {
    try {
        const { videoId } = req.params;
        const comments = await Comment.find({ videoId })
            .sort({ createdAt: -1 })
            .populate('userId', 'userName displayName imageUrl');
        return res.status(200).json({ comments });
    } catch (err) {
        console.error("Error fetching comments:", err);
        return res.status(500).json({ errorCode: "internal_server_error", errorMessage: "An error occurred while fetching comments" });
    }
};

exports.getHomeRecommendations = async (req, res) => {
    try {
        const userId = req.user.id;
        const apiUrl = req.app.locals.RECOMMENDATION_API_URL + "/recommend";
        const response = await axios.post(apiUrl, { userId });
        return res.status(200).json(response.data);
    } catch (err) {
        console.error("Error fetching recommendations:", err.response ? err.response.data : err.message);
        return res.status(500).json({
            errorCode: "recommendation_error",
            errorMessage: err.response && err.response.data ? err.response.data : err.message,
        });
    }
};
