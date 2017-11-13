var express               = require("express"),
    bodyParser            = require("body-parser"),
    methodOverride        = require("method-override"),
    expressSanitizer      = require("express-sanitizer"),
    mongoose              = require("mongoose"),
    passport              = require("passport"),
    sessions              = require("client-sessions"),
    bcrypt                = require("bcryptjs"),
    User                  = require("./models/user"),
    UserCredential        = require("./models/userCredential.js"),
    Community             = require("./models/community.js"),
    Invitation            = require("./models/invitation.js"),
    Board                 = require("./models/board.js"),
    Post                  = require("./models/post.js"),
    Comment               = require("./models/comment.js"),
    Notice                = require("./models/notice.js"),
    Question              = require("./models/question.js");

var app = express();


//DATABASE
mongoose.connect("mongodb://localhost/civy_database", {useMongoClient: true});
    //Schema setup being done with models js files

//SESSION
app.use(sessions({
    cookieName: "session",
    secret: "b9ai55pSX2HVPBsYZeC7Fye17VdpW5pa80h3csCalez6RiveXgvloLTWjZEQRiH",  //Used to encode and decode session
    duration: 30 * 60 * 1000, //30 mins
    activeDuration: 5 * 60 * 1000,
    httpOnly: true, //Don let JS code access cookies
    secure: false, //Only set cookies over https (change later to true)
    ephemeral: true //Destroy cookies when the browser closes
}));


//CONFIGURATION
app.use(express.static('public'));                                              //Tell express to use the public folder aside form the views folder
app.set("view engine", "ejs");                                                  //Tell node that all the views arer going to view ejs by default


app.use(bodyParser.urlencoded({extended: true})); // allows to send concanneted objects
app.use(expressSanitizer());
app.use(methodOverride("_method"));



//Middleware for user authenticated
/*
 It bugs me that a malicious user can eavesdrop and steal the cookie when the user
 is authenticating
*/

app.use(function(req, res, next) {
    if(!(req.session && req.session.userId)){
        return next();
    }
    
    User.findById(req.session.userId, function(err, user) {
       if(err){
           return next(err);
       } 
       
       if(!user){
           return next();
       }
       
       
       req.user = user;
       res.locals.user = user;
       
       next();
    });
});


//Send to every single route the user of the session

app.use(function(req, res, next){
   res.locals.currentUser = req.user;
   next();
});



//ROUTES
// *****************************************************************************
//                              MAIN
// *****************************************************************************
// "/" => index (LOGIN and REGISTRATION)
app.get("/",alreadyLogged, function(req, res){

    res.render("index");
});

// "/about" => About page why do we exist
app.get("/about", function(req,res){
   res.render("about"); 
});

// "/home" => home page
app.get("/home",loginRequired, function(req, res){
    User.findOne({"username" : req.user.username}, function(err, userDetails){
        if(err || !userDetails){
            console.log("Could not find user detailed data");
            return res.render("home", {error: "Could not find user detailed data"});
        }
        res.render("home",{user : userDetails});
        
    });
});


// "/profile" => User data details page
app.get("/profile", loginRequired, function(req,res){
    User.findOne({"username" : req.user.username}, function(err, userDetails){
        if(err || !userDetails){
            console.log("Could not find user detailed data");
            return res.render("home", {error: "Could not find information about user."});
        }
        
        return res.render("profile",{user : userDetails});
        
    });

});

//Request logout
app.get("/logout",loginRequired, function(req, res) {
    req.session.reset(); //Destroys all user data in the session
    res.redirect("/");
})


//******************************************************************************
//              COMMUNITY SHOW, INVITATIONS AND PROFILE
//******************************************************************************
//  Community


//Show all communities
app.get("/communities", loginRequired, function(req, res) {
    User.findOne({"username" : req.user.username}, function(err, userDetails){
        if(err || !userDetails){
            console.log("Could not find user detailed data");
            return res.render("home", {error: "Could not find user detailed data"});
        }
        
        Community.find({_id:userDetails.communities}, function(err,data){
            console.log("Sup");
            if(err || !data){
                console.log("something went wrong");
                return res.render("communities/index", {error: "Could not load correctly the communities."});
            }
            console.log("everything its ok");
            return res.render("communities/index", {communities: data});
        });
        
    });
});


app.get("/communities/new", loginRequired, function(req, res) {
   res.render("communities/new");
});



//create
app.post("/communities", loginRequired, function(req,res){
    User.findOne({_id:req.user._id}, function(err, user){
        if (err || !user ){
           return res.render("communities/new", {error: "Something went wrong with the user logged"});
        }    
        var title = req.sanitize(req.body.community.title);
        var beliefs = req.sanitize(req.body.community.beliefs);
        var desc = req.sanitize(req.body.community.desc);
        
        if(!title || !beliefs || !desc){
            return res.redirect("/communities/new");
        }
        
        var newCommunity = new Community({
            title: title,
            beliefs: beliefs,
            desc: desc
        });
        
        newCommunity.save(function(err, savedCommunity){
            if(err){
                return res.render("communities/new", {error: "Could not save community"});
            }
             user.communities.push(savedCommunity._id);
             user.save(function(err){
                 if(err){
                     return res.render("communities/new", {error: "Could not save association of the community to the user."});
                 }
                 return res.render("communities", {success: "Community created correctly."});
             });
        })
       
    })
});

// ------- INVITATIONS -------

