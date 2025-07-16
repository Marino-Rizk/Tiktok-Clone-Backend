const helper = require("../utils/helper");
const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // reference to user
    videoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
}, {
    timestamps: true,
    collection: 'Likes'
});

VideoSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Like', VideoSchema);