"use strict";

const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cookieSession = require('cookie-session');
const cookieParser = require('cookie-parser');
const flash = require('connect-flash')
const PORT = process.env.PORT || 3000;
const bcrypt = require('bcrypt');
const saltRounds = 10;
const methodOverride = require('method-override');

// sets the view engine to ejs
app.set("view engine", "ejs");

// sets the static assets to /public
app.use(express.static(__dirname + "/public"));

// sets the body parser to body-parser
app.use(bodyParser.urlencoded({extended: true}));

// use the cookie-parser to parse cookies
app.use(cookieSession({
  name: 'tinyAppSession',
  secret: "confusion"
}));

// parse cookies for unique visitors
app.use(cookieParser());

// gives a unique visitor id as cookie
app.use(function(req, res, next) {
  if (!req.cookies.visitor_id){
    res.cookie("visitor_id", generateRandomString(10));
  }
  next();
})

// sets method overwrite
app.use(methodOverride('_method'));

// enables flash messages
app.use(flash());

// urlDatabase is the in-memory database
// in the format
// id: {url:, visitors:{unique_id: times_visited}}
var urlDatabase = {};

// usersDatabase is an in-memory database
// in the format
// id: {id, shortURL: longURL, added, visitors: {visitor: {count, timestamp}}}
const usersDatabase = {};

// sets the username to res.locals.user if logged in
app.use(function(req, res, next) {
  let id = req.session.user_id;
  if (Object.keys(usersDatabase).indexOf(id) !== -1){
    res.locals.user = usersDatabase[id]["email"];
  } else {
    res.locals.user = null;
  }
  next();
})

// returns the home page
app.get("/", (req, res) => {
  if (loggedIn(req.session.user_id)){
    res.redirect("/urls");
  } else {
  res.render("home");
  }
});

// handles GET calls to /login
// attempt generates a warning message if true
app.get("/login", (req, res) => {
  if (loggedIn(req.session.user_id)){
    res.redirect("/urls");
  } else {
    res.render("login", {
      'warning_login': req.flash('warning_login')
    });
  }
})

//Logs in a user
app.post("/login", (req, res) => {
  if (loggedIn(req.session.user_id)){
    res.redirect("/urls");
  } else {
    if (Object.keys(usersDatabase).length === 0) {
      res.redirect("/login/failed");
    } else {
      for (var id in usersDatabase){
        let email = usersDatabase[id]["email"];
        let matched = true;
        if (email !== req.body.email){
          let matched = false;
        } else {
          bcrypt.compare(req.body.password, usersDatabase[id]["password"], (err, passwordMatch) => {
            if (passwordMatch && matched){
              console.log("match")
              req.session.user_id = id;
              res.redirect("/urls");
            } else {
              req.flash('warning_login','That email and password combination is invalid.');
              res.status(303).redirect("/login");
            }
          })
        }
      }
    }
  }
});


// Logs out a user
app.post("/logout", (req, res) => {
  req.session = null;
  res.redirect("/");
});

// Handles GET call to /register
app.get("/register", (req, res) => {
  res.render("register", {
    'warning_register': req.flash('warning_register')
  })
});

// registers a user if both fields are filled out and the email does not conflict
app.post("/register", (req, res) => {
  let randID = Math.random().toString(10).substr(2,10);
  let tempEmail = [];
  if (Object.keys(usersDatabase).length > 0){
    for (var id in usersDatabase){
      tempEmail.push(usersDatabase[id]["email"]);
    }
  }
  switch (branch(tempEmail, req.body.email, req.body.password)){
    case "missing both":
      req.flash('warning_register', 'please fill in both the email and the password fields.');
      res.status(303).redirect("/register");
      break;
    case "missing email":
      req.flash('warning_register', 'please fill in the email field.');
      res.status(303).redirect("/register");
      break;
    case "missing password":
      req.flash('warning_register', 'please fill in the password field');
      res.status(303).redirect("/register");
      break;
    case "conflict":
      req.flash('warning_register', 'that email is already in use');
      res.status(303).redirect("/register");
      break;
    case "all clear":
      bcrypt.hash(req.body.password, saltRounds, (err, hash) => {
      usersDatabase[randID] = {
        id: randID,
        email: req.body.email,
        password: bcrypt.hashSync(req.body.password, saltRounds)
      }
      req.session.user_id = randID;
      res.redirect("urls");
    });
  }
});


// redirects to the longURL previously entered
app.get("/u/:shortURL", (req,res) => {
  let redir = urlRedir(req.params.shortURL);
  if (redir){
    tickVisitor(req.cookies.visitor_id, req.params.shortURL);
    res.redirect(redir)
  } else {
    res.status(302).send("That is not a valid short link");
  }
});


// ---------------LOGIN REQUIRED FEATURES-----------------------

// redirects if the user is not logged in
app.use("/", (req, res, next) => {
  if (Object.keys(usersDatabase).indexOf(req.session.user_id) !== -1){
    next();
  } else {
    req.flash('warning_login', "Please log in the view that page.")
    res.status(302).redirect("/login");
  }
});

// the /urls page shows the urls the user has entered
app.get("/urls", (req, res) => {
  res.render("urls_index", {urls: displayURL(req.session.user_id)});
});

// returns the form for adding a new shortened url
app.get("/urls/new", (req, res) => {
  res.render("urls_new", {
    'warning_new': req.flash('warning_new')
  });
});

// adds a key: value pair to urlDatabase
app.post("/urls", (req, res) => {
  let rand = generateRandomString();
  const valid = require("valid-url");
  if (valid.isWebUri(req.body.longURL)){
    addURL(req.session.user_id, rand, req.body.longURL);
  res.redirect(`/urls/${rand}`);
  } else {
    req.flash('warning_new', 'The entered address was not a valid http or https uri.');
    res.redirect("/urls/new");
  }
});