//"Invitations" => See all the invitations of the user
app.get("/invitations", loginRequired, function(req, res) {
    User.findOne({"username" : req.user.username}, function(err, userDetails){
        if(err || !userDetails){
            return res.redirect("/");
        }
        
        Invitation.find({userReceiverId: userDetails._id}, function(err, data){
            if(err || data.length==0){
                return res.render("invitations/index",{error:"Invitations not found", invitations: []});
            }
            var toSend;
            var dataToSend = [];
            var itemsProcessed = 0;
            data.forEach(function(invitation, index, array){
                User.findOne({_id:invitation.userSenderId}, function(err, sender){
                    if(err || !sender){
                        return res.redirect("/home");
                    }
                    
                }).then(function(sender){
                    
                    Community.findOne({_id:invitation.communityId}, function(err, communityFound) {
                        if(err || !communityFound){
                            return res.redirect("/home");
                        }
                        
                        toSend = {
                            senderName: String(sender.firstName + " " + sender.lastName),
                            community: {
                                _id: String(communityFound._id), 
                                title: String(communityFound.title), 
                                beliefs: String(communityFound.beliefs), 
                                desc: String(communityFound.desc)
                            }
                        };
                   
                        //dataToSend.push(toSend);
                    }).then(function (){
                        dataToSend.push(toSend);
                        itemsProcessed++;
                        if(itemsProcessed == array.length){
                            res.render("invitations/index", {invitations: dataToSend});
                        }
                    });
                });
            });
            return;
        });
    });
});

app.get("/communities/:id/invite",loginRequired, function(req, res) {
    req.params.id = req.sanitize(req.params.id);
        
    User.findOne({username : req.user.username, communities: req.params.id}, function(err, userDetails){
        if(err || !userDetails){
            console.log("User tried to access form for invite people in a community he/she does not belong");
            return res.redirect("/home");
        }
        
        Community.findOne({_id:req.params.id}, function(err,data){
            if(err || !data){
                console.log("User tried to access form for inviting users in a community that does not exist.");
                return res.redirect("/home");
            }
            

            console.log(data);
            return res.render("invitations/new", {communityId : data._id});
        });
        
    });
});

//Accept invitation for community
app.get("/invitations/:communityId/accept", loginRequired,function(req, res) {
    //Check that the user exists
    User.findOne({username : req.user.username}, function(err,userFound){
        if(err || !userFound){
            console.log("Could not find user detailed data")
            return res.render("home", {error: "Could not find information about user."});
        }
        
        //Check that the community exists
        console.log(req.params.id);
        console.log(req.sanitize(req.params.communityId));
        Community.findOne({_id:req.sanitize(req.params.communityId)},function(err, communityFound) {
            if(err || !communityFound){
                console.log("That community for that invitation does not exist");
                return res.redirect("/invitations");
            }
            //Check that the user has an invitation for that community
            Invitation.findOne({userReceiverId:userFound._id, communityId:communityFound._id}, function(err, data) {
                if(err || !data){
                    console.log("The user does not have an invitation for that community");
                    return res.redirect("/invitations");
                }
                //check that the user is not already in that community
                var bAlreadyJoined = false;
                userFound.communities.forEach(function(community){
                   if(community._id == communityFound._id){
                       return (bAlreadyJoined = true);
                   } 
                });
                if(!bAlreadyJoined){
                    //Add the user to the community
                    userFound.communities.push(communityFound._id);
                    return userFound.save().then(function(){
                        //Delete all the invitations
                        Invitation.remove({userReceiverId:userFound._id,communityId:communityFound._id}).then(function(){
                            console.log("removed");
                            return res.redirect("/invitations");
                        });
                    });
                    
                    
                }
                Invitation.remove({userReceiverId:userFound._id,communityId:communityFound._id}).then(function(){
                    console.log("removed");
                    return res.redirect("/invitations");
                });
                console.log("The user is already joined to that community");
                return res.redirect("/invitations");
            });
        });
    });
});


//Reject invitation for community
app.get("/invitations/:communityId/reject", loginRequired,function(req, res) {
    //Check that the user exists
    User.findOne({username : req.user.username}, function(err,userFound){
        if(err || !userFound){
            console.log("Could not find user detailed data")
            return res.render("home", {error: "Could not find information about user."});
        }
        


        //Delete all the invitations
        Invitation.remove({userReceiverId:userFound._id,communityId:req.sanitize(req.params.communityId)}).then(function(){
            res.redirect("/invitations");
     
        });

        return res.redirect("/invitations");
        
    });
});
//Invite person to community
app.post("/communities/:id/invite",loginRequired, function(req, res) {
    req.params.id = req.sanitize(req.params.id);
    req.body.invitation.personUsername = req.sanitize(req.body.invitation.personUsername);
    
    if(!req.body.invitation || !req.body.invitation.personUsername){
        res.redirect("/communities/"+req.params.id+"/invite");
    }
    
    User.findOne({username : req.user.username, communities: req.params.id}, function(err, userLoged){
        if(err || !userLoged){
            console.log("User tryied to invite people to a community he does not belong");
            return res.redirect("/home");
        }
        
        Community.findOne({_id:req.params.id}, function(err,data){
            if(err || !data){
                console.log("something went wrong");
                return res.render("communities/new", {communityId:data._id, error: "Could not load correctly the communities."});
            }
            
            User.findOne({username: req.body.invitation.personUsername}, function(err, userToInvite) {
                if(err || !userToInvite){
                    console.log("user does not exist");
                    return res. render("invitations/new", {communityId: data._id, error:"User does not exist"});
                }
                //SEND INVITATION TO USER!!!!
                let invitation = new Invitation({
                   userSenderId: userLoged._id,
                   userReceiverId: userToInvite._id,
                   communityId: data._id
                });
                
                //Handle error?
                invitation.save(function(err,savedInv){
                    if(err){
                        return res.render("invitations/new", {communityId: data._id, error: "Could not save invitation in the database."});
                    }
                    console.log("_*********************************************");
                    return res.render("invitations/new", {communityId:data._id, success: "Invitation sended correctly."});
                });
            });
        });
        
    });
});



