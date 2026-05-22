🌲 ShadyTrails

ShadyTrails helps you discover parks, trails, and green spaces based on your ideal level of shade, so you can find the perfect outdoor experience no matter the weather or season.


Table of Contents

Project Description
Technologies Used
File Structure
Setup & Installation

Prerequisites
Windows Setup
macOS Setup
Environment Variables
Running the App


Features
AI & API Usage
Credits & References
Contact


Project Description
ShadyTrails is a web app that matches users with personalized trail and park recommendations based on shade preferences and current weather. Whether you want full sun or deep forest cover, ShadyTrails helps you find the perfect outdoor spot. Users can explore an interactive map, save bookmarks, search for parks and paths, and get AI-powered trail summaries and weather advisories.

Technologies Used
Frontend

EJS — server-side HTML templating
Bootstrap 5 — responsive layout and UI components
Bootstrap Icons — icon library
MapLibre GL JS — interactive map rendering
JavaScript — client-side interactivity

Backend

Node.js — runtime environment
Express.js — web framework and routing
express-session — session management
connect-mongo — MongoDB-backed session store
bcrypt — password hashing
Joi — input validation
dotenv — environment variable management

Database

MongoDB Atlas — cloud-hosted NoSQL database

Collections: users, parks, paths, trails, feedback, pageAnalytics, activity, pageAnalytics, sessions



External APIs & Services

Google Gemini AI — trail descriptions and weather summaries
MapLibre GL JS — https://unpkg.com/maplibre-gl@5.23.0/dist/maplibre-gl.js
Google Fonts — Syne, DM Sans typefaces
Open-Meteo - weather forecast


File Structure
Run the following to generate this yourself:
Windows:
bashtree /f
macOS:
bashbrew install tree
tree
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
│       ├── ...
├── .env                  <= NOT committed to repo
├── .gitignore
├── package.json
├── package-lock.json
└── server.js

Setup & Installation
Prerequisites
Make sure the following are installed before you begin:
ToolVersionDownloadNode.jsv18 or higherhttps://nodejs.orgnpmComes with Node.js—GitLatesthttps://git-scm.comVS Code (recommended)Latesthttps://code.visualstudio.com
You will also need:

A MongoDB Atlas account and cluster — https://www.mongodb.com/atlas
A Google Gemini API key — https://aistudio.google.com


Windows Setup

Clone the repository

bash   git clone https://github.com/your-org/shadytrails.git
   cd shadytrails

Install Node.js
Download and run the installer from https://nodejs.org. Choose the LTS version.
Verify installation:

bash   node -v
   npm -v

Install project dependencies

bash   npm install

Create your .env file (see Environment Variables below)
Run the app

bash   node server.js
Then open http://localhost:3000 in your browser.

macOS Setup

Install Homebrew (if not already installed)

bash   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

Install Node.js

bash   brew install node
Verify installation:
bash   node -v
   npm -v

Clone the repository

bash   git clone https://github.com/your-org/shadytrails.git
   cd shadytrails

Install project dependencies

bash   npm install

Create your .env file (see Environment Variables below)
Run the app

bash   node server.js
Then open http://localhost:3000 in your browser.

Environment Variables
Create a file named .env in the root of the project. Do not commit this file to Git — it is already listed in .gitignore.
env# MongoDB
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/<dbname>?retryWrites=true&w=majority

# Session secrets (generate two long random strings)
NODE_SESSION_SECRET=your_node_session_secret_here
MONGODB_SESSION_SECRET=your_mongodb_session_secret_here

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key_here

# Server port (optional, defaults to 3000)
PORT=3000
How to get each value:

MONGO_URI — In MongoDB Atlas, go to your cluster → Connect → Drivers → copy the connection string. Replace <username>, <password>, and <dbname> with your credentials.
NODE_SESSION_SECRET / MONGODB_SESSION_SECRET — Generate two separate random strings. You can use:

bash  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

GEMINI_API_KEY — Visit https://aistudio.google.com, sign in, and create an API key under "Get API Key".


Running the App
bashnode server.js
You should see:
Server is running at port 3000
Connected to MongoDB and initialized collections
Open http://localhost:3000 in your browser.
To auto-restart on file changes during development, use nodemon:
bashnpm install -g nodemon
nodemon server.js

Features
FeatureAccessInteractive map with parks and pathsEveryoneSearch parks and paths by nameEveryoneFilter and browse trail recommendationsEveryoneAI-powered trail descriptionsEveryoneReal-time weather advisory (AI)EveryoneBookmark/save trailsLogged-in usersSearch historyLogged-in usersUser profile and nicknameLogged-in usersDashboard with activityLogged-in usersAdmin panel (users, analytics, feedback)Admin users only

AI & API Usage
Google Gemini AI (aiService.js)
ShadyTrails uses the Google Gemini API for two features:

Trail descriptions — When a user requests a recommended trail on the dashboard, the app sends a prompt to Gemini containing the trail name, distance, and difficulty. Gemini returns a friendly 1–2 paragraph description focused on shade, comfort, and who the trail is best suited for.
Weather advisories — On the weather page, the client fetches current conditions (temperature, rain chance, wind speed, UV index, sky conditions) and sends them to /api/ai-weather-summary. The server constructs a prompt and Gemini returns a 2–4 sentence hiking advisory with gear suggestions and timing recommendations.

MapLibre GL JS
Used to render the interactive trail map. Loaded via CDN (unpkg.com/maplibre-gl@5.23.0). The map displays park and path data fetched from the MongoDB collections and supports navigating to a specific location via URL query parameters (?lat=, ?lng=, ?name=).
MongoDB Atlas
All user data, bookmarks, trail/park/path geodata, feedback, and page analytics are stored in MongoDB Atlas. The app connects via the official mongodb Node.js driver using the MONGO_URI environment variable.

Credits & References

Express.js Documentation
MongoDB Node.js Driver
MapLibre GL JS
Bootstrap 5
Google Gemini AI
Joi Validation
bcrypt
connect-mongo
How to Write a Good README

Contact
Connor Whitesell Developer— cwhitesell@my.bcit.ca

Harshpal Singh Developer— hsingh746@my.bcit.ca

Yasas Rajapakse Developer—  srajapakse1@my.bcit.ca

Amit Kahlon Developer— akahlon23@my.bcit.ca

Bhagat Takhar Developer— btakhar7@my.bcit.ca
