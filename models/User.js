const bcrypt = require("bcryptjs");
const helper = require("../utils/helper");
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    userName: { type: String, required: true, unique: true },
    displayName: { type: String },
    imageUrl: { type: String },
    blurhash: { type: String },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { collection: 'Users' });

// Hash password before saving if modified
UserSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 8);
    }
    next();
});

UserSchema.statics.findByEmail = async function (email) {
    const user = await this.findOne({ email });
    if (user) {
        helper.appendMainUrlToKey(user, 'imageUrl');
        helper.appendMainUrlToKey(user, 'blurhash');
    }
    return user;
};

UserSchema.statics.createUser = async function (userData) {
    try {
        const user = await this.create(userData);
        return user;
    } catch (error) {
        if (error.code === 11000 && error.keyPattern && error.keyPattern.userName) {
            throw new Error('Username already exists');
        }
        console.error("Error in createUser:", error);
        throw error;
    }
};

UserSchema.statics.findByIdWithUrls = async function (id) {
    const user = await this.findOne({ _id: id });
    if (user) {
        helper.appendMainUrlToKey(user, 'imageUrl');
        helper.appendMainUrlToKey(user, 'blurhash');
    }
    return user;
};

UserSchema.statics.updateProfile = async function (userId, updateFields) {
    try {
        const updatedUser = await this.findByIdAndUpdate(
            userId,
            { $set: updateFields },
            { new: true }
        );
        return updatedUser;
    } catch (error) {
        console.error("Error in updateProfile:", error);
        throw error;
    }
};

UserSchema.statics.getFollowersPaginated = async function (userId, page = 1, limit = 12) {
    const user = await this.findByIdWithUrls(userId);
    if (!user || !Array.isArray(user.followers)) return [];
    const pageNum = Math.max(1, parseInt(page));
    const pageSize = pageNum * limit;
    const followerIds = user.followers.slice(0, pageSize);
    return this.find({ _id: { $in: followerIds } })
        .select('id email userName displayName imageUrl blurhash');
};

UserSchema.statics.getFollowingPaginated = async function (userId, page = 1, limit = 12) {
    const user = await this.findByIdWithUrls(userId);
    if (!user || !Array.isArray(user.following)) return [];
    const pageNum = Math.max(1, parseInt(page));
    const pageSize = pageNum * limit;
    const followingIds = user.following.slice(0, pageSize);
    return this.find({ _id: { $in: followingIds } })
        .select('id email userName displayName imageUrl blurhash');
};

UserSchema.statics.getFollowersCount = async function (userId) {
    const user = await this.findByIdWithUrls(userId);
    return user && Array.isArray(user.followers) ? user.followers.length : 0;
};

UserSchema.statics.getFollowingCount = async function (userId) {
    const user = await this.findByIdWithUrls(userId);
    return user && Array.isArray(user.following) ? user.following.length : 0;
};

UserSchema.statics.followUser = async function (followerId, targetUserId) {
    if (followerId === targetUserId) throw new Error('Cannot follow yourself');
    const follower = await this.findByIdWithUrls(followerId);
    const target = await this.findByIdWithUrls(targetUserId);
    if (!follower || !target) throw new Error('User not found');
    // Prevent duplicate follows
    if (target.followers.includes(followerId)) return;
    target.followers.push(followerId);
    follower.following.push(targetUserId);
    await target.save();
    await follower.save();
};

UserSchema.statics.unfollowUser = async function (followerId, targetUserId) {
    if (followerId === targetUserId) throw new Error('Cannot unfollow yourself');
    const follower = await this.findByIdWithUrls(followerId);
    const target = await this.findByIdWithUrls(targetUserId);
    if (!follower || !target) throw new Error('User not found');
    target.followers = target.followers.filter(id => id.toString() !== followerId.toString());
    follower.following = follower.following.filter(id => id.toString() !== targetUserId.toString());
    await target.save();
    await follower.save();
};

const User = mongoose.models.User || mongoose.model('User', UserSchema);
module.exports = User;