//******************************************************************************
//                  DISCUSSION BOARDS
//******************************************************************************
//  SHOW DISCUSSION BOARDS
app.get("/communities/:communityId/boards", loginRequired, function(req, res) {
    req.params.communityId = req.sanitize(req.params.communityId);
    req.user.username = req.sanitize(req.user.username);
    //Check that the user logged belongs to the community
    return User.findOne({username : req.user.username, communities: req.params.communityId}, function(err, userDetails){
        if(err|| !userDetails){
            console.log("User does not belong to the community that is trying to access");
            return res.redirect("/home");
        }
        //Check that the community exists
        return Community.findOne({_id:req.params.communityId}, function(err, community) {
            if(err || !community){
               return res.redirect("/home");
            }
            
            //Get the discussion boards of that community 
            Board.find({comBelongsTo:req.params.communityId}, function(err,boardsFound){
                if(err || boardsFound.length==0){
                    console.log("No discussion boards for that community");
                    return res.render("boards/index",{
                        boards : [], 
                        communityId : req.params.communityId, 
                        error: "There are no discussion boards in this community"
                        
                    });
                }
    
                return res.render("boards/index", {boards : boardsFound, communityId: req.params.communityId});
            });
            
        });
        

        
    });
});

//  SHOW FORM FOR CREATING NEW DISCUSSION BOARD
app.get("/communities/:communityId/boards/new", loginRequired,function(req, res) {
    req.params.communityId = req.sanitize(req.params.communityId);
    req.user.username = req.sanitize(req.user.username);
    //Check that the user logged belongs to the community
    return User.findOne({username : req.user.username, communities: req.params.communityId}, function(err, userDetails){
        if(err || !userDetails){
            console.log("User does not belong to the community that is trying to access");
            return res.redirect("/home");
        }
        //Check that the community exists
        return Community.findOne({_id:req.params.communityId}, function(err, community) {
            if(err || !community){
                return res.redirect("/home");
            }
            
            //Render form for creating a new discussion board
            return res.render("boards/new", {communityId: req.params.communityId});
        });
       
        
    });
});




//  CREATE DISCUSSION BOARD
app.post("/communities/:communityId/boards", loginRequired,function(req,res){
    //Sanitize data
    req.params.communityId = req.sanitize(req.params.communityId);
    req.user.username = req.sanitize(req.user.username);
    var boardTitle = req.sanitize(req.body.board.title);
    var boardDesc = req.sanitize(req.body.board.desc);
    
    if(!boardTitle || !boardDesc){
        return res.redirect("/communities/"+req.params.communityId+"/boards/new");
    }
    
    //Check that the user logged belongs to the community
    return User.findOne({username : req.user.username, communities: req.params.communityId}, function(err, userDetails){
        if(err || !userDetails){
            console.log("User does not belong to the community that is trying to access");
            return res.redirect("/home");
        }
        //Check that the community exists
        return Community.findOne({_id:req.params.communityId}, function(err, community) {
            if(err || !community){
                return res.redirect("/home");
            }
            
             //Create discussion board with data passed
            var board = new Board({
                title: boardTitle,
                description: boardDesc,
                comBelongsTo: community._id
            });
            //Save discussion board
            return board.save().then(function(){
                return res.redirect("/communities/"+req.params.communityId+"/boards");
            });
            
            
        });
        
       
        
    });
});


//******************************************************************************
//                  POSTS
//******************************************************************************
//  Show post form for creating a new post
app.get("/communities/:communityId/boards/:boardId/posts/new", loginRequired,function(req, res) {
    //Sanitize data
    req.params.communityId = req.sanitize(req.params.communityId);
    req.params.boardId = req.sanitize(req.params.boardId);
    req.user.username = req.sanitize(req.user.username);
    
    //Check that the user belongs to the community and that the user exists
    User.findOne({username: req.user.username, communities: req.params.communityId}, function(err, userFound) {
        if(err || !userFound){
            console.log("User tried to access posts form in a community that he/she does not belong");
            return res.redirect("/home");
        }
        
        //Check that the community exists
        Community.findOne({_id:req.params.communityId}, function(err, communityFound){
            if(err || !communityFound){
                console.log("Community seems to not exist when the user belongs to it");
            }
            //Check that the board belongs to the community and that actually exists
            Board.findOne({_id: req.params.boardId, comBelongsTo:communityFound._id}, function(err, boardFound) {
                if(err || !boardFound){
                    console.log("That board does not exist or belongs to other community");
                    return res.redirect("/communities/"+ req.params.communityId + "/boards");
                }
                
                //Show form for creating a post inside this community
                return res.render("posts/new", {communityId: communityFound._id, boardId: boardFound._id});
                
            });
        });
    });
});




