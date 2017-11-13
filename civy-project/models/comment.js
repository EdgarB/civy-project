var mongoose = require("mongoose");

//Comments
var CommentSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    content: {type:String, required: true},
    postBelongsTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post"
    },
    questionBelongsTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post"
    }
});

module.exports = mongoose.model("Comment", CommentSchema);