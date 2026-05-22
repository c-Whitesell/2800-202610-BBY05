/**
 * State Management
 */
let allItems = [];
let activeType = "all";
let debounceTimer = null;

const HISTORY_KEY = "search_history";
const MAX_HISTORY = 10;

/**
 * DOM References
 */
const input = document.getElementById("searchInput");
const clearBtn = document.getElementById("clearBtn");
const dropdown = document.getElementById("searchDropdown");
const resultsSection = document.getElementById("resultsSection");
const resultsGrid = document.getElementById("resultsGrid");
const resultsLabel = document.getElementById("resultsLabel");
const searchEmpty = document.getElementById("searchEmpty");
const historySection = document.getElementById("historySection");
const historyList = document.getElementById("historyList");
const historyEmpty = document.getElementById("historyEmpty");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

/**
 * Normalizes raw park data into a consistent object structure.
 * @param {Object} raw - The raw park data from API.
 * @returns {Object} - Normalized park object with id, name, type, and location.
 */
function normalisePark(raw) {
  const props = raw.properties || {};
  let lat = 0,
    lng = 0;
  if (props.geo_point_2d) {
    lat = props.geo_point_2d.lat;
    lng = props.geo_point_2d.lon;
  } else if (
    raw.geometry?.type === "Polygon" &&
    raw.geometry.coordinates?.[0]?.length
  ) {
    lng = raw.geometry.coordinates[0][0][0];
    lat = raw.geometry.coordinates[0][0][1];
  }
  return {
    _id: String(raw._id),
    name: props.park_name || props.name || "Unnamed Park",
    type: "park",
    classification: props.classification || "",
    area: props.area_ha ? `${parseFloat(props.area_ha).toFixed(1)} ha` : "",
    description: props.aiSummary || "",
    location: props.park_name || "",
    lat,
    lng,
  };
}

/**
 * Normalizes raw path data into a consistent object structure.
 * @param {Object} raw - The raw path data from API.
 * @returns {Object} - Normalized path object with id, name, type, and location.
 */
function normalisePath(raw) {
  const props = raw.properties || {};
  const coords = raw.geometry?.coordinates;
  let lat = 0,
    lng = 0;
  if (raw.geometry?.type === "LineString" && coords?.length) {
    const mid = coords[Math.floor(coords.length / 2)];
    lng = mid[0];
    lat = mid[1];
  } else if (props.geo_point_2d) {
    lat = props.geo_point_2d.lat;
    lng = props.geo_point_2d.lon;
  }
  return {
    _id: String(raw._id),
    name: props.name || props.park_name || "Unnamed Path",
    type: "path",
    classification: props.highway || props.surface || "",
    area: "",
    description: props.surface ? `Surface: ${props.surface}` : "",
    location: props.park_name || "",
    lat,
    lng,
  };
}

/**
 * Determines the emoji representation for a search item based on its attributes.
 * @param {Object} item - The item to categorize.
 * @returns {string} - Emoji string.
 */
function itemEmoji(item) {
  const n = (item.name + item.location).toLowerCase();
  if (n.includes("lake") || n.includes("pond")) return "🏞️";
  if (n.includes("creek") || n.includes("river")) return "🌊";
  if (n.includes("mountain") || n.includes("peak")) return "🏔️";
  if (n.includes("forest") || n.includes("wood")) return "🌲";
  if (n.includes("beach") || n.includes("shore")) return "🏖️";
  if (item.type === "park") return "🌳";
  return "🥾";
}

/**
 * Filters the master items list based on query string and active category.
 * @param {string} query - The search string.
 * @returns {Array} - Filtered list of items.
 */
function filterItems(query) {
  const q = query.trim().toLowerCase();
  return allItems.filter((item) => {
    const typeMatch = activeType === "all" || item.type === activeType;
    const nameMatch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.location.toLowerCase().includes(q);
    return typeMatch && nameMatch;
  });
}

/**
 * Generates HTML for a search result card.
 * @param {Object} item - The item to render.
 * @returns {string} - HTML string of the card.
 */