//  Create new post
app.post("/communities/:communityId/boards/:boardId/posts", loginRequired,function(req, res) {
    //Sanitize data
    req.params.communityId = req.sanitize(req.params.communityId);
    req.params.boardId = req.sanitize(req.params.boardId);
    req.user.username = req.sanitize(req.user.username);
    var postTitle = req.sanitize(req.body.post.title);
    var postDesc = req.sanitize(req.body.post.desc);
    var postContent = req.sanitize(req.body.post.content);
    
    if(!postDesc || !postTitle || !postContent){
        return res.redirect("/communities/" + req.params.communityId + "/boards/" + req.params.boardId+"posts/new");
    }
    
    //Check that the user belongs to the community and that the user exists
    User.findOne({username: req.user.username, communities: req.params.communityId}, function(err, userFound) {
        if(err || !userFound){
            console.log("User tried to access posts form in a community that he/she does not belong");
            return res.redirect("/home");
        }
        
        //Check that the community exists
        Community.findOne({_id:req.params.communityId}, function(err, communityFound){
            if(err || !communityFound){
                console.log("Community seems to not exist when the user belongs to it");
            }
            //Check that the board belongs to the community and that actually exists
            Board.findOne({_id: req.params.boardId, comBelongsTo:communityFound._id}, function(err, boardFound) {
                if(err || !boardFound){
                    console.log("That board does not exist or belongs to other community");
                    return res.redirect("/communities/"+ req.params.communityId + "/boards");
                }
                
                //Create new post
                var newPost = new Post({
                   title : postTitle,
                   description : postDesc,
                   content: postContent,
                   boardBelongsTo: boardFound._id,
                   userAuthor: userFound._id
                });
                
                //Save post 
                return newPost.save(function(err){
                    if(err){
                        console.log(err);
                        return res.redirect("/communities/" + req.params.communityId + "/boards/" + req.params.boardId);
                    }
                }).then(function(){
                    return res.redirect("/communities/" + req.params.communityId + "/boards/" + req.params.boardId);
                });
            });
            
        });
    });
});
//******************************************************************************
// ROUTES FOR COMMENTS INSIDE POSTS
//******************************************************************************
//Get form for creating a new comment
app.get("/communities/:communityId/boards/:boardId/posts/:postId/comments/new", loginRequired,function(req, res){
   //Sanitize data
   req.params.communityId = req.sanitize(req.params.communityId);
   req.params.boardId = req.sanitize(req.params.boardId);
   req.params.postId = req.sanitize(req.params.postId);
   req.user.username = req.sanitize(req.user.username);
   
   //Check that the user logged belongs to the community and that there is user with the given username
    return User.findOne({username : req.user.username, communities: req.params.communityId}, function(err, userDetails){
        if(err || !userDetails){
            console.log("User does not belong to the community that is trying to access");
            return res.redirect("/home");
        }
        //Check that the community exists
        return Community.findOne({_id:req.params.communityId}, function(err, communityFound) {
            if(err || !communityFound){
                console.log("community does not exist");
                return res.redirect("/home");
            }
            //Check that the board exists and belongs to the community
            return Board.findOne({_id : req.params.boardId, comBelongsTo: communityFound._id}, function(err, boardFound){
               if(err || !boardFound){
                   console.log("This board does not exist in this community");
                   return res.redirect("/communities/"+req.params.communityId+"/boards");
               }
               //Check that the post belongs to the disccussion board and that actually exists
               Post.findOne({boardBelongsTo:boardFound._id, _id:req.params.postId}, function(err, postFound){
                    if(err || !postFound){
                        console.log("That post does not exist");
                        return res.redirect("/communities/"+req.params.communityId+"/boards/"+req.params.boardId);
                    }
                   
                    //Show form for creating new comment
                    return res.render("comments/new",{communityId:communityFound._id, boardId:boardFound._id, postId:postFound._id});
               });
            });
        });
    });
   
});

//Create new comment
app.post("/communities/:communityId/boards/:boardId/posts/:postId/comments", loginRequired ,function(req, res){
   //Sanitize data
   req.params.communityId = req.sanitize(req.params.communityId);
   req.params.boardId = req.sanitize(req.params.boardId);
   req.params.postId = req.sanitize(req.params.postId);
   req.user.username = req.sanitize(req.user.username);
   var commentContent = req.sanitize(req.body.comment.content);
   
   if(!commentContent){
       res.redirect("/communities/"+req.params.communityId+"/boards/"+req.params.boardId+"/posts/"+req.params.postId+"/comments/new");
   } 
   
   //Check that the user logged belongs to the community and that there is user with the given username
    return User.findOne({username : req.user.username, communities: req.params.communityId}, function(err, userFound){
        if(err || !userFound){
            console.log("User does not belong to the community that is trying to access");
            return res.redirect("/home");
        }
        //Check that the community exists
        return Community.findOne({_id:req.params.communityId}, function(err, communityFound) {
            if(err || !communityFound){
                console.log("community does not exist");
                return res.redirect("/home");
            }
            //Check that the board exists and belongs to the community
            return Board.findOne({_id : req.params.boardId, comBelongsTo: communityFound._id}, function(err, boardFound){
               if(err || !boardFound){
                   console.log("This board does not exist in this community");
                   return res.redirect("/communities/"+req.params.communityId+"/boards");
               }
               //Check that the post belongs to the disccussion board and that actually exists
               Post.findOne({boardBelongsTo:boardFound._id, _id:req.params.postId}, function(err, postFound){
                    if(err || !postFound){
                        console.log("That post does not exist");
                        return res.redirect("/communities/"+req.params.communityId+"/boards/"+req.params.boardId);
                    }
                   
                    //Create new comment
                    var newComment = new Comment({
                       author: userFound._id,
                       content: commentContent,
                       postBelongsTo: postFound._id,
                       questionBelongsTo : null
                    });
                    
                    newComment.save().then(function(){
                        res.redirect("/communities/"+req.params.communityId+"/boards/"+req.params.boardId+"/posts/"+req.params.postId);
                    });
               });
            });
        });
    });
   
});

