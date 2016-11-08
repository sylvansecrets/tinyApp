const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 8080;

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({extended: true}));

var urlDatabase = {
  "b2xVn2": "http://www.lighthouselabs.ca",
  "9sm5xK": "http://www.google.com"
};

app.get("/", (req, res) => {
  res.end("Hello!");
});

app.get("/urls", (req, res) => {
  res.render("urls_index", {urls: urlDatabase});
});

app.get("/urls/new", (req, res) => {
  res.render("urls_new");
})

app.get("/urls/:short", (req, res) => {
  short = req.params.short;
  if (urlDatabase[short]){
    res.render("urls_show", {shortened: short, original: urlDatabase[short] });
  }  else {
    res.end("That url is not available")
  }
});



app.post("/urls", (req, res) => {
  console.log(req.body);
  res.send("Ok");
})


app.get("/urls.json", (req, res) => {
  res.json(urlDatabase);
});

app.get("/hello", (req, res) => {
  res.end("<html><body>Hello <b>World</b></body></html>\n");
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}!`);
});

// generates a random alphanumeric string of length 16
function generateRandomString(){
  return Math.random().toString(36).substr(2,16);
}
