// Global state arrays for storing mapped items and user's saved bookmark IDs
let allItems = [];
let savedIds = [];

/**
 * Normalizes raw park data from the database into a consistent object structure.
 * Handles spatial coordinate extraction from both Point and Polygon geometries.
 * @param {Object} raw - The raw park document from the database.
 * @returns {Object} A standardized park object.
 */
function normalisePark(raw) {
  const properties = raw.properties || {};
  const coordinates = raw.geometry?.coordinates;

  let lat = 0;
  let lng = 0;

  // Extract coordinates depending on the geographic data format
  if (properties.geo_point_2d) {
    lat = properties.geo_point_2d.lat;
    lng = properties.geo_point_2d.lon;
  } else if (raw.geometry?.type === "Polygon" && coordinates?.[0]?.length) {
    lng = coordinates[0][0][0];
    lat = coordinates[0][0][1];
  }

  return {
    _id: String(raw._id),
    name: properties.park_name || properties.name || "Unnamed Park",
    difficulty: properties.classification || "",
    distance: parseFloat(properties.area_ha || 0),
    length: parseFloat(properties.area_ha || 0),
    description: properties.aiSummary || "",
    location: properties.park_name || "",
    duration: "",
    elevation: "",
    image_url: properties.image_url || "",
    lat,
    lng,
    source: "park",
    raw,
  };
}

/**
 * Normalizes raw path data into a consistent object structure.
 * Calculates the geographic midpoint for LineString geometries.
 * @param {Object} raw - The raw path document from the database.
 * @returns {Object} A standardized path object.
 */
function normalisePath(raw) {
  const properties = raw.properties || {};
  const coordinates = raw.geometry?.coordinates;

  let lat = 0;
  let lng = 0;

  // Find the midpoint of the path line for map pin placement
  if (raw.geometry?.type === "LineString" && coordinates?.length) {
    const midIndex = Math.floor(coordinates.length / 2);
    const midPoint = coordinates[midIndex];
    lng = midPoint[0];
    lat = midPoint[1];
  } else if (properties.geo_point_2d) {
    lat = properties.geo_point_2d.lat;
    lng = properties.geo_point_2d.lon;
  }

  return {
    _id: String(raw._id),
    name: properties.name || properties.park_name || "Unnamed Path",
    difficulty: properties.classification || properties.highway || "",
    distance: 0,
    length: 0,
    description: properties.surface ? `Surface: ${properties.surface}` : "",
    location: properties.park_name || "",
    duration: "",
    elevation: "",
    image_url: properties.image_url || "",
    lat,
    lng,
    source: "path",
    raw,
  };
}

/**
 * Normalizes trail data, specifically handling MongoDB-specific data types.
 * @param {Object} raw - The raw trail document from the database.
 * @param {string} source - The designated source collection or type.
 * @returns {Object} A standardized trail object.
 */
function normaliseTrail2(raw, source) {
  let lengthMeters = 0;

  // Extract decimal number from MongoDB's $numberDecimal format (DB read handling)
  if (raw.length_meters) {
    lengthMeters = parseFloat(
      raw.length_meters.$numberDecimal || raw.length_meters || 0,
    );
  }

  // Format location text by joining associated parks
  let locationText = "Vancouver";
  if (Array.isArray(raw.associated_parks) && raw.associated_parks.length > 0) {
    locationText = raw.associated_parks.join(", ");
  }

  return {
    _id: raw._id,
    name: raw.trail_name || "Unnamed Trail",
    difficulty: raw.difficulty || "",
    distance: lengthMeters,
    description: raw.highway || raw.surface ? `Surface: ${raw.surface}` : "",
    surface: raw.surface,
    location: locationText,
    duration: raw.duration || "",
    elevation: raw.elevation || "",
    image_url: raw.image_url || "",
    lat: parseFloat(raw.lat) || 0,
    lng: parseFloat(raw.lng) || 0,
    source: source || raw.source || "Database",
    raw: raw.raw || raw,
  };
}

/**
 * Determines the appropriate CSS class and label for a difficulty badge.
 * @param {string} difficultyLevel - The raw difficulty string.
 * @returns {Object|null} An object containing the badge class and formatted label, or null.
 */
