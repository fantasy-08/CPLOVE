require('dotenv').config();
const express                = require("express");
const bodyParser             = require("body-parser");
const ejs                    = require("ejs");
const mongoose               = require("mongoose");
const session                = require('express-session');
const passport               = require("passport");
const methodOverride         = require("method-override");
const LocalStrategy          = require("passport-local");
const passportLocalMongoose  = require("passport-local-mongoose");
const findOrCreate           = require('mongoose-findorcreate');
const flash                  = require('connect-flash');
const app                    = express();
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
//PASSPORT
app.use(require('express-session')({
	secret:'hi there',
	resave:false,
	saveUninitialized:false
}));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect('mongodb+srv://smartchuza:smartchuza@cluster0-n4ee0.mongodb.net/test?retryWrites=true&w=majority',{useNewUrlParser:true ,useUnifiedTopology: true })
    .then(()=>console.log('DB CONNECTED...'))
    .catch(err=> console.log(err));

app.use(express.static('public'));
app.set('view engine','ejs');
app.use(bodyParser.urlencoded({
    extended:true
}));
app.use(flash());
app.use(methodOverride('_method'));
//-------SCHEMA-------------
var commentSchema = new mongoose.Schema({
    text: String,
    author:{
		id:{
			type:mongoose.Schema.Types.ObjectId,
			ref:'User'
		},
		username:String
	}
});
const Comment=new mongoose.model('Comment',commentSchema);
const postSchema=new mongoose.Schema({
    title:String,
    text:String,
    date:String,
    image:String,
    author:{
      id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User' 
      },  
      username:String
    },
    comments:[
		{
			type:mongoose.Schema.Types.ObjectId,
			ref:'Comment'
		}
	]
    
});

