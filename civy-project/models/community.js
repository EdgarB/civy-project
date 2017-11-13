var mongoose = require("mongoose");

var CommunitySchema = new mongoose.Schema({
    title: {type: String, required: true, trim:true, lowercase:true},
    beliefs: {type: String, required: true},
    desc: {type: String, required: true}
});

module.exports = mongoose.model("Community", CommunitySchema);