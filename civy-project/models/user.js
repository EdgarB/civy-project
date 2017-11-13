var mongoose = require("mongoose");

//      user
var UserSchema = new mongoose.Schema({
    username: {type: String, required: true, unique: true},
    firstName: {type: String, required: true},
    lastName: {type: String, required: true},
    email: {type: String, required: true, unique: true},
    sex: {type: String, required: true},
    birthdate: {type: Date, required: true},
    userCredential :{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" , 
        required: true},
    communities: [{
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Community"
    }],
});

module.exports = mongoose.model("User", UserSchema);