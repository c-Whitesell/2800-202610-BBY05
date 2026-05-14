require("dotenv").config();

// ── Dependencies ──────────────────────────────────────────
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const bcrypt = require("bcrypt");
const Joi = require("joi");
const { MongoClient } = require("mongodb");
const path = require("path");

// ── App Setup ─────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "public", "views"));

// ── Database ──────────────────────────────────────────────
const client = new MongoClient(process.env.MONGO_URI);

// Declare variables for your collections
let users;
let paths;
let parks;

async function connectDB() {
  try {
    await client.connect();
    const db = client.db(); // Uses the database name from your URI

    // Initialize all collections
    users = db.collection("users");
    paths = db.collection("paths");
    parks = db.collection("parks");

    console.log("Connected to MongoDB and initialized collections");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
  }
}

connectDB();

// ── Sessions ──────────────────────────────────────────────
const expireTime = 60 * 60 * 1000;
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

// ── Global Template Variables ─────────────────────────────
app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.authenticated || false;
  next();
});

// ── Auth Middleware ───────────────────────────────────────
const isAuthenticated = (req, res, next) => {
  if (req.session.authenticated) return next();
  res.redirect("/login");
};

const isNotAuthenticated = (req, res, next) => {
  if (!req.session.authenticated) return next();
  res.redirect("/map");
};

// ── Helper: resolve tutorialMode for the current request ──
// Checks DB for logged-in users, falls back to session for guests.
// Defaults to true (tips on) for brand-new visitors.
async function getTutorialMode(req) {
  if (req.session.authenticated) {
    const user = await users.findOne({ email: req.session.email });
    if (user) return user.tutorialMode !== false;
  }
  return req.session.tutorialMode !== false;
}

// ── Routes ────────────────────────────────────────────────
app.get("/", async (req, res) => {
  const tutorialMode = await getTutorialMode(req);
  res.render("index", {
    pageScript: "tutorial-home",
    pageScripts: [],
    tutorialMode,
    isAuthenticated: req.session.authenticated || false,
  });
});

app.get("/signup", isNotAuthenticated, (req, res) => {
  res.render("signup", {
    error: null,
    pageScripts: [],
    pageScript: "tutorial-auth",
    tutorialMode: true,
  });
});

app.post("/signup", isNotAuthenticated, async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;

  const schema = Joi.object({
    name: Joi.string().max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(50).required(),
    confirmPassword: Joi.string().valid(Joi.ref("password")).required(),
  });

  const validation = schema.validate({
    name,
    email,
    password,
    confirmPassword,
  });
  if (validation.error) {
    return res.render("signup", {
      error: validation.error.details[0].message,
      pageScripts: [],
      pageScript: "tutorial-auth",
      tutorialMode: true, // fixed: was referencing undefined variable
    });
  }

  const existingUser = await users.findOne({ email });
  if (existingUser) {
    return res.render("signup", {
      error: "Email already in use",
      pageScripts: [],
      pageScript: "tutorial-auth",
      tutorialMode: true, // fixed: was missing
    });
  }

  const hash = await bcrypt.hash(password, 10);
  // Store tutorialMode: true on new users so the DB preference is initialised
  await users.insertOne({ name, email, password: hash, tutorialMode: true });

  req.session.authenticated = true;
  req.session.name = name;
  req.session.email = email;

  res.redirect("/map");
});

app.get("/login", isNotAuthenticated, (req, res) => {
  res.render("login", {
    error: null,
    pageScripts: [],
    pageScript: "tutorial-auth",
    tutorialMode: true,
  });
});

app.post("/login", isNotAuthenticated, async (req, res) => {
  const { email, password } = req.body;

  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  });

  const validation = schema.validate({ email, password });
  if (validation.error) {
    return res.render("login", {
      error: "Invalid email or password",
      pageScripts: [],
      pageScript: "tutorial-auth",
      tutorialMode: true, // fixed: was missing
    });
  }

  const user = await users.findOne({ email });
  if (!user) {
    return res.render("login", {
      error: "User not found",
      pageScripts: [],
      pageScript: "tutorial-auth",
      tutorialMode: true, // fixed: was missing
    });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.render("login", {
      error: "Invalid password",
      pageScripts: [],
      pageScript: "tutorial-auth",
      tutorialMode: true, // fixed: was missing
    });
  }

  req.session.authenticated = true;
  req.session.name = user.name;
  req.session.email = email;

  res.redirect("/map");
});

app.get("/bookmarks", (req, res) => {
  res.render("bookmarks", { error: null, pageScripts: [], pageScript: null });
});

