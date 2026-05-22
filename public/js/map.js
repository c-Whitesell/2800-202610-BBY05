const { initLat, initLng, initZoom } = window.MAP_CONFIG;
const container = document.getElementById("map");

let storedParksGeoJSON = null;
let isSyncingTimelineUI = false;
let lastRequestedMs = null;

if (container && !container._map) {
  setMapDimensions();

  const map = new maplibregl.Map({
    container: "map",
    style:
      "https://api.maptiler.com/maps/streets-v4/style.json?key=2s3sHm0MZZMQLMHyYJLn",
    center: [initLng || -123.1207, initLat || 49.2827],
    zoom: initZoom || 10,
  });

  container._map = map;

  map.on("load", async function () {
    await handleMapLoad(map);
  });

  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      setMapDimensions();
      map.resize();
    }, 250);
  });

  window.addEventListener("dateTimeTimelineChanged", async (event) => {
    await handleTimelineChange(event, map);
  });
}

/**
 * @description Calculates and sets the map container dimensions based on viewport height,
 * subtracting the navbar and footer heights to fit the screen.
 * @returns {void}
 */
function setMapDimensions() {
  const navHeight = document.querySelector(".navbar")?.offsetHeight || 0;
  const footHeight = document.querySelector("footer")?.offsetHeight || 0;
  const availableHeight = window.innerHeight - navHeight - footHeight;

  container.style.position = "relative";
  container.style.height = availableHeight + "px";
  container.style.width = "100%";
}

/**
 * @description Handles the map 'load' event, initializing all data layers and
 * triggering the initial timeline synchronization.
 * @param {Object} map - The maplibregl Map instance.
 * @returns {Promise<void>}
 */
async function handleMapLoad(map) {
  await addParksToMap(map);
  await addPathsToMap(map);
  addParkLabelsLayer(map);

  setTimeout(() => {
    const timelineEvent = new CustomEvent("dateTimeTimelineChanged", {
      detail: { timestamp: new Date().toISOString() },
    });
    window.dispatchEvent(timelineEvent);
  }, 500);
}

/**
 * @description Processes timeline change events, fetches new shade data for the given timestamp,
 * and dynamically updates the park labels and shade metrics on the map.
 * @param {CustomEvent} event - The triggered custom event containing the timestamp payload.
 * @param {Object} map - The maplibregl Map instance.
 * @returns {Promise<void>}
 */
async function handleTimelineChange(event, map) {
  const rawIncomingMs = new Date(event.detail.timestamp).getTime();

  if (lastRequestedMs === rawIncomingMs) {
    console.log("API Request blocked: Duplicate timestamp detected.");
    return;
  }

  lastRequestedMs = rawIncomingMs;

  try {
    const targetedVancouverMs = convertToVancouverTime(event.detail.timestamp);

    // Read: Fetch dynamic shade data from the backend API for a specific timestamp
    const response = await fetch(`/api/parkShade?time=${targetedVancouverMs}`);

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const payload = await response.json();
    console.log("Shade API Response:", payload);

    const shadeMetricsMap = buildShadeMetricsMap(payload.data);

    if (payload && payload.selectedTime) {
      window.dispatchEvent(
        new CustomEvent("syncTimelineUIToTime", {
          detail: { adjustedTimestamp: new Date(event.detail.timestamp) },
        }),
      );
    }

    updateMapShadeFeatures(map, shadeMetricsMap);
  } catch (error) {
    console.error("Failed handling spatial dynamic updates:", error);
    lastRequestedMs = null;
  }
}

/**
 * @description Algorithm: Converts a given ISO string timestamp to Vancouver specific wall-clock
 * time format to ensure accurate backend shade calculations regardless of the client's local timezone.
 * @param {string} timestampString - The ISO timestamp string.
 * @returns {number} The time in milliseconds aligned with Vancouver time.
 */
function convertToVancouverTime(timestampString) {
  const incomingDate = new Date(timestampString);
  const vancouverFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = vancouverFormatter.formatToParts(incomingDate);
  const dateMap = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const vancouverISOStr = `${dateMap.year}-${dateMap.month.padStart(2, "0")}-${dateMap.day.padStart(2, "0")}T${dateMap.hour.padStart(2, "0")}:${dateMap.minute.padStart(2, "0")}:${dateMap.second.padStart(2, "0")}`;

  return new Date(vancouverISOStr).getTime();
}

/**
 * @description Maps the array of shade data from the API to an object for fast lookups.
 * @param {Array<Object>} shadeDataArray - The array of park shade data objects.
 * @returns {Object} A dictionary mapping park names to their shading percentage.
 */
function buildShadeMetricsMap(shadeDataArray) {
  const shadeMetricsMap = {};
  if (Array.isArray(shadeDataArray)) {
    shadeDataArray.forEach((document) => {
      const name = (document.park_name || "").toLowerCase();
      shadeMetricsMap[name] = {
        effective_shading_percent: document.effective_shading_percent,
      };
    });
  }
  return shadeMetricsMap;
}

