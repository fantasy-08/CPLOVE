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
	],
    text:String,
    date:String,
    image:String
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
    // console.log(req.user);
    Post.find({},(err,foundPost)=>{
        if(err){
            console.log(err);
        }
        else{
            if(foundPost){
                res.render('pages',{posts:foundPost});
            }
        }
    });
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
    res.redirect('/pages');
})
//EDIT PAGE
app.get('/pages/:id/edit',checkPagesOwnership,(req,res)=>{
    Post.findById(req.params.id,(err,foundPost)=>{
        if(err){
            console.log(err);
        }
        else{
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
    Post.findById(req.params.id,(err,cg)=>{
        res.render('./Page/show_page.ejs',{posts:cg});
    });
});
//DELETE
app.delete('/pages/:id',checkPagesOwnership,(req,res)=>{
    Post.findByIdAndRemove(req.params.id,(err)=>{
        if(err){
            console.log(err);
        }
        else{
            req.flash('success','Campground Deleted !!!');
            res.redirect('/pages');
        }
    });
});

//----------------LOGIN----------------
app.get('/login',(req,res)=>{
    res.render('login');
})
app.post('/login',(req,res)=>{
    const user = new User({
        username: req.body.username,
        password: req.body.password
      });
    
      req.login(user, function(err){
        if (err) {
          console.log(err);
        } else {
          passport.authenticate("local")(req, res, function(){
            res.redirect("/pages");
          });
        }
      });
});
app.get('/signup',(req,res)=>{
    res.render('signup');
})
app.post('/signup',(req,res)=>{
    User.register({username: req.body.username,fullName: req.body.fullName}, req.body.password, function(err, user){
        if (err) {
          console.log(err);
          res.redirect("/signup");
        } else {
          passport.authenticate("local")(req, res, function(){
            res.redirect("/pages");
          });
        }
      });
});
app.get("/logout", function(req, res){
    req.logout();
    res.redirect("/");
});

//Function----------->
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

const PORT=3000;//process.env.PORT;
app.listen(PORT,console.log(`Server started on ${PORT}`));