app.get("/map", (req, res) => {
  // Check if the instructions have been shown in this session
  const showMapTutorial = !req.session.mapInstructionsShown;

  // Mark them as shown so they don't appear on refresh
  if (showMapTutorial) {
    req.session.mapInstructionsShown = true;
  }

  res.render("map", {
    pageScript: "map",
    pageScripts: ["https://unpkg.com/maplibre-gl@5.23.0/dist/maplibre-gl.js"],
    tutorialMode: showMapTutorial, // Passing the session state to EJS
  });
});

app.get("/settings", (req, res) => {
  res.render("settings", {
    pageScript: null,
    pageScripts: [],
  });
});

// fixed: removed duplicate route, added tutorialMode + weather-tutorial script
app.get("/weather", async (req, res) => {
  const tutorialMode = await getTutorialMode(req);
  res.render("weather", {
    pageScript: "weather-tutorial",
    pageScripts: [],
    tutorialMode,
  });
});

app.get("/search", (req, res) => {
  res.render("search", {
    pageScript: null,
    pageScripts: [],
  });
});

// ── Toggle tutorial tips ──────────────────────────────────
app.post("/toggle-tutorial", async (req, res) => {
  const { tutorialMode } = req.body;

  if (typeof tutorialMode !== "boolean") {
    return res.status(400).json({ error: "tutorialMode must be a boolean" });
  }

  // Always save to session (works for guests too)
  req.session.tutorialMode = tutorialMode;

  // Persist to DB for logged-in users so the preference survives across sessions
  if (req.session.authenticated) {
    try {
      await users.updateOne(
        { email: req.session.email },
        { $set: { tutorialMode } },
      );
    } catch (err) {
      console.error("Failed to save tutorialMode to DB:", err);
      // Non-fatal — session value is still set
    }
  }

  res.json({ tutorialMode });
});

// ── Logout ────────────────────────────────────────────────
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

app.get("/profile", isAuthenticated, async (req, res) => {
  try {
    const user = await users.findOne({ email: req.session.email });
    if (!user) {
      return res.redirect("/login");
    }

    const tutorialMode = await getTutorialMode(req);

    // Calculate "member since"
    const createdAt = user.createdAt || new Date();
    const memberSince = createdAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    res.render("profile", {
      pageScript: "profile",
      pageScripts: [],
      user: {
        name: user.name,
        nickname: user.nickname || user.name,
        email: user.email,
        profilePicture: user.profilePicture || null,
        memberSince,
        createdAt,
      },
      tutorialMode,
    });
  } catch (err) {
    console.error("Profile page error:", err);
    res.redirect("/");
  }
});

// Update user profile (nickname)
app.post("/api/profile/update-nickname", isAuthenticated, async (req, res) => {
  const { nickname } = req.body;

  if (!nickname || nickname.trim().length === 0) {
    return res.status(400).json({ error: "Nickname cannot be empty" });
  }

  if (nickname.length > 50) {
    return res
      .status(400)
      .json({ error: "Nickname must be 50 characters or less" });
  }

  try {
    await users.updateOne(
      { email: req.session.email },
      { $set: { nickname: nickname.trim() } },
    );
    req.session.nickname = nickname.trim();
    res.json({ success: true, nickname: nickname.trim() });
  } catch (err) {
    console.error("Error updating nickname:", err);
    res.status(500).json({ error: "Failed to update nickname" });
  }
});

// Update profile picture (base64 upload)
app.post("/api/profile/update-picture", isAuthenticated, async (req, res) => {
  const { profilePicture } = req.body;

  if (!profilePicture) {
    return res.status(400).json({ error: "No image provided" });
  }

  // Optional: validate base64 string length (max 2MB = ~2.7M chars)
  if (profilePicture.length > 2.7e6) {
    return res.status(400).json({ error: "Image too large (max 2MB)" });
  }

  try {
    await users.updateOne(
      { email: req.session.email },
      { $set: { profilePicture } },
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Error updating profile picture:", err);
    res.status(500).json({ error: "Failed to update profile picture" });
  }
});

// ── pass database data to client ──────────────────────────
// Example: Get all parks
app.get("/api/parks", async (req, res) => {
  try {
    // We use the 'parks' variable defined in your connectDB function
    const allParks = await parks.find({}).toArray();
    res.json(allParks);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch parks" });
  }
});
// Example: Get all paths
app.get("/api/paths", async (req, res) => {
  try {
    // We use the 'paths' variable defined in your connectDB function
    const allPaths = await paths.find({}).toArray();
    res.json(allPaths);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch paths" });
  }
});
// ── 404 Handler (must be last) ────────────────────────────
app.use((req, res) => {
  res.status(404).render("404", { pageScripts: [], pageScript: null });
});

// ── Start Server ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server is running at port ${PORT}`);
});
