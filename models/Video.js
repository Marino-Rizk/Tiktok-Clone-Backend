const helper = require("../utils/helper");
const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // reference to uploader
    videoUrl: { type: String, required: true },
    thumbnailUrl: { type: String, required: true },
    caption: { type: String },
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
}, {
    timestamps: true,
    collection: 'Videos'
});

VideoSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Video', VideoSchema);