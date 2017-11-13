var mongoose = require("mongoose");
//      user
var UserCredentialSchema = new mongoose.Schema({
    username: {type: String, required: true, unique: true},
    password: String
});



module.exports = mongoose.model("UserCredential", UserCredentialSchema);