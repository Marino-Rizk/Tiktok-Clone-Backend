const bcrypt = require("bcryptjs");
const helper = require("../utils/helper");
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    userName: { type: String },
    displayName: { type: String },
    imageUrl: { type: String },
    blurhash: { type: String },
}, { collection: 'Users' });

// Hash password before saving if modified
UserSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 8);
    }
    next();
});

UserSchema.statics.findByEmail = async function(email) {
    const user = await this.findOne({ email });
    if (user) {
        helper.appendMainUrlToKey(user, 'imageUrl');
        helper.appendMainUrlToKey(user, 'blurhash');
    }
    return user;
};

UserSchema.statics.createUser = async function(userData) {
    try {
        const user = await this.create(userData);
        return user;
    } catch (error) {
        console.error("Error in createUser:", error);
        throw error;
    }
};

UserSchema.statics.findById = async function(id) {
    const user = await this.findOne({ _id: id });
    if (user) {
        helper.appendMainUrlToKey(user, 'imageUrl');
        helper.appendMainUrlToKey(user, 'blurhash');
    }
    return user;
};

const User = mongoose.models.User || mongoose.model('User', UserSchema);
module.exports = User;
