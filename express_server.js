"use strict";

const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cookieParser = require('cookie-parser')
const PORT = process.env.PORT || 8080;
const universal = {};

// sets the view engine to ejs
app.set("view engine", "ejs");

// sets the body parser to body-parser
app.use(bodyParser.urlencoded({extended: true}));

// use the cookie-parser to parse cookies
app.use(cookieParser());

//
app.use(function(req, res, next) {
  if (req.cookies){
    res.locals.user = req.cookies.username;
  } else {
    res.locals.user = null;
  }
  console.log(res.locals.user);
  next();
})

// urlDatabase is the in-memory database
var urlDatabase = {
  "b2xVn2": "http://www.lighthouselabs.ca",
  "9sm5xK": "http://www.google.com"
};

// returns the root
// at the moment empty
app.get("/", (req, res) => {
  res.end("Hello!");
});

app.post("/login", (req, res) => {
  let username = req.body.login;
  res.cookie("username", username, {maxAge: 86400000 });
  console.log(req.cookie);
  res.redirect("/urls")
})

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
  console.log(req.body)
  let rand = generateRandomString()
  urlDatabase[rand] = req.body.longURL;
  res.redirect(`urls/${rand}`);
});

app.post("/urls/:id/delete", (req, res) => {
  delete(urlDatabase[req.params.id]);
  console.log(urlDatabase);
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

function universalPad(obj){
  return Object.assign({},universal,universalPad);

}