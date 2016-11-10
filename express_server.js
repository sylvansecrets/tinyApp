"use strict";

const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cookieSession = require('cookie-session');
const cookieParser = require('cookie-parser');
const PORT = process.env.PORT || 8080;
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

app.use(cookieParser());

app.use(function(req, res, next) {
  if (!req.cookies.visitor_id){
    res.cookie("visitor_id", generateRandomString(10));
  }
  next();
})

app.use(methodOverride('_method'));

// urlDatabase is the in-memory database
// in the format
// id: {url:, visitors:{unique_id: times_visited}}
var urlDatabase = {};

const usersDatabase = {};

//
app.use(function(req, res, next) {
  let id = req.session.user_id;
  if (Object.keys(usersDatabase).indexOf(id) >= 0){
    res.locals.user = usersDatabase[id]["email"];
  } else {
    res.locals.user = null;
  }
  next();
})


// returns the root
// at the moment empty
app.get("/", (req, res) => {
  res.render("home");
});

app.get("/login", (req, res) => {
  res.render("login", {attempt: false});
})

app.get("/login/failed", (req, res) => {
  res.render("login", {attempt: true});
})

app.get("/login/required", (req, res) => {
  res.redirect("/login");
})

app.post("/login", (req, res) => {
  if (Object.keys(usersDatabase).length === 0) {
    res.redirect("/login/failed")
  } else {
    for (var id in usersDatabase){
      let email = usersDatabase[id]["email"];
      let passwordMatch = bcrypt.compareSync(req.body.password, usersDatabase[id]["password"])
      if (email == req.body.email && passwordMatch){
        req.session.user_id = id
        res.redirect("/urls");
      } else {
        res.redirect("/login/failed");
      }
    }
  }
});

app.post("/logout", (req, res) => {
  req.session = null;
  res.redirect("/");
});

app.get("/register", (req, res) => {
  res.render("register", {})
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
  if (!req.body.email && !req.body.password){
    res.status(400).send({ error: "please fill in both the email and password fields"});
  }
  if (tempEmail.indexOf(req.body.email) < 0 && req.body.password){
    usersDatabase[randID] = {
      id: randID,
      email: req.body.email,
      password: bcrypt.hashSync(req.body.password, saltRounds)
    }
    req.session.user_id = randID;
    res.redirect("/urls");
  } else {
    res.status(400).send({ error: "missing password or conflict with existing email"});
  }
});

// redirects to the longURL previously entered
app.get("/u/:shortURL", (req,res) => {
  let redir = urlRedir(req.params.shortURL);
  if (redir){
    tickVisitor(req.cookies.visitor_id, req.params.shortURL);
    res.redirect(redir)
  } else {
    res.status(404).send("That is not a valid short link");
  }
});


// ---------------LOGIN REQUIRED FEATURES-----------------------

app.use("/", (req, res, next) => {
  if (Object.keys(usersDatabase).indexOf(req.session.user_id) >= 0){
    next();
  } else {
    res.redirect("/");
  }
});

// the /urls page shows the entire database
app.get("/urls", (req, res) => {
  res.render("urls_index", {urls: displayURL(req.session.user_id)});
});

// returns the form for adding a new shortened url
app.get("/urls/new", (req, res) => {
  res.render("urls_new", {failure: false});
});

// adds a key: value pair to urlDatabase
app.post("/urls", (req, res) => {
  let rand = generateRandomString();
  const valid = require("valid-url");
  console.log(valid.isWebUri(req.body.longURL));
  if (valid.isWebUri(req.body.longURL)){
    addURL(req.session.user_id, rand, req.body.longURL);
  res.redirect(`urls/${rand}`);
  } else {
  res.redirect("urls/invalid");
  }
});

app.delete("/urls/:shortURL/delete", (req, res) => {
  let shortURL = req.params.shortURL;
  deleteURL(req.session.user_id, shortURL);
  res.redirect("/urls");
});

// replaces the longURL with a different one
// then redirects to the /urls page
app.put("/urls/:shortURL/replace", (req, res) => {
  replaceURL(req.session.user_id, req.params.shortURL, req.body.longURL);
  res.redirect("/urls");
});

//
app.get("/urls/invalid", (req, res) => {
  // res.redirect("/urls/new", {failure: true});
  res.render("urls_new", {failure: true});
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
      visitorData: visitorData });
  }  else {
    res.end("That url is not available")
  }
});

// app.delete("/urls/:id/delete", (req, res) => {
//   res.end("Success");
// });

// returns the .json of the urlDatabase
app.get("/urls.json", (req, res) => {
  res.json(displayURL(req.session.user_id));
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}!`);
});

//--------------------------helper functions ---------------
// generates a random alphanumeric string of length 16
function generateRandomString(num){
  var num = num || 6;
  return Math.random().toString(36).substr(2,num);
}

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
    visitors: {}
  };
}

function deleteURL(id, shortURL){
  if (urlExist(id, shortURL)){
    delete (urlDatabase[id][shortURL]);
  }
}

function replaceURL(id, shortURL, longURL){
  if (urlExist(id, shortURL)){
    urlDatabase[id][shortURL]["original"] = longURL;
  }
}
function urlExist(id, shortURL){
  return urlDatabase[id] && Object.keys(urlDatabase[id]).indexOf(shortURL) >= 0;
}

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

function tickVisitor(visitor, shortURL){
  for (var id in urlDatabase){
    if(Object.keys(urlDatabase[id]).indexOf(shortURL) >= 0){
      if(Object.keys(urlDatabase[id][shortURL]["visitors"]).indexOf(visitor) >= 0){
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