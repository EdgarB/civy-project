var mongoose = require("mongoose");

//Discussion boards
var NoticeSchema = new mongoose.Schema({
    title: {type: String, required: true},
    description: {type:String, required: true},
    
    datePublished: {type:Date, required: true},
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref:"User",
        required: true
    },
    comBelongsTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Community",
        required: true
    }
});

module.exports = mongoose.model("Notice", NoticeSchema);