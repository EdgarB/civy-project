var mongoose = require("mongoose");

//Posts inside discussion boards
var PostSchema = new mongoose.Schema({
    title: {type: String, required: true},
    description: {type:String, required: true},
    content: {type:String, required:true},
    boardBelongsTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Board",
        required: true
    },
    userAuthor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
    
});

module.exports = mongoose.model("Post", PostSchema);