// deletes a shortURL longURL pair
app.delete("/urls/:shortURL", (req, res) => {
  let shortURL = req.params.shortURL;
  deleteURL(req.session.user_id, shortURL);
  res.redirect("/urls");
});

// replaces the longURL with a different one
// then redirects to the /urls page
app.put("/urls/:shortURL/replace", (req, res) => {
  const valid = require("valid-url");
  if (valid.isWebUri(req.body.longURL)){
    replaceURL(req.session.user_id, req.params.shortURL, req.body.longURL);
    res.redirect(`/urls/${req.params.shortURL}`);
  } else {
    req.flash('replace_failure', 'The replacement string entered was not a valid http or https uri')
    res.redirect(`/urls/${req.params.shortURL}`);
  }
});


// retrieves the particular key: value pair from urlDatabase
// allows for editing of links
app.get("/urls/:shortURL", (req, res) => {
  let shortURL = req.params.shortURL;
  let id = req.session.user_id
  if (urlExist(id, shortURL)){
    let visitorData = {};
    for (let visitor in urlDatabase[id][shortURL]["visitors"]){
      visitorData[visitor] = urlDatabase[id][shortURL]["visitors"][visitor]["timestamp"].map(timestampToDate).join('; ')
    }
    res.render("urls_show", {
      shortened: shortURL,
      original: urlDatabase[id][shortURL]["original"],
      visitorData: visitorData,
      created: timestampToDate(urlDatabase[id][shortURL]["added"]),
      failure: req.flash('replace_failure')
    });
  }  else {
    if (urlRedir(shortURL)){
      req.flash("warning_new", "Someone has already claimed that short link");
      res.status(303).redirect("/urls/new");
    } else {
      req.flash("warning_new", "That url is not available, would you like to add it?")
      res.status(303).redirect("/urls/new")
    }
  }
});

// returns the .json of the urlDatabase
app.get("/urls.json", (req, res) => {
  res.json(displayURL(req.session.user_id));
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}!`);
});

//--------------------------helper functions ---------------
// generates a random alphanumeric string
function generateRandomString(num=6){
  return Math.random().toString(36).substr(2,num);
}

// displays all the shortURL longURL pairs for a given user
function displayURL(id){
  let allLink = {}
  if (urlDatabase[id]){
    for (let key in urlDatabase[id]){
      allLink[key] = {}
      allLink[key]["original"] = urlDatabase[id][key]["original"];
      allLink[key]["uniques"] = Object.keys(urlDatabase[id][key]["visitors"]).length
    }
    return allLink;
  } else {
    return {};
  }
};

function addURL(id, shortURL, longURL){
  if (!urlDatabase[id]){
    urlDatabase[id] = {};
  }
  urlDatabase[id][shortURL] = {
    original: longURL,
    visitors: {},
    added: Date.now(),
  };
}

function deleteURL(id, shortURL){
  if (urlExist(id, shortURL)){
    delete (urlDatabase[id][shortURL]);
  }
}

// replaces the old longURL with a new one
function replaceURL(id, shortURL, longURL){
  if (urlExist(id, shortURL)){
    urlDatabase[id][shortURL]["original"] = longURL;
  }
}

// checks if the shortURL given is in the database
function urlExist(id, shortURL){
  return urlDatabase[id] && Object.keys(urlDatabase[id]).indexOf(shortURL) !== -1;
}

// gives the redirect url
function urlRedir(shortURL){
  for (let id in urlDatabase){
    for (let short in urlDatabase[id]){
      if (shortURL === short){
        return urlDatabase[id][short]["original"];
      }
    }
  }
  return false;

}

// increases the visitor count by 1
function tickVisitor(visitor, shortURL){
  for (var id in urlDatabase){
    if(Object.keys(urlDatabase[id]).indexOf(shortURL) !== -1){
      if(Object.keys(urlDatabase[id][shortURL]["visitors"]).indexOf(visitor) !== -1){
        urlDatabase[id][shortURL]["visitors"][visitor]["count"] += 1;
        urlDatabase[id][shortURL]["visitors"][visitor]["timestamp"].push(Date.now());
      } else {
        urlDatabase[id][shortURL]["visitors"][visitor] = {};
        urlDatabase[id][shortURL]["visitors"][visitor]["count"] = 1;
        urlDatabase[id][shortURL]["visitors"][visitor]["timestamp"] = [Date.now()];
      }
    }
  }
}

// converts a timestamp to human readable format
function timestampToDate (time){
  let timestamp = new Date(time);
  let year = timestamp.getFullYear();
  let month = timestamp.getMonth();
  let date = timestamp.getDate();
  let hour = timestamp.getHours();
  let min = timestamp.getMinutes();
  let sec = timestamp.getSeconds();
  if (hour < 10) { hour = "0" + hour.toString()};
  if (min < 10) { min = "0" + min.toString()};
  if (sec < 10) { sec = "0" + sec.toString()};
  return `${year}-${month}-${date},${hour}:${min}:${sec}`
}

// checks if the user is logged in
function loggedIn(user_id){
  return Object.keys(usersDatabase).indexOf(user_id) !== -1
}

// sets the conditionals for registration
function branch(tempEmail, email, password){
  if (!email && !password){
    return "missing both";
  }
  if (!email){
    return "missing email";
  }
  if (!password){
    return "missing password";
  }
  if (tempEmail.indexOf(email) !== -1){
    return "conflict";
  }
  return "all clear";
}