function renderResultCard(item) {
  const hasCoords = item.lat && item.lng;
  const onclick = hasCoords
    ? `viewOnMap(${item.lat}, ${item.lng}, '${item.name.replace(/'/g, "\\'")}')`
    : `viewOnMap(null, null, '${item.name.replace(/'/g, "\\'")}')`;

  return `
      <div class="result-card" onclick="${onclick}" data-id="${item._id}">
        <div class="result-card__emoji">${itemEmoji(item)}</div>
        <div class="result-card__body">
          <div class="result-card__row">
            <span class="result-card__name">${item.name}</span>
            <span class="result-card__type result-card__type--${item.type}">${item.type}</span>
          </div>
          ${item.location ? `<div class="result-card__location">📍 ${item.location}</div>` : ""}
          ${item.classification ? `<div class="result-card__meta">${item.classification}</div>` : ""}
          ${item.area ? `<div class="result-card__meta">📐 ${item.area}</div>` : ""}
          ${item.description ? `<div class="result-card__desc">${item.description}</div>` : ""}
        </div>
        <div class="result-card__arrow">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </div>
      </div>
    `;
}

/**
 * Displays search results in the main results grid.
 * @param {string} query - The search string.
 */
function showResults(query) {
  const results = filterItems(query);
  dropdown.innerHTML = "";
  dropdown.classList.remove("open");

  if (!query.trim() && activeType === "all") {
    resultsSection.style.display = "none";
    searchEmpty.style.display = "none";
    if (historySection) historySection.style.display = "";
    return;
  }

  if (historySection) historySection.style.display = "none";

  if (results.length === 0) {
    resultsSection.style.display = "none";
    searchEmpty.style.display = "flex";
    return;
  }

  searchEmpty.style.display = "none";
  resultsSection.style.display = "block";
  resultsLabel.textContent = `${results.length} result${results.length !== 1 ? "s" : ""} for "${query || activeType}"`;
  resultsGrid.innerHTML = results.map(renderResultCard).join("");
}

/**
 * Displays the live search dropdown.
 * @param {string} query - The search string.
 */
function showDropdown(query) {
  if (!query.trim()) {
    closeDropdown();
    return;
  }
  const results = filterItems(query).slice(0, 6);
  if (results.length === 0) {
    closeDropdown();
    return;
  }

  dropdown.innerHTML = results
    .map(
      (item) => `
      <div class="dropdown-item" onclick="pickDropdownItem('${item._id}', '${item.name.replace(/'/g, "\\'")}', ${item.lat}, ${item.lng})">
        <span class="dropdown-item__emoji">${itemEmoji(item)}</span>
        <span class="dropdown-item__name">${highlightMatch(item.name, query)}</span>
        <span class="dropdown-item__type">${item.type}</span>
      </div>
    `,
    )
    .join("");
  dropdown.classList.add("open");
}

function closeDropdown() {
  dropdown.innerHTML = "";
  dropdown.classList.remove("open");
}

/**
 * Wraps matching characters in a mark tag.
 * @param {string} text - The full text.
 * @param {string} query - The substring to highlight.
 * @returns {string} - HTML string with marked highlights.
 */
function highlightMatch(text, query) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    text.slice(0, idx) +
    `<mark>${text.slice(idx, idx + query.length)}</mark>` +
    text.slice(idx + query.length)
  );
}

function pickDropdownItem(id, name, lat, lng) {
  input.value = name;
  closeDropdown();
  saveHistory(name);
  showResults(name);
  viewOnMap(lat || null, lng || null, name);
}

/**
 * Handles map redirection with coordinates or search term.
 * @param {number|null} lat - Latitude.
 * @param {number|null} lng - Longitude.
 * @param {string} name - The item name for search fallback.
 */
function viewOnMap(lat, lng, name) {
  saveHistory(name);
  if (lat && lng) {
    window.location.href = `/map?zoom=17&lat=${lat}&lng=${lng}`;
  } else {
    window.location.href = `/map?search=${encodeURIComponent(name)}`;
  }
}

