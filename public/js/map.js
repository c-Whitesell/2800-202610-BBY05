const container = document.getElementById("map");
let storedParksGeoJSON = null; // Cache map reference features natively
// 1. Create a global or module-scoped guard flag
let isSyncingTimelineUI = false;
// 1. Maintain a reference to the last successfully requested timestamp
let lastRequestedMs = null;

if (container && !container._map) {
  function setMapDimensions() {
    const navHeight = document.querySelector(".navbar")?.offsetHeight || 0;
    const footHeight = document.querySelector("footer")?.offsetHeight || 0;
    const availableHeight = window.innerHeight - navHeight - footHeight;

    container.style.position = "relative";
    container.style.height = availableHeight + "px";
    container.style.width = "100%";
  }

  setMapDimensions();

  const map = new maplibregl.Map({
    container: "map",
    style:
      "https://api.maptiler.com/maps/streets-v4/style.json?key=2s3sHm0MZZMQLMHyYJLn",
    center: [-123.1207, 49.2827],
    zoom: 10,
  });

  container._map = map;

  map.on("load", async function () {
    // 1. Structural base fills (Wait for database fetch to finish)
    await addParksToMap(map);

    // 2. Linear trails (Wait for database fetch to finish)
    await addPathsToMap(map);

    // 3. Labels injected at terminal stage to ride above preceding layer blocks
    // This now safely runs AFTER "parks-data" has been created
    addParkLabelsLayer(map);

    // Bootstrap initial database lookup immediately matching system startup times
    setTimeout(() => {
      const event = new CustomEvent("dateTimeTimelineChanged", {
        detail: { timestamp: new Date().toISOString() },
      });
      window.dispatchEvent(event);
    }, 500);
  });

  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      setMapDimensions();
      map.resize();
    }, 250);
  });

  // ── Global Custom Event Hook: Fired after 3-second debounces ──────────────────
  window.addEventListener("dateTimeTimelineChanged", async (e) => {
    // Keep the guard based strictly on the raw incoming timestamp so it stays completely stable
    const rawIncomingMs = new Date(e.detail.timestamp).getTime();

    // Deduplication Guard: If this exact millisecond was just processed, abort network request
    if (lastRequestedMs === rawIncomingMs) {
      console.log("🛑 API Request blocked: Duplicate timestamp detected.");
      return;
    }

    // Update our pointer immediately to block subsequent simultaneous or debounced echoes
    lastRequestedMs = rawIncomingMs;

    try {
      // 1. Convert the incoming time specifically to Vancouver wall-clock time JUST for the API
      const incomingDate = new Date(e.detail.timestamp);
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
      const dateMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));
      const vancouverISOStr = `${dateMap.year}-${dateMap.month.padStart(2, "0")}-${dateMap.day.padStart(2, "0")}T${dateMap.hour.padStart(2, "0")}:${dateMap.minute.padStart(2, "0")}:${dateMap.second.padStart(2, "0")}`;

      // This is the specific adjusted MS value that goes to your backend
      const targetedVancouverMs = new Date(vancouverISOStr).getTime();

      // Send the Vancouver millisecond timestamp to the backend
      const response = await fetch(
        `/api/parkShade?time=${targetedVancouverMs}`,
      );

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const payload = await response.json();
      console.log("✅ Shade API Response:", payload);

      // 1. Build the shadeMap dynamically from the array received from the server
      const shadeMap = {};
      if (payload.data && Array.isArray(payload.data)) {
        payload.data.forEach((doc) => {
          const name = (doc.park_name || "").toLowerCase();
          shadeMap[name] = {
            effective_shading_percent: doc.effective_shading_percent,
          };
        });
      }

      // 2. Sync Timeline UI (Using the original raw timestamp to keep guards perfectly matching)
      if (payload && payload.selectedTime) {
        // We pass the raw original incoming date object back out to the UI.
        // This guarantees that the UI loops back the exact same MS value that our guard expects.
        window.dispatchEvent(
          new CustomEvent("syncTimelineUIToTime", {
            detail: { adjustedTimestamp: incomingDate },
          }),
        );
      }

      // 3. Update Map
      if (storedParksGeoJSON && map.getSource("parks-data")) {
        const updatedFeatures = storedParksGeoJSON.features.map((feature) => {
          const parkName = (feature.properties.park_name || "").toLowerCase();
          const liveMetrics = shadeMap[parkName];

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
    } catch (err) {
      console.error("❌ Failed handling spatial dynamic updates:", err);
      // Clear out cache on error to allow the user to retry clicking/dragging the timeline
      lastRequestedMs = null;
    }
  });
}

async function addPathsToMap(map) {
  const mongoData = await getMongoMapData("paths");
  const geojsonSource = {
    type: "FeatureCollection",
    features: mongoData.map((doc) => ({
      type: "Feature",
      geometry: doc.geometry,
      properties: {
        id: doc._id.toString(),
        ...doc.properties,
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

async function addParksToMap(map) {
  const mongoData = await getMongoMapData("parks");

  // Construct baseline properties with initial safe fallback string label structures
  storedParksGeoJSON = {
    type: "FeatureCollection",
    features: mongoData.map((doc) => ({
      type: "Feature",
      geometry: doc.geometry,
      properties: {
        id: doc._id.toString(),
        ...doc.properties,
        effective_shading_string: "Calculating...", // Baseline loading string
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
      "fill-opacity": 0.35, // Dropped slightly for visual enhancement
    },
  });
}

// Separated function to load symbols on top explicitly
function addParkLabelsLayer(map) {
  map.addLayer({
    id: "park-labels",
    type: "symbol",
    source: "parks-data",
    layout: {
      // Use standard interpolation text binding parameters mapping to live data tracking variables
      "text-field": [
        "concat",
        ["to-string", ["get", "park_name"]],
        "\n",
        ["get", "effective_shading_string"],
      ],
      "text-size": ["interpolate", ["linear"], ["zoom"], 10, 11, 15, 16],
      "text-justify": "center",
      "text-allow-overlap": false, // Set to true if labels should force render over intersecting entities
      "text-ignore-placement": false,
    },
    paint: {
      "text-color": "#1e293b",
      "text-halo-color": "#ffffff",
      "text-halo-width": 2,
    },
  });
}

async function getMongoMapData(collectionName) {
  try {
    const response = await fetch("/api/" + collectionName);
    const data = await response.json();
    console.log("Here are the " + collectionName + ": ", data);
    return data;
  } catch (error) {
    console.error("Error fetching data:", error);
    return [];
  }
}