const Post=new mongoose.model('Post',postSchema);
const userSchema=new mongoose.Schema({
    username:String,
    password:String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User=new mongoose.model('User',userSchema);
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
app.use((req,res,next)=>{
	res.locals.currentUser=req.user;
	res.locals.error=req.flash('error');
	res.locals.success=req.flash('success');
	next();
});

//--------------HOME------
app.get('/',(req,res)=>{
    res.render('home');
})

//----------PAGES----------------
app.get('/pages',(req,res)=>{
    var noMatch=null;
    if(req.query.search){
        const regex = new RegExp(escapeRegex(req.query.search), 'gi');
        Post.find({title:regex},(err,foundPost)=>{
            if(foundPost.length<1){
                noMatch="No result found!"
            }
            if(err){
                console.log(err);
            }
            else{
                if(foundPost){
                    res.render('pages',{posts:foundPost,noMatch:noMatch});
                }
            }
        });
    }else{
        Post.find({},(err,foundPost)=>{
            if(err){
                console.log(err);
            }
            else{
                if(foundPost){
                    res.render('pages',{posts:foundPost,noMatch:noMatch});
                }
            }
        });
    }
});
// NEW PAGE
app.get('/pages/new',isLoggedIn,(req,res)=>{
    res.render('./Page/post');
})
app.post('/pages/new',isLoggedIn,(req,res)=>{
    var today=new Date();
    var creationdate=today.toDateString();
    var author={
		id:req.user._id,
		username:req.user.username
	};
    const post=new Post({
        title:req.body.title,
        text:req.body.text,
        author:author,
        image:req.body.image,
        date:creationdate
    });
    post.save();
    req.flash('success','Page Added Successfully');
    res.redirect('/pages');
})
//EDIT PAGE
app.get('/pages/:id/edit',checkPagesOwnership,(req,res)=>{
    Post.findById(req.params.id,(err,foundPost)=>{
        if(err){
            console.log(err);
        }
        else{
            req.flash('success','Update Successfully');
            res.render('./Page/edit',{posts:foundPost});
        }
    });
});
app.put('/pages/:id',checkPagesOwnership,(req,res)=>{
    var today=new Date();
    var creationdate=today.toDateString();
    var data={
        title:req.body.title,
        text:req.body.text,
        image:req.body.image,
        date:creationdate
    }
    Post.findByIdAndUpdate(req.params.id,data,(err,cg)=>{
        if(err){
            console.log(err);
        }
        else{
            res.redirect('/pages/'+req.params.id);
        }
    })
});
// SHOW PAGE
app.get('/pages/:id',(req,res)=>{
    Post.findById(req.params.id).populate("comments").exec((err,cg)=>{
        if(err || !cg){
            console.log(err);
            req.flash('error','Sorry BAD request');
            return res.redirect('/pages');
        }
        else{
            res.render('./Page/show_page.ejs',{posts:cg});
        }
    })
});
//DELETE
app.delete('/pages/:id',checkPagesOwnership,(req,res)=>{
    Post.findByIdAndRemove(req.params.id,(err)=>{
        if(err){
            console.log(err);
        }
        else{
            req.flash('success','Page Deleted !!!');
            res.redirect('/pages');
        }
    });
});
//==========================COMMENT==============================
app.get('/pages/:id/comments/new',isLoggedIn,function(req,res){
	Post.findById(req.params.id,(err,cmmt)=>{
	if(err) {console.log(err);}
	else {res.render('comments/new',{cmt:cmmt});}
						});
	
});
app.post('/pages/:id/comments',isLoggedIn,function(req,res){
	Post.findById(req.params.id,(err,cmtPost)=>{
		if(err){console.log(err);}
		else{
			Comment.create(req.body.comment,(err,comment)=>{
                if(err){
                    console.log(err);
                }
                else{
                    comment.author.id=req.user._id;
                    comment.author.username=req.user.username;
                    comment.save();
                    cmtPost.comments.push(comment);
                    cmtPost.save();
                    console.log(comment);
                    console.log(cmtPost);
                    req.flash('success','Successfully Added Comment');
                    res.redirect('/pages/'+cmtPost._id);
                }
			});
		}
	});
});
app.get('/pages/:id/comments/:commentid/edit',checkCommentOwnership,(req,res)=>{
    Comment.findById(req.params.commentid,(err,updateComment)=>{
        if(err) console.log(err);
        else{
            res.render('./Comments/edit.ejs',{post_id:req.params.id,comment:updateComment});
        }
    })
});
app.put('/pages/:id/comments/:commentid',checkCommentOwnership,(req,res)=>{
    Comment.findByIdAndUpdate(req.params.commentid, req.body.comment, function(err, updatedComment){
        if(err){
            res.redirect("back");
        } else {
            res.redirect("/pages/" + req.params.id );
        }
     });
});
app.delete('/pages/:id/comments/:commentid',checkCommentOwnership,(req,res)=>{
    Comment.findByIdAndRemove(req.params.commentid,(err,removed)=>{
        if(err)console.log('error');
        else res.redirect('/pages/'+req.params.id);
    });
});


//----------------LOGIN----------------
app.get('/login',(req,res)=>{
    res.render('login');
})
app.post('/login',passport.authenticate('local',{
    successRedirect:'/pages',
    failureRedirect:'/login',
    failureFlash: true,
    successFlash: 'Welcome to CP!'
}),(req,res)=>{});
app.get('/signup',(req,res)=>{
    res.render('signup');
})
app.post('/signup',(req,res)=>{
    User.register({username: req.body.username,fullName: req.body.fullName}, req.body.password, function(err, user){
        if (err) {
          console.log(err);
          req.flash('error','Invalid email or password');
          res.redirect("/signup");
        } else {
          passport.authenticate("local")(req, res, function(){
            req.flash('success','Welcome to Family');
            res.redirect("/pages");
          });
        }
      });
});

app.get("/logout", function(req, res){
    req.logout();
    req.flash('success','Logout Successfully');
    res.redirect("/pages");
});
//Contact
app.get('/contact',isLoggedIn,(req,res)=>{
    res.render('contact.ejs')
});
app.post('/contact',async (req,res)=>{
    const msg = {
        to:    req.body.email,
        from: 'smartchuza@gmail.com',
        subject: 'Feedback CPLove from '+req.body.name,
        text: req.body.message,
        html: '<strong>'+req.body.message+'</strong>'
      };
    //   console.log(msg);
      try {
        await sgMail.send(msg);
        req.flash('success','Thank you for valuable feedback');
        res.redirect('/pages');
      } catch (error) {
        console.error(error);
     
        if (error.response) {
          console.error(error.response.body)
        }
        req.flash('error','Oh snap Something went wrong! Contact admin eshaan.263@gmail.com');
        res.redirect('back');
      }
});
//discuss----
app.get('/discuss',(req,res)=>{
    res.render('./coming/coming.ejs');
});
//----------------------------PROFILE---------------
app.get('/user/:id',isLoggedIn,(req,res)=>{
    User.findById(req.user._id,(err,foundUser)=>{
        if(err){
            req.flash('error','Some error occured cantact admin');
            res.redirect('back');
        }else{
            if(foundUser){
                Post.find({author:{id:foundUser._id,username:foundUser.username}},(err,foundPost)=>{
                    if(err){
                        req.flash('error','Some error occured cantact admin');
                        res.redirect('back');
                    }
                    else{
                        console.log(foundPost);
                        res.render('./Profile/profile.ejs',{info:foundUser,posts:foundPost});
                    }
                }); 
            }
        }
    });
});
//Function/MiddleWare----------->
function isLoggedIn(req,res,next){
	if(req.isAuthenticated()){
		return next();
	}
	else{
		req.flash('error','You Need To Be Logged In');
		res.redirect('/login');
	}
}

function checkPagesOwnership(req,res,next){
	Post.findById(req.params.id,(err,foundPost)=>{
        if(err || !foundPost){
            console.log(err);
            req.flash('error', 'Sorry, that campground does not exist!');
            res.redirect('/pages');
        }
        else if(foundPost.author.id.equals(req.user._id)){
            req.post=foundPost;
            next();
        }
        else{
            req.flash('error', 'You don\'t have permission to do that!');
            res.redirect('/pages/' + req.params.id);
        }
    })};

function checkCommentOwnership(req,res,next){
    if(req.isAuthenticated()){
		Comment.findById(req.params.commentid,(err,foundComment)=>{
			if(err) {req.flash('error','Database Not Found!!!');res.redirect('back');}
			else{
				if(foundComment.author.id.equals(req.user._id)){
					next();
				}
				else{
					req.flash('error','Permission Denied!!!');
					res.redirect('back');
				}
			}
		});
	}
	else{
		req.flash('error','You Need To Be Logged In');
		res.redirect('back');
    }
}
function escapeRegex(text){
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,"\\$&");
}

const PORT=3000;//process.env.PORT;
app.listen(PORT,console.log(`Server started on ${PORT}`));
