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
const isAuthenticated = (req, res, next) => {
  if (req.session.authenticated) return next();
  res.redirect("/login");
};

const isNotAuthenticated = (req, res, next) => {
  if (!req.session.authenticated) return next();
  res.redirect("/map");
};

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

app.get("/dashboard", isAuthenticated, async (req, res) => {
  try {
    const user = await users.findOne({ email: req.session.email });
    if (!user)
      return res
        .status(404)
        .render("404", { pageScripts: [], pageScript: null });

    const userStats = {
      username: user.username || user.email.split("@")[0],
      trailsExplored: user.trailsExplored || 0,
      totalDistance: user.totalDistance || 0,
      lastActivityDays: calculateDaysSinceLastActivity(user.lastActivityDate),
    };

    let recentActivity = [];
    try {
      const activityCollection = client.db().collection("activity");
      const raw = await activityCollection
        .find({ userId: user._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();

      recentActivity = raw.map((a) => ({
        ...a,
        timeAgo: getRelativeTime(a.createdAt),
      }));
    } catch (err) {
      console.warn("Activity collection not available:", err.message);
    }

    res.render("dashboard", {
      pageScript: "dashboard",
      pageScripts: [],
      user: userStats,
      recentActivity,
      isAuthenticated: true,
    });
  } catch (error) {
    console.error("Dashboard route error:", error);
    res
      .status(500)
      .render("error", {
        pageScripts: [],
        pageScript: null,
        message: "Error loading dashboard",
      });
  }
});

app.get("/api/recommended-trail", isAuthenticated, async (req, res) => {
  try {
    const trailCount = await paths.countDocuments();
    if (trailCount === 0)
      return res.status(404).json({ error: "No trails available" });

    const randomIndex = Math.floor(Math.random() * trailCount);
    const trail = await paths.find({}).skip(randomIndex).limit(1).next();
    if (!trail) return res.status(404).json({ error: "No trail found" });

    res.json({
      trail: {
        id: trail._id.toString(),
        name: trail.name || "Unnamed Trail",
        description: trail.description || "A scenic trail in the area.",
        distance: trail.distance || 5,
        duration: trail.duration || "1-2 hours",
        difficulty: trail.difficulty || "Moderate",
        rating: trail.rating || 0,
      },
    });
  } catch (error) {
    console.error("Recommended trail API error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/recommended-trail/ai", isAuthenticated, async (req, res) => {
  try {
    const trailCount = await paths.countDocuments();
    if (trailCount === 0)
      return res.status(404).json({ error: "No trails available" });

    const randomIndex = Math.floor(Math.random() * trailCount);
    const trail = await paths.find({}).skip(randomIndex).limit(1).next();
    if (!trail) return res.status(404).json({ error: "No trail found" });

    const prompt = `
Write a short hiking trail description.

Do NOT include labels like "Trail:", "Name:", "Distance:", markdown formatting, or bullet points.
Only return a clean paragraph.

Trail name: ${trail.trail_name}
Distance: ${trail.distance}
Difficulty: ${trail.difficulty}

Focus on shade and comfort, best time to go, and who it's ideal for.
Tone: friendly, helpful, concise.
`.trim();

    const aiDescription = await generateAIResponse(prompt);

    res.json({
      trail: {
        id: trail._id.toString(),
        name: trail.trail_name || "Unnamed Trail",
        description: aiDescription,
        distance: trail.distance || 5,
        duration: trail.duration || "1-2 hours",
        difficulty: trail.difficulty || "Moderate",
        rating: trail.rating || 0,
      },
    });
  } catch (err) {
    console.error("AI trail recommendation error:", err);
    res.status(500).json({ error: "AI recommendation unavailable" });
  }
});

// ── AI Weather Summary ────────────────────────────────────
// Accepts weather data as query params sent by the client,
// builds a hiking-focused prompt, and returns a Gemini summary.
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
app.get("/bookmarks", (req, res) => {
  res.render("bookmarks", { error: null, pageScripts: [], pageScript: null });
});

app.get("/map", (req, res) => {
  const showMapTutorial = !req.session.mapInstructionsShown;
  if (showMapTutorial) req.session.mapInstructionsShown = true;

  res.render("map", {
    pageScript: "map",
    pageScripts: ["https://unpkg.com/maplibre-gl@5.23.0/dist/maplibre-gl.js"],
    tutorialMode: showMapTutorial,
  });
});

app.get("/recommendations", (req, res) => {
  res.render("recommendations", {
    pageScript: "recommendations",
    pageScripts: [],
  });
});

app.get("/settings", (req, res) => {
  res.render("settings", { pageScript: null, pageScripts: [] });
});

app.get("/weather", async (req, res) => {
  const tutorialMode = await getTutorialMode(req);
  res.render("weather", {
    pageScript: "weather-tutorial",
    pageScripts: [],
    tutorialMode,
  });
});

app.get("/search", (req, res) => {
  res.render("search", { pageScript: null, pageScripts: [] });
});

// ── Admin routes ──────────────────────────────────────────
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

// ── Tutorial toggle ───────────────────────────────────────
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
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// ── Profile routes ────────────────────────────────────────
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

// ── 404 Handler ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render("404", { pageScripts: [], pageScript: null });
});

// ── Start Server ──────────────────────────────────────────
app.listen(PORT, () => console.log(`Server is running at port ${PORT}`));