//******************************************************************************
// ROUTES FOR NEWS
//******************************************************************************
// show all news ordered as the top ones with a recent date
app.get("/communities/:communityId/notices",loginRequired,function(req, res){
    req.params.communityId = req.sanitize(req.params.communityId);
    req.user.username = req.sanitize(req.user.username);
    //Check that the user logged belongs to the community
    return User.findOne({username : req.user.username, communities: req.params.communityId}, function(err, userDetails){
        if(err || !userDetails){
            console.log("User does not belong to the community that is trying to access");
            return res.redirect("/home");
        }
        
        
        //Check that the community exists
        return Community.findOne({_id:req.params.communityId}, function(err, community) {
            if(err || !community){
                console.log("Community not found");
               return res.redirect("/home");
            }
            
            //Get the news of that community 
            Notice.find({comBelongsTo:req.params.communityId},null , {sort: "-datePublished"},function(err,tidingsFound){
                if(err || tidingsFound.length==0){
                    console.log("No tidings for that community");
                    
                    return res.render("notices/index",{
                        tidings : [], 
                        communityId : req.params.communityId
                    });
                    
                }
                
                var tidingsToSend = [];
                var aux;
                tidingsFound.forEach(function(tidings, index){
                    User.findOne({_id:tidings.author},function(err,userFound){
                        if(err){
                            aux = {
                                title: String(tidings.title),
                                description: String(tidings.description),
                                authorName: String("anon"),
                                datePublished: String(tidings.datePublished)
                            };
                        }else{
                            aux = {
                                title: String(tidings.title),
                                description: String(tidings.description),
                                authorName: String(userFound.firstName + " " + userFound.lastName),
                                datePublished: String(tidings.datePublished)
                            };
                        }
                        
                        
                    }).then(function(){
                        tidingsToSend.push(aux);

                        
                        if(index == tidingsFound.length - 1){
                            
                            
                            return res.render("notices/index", {tidings : tidingsToSend,communityId: req.params.communityId});
                        }
                    });
                });
                
                
            });
            
        });

        
    });

});
// Show form for creating a new new
app.get("/communities/:communityId/notices/new",loginRequired,function(req, res){

    req.params.communityId = req.sanitize(req.params.communityId);
    req.user.username = req.sanitize(req.user.username);
    //Check that the user logged belongs to the community
    return User.findOne({username : req.user.username, communities: req.params.communityId}, function(err, userDetails){
        if(err || !userDetails){
            console.log("User does not belong to the community that is trying to access");
            return res.redirect("/home");
        }
        //Check that the community exists
        return Community.findOne({_id:req.params.communityId}, function(err, community) {
            if(err || !community){
               return res.redirect("/home");
            }
            
            //Render news form
            return res.render("notices/new", {communityId: req.params.communityId});
            
        });

        
    });

});

// Create a new new
app.post("/communities/:communityId/notices",loginRequired,function(req, res){

    req.params.communityId = req.sanitize(req.params.communityId);
    req.user.username = req.sanitize(req.user.username);
    var newsTitle = req.sanitize(req.body.news.title);
    var newsDesc = req.sanitize(req.body.news.desc);
    var newsDate = Date.now();
    
    if(!newsTitle || !newsDesc || !newsDate){
        return res.redirect("/communities/"+req.params.communityId+"/notices/new");
    }
    
    //Check that the user logged belongs to the community
    return User.findOne({username : req.user.username, communities: req.params.communityId}, function(err, userDetails){
        if(err || !userDetails){
            console.log("User does not belong to the community that is trying to access");
            return res.redirect("/home");
        }
        //Check that the community exists
        return Community.findOne({_id:req.params.communityId}, function(err, communityFound) {
            if(err || !communityFound){
                console.log("s");
                return res.redirect("/home");
            }
            
            //create new notice
            var newNotice = new Notice({
               title : newsTitle,
               description : newsDesc,
               datePublished : newsDate,
               author: userDetails._id,
               comBelongsTo : communityFound._id
            });
            
            //Save notice
            return newNotice.save().then(function(){
                console.log(newNotice);
               return res.redirect("/communities/"+communityFound._id+"/notices");
            });
            
        });

        
    });

});
//******************************************************************************
// ROUTES OF QUESTIONS
//******************************************************************************
//Get all the questions
app.get("/communities/:communityId/questions", loginRequired, function(req,res){
    //Sanitize the data
    req.params.communityId = req.sanitize(req.params.communityId);
    req.user.username = req.sanitize(req.user.username);
    
   //Check that the user logged belongs to the community specified
   User.findOne({username:req.user.username, communities:req.params.communityId},"_id" , function(err,userFound){
       if(err || !userFound){
           console.log("User tried to get the questions of a community he/she does not belong")
           return res.redirect("/home");
       }
       
       //Check that the community exists
       Community.findOne({_id:req.params.communityId},"_id",function(err, communityFound) {
            if(err || !communityFound){
                return res.redirect("/home");
            } 
          
            //Get questions of that given community
            Question.find({comBelongsTo: communityFound._id}, "_id title", function(err, questionsFound) {
                if(err || questionsFound.length==0){
                    return res.render("questions/index", {communityId : communityFound._id, questions: []});
                }
              
                //Format questions found
                return res.render("questions/index", {communityId: communityFound._id, questions:questionsFound});
              
          });
          
       });
   });
});

//get questions form for creating new question
app.get("/communities/:communityId/questions/new", loginRequired, function(req, res) {
   //Sanitize data
    req.params.communityId = req.sanitize(req.params.communityId);
    req.user.username = req.sanitize(req.user.username);

   //Check that the user logged belongs to the community specified
   User.findOne({username:req.user.username, communities:req.params.communityId},"_id" , function(err,userFound){
       if(err || !userFound){
           console.log("User tried to get the questions of a community he/she does not belong")
           return res.redirect("/home");
       }
       
       //Check that the community exists
       return Community.findOne({_id:req.params.communityId},"_id",function(err, communityFound) {
            if(err || !communityFound){
                return res.redirect("/home");
            } 
          
            //Render question form
            return res.render("questions/new", {communityId: communityFound._id});
          
       });
   });
});

