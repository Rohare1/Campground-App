 var mongoose = require('mongoose');
 
var campgroundSchema = new mongoose.Schema({
    name: String,
    price: String, 
    image: String,
    imageId: String,
    description: String,
    location: String,
    lat: Number,
    createdAt:{
                type: Date,
                default: Date.now
              },
    lng: Number,
    author: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        username: String
    },
    comments: [
                {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "comment"
                }
        ]
});

module.exports = mongoose.model('Campground', campgroundSchema);
  