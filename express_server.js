// "use strict";

const express = require("express");
const app = express();
const bodyParser = require("body-parser");
// const cookieParser = require('cookie-parser')
const cookieSession = require('cookie-session');
const PORT = process.env.PORT || 8080;
const bcrypt = require('bcrypt');
const saltRounds = 10;


// sets the view engine to ejs
app.set("view engine", "ejs");

// sets the body parser to body-parser
app.use(bodyParser.urlencoded({extended: true}));

// use the cookie-parser to parse cookies
app.use(cookieSession({
  name: 'tinyAppSession',
  secret: "confusion"
}));

// urlDatabase is the in-memory database
var urlDatabase = {
  "b2xVn2": "http://www.lighthouselabs.ca",
  "9sm5xK": "http://www.google.com"
};

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
  res.end("Hello!");
});

app.get("/login", (req, res) => {
  res.render("login", {attempt: false});
})

app.get("/login/failed", (req, res) => {
  res.render("login", {attempt: true});
})

app.post("/login", (req, res) => {
  if (Object.keys(usersDatabase).length === 0) {
    res.redirect("/login/failed")
  } else {
    for (var id in usersDatabase){
      let email = usersDatabase[id]["email"];
      // let password = usersDatabase[id]["password"];
      let passwordMatch = bcrypt.compareSync(req.body.password, usersDatabase[id]["password"])
      if (email == req.body.email && passwordMatch){
        req.session.user_id = id //("user_id", id, {maxAge: 86400000});
        res.redirect("/urls");
      } else {
        res.redirect("/login/failed");
      }
    }
  }
});

app.post("/logout", (req, res) => {
  req.session = null;
  res.redirect("/urls");
});

app.get("/register", (req, res) => {
  res.render("register", {})
});

app.post("/register", (req, res) => {
  let randID = Math.random().toString(10).substr(2,10);
  let tempEmail = [];
  if (Object.keys(usersDatabase).length > 0){
    for (var id in usersDatabase){
      tempEmail.push(usersDatabase[id][email]);
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
    console.log(usersDatabase);
    req.session.user_id = randID;
    res.redirect("/urls");
  } else {
    res.status(400).send({ error: "conflict with existing email"});
  }
});

// the /urls page shows the entire database
app.get("/urls", (req, res) => {
  res.render("urls_index", {urls: urlDatabase});
});

// returns the form for adding a new shortened url
app.get("/urls/new", (req, res) => {
  res.render("urls_new");
});

// retrieves the particular key: value pair from urlDatabase
app.get("/urls/:shortURL", (req, res) => {
  let shortURL = req.params.shortURL;
  if (urlDatabase[shortURL]){
    res.render("urls_show", {shortened: shortURL, original: urlDatabase[shortURL] });
  }  else {
    res.end("That url is not available")
  }
});

// adds a key: value pair to urlDatabase
app.post("/urls", (req, res) => {
  let rand = generateRandomString()
  urlDatabase[rand] = req.body.longURL;
  res.redirect(`urls/${rand}`);
});

app.post("/urls/:id/delete", (req, res) => {
  delete(urlDatabase[req.params.id]);
  res.redirect("/urls");
});

// replaces the longURL with a different one
// then redirects to the /urls page
app.post("/urls/:id/replace", (req, res) => {
  urlDatabase[req.params.id] = req.body.longURL;
  res.redirect("/urls");
});

// redirects to the longURL previously entered
app.get("/u/:shortURL", (req,res) => {
  let shortURL = req.params.shortURL;
  if (urlDatabase[shortURL]){
    let longURL = urlDatabase[shortURL]
    res.redirect(longURL);
  }  else {
    res.end("That url is not available")
  }
});

// returns the .json of the urlDatabase
app.get("/urls.json", (req, res) => {
  res.json(urlDatabase);
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}!`);
});

// generates a random alphanumeric string of length 16
function generateRandomString(){
  return Math.random().toString(36).substr(2,6);
}
