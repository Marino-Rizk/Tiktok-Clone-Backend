const helper = require("../utils/helper");
const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // reference to user
    videoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
    text: { type: String },
}, {
    timestamps: true,
    collection: 'Comments'
});

VideoSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Comment', VideoSchema);