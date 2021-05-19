// incorporating todo list on local server using mongodb database using mongoose //and google oauth

require('dotenv').config();
const express=require("express");
const app=express();
const mongoose=require("mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const  session = require('express-session');//is isAuthenticated
const passport=require("passport");
const passportLocalMongoose=require("passport-local-mongoose");//we do not use it but in background hases passwword
const bodyParser=require("body-parser");
app.use(bodyParser.urlencoded({extended:true}));//to use body parser
// const date=require(__dirname+"/module.js");//this will go in that module and run all the code inside it
const _=require("lodash");
const findOrCreate = require('mongoose-findorcreate');//to avoid extra code of find or create
app.set('view engine', 'ejs');//for ejs to work
app.use(express.static("public"));//this will let other static files like css and images all to render
//alwyas place these codes in same order
//initialisation of cookie session


app.use(session({//javascript object style
  secret: process.env.ENCRYPT_STRING,
  resave: false,
  saveUninitialized: true

}));
//now we initialize passport and use it to set our sessions
app.use(passport.initialize());//initialise passport
app.use(passport.session());//creting session using passport



mongoose.connect("mongodb://localhost:27017/messDB") ;//toDoDB is the name of database when connecting locally

const secretSchema=new mongoose.Schema(
  {
    username:String,
    pass:String,
    googleId:String,//so that no id is generatrd again nad again basically find function will work before creating

    secret : [{
    nameoffood : String,
    review : String
     }]

  }
);
secretSchema.plugin(passportLocalMongoose);//hash and salt our password and to save user to mongo db database
secretSchema.plugin(findOrCreate);

const Secret=mongoose.model("messReview",secretSchema);

// CHANGE: USE "createStrategy" INSTEAD OF "authenticate"
passport.use(Secret.createStrategy());//local strtaegy


//serialize and deserailise local as well as non local strtegy
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  Secret.findById(id, function(err, user) {
    done(err, user);
  });
});


passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets" //after google authenticate where to go
  },
  function(accessToken, refreshToken, profile, cb) {
    Secret.findOrCreate({ googleId: profile.id }, function (err, user) {//findorcreatewas just apsudo telling if it is there create it or alredy then find
//console log the profile and u will see what are the things we get from google
      // but mongoose-findorcreate is also a package we install and require it
      return cb(err, user);
    });
  }
));

var foodlist=["daal","chawal","roti","sabji","paneer","chicken"];
app.get("/foodoption",function(req,res)
{
  res.render("foodoption",{foodlist:foodlist})

});




app.get("/review/:key",function(req,res)//here key is the value that will be changing in our link key is not any specific key it can be named anything
{
  const foodname=req.params.key;
  // res.send(foodname);

  Secret.find({"secret":{$ne:null}},function(err,foundusers)

{
  if(err)
  {
    console.log(err);
  }
  else{
    var array=[];
    for(var i=0;i<foundusers.length;i++)
    {
      for(var j=0;j<foundusers[i].secret.length;j++)
      {
        if(foundusers[i].secret[j].nameoffood==foodname)
        {
          array.push(foundusers[i].secret[j].review);
        }
      }
    }
    res.render("ind_food",{name:foodname,array:array});

  }

});


});



app.get("/",function(req,res)
{
  res.render("home");
});


app.get("/login",function(req,res)
{
  res.render("login");
});

app.get("/register",function(req,res)
{
  res.render("register");
});

app.get('/auth/google',//for rendering that signup from google page
  passport.authenticate('google', { scope: ['profile'] }));
//this get method is called when user has entered the correct result
app.get('/auth/google/secrets',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets');
  });

  app.get("/submit",function(req,res)
  {
      if(req.isAuthenticated())//cheks from cookie that any cookie for this user autherisation  exist or not
      {//this comes from session //or simply we could have made a middle ware or logic to check for that user inside
        //this callback function
        res.render("submit",{foodlist:foodlist});
      }
      else{
        res.redirect("/login");
      }
  });


  app.post("/submit",function(req,res)
{
  const nsecret=req.body.secret;
  const nfood=req.body.food;
  const obj={nameoffood:nfood,review:nsecret};
  //req contains the info of user also we can check that via loggong it in console
    console.log(req.user.id)  ;//user here is keyword this has ocuured due to paasport
   Secret.findById(req.user.id,function(err,founduser)
 {
   if(err)
   {
     console.log(err);
   }
   else{
     if(founduser)
     {
       founduser.secret.push(obj);

       founduser.save(function()
     {
        res.redirect("/secrets");
     });

     }
   }
 });

});


// simple authentication explaination
// app.get("/secrets",function(req,res)///inn earlier method we did not make this as this
// //should be reachable only when called login so herer before showing secrets we will tell
// //passport.login authenticate to check if authenticated then render else do not render
// //it will check from seesion details whether we are logged in or not
// {
//     if(req.isAuthenticated())//cheks from cookie that any cookie for this user aut exist or not
//     {
//       res.render("secrets");
//     }
//     else{
//       res.redirect("/login");
//     }
// });



app.get("/secrets",function(req,res)
{

  Secret.find({"secret":{$ne:null}},function(err,foundusers)
{
  if (err)
  {
    console.log(err);
  }
  else
  {
    if(foundusers)
    {
        res.render("secrets",{usersarray:foundusers});
    }
  }
});

});


app.get("/logout",function(req,res)
{
  req.logout();//function from passport destryos cookie as well
  res.redirect("/");
});
app.post("/register",function(req,res)
{
  Secret.register({username:req.body.username},req.body.password,function(err,secret)
{
  if(err)
  {
    console.log(err);
    res.redirect("/register");

  }
  else{
    passport.authenticate("local")(req,res,function()//authenticate creates a cookie and when redirected to secret that cookie
    //is deserailise and used against is authenticated function to see whether authenticated or not
  {
    //here entered means is authenticated
    res.redirect("/secrets");
  });


  }
});




});

app.post("/login",function(req,res)
{
  const nuser=new Secret({
    username:req.body.username,
    pass:req.body.password
  });
  req.login(nuser,function(err)
{
  if(err)
  {
    console.log(err);
    res.redirect("/login");
  }
  else{
    passport.authenticate("local")(req,res,function()
  {
    //yaha tk aaya mtlb authenticate hua shi h aur wo cookie bna __dirname
    res.redirect("/secrets");
  });
  }
});

});
app
app.listen(process.env.PORT|| 3000,function()
{
  console.log("server working");
});
