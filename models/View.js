const mongoose = require('mongoose');

const ViewSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    videoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
}, {
    timestamps: true,
    collection: 'Views'
});

ViewSchema.index({ createdAt: -1 });

module.exports = mongoose.model('View', ViewSchema); 