//Create new question
app.post("/communities/:communityId/questions", loginRequired, function(req,res){
    //Sanitize data
    req.params.communityId = req.sanitize(req.params.communityId);
    req.user.username = req.sanitize(req.user.username);
    req.body.question.title = req.sanitize(req.body.question.title);
    req.body.question.desc = req.sanitize(req.body.question.desc);
    var questionIsOpen = false;
    if(req.sanitize(req.body.question.isOpen) == "true"){
        questionIsOpen = true;
    }
    var answersDescription = [];
    req.body.answers.forEach(function(answer,index){
        answersDescription.push({
            description: String(req.sanitize(answer)),
            votators :[]
        });
    });
    
    if(answersDescription.length == 0 ||  !req.body.question.desc || !req.body.question.title){
        return res.redirect("/communities/"+req.params.communityId+"/questions/new");
    }
    
    
   //Check that the user logged belongs to the community specified
   User.findOne({username:req.user.username, communities:req.params.communityId},"_id" , function(err,userFound){
       if(err || !userFound){
           console.log("User tried to get the questions of a community he/she does not belong");
           return res.redirect("/home");
       }
       
       //Check that the community exists
       Community.findOne({_id:req.params.communityId},"_id",function(err, communityFound) {
            if(err || !communityFound){
                return res.redirect("/home");
            } 
          
            //Create the question
            var newQuestion = new Question({
                title: req.body.question.title,
                description: req.body.question.desc,
                answers: answersDescription,
                isOpen: questionIsOpen,
                comBelongsTo: communityFound._id
            });
            console.log(newQuestion);
            //Save the question
            return newQuestion.save(function(err){
                if(err){
                    console.log(err);
                    return res.redirect("/communities/"+req.params.communityId+"/questions/new");
                }
            }).then(function(){
                res.redirect("/communities/"+req.params.communityId+"/questions");
            });
       });
   });
});


//  Post user's answer for determined question
app.post("/communities/:communityId/questions/:questionId/answers", loginRequired, function(req,res){
    //Sanitize data
    req.params.communityId = req.sanitize(req.params.communityId);
    req.params.questionId = req.sanitize(req.params.questionId);
    req.user.username = req.sanitize(req.user.username);

    var answerSelected = Number(req.sanitize(req.body.answerSelected));
    if(!answerSelected){
        return res.redirect("/communities/"+req.params.communityId+"/questions/"+req.params.questionId);
    }

   //Check that the user logged belongs to the community specified
   User.findOne({username:req.user.username, communities:req.params.communityId},"_id" , function(err,userFound){
       if(err || !userFound){
           console.log("User tried to get the questions of a community he/she does not belong");
           return res.redirect("/home");
       }
       
       //Check that the community exists
       Community.findOne({_id:req.params.communityId},"_id",function(err, communityFound) {
            if(err || !communityFound){
                return res.redirect("/home");
            } 
            
            //Get the question, push the vote and then save it
            Question.findOne({_id:req.params.questionId},function(err, questionFound) {
                if(err || !questionFound){
                     return res.redirect("/communities/"+req.params.communityId+"/questions");
                }
                questionFound.answers[answerSelected].votators.push(userFound._id);
                
                questionFound.save().then(function(){
                    res.redirect("/communities/"+req.params.communityId+"/questions/"+req.params.questionId);
                });
                
            });
       });
   });
});


//******************************************************************************
// ROUTES FOR COMMENTS INSIDE QUESTIONS
//******************************************************************************
app.get("/communities/:communityId/questions/:questionId/comments/new", loginRequired, function(req,res){
    //Sanitize data
    req.params.communityId = req.sanitize(req.params.communityId);
    req.params.questionId = req.sanitize(req.params.questionId);
    req.user.username = req.sanitize(req.user.username);

   //Check that the user logged belongs to the community specified
   User.findOne({username:req.user.username, communities:req.params.communityId},"_id" , function(err,userFound){
       if(err || !userFound){
           console.log("User tried to get the questions of a community he/she does not belong");
           return res.redirect("/home");
       }
       
       //Check that the community exists
       Community.findOne({_id:req.params.communityId},"_id",function(err, communityFound) {
            if(err || !communityFound){
                return res.redirect("/home");
            } 
            
            //Get the question, push the vote and then save it
            Question.findOne({_id:req.params.questionId},"_id", function(err, questionFound) {
                if(err || !questionFound){
                     return res.redirect("/communities/"+req.params.communityId+"/questions");
                }
                
                //Render form with neccesary ids
                return res.render("questions/newComment",{communityId: communityFound._id, questionId: questionFound._id});
                
            });
       });
   });
});

//Create new comment
app.post("/communities/:communityId/questions/:questionId/comments/",function(req,res){
    //Sanitize data
    req.params.communityId = req.sanitize(req.params.communityId);
    req.params.questionId = req.sanitize(req.params.questionId);
    req.user.username = req.sanitize(req.user.username);
    var commentContent = req.sanitize(req.body.comment.content);
    
    if(!commentContent){
        res.redirect("/communities/"+req.params.communityId+"/questions/"+req.params.questionId+"/comments/new");
    }
    
   //Check that the user logged belongs to the community specified
   User.findOne({username: req.user.username, communities:req.params.communityId},"_id" , function(err,userFound){
       if(err || !userFound){
           console.log("User tried to get the questions of a community he/she does not belong");
           return res.redirect("/home");
       }
       
       //Check that the community exists
       Community.findOne({_id:req.params.communityId},"_id",function(err, communityFound) {
            if(err || !communityFound){
                return res.redirect("/home");
            } 
            
            //Check that the question exists
            Question.findOne({_id:req.params.questionId},"_id", function(err, questionFound) {
                if(err || !questionFound){
                     return res.redirect("/communities/"+req.params.communityId+"/questions");
                }
                var newComment = new Comment({
                   author: userFound._id,
                   content: commentContent,
                   postBelongsTo: null,
                   questionBelongsTo: questionFound._id
                });
                
                newComment.save(function(err){
                    if(err){
                       return res.redirect("/communities/"+req.params.communityId+"/questions/"+req.params.questionId+"/comments/new"); 
                    }
                    //Render form with neccesary ids
                    return res.redirect("/communities/"+req.params.communityId+"/questions/"+req.params.questionId);
                })
                
            });
       });
   });
});


