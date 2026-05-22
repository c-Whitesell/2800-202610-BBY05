require("dotenv").config();

// ── Dependencies ──────────────────────────────────────────
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const bcrypt = require("bcrypt");
const Joi = require("joi");
const { MongoClient } = require("mongodb");
const path = require("path");

const { generateAIResponse } = require("./public/js/aiService");

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

let users;
let pageAnalytics;
let feedback;
let paths;
let parks;
let trails;
let parkshade;

/**
 * Initializes the MongoDB connection and maps collection variables.
 * Database Access: Establishes connection, maps collections for reading/writing.
 *
 * @returns {Promise<void>} Resolves when the database is successfully connected.
 */
async function connectDB() {
  try {
    await client.connect();
    const db = client.db();

    users = db.collection("users");
    pageAnalytics = db.collection("pageAnalytics");
    feedback = db.collection("feedback");
    paths = db.collection("paths");
    parks = db.collection("parks");
    trails = db.collection("trails");
    parkshade = db.collection("parkShade");

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
      crypto: { secret: process.env.MONGODB_SESSION_SECRET },
    }),
    cookie: { maxAge: expireTime },
    resave: false,
    saveUninitialized: false,
  }),
);

// ── Global Template Variables ─────────────────────────────

/**
 * Middleware: Injects authentication and role status into all views.
 * Database Access: Reads the users collection to verify if an authenticated user has the 'admin' role.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
app.use(async (req, res, next) => {
  res.locals.isAuthenticated = req.session.authenticated || false;

  if (req.session.authenticated) {
    try {
      const user = await users.findOne({ email: req.session.email });
      res.locals.isAdmin = user?.role === "admin";
    } catch {
      res.locals.isAdmin = false;
    }
  } else {
    res.locals.isAdmin = false;
  }

  next();
});

/**
 * Middleware: Logs page visits for authenticated users for analytics.
 * Database Access: Writes a new document to the pageAnalytics collection.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
app.use(async (req, res, next) => {
  const skipPrefixes = ["/api", "/js", "/css", "/images"];
  const shouldTrack =
    req.session.email && !skipPrefixes.some((p) => req.path.startsWith(p));

  if (shouldTrack) {
    try {
      await pageAnalytics.insertOne({
        email: req.session.email,
        page: req.path,
        timestamp: new Date(),
        userAgent: req.get("user-agent"),
      });
    } catch (err) {
      console.error("Analytics tracking error:", err);
    }
  }
  next();
});

// ── Auth Middleware ───────────────────────────────────────

/**
 * Middleware: Blocks unauthenticated users from protected page routes.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const isAuthenticated = (req, res, next) => {
  if (req.session.authenticated) return next();
  res.redirect("/login");
};

/**
 * Middleware: Prevents authenticated users from accessing login/signup pages.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const isNotAuthenticated = (req, res, next) => {
  if (!req.session.authenticated) return next();
  res.redirect("/map");
};

/**
 * Middleware: Secures admin-only routes. Displays a 403 error page if unauthorized.
 * Database Access: Reads the users collection to verify the 'admin' role.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const isAdmin = async (req, res, next) => {
  if (!req.session.authenticated) {
    return res.status(403).render("403", {
      pageScript: null,
      pageScripts: [],
      reason: "You must be logged in to access this page.",
      isAuthenticated: false,
      isAdmin: false,
    });
  }

  try {
    const user = await users.findOne({ email: req.session.email });
    if (user?.role === "admin") return next();

    res.status(403).render("403", {
      pageScript: null,
      pageScripts: [],
      reason:
        "You do not have permission to access this page. Admin privileges required.",
      isAuthenticated: true,
      isAdmin: false,
    });
  } catch (err) {
    console.error("Admin middleware error:", err);
    res.status(500).render("403", {
      pageScript: null,
      pageScripts: [],
      reason: "An error occurred while checking permissions.",
      isAuthenticated: true,
      isAdmin: false,
    });
  }
};

/**
 * Checks whether tutorial mode should be active for the current session/user.
 * Database Access: Reads the users collection to check stored tutorial preferences.
 *
 * @param {Object} req - Express request object
 * @returns {Promise<boolean>} True if tutorial mode should be enabled, false otherwise
 */
async function getTutorialMode(req) {
  if (req.session.authenticated) {
    const user = await users.findOne({ email: req.session.email });
    if (user) return user.tutorialMode !== false;
  }
  return req.session.tutorialMode !== false;
}

/**
 * Middleware: Blocks unauthenticated users from protected API routes.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const isAuthenticatedAPI = (req, res, next) => {
  if (req.session.authenticated) return next();
  return res.status(401).json({ error: "Not logged in" });
};

// ── Routes ────────────────────────────────────────────────

/**
 * Route: GET /
 * Description: Renders the home page and determines if tutorial mode should be active.
 * Database Access: Implicitly reads from `users` via getTutorialMode().
 */