/**
 * @description Updates the stored GeoJSON properties with the newly fetched shade metrics
 * and pushes the updated data to the maplibregl source.
 * @param {Object} map - The maplibregl Map instance.
 * @param {Object} shadeMetricsMap - Dictionary containing shade percentages keyed by park name.
 * @returns {void}
 */
function updateMapShadeFeatures(map, shadeMetricsMap) {
  if (storedParksGeoJSON && map.getSource("parks-data")) {
    const updatedFeatures = storedParksGeoJSON.features.map((feature) => {
      const parkName = (feature.properties.park_name || "").toLowerCase();
      const liveMetrics = shadeMetricsMap[parkName];
      const displayString = liveMetrics
        ? `${Math.round(liveMetrics.effective_shading_percent)}%`
        : "0%";

      return {
        ...feature,
        properties: {
          ...feature.properties,
          effective_shading_string: displayString,
        },
      };
    });

    map.getSource("parks-data").setData({
      type: "FeatureCollection",
      features: updatedFeatures,
    });
  }
}

/**
 * @description Fetches trail path data from the database and adds it as a line layer to the map.
 * Configures paint properties to color-code trails based on their surface material.
 * @param {Object} map - The maplibregl Map instance.
 * @returns {Promise<void>}
 */
async function addPathsToMap(map) {
  // Read: Fetch paths geospatial data from MongoDB
  const mongoData = await getMongoMapData("paths");

  const geojsonSource = {
    type: "FeatureCollection",
    features: mongoData.map((document) => ({
      type: "Feature",
      geometry: document.geometry,
      properties: {
        id: document._id.toString(),
        ...document.properties,
      },
    })),
  };

  map.addSource("paths-data", {
    type: "geojson",
    data: geojsonSource,
  });

  map.addLayer({
    id: "trails-layer",
    type: "line",
    source: "paths-data",
    paint: {
      "line-color": [
        "match",
        ["get", "surface"],
        ["asphalt", "paved", "rubbercrumb"],
        "#333333",
        ["concrete", "concrete:plates", "metal"],
        "#95a5a6",
        ["paving_stones", "sett", "unhewn_cobblestone"],
        "#7f8c8d",
        ["gravel", "fine_gravel", "pebblestone"],
        "#d35400",
        ["compacted", "sand", "stone", "rock"],
        "#e67e22",
        ["dirt", "ground", "earth", "unpaved"],
        "#8b4513",
        ["wood", "woodchips", "boardwalk"],
        "#a0522d",
        ["grass", "grass_paver", "stepping_stones"],
        "#27ae60",
        "#ad7c10",
      ],
      "line-opacity": 0.7,
      "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1, 15, 5],
    },
  });
}

/**
 * @description Fetches park boundary data from the database and adds it as a fill layer.
 * Initializes the 'effective_shading_string' property with a loading state.
 * @param {Object} map - The maplibregl Map instance.
 * @returns {Promise<void>}
 */
async function addParksToMap(map) {
  // Read: Fetch parks geospatial polygon data from MongoDB
  const mongoData = await getMongoMapData("parks");

  storedParksGeoJSON = {
    type: "FeatureCollection",
    features: mongoData.map((document) => ({
      type: "Feature",
      geometry: document.geometry,
      properties: {
        id: document._id.toString(),
        ...document.properties,
        effective_shading_string: "Calculating...",
      },
    })),
  };

  map.addSource("parks-data", {
    type: "geojson",
    data: storedParksGeoJSON,
  });

  map.addLayer({
    id: "parks-layer",
    type: "fill",
    source: "parks-data",
    paint: {
      "fill-color": "#008000",
      "fill-opacity": 0.35,
    },
  });
}

/**
 * @description Appends a symbol layer to the map to display park names and live shade metrics.
 * Uses data-driven styling to format and display the text strings.
 * @param {Object} map - The maplibregl Map instance.
 * @returns {void}
 */
function addParkLabelsLayer(map) {
  map.addLayer({
    id: "park-labels",
    type: "symbol",
    source: "parks-data",
    layout: {
      "text-field": [
        "concat",
        ["to-string", ["get", "park_name"]],
        "\nShade: ",
        ["get", "effective_shading_string"],
      ],
      "text-size": ["interpolate", ["linear"], ["zoom"], 10, 11, 15, 16],
      "text-justify": "center",
      "text-allow-overlap": false,
      "text-ignore-placement": false,
    },
    paint: {
      "text-color": "#1e293b",
      "text-halo-color": "#ffffff",
      "text-halo-width": 2,
    },
  });
}

/**
 * @description Generic fetch helper to retrieve collection data from the internal API.
 * @param {string} collectionName - The MongoDB collection endpoint to target.
 * @returns {Promise<Array>} Array of retrieved database records.
 */
async function getMongoMapData(collectionName) {
  try {
    // Read: General API GET request for collection records
    const response = await fetch("/api/" + collectionName);
    const data = await response.json();
    console.log("Here are the " + collectionName + ": ", data);
    return data;
  } catch (error) {
    console.error("Error fetching data:", error);
    return [];
  }
}
