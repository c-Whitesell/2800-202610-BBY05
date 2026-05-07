require('dotenv').config();

const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const bcrypt = require('bcrypt');
const Joi = require('joi');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const expireTime = 60 * 60 * 1000;
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'public', 'views'));

const client = new MongoClient(process.env.MONGO_URI);
let users;

async function connectDB() {
  await client.connect();
  const db = client.db();
  users = db.collection('users');
  console.log('Connected to MongoDB');
}
connectDB();

app.use(
  session({
    secret: process.env.NODE_SESSION_SECRET,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      crypto: {
        secret: process.env.MONGODB_SESSION_SECRET,
      },
    }),
    cookie: { maxAge: expireTime },
    resave: false,
    saveUninitialized: false,
  }),
);

const isAuthenticated = (req, res, next) => {
  if (req.session.authenticated) {
    return next();
  }
  res.redirect('/login');
};

const isNotAuthenticated = (req, res, next) => {
  if (!req.session.authenticated) {
    return next();
  }
  res.redirect('/map');
};

app.get('/', (req, res) => {
  res.render('index', {
    pageScript: null,
    pageScripts: [],
  });
});

app.get('/signup', isNotAuthenticated, (req, res) => {
  res.render('signup', { error: null, pageScripts: [], pageScript: null });
});

app.post('/signup', isNotAuthenticated, async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;

  const schema = Joi.object({
    name: Joi.string().max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(50).required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
  });

  const validation = schema.validate({
    name,
    email,
    password,
    confirmPassword,
  });
  if (validation.error) {
    return res.render('signup', {
      error: validation.error.details[0].message,
      pageScripts: [],
      pageScript: null,
    });
  }

  const existingUser = await users.findOne({ email });
  if (existingUser) {
    return res.render('signup', {
      error: 'Email already in use',
      pageScripts: [],
      pageScript: null,
    });
  }

  const hash = await bcrypt.hash(password, 10);
  await users.insertOne({ name, email, password: hash });

  req.session.authenticated = true;
  req.session.name = name;
  req.session.email = email;

  res.redirect('/map');
});

app.get('/login', isNotAuthenticated, (req, res) => {
  res.render('login', { error: null, pageScripts: [], pageScript: null });
});

app.post('/login', isNotAuthenticated, async (req, res) => {
  const { email, password } = req.body;

  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  });

  const validation = schema.validate({ email, password });
  if (validation.error) {
    return res.render('login', {
      error: 'Invalid email or password',
      pageScripts: [],
      pageScript: null,
    });
  }

  const user = await users.findOne({ email });

  if (!user) {
    return res.render('login', {
      error: 'User not found',
      pageScripts: [],
      pageScript: null,
    });
  }

  const valid = await bcrypt.compare(password, user.password);

  if (!valid) {
    return res.render('login', {
      error: 'Invalid password',
      pageScripts: [],
      pageScript: null,
    });
  }

  req.session.authenticated = true;
  req.session.name = user.name;
  req.session.email = email;

  res.redirect('/map');
});

app.get('/map', (req, res) => {
  res.render('map', {
    pageScript: 'map',
    pageScripts: ['https://unpkg.com/maplibre-gl@5.23.0/dist/maplibre-gl.js'],
  });
});

app.use((req, res) => {
  res.status(404).render('404', { pageScripts: [], pageScript: null });
});

app.listen(PORT, () => {
  console.log(`Server is running at port ${PORT}`);
});