app.get("/", async (req, res) => {
  const tutorialMode = await getTutorialMode(req);
  res.render("index", {
    pageScript: "tutorial-home",
    pageScripts: [],
    tutorialMode,
    isAuthenticated: req.session.authenticated || false,
  });
});

/**
 * Route: GET /dashboard
 * Description: Renders the user dashboard, calculating user statistics and fetching recent activity.
 * Database Access: Reads from the `users` and `activity` collections.
 */
app.get("/dashboard", isAuthenticated, async (req, res) => {
  try {
    const user = await getUserByEmail(req.session.email);

    if (!user) {
      return res.status(404).render("404", {
        pageScripts: [],
        pageScript: null,
      });
    }

    const recentActivity = await getRecentActivity(req.session.email);
    const lastActivityDate = getLastActivityDate(user, recentActivity);
    const userStats = buildUserStats(user, lastActivityDate);

    return res.render("dashboard", {
      pageScript: "dashboard",
      pageScripts: [],
      user: userStats,
      recentActivity,
      isAuthenticated: true,
    });
  } catch (error) {
    console.error("Dashboard route error:", error);
    return res.status(500).render("error", {
      pageScripts: [],
      pageScript: null,
      message: "Error loading dashboard",
    });
  }
});

/**
 * Retrieves a user document by their email address.
 * Database Access: Reads a single document from the `users` collection.
 *
 * @param {string} email - The email address of the user to retrieve.
 * @returns {Promise<Object|null>} A promise resolving to the user object or null if not found.
 */
async function getUserByEmail(email) {
  return await users.findOne({ email });
}

/**
 * Retrieves the 5 most recent activity records for a specific user and formats their timestamps.
 * Database Access: Reads from the `activity` collection, sorts by date, and limits to 5.
 *
 * @param {string} email - The email address of the user.
 * @returns {Promise<Array>} A promise resolving to an array of formatted activity objects.
 */
async function getRecentActivity(email) {
  try {
    const activityCollection = client.db().collection("activity");

    const raw = await activityCollection
      .find({ email })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    return raw.map((a) => ({
      ...a,
      timeAgo: getRelativeTime(a.createdAt),
    }));
  } catch (err) {
    console.warn("Activity collection not available:", err.message);
    return [];
  }
}

/**
 * Determines the most recent activity date by checking the recent activity list or user profile fallback.
 *
 * @param {Object} user - The user document.
 * @param {Array} recentActivity - Array of the user's recent activity objects.
 * @returns {Date|null} The date of the last activity, or null if none exists.
 */
function getLastActivityDate(user, recentActivity) {
  return recentActivity?.[0]?.createdAt ?? user.lastActivityDate ?? null;
}

/**
 * Constructs a standardized user statistics object for dashboard display.
 *
 * @param {Object} user - The raw user document.
 * @param {Date|null} lastActivityDate - The user's most recent activity date.
 * @returns {Object} An object containing formatted statistics (username, distance, days since active).
 */
function buildUserStats(user, lastActivityDate) {
  return {
    username: user.username || user.name || user.email.split("@")[0],
    trailsExplored: Number(user.trailsExplored || 0),
    totalDistance: Number((user.totalDistance || 0).toFixed(1)),
    lastActivityDays: lastActivityDate
      ? calculateDaysSinceLastActivity(lastActivityDate)
      : "—",
  };
}

/**
 * Route: GET /api/recommended-trail
 * Description: Fetches a random trail recommendation from the database.
 * Database Access: Reads document count and fetches a single random document from the `trails` collection.
 */
