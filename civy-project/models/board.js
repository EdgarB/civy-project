var mongoose = require("mongoose");

//Discussion boards
var BoardSchema = new mongoose.Schema({
    title: {type: String, required: true},
    description: {type:String, required: true},
    comBelongsTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Community",
        required: true
    }
});

module.exports = mongoose.model("Board", BoardSchema);