//******************************************************************************
// ROUTES THAT CAN INTERFEER WITH OTHER ROUTES
//******************************************************************************

//  Show specific post details
app.get("/communities/:communityId/boards/:boardId/posts/:postId", loginRequired, function(req, res) {
    //Sanitize data
    req.params.communityId = req.sanitize(req.params.communityId);
    req.params.boardId = req.sanitize(req.params.boardId);
    req.params.postId = req.sanitize(req.params.postId);
    req.user.username = req.sanitize(req.user.username);
    
    
    //Check that the user logged belongs to the community and that there is user with the given username
    return User.findOne({username : req.user.username, communities: req.params.communityId}, function(err, userDetails){
        if(err){
            console.log("User does not belong to the community that is trying to access");
            return res.redirect("/home");
        }
        //Check that the community exists
        return Community.findOne({_id:req.params.communityId}, function(err, communityFound) {
            if(err || !communityFound){
                console.log("community does not exist");
                return res.redirect("/home");
            }
            //Check that the board exists and belongs to the community
            return Board.findOne({_id : req.params.boardId, comBelongsTo: communityFound._id}, function(err, boardFound){
               if(err || !boardFound){
                   console.log("This board does not exist in this community");
                   return res.redirect("/communities/"+req.params.communityId+"/boards");
               }
               //Check that the post belongs to the disccussion board and that actually exists
               Post.findOne({boardBelongsTo:boardFound._id, _id:req.params.postId}, function(err, postFound){
                    if(err || !postFound){
                        console.log("That post does not exist");
                        return res.redirect("/communities/"+req.params.communityId+"/boards/"+req.params.boardId);
                    }
                   
                   //Get all the comments of the post
                   Comment.find({postBelongsTo:postFound._id}, function(err, commentsFound){
                      if(err || commentsFound.length == 0){
                          return res.render("posts/show", {communityId: communityFound._id, boardId:boardFound._id, post:postFound, comments:[]});
                      } 
                      
                      var aux;
                      var commentsToSend = [];
                      commentsFound.forEach(function(comment, index){
                         User.findOne({_id: comment.author},function(err, userDetails) {
                             if(err || !userDetails){
                                return aux = {
                                     authorName : "anon",
                                     content: String(comment.content)
                                 };
                             }
                             return aux = {
                                authorName : String(userDetails.firstName + " " + userDetails.lastName),
                                content: String(comment.content)
                             };
                             
                         }).then(function() {
                             commentsToSend.push(aux);
                            if(index == commentsFound.length - 1){
                                console.log(commentsToSend);
                                return res.render("posts/show", {communityId: communityFound._id,boardId: boardFound._id, post: postFound, comments:commentsToSend});
                            }
                            
                         }); 
                      });
                   });
               });
            });
        });
    });

});

//  SHOW SPECIFIC QUESTION
app.get("/communities/:communityId/questions/:questionId", loginRequired, function(req, res){
    //Sanitize data
    req.params.communityId = req.sanitize(req.params.communityId);
    req.params.questionId = req.sanitize(req.params.questionId);
    
    //Check that the user logged belongs to the specified community
    User.findOne({username:req.user.username, communities:req.params.communityId}, "_id",function(err, userFound) {
        if(err || !userFound){
            console.log("User did not belong to the community he was trying to access")
            return res.redirect("/home");
        }
        //Check that the community exists
        Community.findOne({_id:req.params.communityId},"_id",function(err, communityFound){
            if(err || !communityFound){
                console.log("Community does not exist");
                return res.redirect("/home");
            }
            //Get the question and display them properly
            Question.findOne({comBelongsTo: communityFound._id}, function(err, questionFound){
                if(err || !questionFound){
                    console.log("Question not found");
                    return res.redirect("/communities/"+req.params.communityId+"/questions");
                }
                
                Comment.find({questionBelongsTo:questionFound._id}, function(err, commentsFound){
                    if(err || commentsFound.length==0){
                        console.log("No comments found");
                        commentsFound = [];
                    }
                    
                    var commentsToSend = [];
                    var aux;
                    commentsFound.forEach(function(comment, index){
                       User.findOne({_id:comment.author}, "firstName lastName",function(error,userData){
                           if(err || !userData){
                              return aux = {
                                   content:String(comment.content),
                                   authorName: "anon"
                               };
                           }
                           return aux ={
                               content: String(comment.content),
                               authorName: String(userData.firstName + " " + userData.lastName)
                           };
                           
                       }).then(function(){
                           commentsToSend.push(aux);
                           if(index == commentsFound.length - 1){
                               //Check if the user already voted
                               console.log(commentsToSend);
                                Question.findOne({"answers.votators": userFound._id},"_id",function(err, questionWithVote) {
                                    if(err || questionWithVote){
                                       return res.render("questions/show", {question: questionFound, communityId:req.params.communityId, allowVote:false, comments:commentsToSend});
                                    }
                                    
                                    return res.render("questions/show", {question: questionFound, communityId:req.params.communityId, allowVote: true, comments:commentsToSend});
                                });
                           }
                       })
                    });
                    
                    
                    
                   
                });
                
               
                
            });
        });
    });
});