app.get("/api/recommended-trail", isAuthenticated, async (req, res) => {
  try {
    const trailCount = await trails.countDocuments();
    if (trailCount === 0)
      return res.status(404).json({ error: "No trails available" });

    const randomIndex = Math.floor(Math.random() * trailCount);
    const trail = await trails.find({}).skip(randomIndex).limit(1).next();
    if (!trail) return res.status(404).json({ error: "No trail found" });

    res.json({
      trail: {
        id: trail._id.toString(),
        name: trail.trail_name || "Unnamed Trail",
        description: trail.description || "A scenic trail in the area.",
        distance: String(trail.length_meters || "???"),
        duration: trail.duration || "1-2 hours",
        difficulty: trail.difficulty || "Moderate",
        rating: trail.rating || 0,
        lat: trail.lat,
        lng: trail.lng,
      },
    });
  } catch (error) {
    console.error("Recommended trail API error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * Route: GET /api/recommended-trail/ai
 * Description: Fetches a random trail and generates a custom AI description based on its stats.
 * Database Access: Reads document count and fetches a single random document from the `trails` collection.
 */
app.get("/api/recommended-trail/ai", isAuthenticated, async (req, res) => {
  try {
    const trailCount = await trails.countDocuments();
    if (trailCount === 0)
      return res.status(404).json({ error: "No trails available" });

    const randomIndex = Math.floor(Math.random() * trailCount);
    const trail = await trails.find({}).skip(randomIndex).limit(1).next();
    if (!trail) return res.status(404).json({ error: "No trail found" });

    const prompt = `
Write a short hiking trail description.

Do NOT include labels like "Trail:", "Name:", "Distance:", markdown formatting, or bullet points.
Only return a clean paragraph.

Trail name: ${trail.trail_name}
Distance: ${trail.length_meters}
Difficulty: ${trail.difficulty}

The trail is located in Vancouver, British Columbia.
Focus on shade and comfort, best time to go, and who it's ideal for.
Be specific, and include information from the internet about the trail.
If the trail name ends in 'Trails', put information about the park, the park name comes before 'Trails' in the trail name
Tone: friendly, helpful, concise.
`.trim();

    const aiDescription = await generateAIResponse(prompt);

    res.json({
      trail: {
        id: trail._id.toString(),
        name: trail.trail_name || "Unnamed Trail",
        description: aiDescription,
        distance: String(trail.length_meters || "unkown"),
        //duration: trail.duration || "1-2 hours",
        //difficulty: trail.difficulty || "Moderate",
        //rating: trail.rating || 0,
        lat: trail.lat,
        lng: trail.lng,
      },
    });
  } catch (err) {
    console.error("AI trail recommendation error:", err);
    res.status(500).json({ error: "AI recommendation unavailable" });
  }
});

// ── AI Weather Summary ────────────────────────────────────

/**
 * Route: GET /api/ai-weather-summary
 * Description: Accepts weather data as query params, builds a hiking-focused prompt, and returns a Gemini summary.
 * Database Access: None.
 */
app.get("/api/ai-weather-summary", async (req, res) => {
  const { temp, rain, wind, uv, condition } = req.query;

  // Validate — all fields must be present
  if (
    [temp, rain, wind, uv, condition].some((v) => v === undefined || v === "")
  ) {
    return res.status(400).json({ error: "Missing weather parameters." });
  }

  const prompt = `
You are a friendly hiking assistant.
Given the weather data below, write a short hiking advisory for today.

Weather conditions:
- Temperature: ${temp}°C
- Rain Chance: ${rain}%
- Wind Speed: ${wind} km/h
- UV Index: ${uv}
- Sky Conditions: ${condition}

Rules:
- 2–4 sentences only
- Focus on hiking safety and comfort
- Include gear suggestions if the weather warrants it
- Suggest the best time of day to hike if applicable
- Friendly, natural tone

Output ONLY the summary text. No headings, no bullet points.
`.trim();

  try {
    const summary = await generateAIResponse(prompt);
    res.json({ summary: summary.trim() });
  } catch (err) {
    console.error("AI weather summary error:", err);
    res.status(500).json({ error: "AI summary unavailable." });
  }
});

// ── Utility functions ─────────────────────────────────────

/**
 * Calculates a formatted string representing the time elapsed since the last activity.
 *
 * @param {Date|string} lastActivityDate - The timestamp of the last activity.
 * @returns {string} Formatted time string (e.g., "Today", "3 days", "2 weeks").
 */
function calculateDaysSinceLastActivity(lastActivityDate) {
  if (!lastActivityDate) return "—";

  const diffDays = Math.ceil(
    Math.abs(new Date() - new Date(lastActivityDate)) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "1 day";
  if (diffDays < 7) return `${diffDays} days`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks === 1) return "1 week";
  if (diffWeeks < 4) return `${diffWeeks} weeks`;

  const diffMonths = Math.floor(diffDays / 30);
  return diffMonths === 1 ? "1 month" : `${diffMonths} months`;
}

/**
 * Converts a specific date into a short, relative time string.
 *
 * @param {Date|string} date - The date to convert.
 * @returns {string} Short relative time string (e.g., "just now", "5m ago", "2h ago").
 */
function getRelativeTime(date) {
  if (!date) return "recently";

  const diffMs = Date.now() - new Date(date);
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

// ── Auth routes ───────────────────────────────────────────

/**
 * Route: GET /signup
 * Description: Renders the user registration page.
 * Database Access: None.
 */
app.get("/signup", isNotAuthenticated, (req, res) => {
  res.render("signup", {
    error: null,
    pageScripts: [],
    pageScript: "tutorial-auth",
    tutorialMode: true,
  });
});

/**
 * Route: POST /signup
 * Description: Validates registration payload, checks for duplicates, hashes password, and creates a user.
 * Database Access: Reads from `users` (duplicate check). Writes to `users` (insertion).
 */
app.post("/signup", isNotAuthenticated, async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;

  const schema = Joi.object({
    name: Joi.string().max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(50).required(),
    confirmPassword: Joi.string().valid(Joi.ref("password")).required(),
  });

  const { error } = schema.validate({ name, email, password, confirmPassword });
  if (error) {
    return res.render("signup", {
      error: error.details[0].message,
      pageScripts: [],
      pageScript: "tutorial-auth",
      tutorialMode: true,
    });
  }

  const existingUser = await users.findOne({ email });
  if (existingUser) {
    return res.render("signup", {
      error: "Email already in use",
      pageScripts: [],
      pageScript: "tutorial-auth",
      tutorialMode: true,
    });
  }

  const hash = await bcrypt.hash(password, 10);
  await users.insertOne({
    name,
    email,
    password: hash,
    tutorialMode: true,
    role: "user",
  });

  req.session.authenticated = true;
  req.session.name = name;
  req.session.email = email;
  res.redirect("/dashboard");
});

/**
 * Route: GET /login
 * Description: Renders the login page.
 * Database Access: None.
 */
app.get("/login", isNotAuthenticated, (req, res) => {
  res.render("login", {
    error: null,
    pageScripts: [],
    pageScript: "tutorial-auth",
    tutorialMode: true,
  });
});

/**
 * Route: POST /login
 * Description: Authenticates a user by checking credentials against the database.
 * Database Access: Reads from the `users` collection.
 */
app.post("/login", isNotAuthenticated, async (req, res) => {
  const { email, password } = req.body;

  const { error } = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }).validate({ email, password });

  if (error) {
    return res.render("login", {
      error: "Invalid email or password",
      pageScripts: [],
      pageScript: "tutorial-auth",
      tutorialMode: true,
    });
  }

  const user = await users.findOne({ email });
  if (!user) {
    return res.render("login", {
      error: "User not found",
      pageScripts: [],
      pageScript: "tutorial-auth",
      tutorialMode: true,
    });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.render("login", {
      error: "Invalid password",
      pageScripts: [],
      pageScript: "tutorial-auth",
      tutorialMode: true,
    });
  }

  req.session.authenticated = true;
  req.session.name = user.name;
  req.session.email = email;
  res.redirect("/dashboard");
});

// ── Page routes ───────────────────────────────────────────

/**
 * Route: GET /bookmarks
 * Description: Renders the bookmarks page for authenticated users.
 * Database Access: None.
 */
app.get("/bookmarks", isAuthenticated, async (req, res) => {
  res.render("bookmarks", {
    pageScript: "bookmarks",
    pageScripts: [],
    isAuthenticated: true,
  });
});

/**
 * Route: GET /map
 * Description: Renders the interactive map page. Manages a one-time session flag for the map tutorial.
 * Database Access: None.
 */
app.get("/map", (req, res) => {
  const showMapTutorial = !req.session.mapInstructionsShown;
  if (showMapTutorial) req.session.mapInstructionsShown = true;
  const { lat, lng, zoom } = req.query;
  res.render("map", {
    pageScript: "map",
    pageScripts: ["https://unpkg.com/maplibre-gl@5.23.0/dist/maplibre-gl.js"],
    tutorialMode: showMapTutorial,
    initLat: lat,
    initLng: lng,
    initZoom: zoom,
  });
});

/**
 * Route: GET /recommendations
 * Description: Renders the recommendations overview page.
 * Database Access: None.
 */
app.get("/recommendations", (req, res) => {
  res.render("recommendations", {
    pageScript: "recommendations",
    pageScripts: [],
  });
});

/**
 * Route: GET /settings
 * Description: Renders the user settings page.
 * Database Access: None.
 */
app.get("/settings", (req, res) => {
  res.render("settings", { pageScript: null, pageScripts: [] });
});

/**
 * Route: GET /weather
 * Description: Renders the weather information page, fetching tutorial mode preference.
 * Database Access: Implicitly reads from `users` via getTutorialMode().
 */
app.get("/weather", async (req, res) => {
  const tutorialMode = await getTutorialMode(req);
  res.render("weather", {
    pageScript: "weather-tutorial",
    pageScripts: [],
    tutorialMode,
  });
});

// ── Admin routes ──────────────────────────────────────────

/**
 * Route: GET /admin
 * Description: Renders the admin dashboard with user statistics and recent page analytics.
 * Database Access: Reads from the `users` collection (all users) and `pageAnalytics` collection (last 30 days).
 */
app.get("/admin", isAdmin, async (req, res) => {
  try {
    const allUsers = await users.find({}).toArray();
    const totalUsers = allUsers.length;
    const adminUsers = allUsers.filter((u) => u.role === "admin").length;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentAnalytics = await pageAnalytics
      .find({ timestamp: { $gte: thirtyDaysAgo } })
      .toArray();

    const pageVisits = {};
    recentAnalytics.forEach((e) => {
      pageVisits[e.page] = (pageVisits[e.page] || 0) + 1;
    });

    const topPages = Object.entries(pageVisits)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([page, count]) => ({ page, count }));

    const userList = allUsers
      .map((u) => ({
        name: u.name,
        email: u.email,
        role: u.role || "user",
        createdAt: u.createdAt || new Date(),
        lastVisit: u.lastVisit || null,
        isAdmin: u.role === "admin",
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.render("admin", {
      pageScript: "admin",
      pageScripts: [],
      stats: { totalUsers, adminUsers, regularUsers: totalUsers - adminUsers },
      topPages,
      userList,
    });
  } catch (err) {
    console.error("Admin dashboard error:", err);
    res.status(500).render("404", { pageScripts: [], pageScript: null });
  }
});

/**
 * Route: POST /api/admin/toggle-role
 * Description: Toggles a user's role between 'admin' and 'user'.
 * Database Access: Reads from `users` (find by email), writes to `users` (update role).
 */
app.post("/api/admin/toggle-role", isAdmin, async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== "string")
    return res.status(400).json({ error: "Invalid email provided" });
  if (email === req.session.email)
    return res.status(400).json({ error: "You cannot change your own role" });

  try {
    const user = await users.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const newRole = user.role === "admin" ? "user" : "admin";
    await users.updateOne({ email }, { $set: { role: newRole } });

    res.json({
      success: true,
      email,
      newRole,
      message: `User ${newRole === "admin" ? "promoted to admin" : "demoted to regular user"}`,
    });
  } catch (err) {
    console.error("Error toggling user role:", err);
    res.status(500).json({ error: "Failed to update user role" });
  }
});

/**
 * Route: GET /admin/feedback
 * Description: Renders the admin feedback management page.
 * Database Access: Reads all documents from the `feedback` collection, sorted by date.
 */
app.get("/admin/feedback", isAdmin, async (req, res) => {
  try {
    const allFeedback = await feedback
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    const feedbackList = allFeedback.map((item) => ({
      id: item._id.toString(),
      email: item.email || "Anonymous",
      type: item.type || "general",
      message: item.message,
      createdAt: item.createdAt || new Date(),
      status: item.status || "new",
      rating: item.rating || null,
    }));

    res.render("admin-feedback", {
      pageScript: "admin-feedback",
      pageScripts: [],
      feedbackList,
    });
  } catch (err) {
    console.error("Admin feedback page error:", err);
    res.status(500).render("404", { pageScripts: [], pageScript: null });
  }
});

/**
 * Route: POST /api/admin/feedback/update-status
 * Description: Updates the status of a specific feedback submission.
 * Database Access: Writes (updates) a single document in the `feedback` collection.
 */
app.post("/api/admin/feedback/update-status", isAdmin, async (req, res) => {
  const { feedbackId, status } = req.body;
  if (!feedbackId || !["new", "reviewed", "resolved"].includes(status)) {
    return res.status(400).json({ error: "Invalid request" });
  }

  try {
    const { ObjectId } = require("mongodb");
    await feedback.updateOne(
      { _id: new ObjectId(feedbackId) },
      { $set: { status, updatedAt: new Date() } },
    );
    res.json({ success: true, message: "Feedback status updated" });
  } catch (err) {
    console.error("Error updating feedback status:", err);
    res.status(500).json({ error: "Failed to update feedback status" });
  }
});

/**
 * Route: POST /api/admin/feedback/delete
 * Description: Deletes a specific feedback submission.
 * Database Access: Writes (deletes) a single document from the `feedback` collection.
 */
app.post("/api/admin/feedback/delete", isAdmin, async (req, res) => {
  const { feedbackId } = req.body;
  if (!feedbackId) return res.status(400).json({ error: "Invalid request" });

  try {
    const { ObjectId } = require("mongodb");
    await feedback.deleteOne({ _id: new ObjectId(feedbackId) });
    res.json({ success: true, message: "Feedback deleted" });
  } catch (err) {
    console.error("Error deleting feedback:", err);
    res.status(500).json({ error: "Failed to delete feedback" });
  }
});

/**
 * Route: POST /api/feedback/submit
 * Description: Submits new user feedback to the database.
 * Database Access: Writes (inserts) a new document into the `feedback` collection.
 */
app.post("/api/feedback/submit", async (req, res) => {
  const { type, message, rating } = req.body;

  if (!message?.trim())
    return res.status(400).json({ error: "Message cannot be empty" });
  if (message.length > 1000)
    return res
      .status(400)
      .json({ error: "Message must be 1000 characters or less" });
  if (type && !["bug", "feature", "general", "complaint"].includes(type)) {
    return res.status(400).json({ error: "Invalid feedback type" });
  }
  if (rating && (rating < 1 || rating > 5 || !Number.isInteger(rating))) {
    return res.status(400).json({ error: "Rating must be between 1 and 5" });
  }

  try {
    await feedback.insertOne({
      email: req.session.email || null,
      type: type || "general",
      message: message.trim(),
      rating: rating || null,
      createdAt: new Date(),
      status: "new",
    });
    res.json({ success: true, message: "Thank you for your feedback!" });
  } catch (err) {
    console.error("Error submitting feedback:", err);
    res.status(500).json({ error: "Failed to submit feedback" });
  }
});

/**
 * Route: POST /api/trails/log
 * Description: Logs a completed trail for the authenticated user.
 * Database Access: Handled by helper functions.
 */
app.post("/api/trails/log", isAuthenticated, async (req, res) => {
  try {
    const result = await logUserTrail(req.session.email, req.body);
    res.json(result);
  } catch (err) {
    console.error("Trail log error:", err);
    res.status(500).json({ error: "Failed to log trail" });
  }
});

/**
 * Coordinates trail resolution, user stat updating, and activity logging.
 * Database Access: Invokes functions that read `trails` and write to `users` and `activity`.
 *
 * @param {string} email - User email address.
 * @param {Object} body - Request body containing trail details.
 * @returns {Promise<Object>} Success status.
 */
async function logUserTrail(email, body) {
  const trail = await resolveTrail(body);
  const log = buildTrailLog(trail, body);

  await updateUserStats(email, log);
  await insertTrailActivity(email, log);

  return { success: true };
}

/**
 * Resolves a trail document by ID if provided in the payload.
 * Database Access: Reads a single document from the `trails` collection.
 *
 * @param {Object} body - Request body containing an optional trailId.
 * @returns {Promise<Object|null>} The trail document or null.
 */
async function resolveTrail(body) {
  if (!body.trailId) return null;

  const { ObjectId } = require("mongodb");
  return await trails.findOne({ _id: new ObjectId(body.trailId) });
}

/**
 * Normalizes trail data and payload details into a standardized log object.
 *
 * @param {Object|null} trail - The retrieved trail document.
 * @param {Object} body - The request payload containing fallback values.
 * @returns {Object} A standardized trail log object.
 */
function buildTrailLog(trail, body) {
  const name = trail?.trail_name || body.trailName;
  if (!name) throw new Error("Trail name required");

  let distance =
    trail?.length_meters != null
      ? trail.length_meters / 1000
      : parseFloat(body.distanceKm);

  if (isNaN(distance)) distance = 0;

  return { name, distance, trail };
}

/**
 * Updates a user's total distance, trails explored count, and appends a log entry.
 * Database Access: Writes (updates) a document in the `users` collection.
 *
 * @param {string} email - The user's email.
 * @param {Object} log - The standardized trail log object.
 * @returns {Promise<void>}
 */
async function updateUserStats(email, log) {
  await users.updateOne(
    { email },
    {
      $inc: {
        trailsExplored: 1,
        totalDistance: log.distance,
      },
      $push: {
        trailLogs: {
          trailId: log.trail?._id || null,
          name: log.name,
          distance: log.distance,
          createdAt: new Date(),
        },
      },
    },
  );
}

/**
 * Route: GET /api/activity
 * Description: Fetches paginated activity history for the authenticated user.
 * Database Access: Handled by fetchUserActivity().
 */
app.get("/api/activity", isAuthenticated, async (req, res) => {
  try {
    const items = await fetchUserActivity(req.session.email, req.query);
    res.json(formatActivity(items));
  } catch (err) {
    console.error("Load activity error:", err);
    res.status(500).json([]);
  }
});

/**
 * Inserts a record of completed trail activity into the activity collection.
 * Note: This declaration shadows the previous definition of insertTrailActivity.
 * Database Access: Writes (inserts) into the `activity` collection.
 *
 * @param {string} email - The user's email.
 * @param {Object} log - The standardized trail log object.
 * @returns {Promise<void>}
 */
async function insertTrailActivity(email, log) {
  const activityCollection = client.db().collection("activity");

  await activityCollection.insertOne({
    email,
    type: "trail_completed",
    description: `Completed ${log.name} (${log.distance.toFixed(1)} km)`,
    createdAt: new Date(),
  });
}

/**
 * Retrieves a user's recent activity stream with pagination support.
 * Database Access: Reads from the `activity` collection.
 *
 * @param {string} email - The user's email.
 * @param {Object} query - Query parameters for pagination (limit, skip).
 * @returns {Promise<Array>} Array of raw activity documents.
 */
async function fetchUserActivity(email, query) {
  const limit = parseInt(query.limit || "10");
  const skip = parseInt(query.skip || "0");

  return await client
    .db()
    .collection("activity")
    .find({ email })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();
}

/**
 * Formats an array of raw activity documents by adding a relative time string.
 *
 * @param {Array} items - Array of activity documents.
 * @returns {Array} Array of formatted activity objects.
 */
function formatActivity(items) {
  return items.map((a) => ({
    ...a,
    timeAgo: getRelativeTime(a.createdAt),
  }));
}

// ── Tutorial toggle ───────────────────────────────────────

/**
 * Route: POST /toggle-tutorial
 * Description: Toggles the tutorial mode preference for the current session and persistent user profile.
 * Database Access: Writes (updates) the tutorial mode preference in the `users` collection.
 */
app.post("/toggle-tutorial", async (req, res) => {
  const { tutorialMode } = req.body;
  if (typeof tutorialMode !== "boolean") {
    return res.status(400).json({ error: "tutorialMode must be a boolean" });
  }

  req.session.tutorialMode = tutorialMode;

  if (req.session.authenticated) {
    try {
      await users.updateOne(
        { email: req.session.email },
        { $set: { tutorialMode } },
      );
    } catch (err) {
      console.error("Failed to save tutorialMode to DB:", err);
    }
  }

  res.json({ tutorialMode });
});

// ── Logout ────────────────────────────────────────────────

/**
 * Route: GET /logout
 * Description: Destroys the current user session and redirects to the home page.
 * Database Access: None (Session storage handles cleanup).
 */
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// ── Profile routes ────────────────────────────────────────

/**
 * Route: GET /profile
 * Description: Renders the user profile page.
 * Database Access: Reads a single document from the `users` collection.
 */
app.get("/profile", isAuthenticated, async (req, res) => {
  try {
    const user = await users.findOne({ email: req.session.email });
    if (!user) return res.redirect("/login");

    const tutorialMode = await getTutorialMode(req);
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

/**
 * Route: POST /api/profile/update-nickname
 * Description: Updates a user's nickname.
 * Database Access: Writes (updates) the nickname field in the `users` collection.
 */
app.post("/api/profile/update-nickname", isAuthenticated, async (req, res) => {
  const { nickname } = req.body;
  if (!nickname?.trim())
    return res.status(400).json({ error: "Nickname cannot be empty" });
  if (nickname.length > 50)
    return res
      .status(400)
      .json({ error: "Nickname must be 50 characters or less" });

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

/**
 * Route: POST /api/profile/update-picture
 * Description: Updates a user's profile picture using a base64 encoded image string.
 * Database Access: Writes (updates) the profile picture field in the `users` collection.
 */
app.post("/api/profile/update-picture", isAuthenticated, async (req, res) => {
  const { profilePicture } = req.body;
  if (!profilePicture)
    return res.status(400).json({ error: "No image provided" });
  if (profilePicture.length > 2.7e6)
    return res.status(400).json({ error: "Image too large (max 2MB)" });

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

// ── Data API ──────────────────────────────────────────────
app.get("/api/parks", async (req, res) => {
  try {
    res.json(await parks.find({}).toArray());
  } catch {
    res.status(500).json({ error: "Failed to fetch parks" });
  }
});

app.get("/api/paths", async (req, res) => {
  try {
    res.json(await paths.find({}).toArray());
  } catch {
    res.status(500).json({ error: "Failed to fetch paths" });
  }
});

app.get("/api/trails", async (req, res) => {
  try {
    res.json(await trails.find({}).toArray());
  } catch {
    res.status(500).json({ error: "Failed to fetch trails" });
  }
});

app.get("/api/trails/search", async (req, res) => {
  try {
    const results = await searchTrails(req.query.q);
    res.json(formatTrailSearchResults(results));
  } catch (err) {
    console.error("Trail search error:", err);
    res.status(500).json([]);
  }
});

app.get("/api/parkShade", async (req, res) => {
  try {
    const { time } = req.query;

    // The incoming query time is a millisecond timestamp representing a PDT time.
    // e.g., if a user passes a timestamp, targetDate represents that exact moment in time.
    const targetDate = new Date(parseInt(time));
    console.log("---");
    console.log(
      "🟢 [API] Incoming Request Time (UTC ISO):",
      targetDate.toISOString(),
    );

    // 1. Check if the database has data
    const totalDocs = await parkshade.countDocuments();
    console.log("DEBUG: Total documents in parkshade collection:", totalDocs);

    if (totalDocs === 0) {
      console.log("❌ ERROR: parkshade collection is completely empty!");
      return res.json({ data: [] }); // Matched your internal fallback key
    }

    // 2. Print a sample document to verify field names
    const sampleDoc = await parkshade.findOne();
    console.log("DEBUG: Sample document 'time' field:", sampleDoc?.time);

    // 3. Get distinct times
    const distinctTimes = await parkshade.distinct("time");
    console.log(
      `DEBUG: Found ${distinctTimes.length} unique time strings in DB.`,
    );

    let closestTime = null;
    let minDiff = Infinity;
    const targetMs = targetDate.getTime();

    // 4. Safely parse and find closest using an explicit Pacific Time offset
    distinctTimes.forEach((timeStr) => {
      if (!timeStr) return;

      // 1. Strip the timezone text out completely
      // Handles formats like "2026-05-21 16:30:00 PDT" -> "2026-05-21 16:30:00"
      const cleanStr = timeStr.replace(/ (PDT|PST|UTC|GMT)$/, "").trim();

      // 2. Format it into an ISO-like structure with an explicit Pacific offset (-07:00 or -08:00)
      // Since your query is explicitly always in PDT/PST, we force the string parser to treat it as Pacific.
      // Replacing space with 'T' helps guarantee cross-platform native parsing.
      const formattedIsoStr = cleanStr.replace(" ", "T");

      // Determine if the date falls in Daylight Savings (PDT = -07:00) or Standard Time (PST = -08:00)
      // For absolute accuracy, we look at whether the specific database date is in daylight savings.
      const isDST = isPacificDST(new Date(cleanStr.split(" ")[0]));
      const offset = isDST ? "-07:00" : "-08:00";

      const dbDateMs = new Date(`${formattedIsoStr}${offset}`).getTime();

      if (isNaN(dbDateMs)) {
        console.log(
          `⚠️ WARNING: Failed to parse time string: "${timeStr}" (Formatted: "${formattedIsoStr}${offset}")`,
        );
        return;
      }

      const diff = Math.abs(dbDateMs - targetMs);

      if (diff < minDiff) {
        minDiff = diff;
        closestTime = timeStr;
      }
    });

    console.log("🔵 [API] Closest Time found in DB:", closestTime);

    if (!closestTime) {
      return res.json({ data: [] });
    }

    const shadingDocs = await parkshade.find({ time: closestTime }).toArray();
    console.log(
      `🟡 [API] Documents found for ${closestTime}: ${shadingDocs.length}`,
    );

    res.json({
      selectedTime: closestTime,
      data: shadingDocs,
    });
  } catch (err) {
    console.error("❌ [API] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Helper function to check if a specific date is in Daylight Savings for Pacific Time
function isPacificDST(dateObj) {
  // Returns something like "America/Los_Angeles" standard vs daylight rules
  const str = dateObj.toLocaleDateString("en-US", {
    timeZone: "America/Los_Angeles",
    timeZoneName: "short",
  });
  return str.includes("PDT");
}

async function searchTrails(query) {
  const q = (query || "").trim();
  if (!q) return [];

  return await trails
    .find({ trail_name: { $regex: q, $options: "i" } })
    .limit(10)
    .toArray();
}

function formatTrailSearchResults(trailsArr) {
  return trailsArr.map((t) => ({
    id: t._id.toString(),
    name: t.trail_name,
    distance_m: t.length_meters || null,
  }));
}

// ── Bookmark Routes ────────────────────────────────────────
app.post("/bookmark/:trailId", isAuthenticated, async (req, res) => {
  try {
    const trailId = req.params.trailId;
    const user = await users.findOne({ email: req.session.email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const alreadySaved = user.bookmarks?.includes(trailId);

    if (alreadySaved) {
      await users.updateOne(
        { email: req.session.email },
        { $pull: { bookmarks: trailId } },
      );
      return res.json({ saved: false });
    }

    await users.updateOne(
      { email: req.session.email },
      { $addToSet: { bookmarks: trailId } },
    );
    res.json({ saved: true });
  } catch (err) {
    console.error("Bookmark error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/bookmarks", isAuthenticated, async (req, res) => {
  try {
    const user = await users.findOne({ email: req.session.email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ bookmarks: user.bookmarks || [] });
  } catch (err) {
    console.error("Get bookmarks error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Settings Routes ───────────────────────────────────────
app.get("/api/settings", isAuthenticated, async (req, res) => {
  try {
    const user = await users.findOne({ email: req.session.email });
    res.json(user?.settings || {});
  } catch (err) {
    res.status(500).json({ error: "Failed to load settings" });
  }
});

app.post("/api/settings", isAuthenticated, async (req, res) => {
  try {
    await users.updateOne(
      { email: req.session.email },
      { $set: { settings: req.body } },
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save settings" });
  }
});

app.post("/api/account/delete", isAuthenticated, async (req, res) => {
  try {
    await users.deleteOne({ email: req.session.email });
    req.session.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete account" });
  }
});

// ── Search Routes ───────────────────────────────────────────
app.get("/search", (req, res) => {
  res.render("search", {
    pageScript: null,
    pageScripts: [],
    isAuthenticated: req.session.authenticated || false,
  });
});

// ── 404 Handler ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render("404", { pageScripts: [], pageScript: null });
});

// ── Start Server ──────────────────────────────────────────
app.listen(PORT, () => console.log(`Server is running at port ${PORT}`));