function difficultyBadge(difficultyLevel) {
  const lowerDifficulty = (difficultyLevel || "").toLowerCase();

  if (
    lowerDifficulty.includes("easy") ||
    lowerDifficulty === "low" ||
    lowerDifficulty === "neighbourhood"
  ) {
    return {
      cls: "badge--easy",
      label: lowerDifficulty === "neighbourhood" ? "Neighbourhood" : "Easy",
    };
  }

  if (lowerDifficulty.includes("hard") || lowerDifficulty === "high") {
    return { cls: "badge--hard", label: "Hard" };
  }

  if (lowerDifficulty.includes("mod") || lowerDifficulty === "medium") {
    return { cls: "badge--moderate", label: "Moderate" };
  }

  if (
    lowerDifficulty === "footway" ||
    lowerDifficulty === "path" ||
    lowerDifficulty === "cycleway"
  ) {
    return {
      cls: "badge--default",
      label: lowerDifficulty.charAt(0).toUpperCase() + lowerDifficulty.slice(1),
    };
  }

  if (lowerDifficulty) {
    return { cls: "badge--default", label: difficultyLevel };
  }

  return null;
}

/**
 * Assigns a representative emoji based on the item's name or location keywords.
 * @param {Object} itemData - The normalized item data.
 * @returns {string} An emoji string representing the item's terrain or type.
 */
function itemEmoji(itemData) {
  const itemName = (itemData.name + itemData.location).toLowerCase();

  if (itemName.includes("lake") || itemName.includes("pond")) return "🏞️";
  if (itemName.includes("creek") || itemName.includes("river")) return "🌊";
  if (itemName.includes("mountain") || itemName.includes("peak")) return "🏔️";
  if (itemName.includes("forest") || itemName.includes("wood")) return "🌲";
  if (itemName.includes("beach") || itemName.includes("shore")) return "🏖️";
  if (itemName.includes("canyon") || itemName.includes("gorge")) return "🏜️";

  return "🥾";
}

/**
 * Generates the HTML markup for an individual trail or park card.
 * @param {Object} itemData - The normalized data for a single item.
 * @returns {string} The HTML string for the item card.
 */
