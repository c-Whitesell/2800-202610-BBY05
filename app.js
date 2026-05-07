const express = require('express');
const app = express();
const path = require('path');
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'public', 'views'));

app.get('/', (req, res) => {
  res.render('index', {
    pageScript: null,
    pageScripts: [],
  });
});

app.get('/signup', (req, res) => {
  res.render('signup', { error: null, pageScripts: [], pageScript: null });
});

app.get('/login', (req, res) => {
  res.render('login', { error: null, pageScripts: [], pageScript: null });
});

app.get('/map', (req, res) => {
  res.render('map', {
    pageScript: 'map',
    pageScripts: ['https://unpkg.com/maplibre-gl@5.23.0/dist/maplibre-gl.js'],
  });
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
