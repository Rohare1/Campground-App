var express = require('express');
var router = express.Router();
var Campground = require('../models/campground'); 
var middleware = require('../middleware/');
var NodeGeocoder = require('node-geocoder');
var multer = require('multer');
var storage = multer.diskStorage({
  filename: function(req, file, callback) {
    callback(null, Date.now() + file.originalname);
  }
});
var imageFilter = function (req, file, cb) {
    // accept image files only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};
var upload = multer({ storage: storage, fileFilter: imageFilter});

var cloudinary = require('cloudinary');
cloudinary.config({ 
  cloud_name: 'dlqhctgy9', 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

var options = {
  provider: 'google',
  httpAdapter: 'https',
  apiKey: process.env.GEOCODER_API_KEY,
  formatter: null
};
 
var geocoder = NodeGeocoder(options);

//INDEX  - Show all campgrounds in DB
router.get('/', function(req, res){
    if(req.query.search){
        const regex = new RegExp(escapeRegex(req.query.search), 'gi');
        Campground.find({name: regex}, function(err, searchResult){
            if (err){
                console.log(err);
            }else{
                if(searchResult.length < 1){
                    req.flash('error', 'The campground you are looking for does not exist!');
                    res.redirect('back');
                }else{
                res.render('campgrounds/index', {campgrounds: searchResult, page: 'campgrounds'}); 
                }
            }
        });  
    } else{
        // Get all campgrounds from DB
        Campground.find({}, function(err, allCampgrounds){
            if (err){
                console.log(err);
            }else{
                res.render('campgrounds/index', {campgrounds: allCampgrounds, page: 'campgrounds'}); 
            }
        });
    }
});  

//CREATE - add new campground to DB
router.post("/", middleware.isLoggedIn, upload.single('image'), function(req, res) {
  // get data from form and add to campgrounds array
  geocoder.geocode(req.body.location, function (err, data) {
  cloudinary.v2.uploader.upload(req.file.path, function(err, result) {
      if (err){
          req.flash('error', err.message);
          return res.redirect('back');
      }
  var name = req.body.name;
  var price = req.body.price;
  var image = result.secure_url;
  var imageId = result.public_id;
  var desc = req.body.description;
  var author = {
      id: req.user._id,
      username: req.user.username
  };
    if (err || !data.length) {
      console.log(err);    
      req.flash('error', 'Invalid address');
      return res.redirect('back');
    }
    var lat = data[0].latitude;
    var lng = data[0].longitude;
    var location = data[0].formattedAddress;
    var newCampground = {name: name,price: price, image: image, imageId: imageId, description: desc, author:author, location: location, lat: lat, lng: lng};
    // Create a new campground and save to DB
    Campground.create(newCampground, function(err, newlyCreated){
        if(err){
            console.log(err);
        } else {
            //redirect back to campgrounds page
            
            res.redirect("/campgrounds");
        }
    });
  });
});
});

// NEW - show form to create  a new campground 
router.get('/new', middleware.isLoggedIn, function(req,res){
    res.render('campgrounds/new');
});

// SHOW - shows more info about one campground
router.get('/:id', function(req, res){
    // Find campground with provided ID 
    Campground.findById(req.params.id).populate("comments").exec(function(err, foundCampground){
        if(err || !foundCampground){
            req.flash('error', 'Campground not found!');
            res.redirect('back'); 
        }else{
            //  console.log(foundCampground);  
             // render SHOW template with that campground 
             res.render('campgrounds/show', {campground:foundCampground}); 
        }
    });
}); 

//EDIT CAMPGROUND ROUTE
router.get('/:id/edit', middleware.checkCampgroundOwnership, function(req, res){
    Campground.findById(req.params.id, function(err, foundCampground){
        res.render('campgrounds/edit', {campground:foundCampground}); 
    });
});

// UPDATE CAMPGROUND ROUTE 
router.put('/:id', upload.single('image'), function(req, res){
    Campground.findById(req.params.id, async function(err, campground){
        if(err){
            req.flash("error", err.message);
            res.redirect("back");
        } else {
            if (req.file) {
              try {
                  await cloudinary.v2.uploader.destroy(campground.imageId);
                  var result = await cloudinary.v2.uploader.upload(req.file.path);
                  campground.imageId = result.public_id;
                  campground.image = result.secure_url;
              } catch(err) {
                  req.flash("error", err.message);
                  return res.redirect("back");
              }
            }
            geocoder.geocode(req.body.location, function (err, data) {
            campground.name = req.body.campground.name;
            campground.description = req.body.campground.description;
            campground.price = req.body.campground.price;
            campground.lat = data[0].latitude;
            campground.lng = data[0].longitude;
            campground.location = data[0].formattedAddress;
            console.log(req.body.campground);
            campground.save();
            req.flash("success","Successfully Updated!");
            res.redirect("/campgrounds/" + campground._id);
            });
        }
    });
});
        
 


// DESTROY CAMPGROUND
router.delete('/:id',middleware.checkCampgroundOwnership, function(req,res){
    Campground.findById(req.params.id, async function(err, campground){
        if (err){
            req.flash('error', err.message);
            return res.redirect('/campgrounds');
        }
        try{
            await cloudinary.v2.uploader.destroy(campground.imageId);
            campground.remove();
            req.flash('success', 'Campground deleted!');
            res.redirect('/campgrounds');
        }catch(err){
            if(err){
             req.flash('error', err.message);
             return res.redirect('/campgrounds');   
            }
        }
    });
});

function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

module.exports = router; 