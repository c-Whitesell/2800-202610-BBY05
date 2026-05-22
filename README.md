# 🌲 ShadyTrails

ShadyTrails helps users discover parks, trails, and green spaces based on their ideal level of shade, making it easier to enjoy the outdoors in any weather or season.

---

## 📚 Table of Contents

- [Project Description](#-project-description)
- [Technologies Used](#-technologies-used)
- [File Structure](#-file-structure)
- [Setup & Installation](#-setup--installation)
  - [Prerequisites](#prerequisites)
  - [Windows Setup](#windows-setup)
  - [macOS Setup](#macos-setup)
  - [Environment Variables](#environment-variables)
  - [Running the App](#running-the-app)
- [Features](#-features)
- [AI & API Usage](#-ai--api-usage)
- [Credits & References](#-credits--references)
- [Contact](#-contact)

---

# 📖 Project Description

ShadyTrails is a web application that recommends trails and parks based on user shade preferences and current weather conditions.

Whether users prefer sunny open trails or cool forest cover, ShadyTrails helps them find the ideal outdoor experience through:

- Interactive maps
- Personalized trail recommendations
- AI-generated trail summaries
- Weather advisories
- Bookmarking and search history

---

# 🛠 Technologies Used

## Frontend

- **EJS** — Server-side HTML templating
- **Bootstrap 5** — Responsive layouts and UI components
- **Bootstrap Icons** — Icon library
- **MapLibre GL JS** — Interactive map rendering
- **JavaScript** — Client-side interactivity

## Backend

- **Node.js** — Runtime environment
- **Express.js** — Web framework and routing
- **express-session** — Session management
- **connect-mongo** — MongoDB-backed session storage
- **bcrypt** — Password hashing
- **Joi** — Input validation
- **dotenv** — Environment variable management

## Database

- **MongoDB Atlas** — Cloud-hosted NoSQL database

### Collections

- users
- parks
- paths
- trails
- feedback
- pageAnalytics
- activity
- sessions

---

# 🌐 External APIs & Services

- **Google Gemini AI** — Trail descriptions and weather summaries
- **MapLibre GL JS** — https://unpkg.com/maplibre-gl@5.23.0/dist/maplibre-gl.js
- **Google Fonts** — Syne & DM Sans typefaces
- **Open-Meteo** — Weather forecasts

---

# 📁 File Structure

Generate this yourself using:

## Windows

```bash
tree /f
```

## macOS

```bash
brew install tree
tree
```

## Project Structure

```bash
shadytrails/
├── public/
│   ├── css/
│   │   ├── bookmarks.css
│   │   ├── search.css
│   │   └── ...
│   ├── js/
│   │   ├── bookmarks.js
│   │   ├── map.js
│   │   ├── recommendations.js
│   │   ├── search.js
│   │   └── ...
│   └── views/
│       ├── components/
│       │   ├── header.ejs
│       │   └── footer.ejs
│       ├── admin.ejs
│       ├── bookmarks.ejs
│       ├── dashboard.ejs
│       ├── index.ejs
│       └── ...
├── .env
├── .gitignore
├── package.json
├── package-lock.json
└── app.js
```

---

# ⚙️ Setup & Installation

## Prerequisites

Install the following before starting:

| Tool | Version | Download |
|------|------|------|
| Node.js | v18+ | https://nodejs.org |
| npm | Included with Node.js | — |
| Git | Latest | https://git-scm.com |
| VS Code (recommended) | Latest | https://code.visualstudio.com |

You will also need:

- A MongoDB Atlas account and cluster
- A Google Gemini API key

---

# 🪟 Windows Setup

## 1. Clone the Repository

```bash
git clone https://github.com/your-org/shadytrails.git
cd shadytrails
```

## 2. Install Node.js

Download the LTS installer from:

https://nodejs.org

Verify installation:

```bash
node -v
npm -v
```

## 3. Install Dependencies

```bash
npm install
```

## 4. Create Your `.env` File

See the [Environment Variables](#environment-variables) section below.

## 5. Run the App

```bash
node app.js
```

Open:

```text
http://localhost:3000
```

---

# 🍎 macOS Setup

## 1. Install Homebrew (if needed)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

## 2. Install Node.js

```bash
brew install node
```

Verify installation:

```bash
node -v
npm -v
```

## 3. Clone the Repository

```bash
git clone https://github.com/your-org/shadytrails.git
cd shadytrails
```

## 4. Install Dependencies

```bash
npm install
```

## 5. Create Your `.env` File

See the section below.

## 6. Run the App

```bash
node app.js
```

Open:

```text
http://localhost:3000
```

---

# 🔐 Environment Variables

Create a `.env` file in the root directory.

⚠️ Do NOT commit this file to GitHub.

```env
# MongoDB
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/<dbname>?retryWrites=true&w=majority

# Session secrets
NODE_SESSION_SECRET=your_node_session_secret_here
MONGODB_SESSION_SECRET=your_mongodb_session_secret_here

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key_here

# Server Port
PORT=3000
```

## How to Get Each Value

### MongoDB URI

In MongoDB Atlas:

1. Open your cluster
2. Click **Connect**
3. Select **Drivers**
4. Copy the connection string

Replace:

- `<username>`
- `<password>`
- `<dbname>`

with your own values.

---

### Session Secrets

Generate secure random strings:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Gemini API Key

Visit:

https://aistudio.google.com

Create an API key under **Get API Key**.

---

# ▶️ Running the App

Start the server:

```bash
node app.js
```

Expected console output:

```bash
Server is running at port 3000
Connected to MongoDB and initialized collections
```

Open in browser:

```text
http://localhost:3000
```

---

## 🔄 Development Mode (Optional)

Install Nodemon:

```bash
npm install -g nodemon
```

Run with auto-restart:

```bash
nodemon node.js
```

---

# ✨ Features

| Feature | Access |
|---|---|
| Interactive map with parks and paths | Everyone |
| Search parks and trails by name | Everyone |
| Filter and browse recommendations | Everyone |
| AI-powered trail descriptions | Everyone |
| Real-time weather advisories | Everyone |
| Bookmark/save trails | Logged-in users |
| Search history | Logged-in users |
| User profiles and nicknames | Logged-in users |
| Dashboard activity tracking | Logged-in users |
| Admin analytics & feedback tools | Admin users only |

---

# 🤖 AI & API Usage

## Google Gemini AI (`aiService.js`)

ShadyTrails uses Gemini AI for:

### Trail Descriptions

When users request trail recommendations, the app sends:

- Trail name
- Distance
- Difficulty

Gemini generates a friendly 1–2 paragraph summary focused on:

- Shade coverage
- Comfort level
- Ideal hikers

---

### Weather Advisories

The app fetches:

- Temperature
- Rain chance
- Wind speed
- UV index
- Sky conditions

This data is sent to `/api/ai-weather-summary`.

Gemini returns:

- Hiking recommendations
- Gear suggestions
- Best hiking times

---

## MapLibre GL JS

Used for rendering the interactive map.

Features include:

- Park/path markers
- Dynamic navigation
- Query parameter navigation:

```text
?lat=
?lng=
?name=
```

---

## MongoDB Atlas

Stores:

- User accounts
- Bookmarks
- Trail data
- Park/path geodata
- Feedback
- Analytics

---

# 🙌 Credits & References

- Express.js Documentation
- MongoDB Node.js Driver
- MapLibre GL JS
- Bootstrap 5
- Google Gemini AI
- Joi Validation
- bcrypt
- connect-mongo
- How to Write a Good README

---

# 📬 Contact

| Developer | Email |
|---|---|
| Connor Whitesell | cwhitesell@my.bcit.ca |
| Harshpal Singh | hsingh746@my.bcit.ca |
| Yasas Rajapakse | srajapakse1@my.bcit.ca |
| Amit Kahlon | akahlon23@my.bcit.ca |
| Bhagat Takhar | btakhar7@my.bcit.ca |