/**
 * Retrieves search history from localStorage.
 * @returns {Array} - List of search terms.
 */
function getHistory() {
  if (!IS_LOGGED_IN) return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

/**
 * Adds a term to history and updates localStorage.
 * @param {string} term - The search term.
 */
function saveHistory(term) {
  if (!IS_LOGGED_IN || !term?.trim()) return;
  let h = getHistory().filter((x) => x.toLowerCase() !== term.toLowerCase());
  h.unshift(term.trim());
  if (h.length > MAX_HISTORY) h = h.slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  renderHistory();
}

function removeHistoryItem(term) {
  const h = getHistory().filter((x) => x !== term);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  renderHistory();
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
}

/**
 * Renders the search history list into the DOM.
 */
function renderHistory() {
  if (!historyList) return;
  const h = getHistory();
  if (h.length === 0) {
    historyList.innerHTML = "";
    if (historyEmpty) historyEmpty.style.display = "block";
    return;
  }
  if (historyEmpty) historyEmpty.style.display = "none";
  historyList.innerHTML = h
    .map(
      (term) => `
      <div class="history-item">
        <button class="history-item__btn" onclick="applyHistory('${term.replace(/'/g, "\\'")}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${term}
        </button>
        <button class="history-item__remove" onclick="removeHistoryItem('${term.replace(/'/g, "\\'")}')">✕</button>
      </div>
    `,
    )
    .join("");
}

function applyHistory(term) {
  input.value = term;
  clearBtn.style.display = "flex";
  showResults(term);
  if (historySection) historySection.style.display = "none";
}

/**
 * Event Listeners
 */
input.addEventListener("input", () => {
  const q = input.value;
  clearBtn.style.display = q ? "flex" : "none";
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    showDropdown(q);
    showResults(q);
  }, 180);
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    closeDropdown();
    if (input.value.trim()) saveHistory(input.value.trim());
    showResults(input.value);
  }
  if (e.key === "Escape") {
    closeDropdown();
    input.blur();
  }
});

input.addEventListener("focus", () => {
  if (input.value) showDropdown(input.value);
});

document.addEventListener("click", (e) => {
  if (!e.target.closest("#searchBar") && !e.target.closest("#searchDropdown")) {
    closeDropdown();
  }
});

clearBtn?.addEventListener("click", () => {
  input.value = "";
  clearBtn.style.display = "none";
  closeDropdown();
  resultsSection.style.display = "none";
  searchEmpty.style.display = "none";
  if (historySection) historySection.style.display = "";
  input.focus();
});

document.querySelectorAll(".search-pill").forEach((pill) => {
  pill.addEventListener("click", function () {
    document
      .querySelectorAll(".search-pill")
      .forEach((p) => p.classList.remove("active"));
    this.classList.add("active");
    activeType = this.dataset.type;
    showResults(input.value);
  });
});

clearHistoryBtn?.addEventListener("click", clearHistory);

/**
 * Fetches parks and paths data from API.
 */
async function loadData() {
  try {
    const [parksRes, pathsRes] = await Promise.all([
      fetch("/api/parks").catch(() => ({ ok: false })),
      fetch("/api/paths").catch(() => ({ ok: false })),
    ];
    const parks = parksRes.ok ? await parksRes.json() : [];
    const paths = pathsRes.ok ? await pathsRes.json() : [];

    const seen = new Set();

    allItems = [
      ...(Array.isArray(parks) ? parks : []).map(normalisePark),
      ...(Array.isArray(paths) ? paths : []).map(normalisePath),
    ].filter((item) => {
      const name = item?.name;
      if (!name || seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  } catch (err) {
    console.error("Failed to load search data:", err);
  }
}

/**
 * Initializes app state, loads data, and checks URL parameters.
 */
async function init() {
  await loadData();
  renderHistory();
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q");
  if (q) {
    input.value = q;
    clearBtn.style.display = "flex";
    showResults(q);
  }
}

init();