function renderCard(itemData) {
  const badge = difficultyBadge(itemData.difficulty);
  const distanceString = itemData.distance
    ? `${itemData.distance.toFixed(2)} ha`
    : "";
  const durationString = itemData.duration || "";
  const elevationString = itemData.elevation
    ? `${itemData.elevation}m gain`
    : "";
  const hasCoordinates = itemData.lat && itemData.lng;
  const typeLabel = itemData.source === "park" ? "Park" : "Path";

  return `
      <div class="trail-card" data-id="${itemData._id}">
        <div class="trail-card__img">
          ${
            itemData.image_url
              ? `<div class="trail-card__img-placeholder" style="background-image: url('${itemData.image_url}'); background-size: cover; background-position: center; width: 100%; height: 100%;"></div>`
              : `<div class="trail-card__img-placeholder">${itemEmoji(itemData)}</div>`
          }
          <button class="trail-card__bookmark saved" onclick="toggleBookmark('${itemData._id}', this)" title="Remove bookmark">
            🔖
          </button>
          <span class="trail-card__type-badge">${typeLabel}</span>
        </div>
        <div class="trail-card__body">
          <div class="trail-card__top">
            <div class="trail-card__name">${itemData.name}</div>
            ${badge ? `<span class="trail-card__badge ${badge.cls}">${badge.label}</span>` : ""}
          </div>
          <div class="trail-card__meta">
            ${distanceString ? `<span class="trail-card__meta-item"><span>📐</span>${distanceString}</span>` : ""}
            ${durationString ? `<span class="trail-card__meta-item"><span>⏱️</span>${durationString}</span>` : ""}
            ${elevationString ? `<span class="trail-card__meta-item"><span>⛰️</span>${elevationString}</span>` : ""}
            ${itemData.location ? `<span class="trail-card__meta-item"><span>📍</span>${itemData.location}</span>` : ""}
          </div>
          ${itemData.description ? `<div class="trail-card__desc">${itemData.description}</div>` : ""}
          <div class="trail-card__actions">
            ${
              hasCoordinates
                ? `<button class="trail-card__btn trail-card__btn--primary" onclick="viewOnMap(${itemData.lat}, ${itemData.lng}, '${itemData.name.replace(/'/g, "\\'")}')">🗺️ View on Map</button>`
                : `<button class="trail-card__btn trail-card__btn--primary" onclick="viewOnMap(null,null,'${itemData.name.replace(/'/g, "\\'")}')">🗺️ View on Map</button>`
            }
            <button class="trail-card__btn trail-card__btn--remove" onclick="toggleBookmark('${itemData._id}', this)">
              🗑️ Remove
            </button>
          </div>
        </div>
      </div>
    `;
}

/**
 * Filters the master list of items against saved bookmarks and renders them to the DOM.
 * Manages the display of empty states and loading indicators.
 * @param {void}
 * @returns {void}
 */
function renderGrid() {
  const loadingIndicator = document.getElementById("bookmarksLoading");
  const emptyStateContainer = document.getElementById("bookmarksEmpty");
  const bookmarkSection = document.getElementById("bookmarksSection");
  const gridContainer = document.getElementById("bookmarksContainer");
  const countDisplay = document.getElementById("bookmarksCount");

  loadingIndicator.classList.add("d-none");

  const bookmarkedItems = allItems.filter((item) =>
    savedIds.includes(item._id),
  );

  if (countDisplay) {
    countDisplay.textContent = `${bookmarkedItems.length} saved`;
  }

  // Handle empty state if user has no saved bookmarks
  if (bookmarkedItems.length === 0) {
    bookmarkSection.classList.add("d-none");
    emptyStateContainer.classList.remove("d-none");
    return;
  }

  // Render cards if bookmarks exist
  emptyStateContainer.classList.add("d-none");
  bookmarkSection.classList.remove("d-none");
  gridContainer.innerHTML = bookmarkedItems.map(renderCard).join("");
}

/**
 * Sends a POST request to the server to remove a bookmark, then updates the UI.
 * Database Write Operation: Updates the user's saved bookmarks collection.
 * @param {string} id - The unique identifier of the bookmark to toggle.
 * @returns {Promise<void>}
 */
async function toggleBookmark(id) {
  try {
    const response = await fetch(`/bookmark/${id}`, { method: "POST" });

    if (!response.ok) {
      showToast("Something went wrong");
      return;
    }

    const responseData = await response.json();

    if (!responseData.saved) {
      savedIds = savedIds.filter((existingId) => existingId !== id);
      showToast("Removed from bookmarks");
      renderGrid();
    }
  } catch (error) {
    console.error(error);
    showToast("Something went wrong");
  }
}

/**
 * Redirects the user to the map page, centering on specific coordinates or a search term.
 * @param {number|null} lat - The latitude coordinate.
 * @param {number|null} lng - The longitude coordinate.
 * @param {string} name - The name of the location to search for if coordinates are missing.
 * @returns {void}
 */
function viewOnMap(lat, lng, name) {
  if (lat && lng) {
    window.location.href = `/map?zoom=17&lat=${lat}&lng=${lng}`;
  } else {
    window.location.href = `/map?search=${encodeURIComponent(name)}`;
  }
}

/**
 * Displays a temporary toast notification message on the screen.
 * @param {string} message - The text to display in the toast.
 * @returns {void}
 */
function showToast(message) {
  let toastElement = document.getElementById("bm-toast");

  if (!toastElement) {
    toastElement = document.createElement("div");
    toastElement.id = "bm-toast";
    toastElement.className = "bm-toast";
    document.body.appendChild(toastElement);
  }

  toastElement.textContent = message;
  toastElement.classList.add("show");

  setTimeout(() => toastElement.classList.remove("show"), 2500);
}

/**
 * Fetches the list of bookmarked IDs associated with the current user.
 * Database Read Operation: Retrieves user's saved list from the server.
 * @param {void}
 * @returns {Promise<void>}
 */
async function loadBookmarks() {
  try {
    const response = await fetch("/api/bookmarks");
    if (!response.ok) return;

    const responseData = await response.json();
    savedIds = (responseData.bookmarks || []).map(String);
  } catch (error) {
    console.error("Failed to load bookmarks:", error);
  }
}

/**
 * Fetches all map-related data collections concurrently and normalizes them.
 * Database Read Operation: Retrieves all parks, paths, and trails.
 * @param {void}
 * @returns {Promise<void>}
 */
async function loadData() {
  try {
    const [parksResponse, pathsResponse, trailsResponse] = await Promise.all([
      fetch("/api/parks").catch(() => ({ ok: false })),
      fetch("/api/paths").catch(() => ({ ok: false })),
      fetch("/api/trails").catch(() => ({ ok: false })),
    ]);

    const parksData = parksResponse.ok ? await parksResponse.json() : [];
    const pathsData = pathsResponse.ok ? await pathsResponse.json() : [];
    const trailsData = trailsResponse.ok ? await trailsResponse.json() : [];

    const normalizedParks = (Array.isArray(parksData) ? parksData : []).map(
      normalisePark,
    );

    const normalizedPaths = (Array.isArray(trailsData) ? trailsData : [])
      .filter(
        (pathItem) =>
          pathItem &&
          pathItem.trail_name &&
          !pathItem.trail_name.endsWith(" Trails"),
      )
      .map((pathItem) => normaliseTrail2(pathItem, "path"));

    allItems = [...normalizedParks, ...normalizedPaths];
  } catch (error) {
    console.error("Failed to load data:", error);
  }
}

/**
 * Initializes the bookmark page by loading user data and master lists concurrently,
 * then rendering the UI grid.
 * @param {void}
 * @returns {Promise<void>}
 */
async function init() {
  await Promise.all([loadBookmarks(), loadData()]);
  renderGrid();
}

init();
