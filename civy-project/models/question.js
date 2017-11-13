var mongoose = require("mongoose");

//      user
var QuestionSchema = new mongoose.Schema({
    title: {type: String, required: true},
    description: {type: String, required: true},
    answers: [{
        description:{type: String, required: true},
        votators: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }]
    }],
    isOpen: {type: Boolean, required: true},
    comBelongsTo:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Community"
    }
});

module.exports = mongoose.model("Question", QuestionSchema);