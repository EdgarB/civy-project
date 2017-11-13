var mongoose = require("mongoose");

//Invitations
var InvitationSquema = new mongoose.Schema({
    userSenderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    userReceiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    communityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Community",
        required: true
    }
});

module.exports = mongoose.model("Invitation", InvitationSquema);