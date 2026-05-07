const express = require("express");
const app = express();
const path = require("path");
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "public", "views"));

app.get("/", (req, res) => {
  //res.send("Hello World!");
  res.render("temp");
});

app.get("/map", (req, res) => {
  res.render("map");
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
