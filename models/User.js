const bcrypt = require("bcryptjs");
const helper = require("../utils/helper");

class User {
    constructor(
        email,
        password,
        userName = "",
        displayName = "",
        imageUrl = "",
        blurhash = "",
        //      expoToken = null,
    ) {
        this.email = email;
        this.password = bcrypt.hashSync(password, 8);
        this.userName = userName;
        this.displayName = displayName;
        this.imageUrl = imageUrl;
        this.blurhash = blurhash;
    }

    static create(newUser) {

    }

    static findByPhoneNumber(phoneNumber) {
    }
}
module.exports = User;