//  SHOW SPECIFIC DISCUSUSION BOARD
app.get("/communities/:communityId/boards/:boardId", loginRequired, function(req, res) {
    //Sanitize data
    req.params.communityId = req.sanitize(req.params.communityId);
    req.params.boardId = req.sanitize(req.params.boardId);
    req.user.username = req.sanitize(req.user.username);
    
    //Check that the user logged belongs to the community and that there is user with the given username
    return User.findOne({username : req.user.username, communities: req.params.communityId}, function(err, userDetails){
        if(err){
            console.log("User does not belong to the community that is trying to access");
            return res.redirect("/home");
        }
        //Check that the community exists
        return Community.findOne({_id:req.params.communityId}, function(err, communityFound) {
            if(err || !communityFound){
                console.log("community does not exist");
                return res.redirect("/home");
            }
            //Check that the board exists and belongs to the community
            return Board.findOne({_id : req.params.boardId, comBelongsTo: communityFound._id}, function(err, boardFound){
               if(err || !boardFound){
                   console.log("This board does not exist in this community");
                   return res.redirect("/communities/"+req.params.communityId+"/boards");
               }
               //Get all the posts of the board
               Post.find({boardBelongsTo:boardFound._id}, function(err, posts){
                    if(err){
                        console.log("Something went wrong");
                        return res.redirect("/communities/"+req.params.communityId+"/boards");
                    }
                   
                    if(posts.length == 0){
                        console.log("there are no posts");
                        //console.log(posts);
                       return res.render("boards/show",{communityId:communityFound._id,board:boardFound, posts:[]});
                    }
                    //console.log(posts);
                    var postsToSend = [];
                    var aux;
                    posts.forEach(function(post, index){
                       //Search user to get username of the author
                       User.findOne({_id:post.userAuthor},function(err,userAuthor){
                           if(err || !userAuthor){
                                return aux = {
                                   title: post.title,
                                   description: post.description,
                                   authorName: userAuthor.firstName + " " + userAuthor.lastName
                                };
                           }
                           
                            return aux = {
                                _id: String(post._id),
                                title: String(post.title),
                                description: String(post.description),
                                authorName: String(userAuthor.firstName + " " + userAuthor.lastName)
                            };
                       }).then(function(){
                           postsToSend.push(aux);
                           if(index == postsToSend.length - 1){
                               console.log(postsToSend);
                               return res.render("boards/show", {
                                   communityId:communityFound._id,
                                   board:boardFound,
                                   posts:postsToSend});
                           }
                       });
                    });
               });
               
               
            });
            
        });
        
       
        
    });

});


//Show specific community
app.get("/communities/:id", loginRequired, function(req, res) {
    req.params.id = req.sanitize(req.params.id);
        
    User.findOne({username : req.user.username, communities: req.params.id}, function(err, userDetails){
        if(err){
            console.log("Could not find user detailed data");
            return res.render("home", {error: "You need to belong to a community in order to access it"});
        }
        
        Community.findOne({_id:req.params.id}, function(err,data){
            if(err || !data){
                console.log("something went wrong");
                return res.render("communities/index", {error: "Could not load correctly the communities."});
            }
            console.log("everything its ok");
            return res.render("communities/show", {community : data});
        });
        
    });
});



//******************************************************************************
//  AUTH ROUTES
//******************************************************************************
//  POST ROUTES
app.post("/register", function(req, res){
    var username = req.sanitize(req.body.regUser.username);
    var firstName = req.sanitize(req.body.regUser.firstName);
    var lastName = req.sanitize(req.body.regUser.lastName);
    var email = req.sanitize(req.body.regUser.email);
    var sex = req.sanitize(req.body.regUser.sex);
    var birthdate = Date.now();
    var password = req.sanitize(req.body.regUser.password);
    
    if(!username || !firstName || !lastName || !email || !sex || !birthdate || !password){
        return res.redirect("/");
    }
    //**************************************************************************
    //TO-DO: Check if a user with that username and email already exist and that they are not empty
    //**************************************************************************
    
    //**************************************************************************
    //ENCRYPTION
    //===================
    let hash = bcrypt.hashSync(password, 14); //14 is the standard, the bigger the more secure and the more time it takes
    password = hash;
    req.body.regUser.password = hash;
    
    //**************************************************************************
    
    var newUserCredential = new UserCredential({
        username :  username,
        password : password 
    });

    var newUser = new User({
        username: username,
        firstName: firstName,
        lastName: lastName,
        email: email,
        sex: sex,
        birthdate: birthdate,
        userCredential : newUserCredential._id
    }); 

    newUser.save(function(err, userAdded){
        if(err){
            console.log("something went wrong when saving user");
            return res.redirect("/");
        }
        
        console.log("User added:")
        console.log(userAdded);
        newUserCredential.save(function(err, userCredential){
            if(err){
                return res.redirect("/")
            }
            req.session.userId = newUser._id;
            return res.redirect("/home");
        });
    });
});

app.post("/login", function(req, res){
    var username = req.sanitize(req.body.loginUser.username);
    var password = req.sanitize(req.body.loginUser.password);
    if(!username || !password){
        return res.redirect("/");
    }
    
    //Check if user exists
    User.findOne({username: username}, function(err, userDetails) {
        if(err || !userDetails){
            console.log(err);
            return res.render("index", {
                error: "Wrong username or password"
            });
        }
        
        //Check if credentials actually match
        UserCredential.findById(userDetails.userCredential, function(err, userCredential) {
            if(err || !userCredential || !bcrypt.compareSync(password, userCredential.password)){
                return res.render("index", {
                    error: "Wrong username or password"
                });
            }
            
            req.session.userId = userDetails._id;
            return res.redirect("/home");
            
        })
    })
});


function loginRequired(req,res,next){
    if(!req.user){
        return res.redirect("/");
    }
    
    next();
}
function alreadyLogged(req, res, next){
    if(req.user){
        return res.redirect("/home");
    }
    
    next();
}


//START SERVER
app.listen(process.env.PORT, process.env.IP, function(){
    console.log("SERVER STARTED..");
})