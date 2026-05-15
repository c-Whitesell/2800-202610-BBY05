const container = document.getElementById("map");

if (container && !container._map) {
  // Function to set explicit container dimensions
  function setMapDimensions() {
    const navHeight = document.querySelector(".navbar")?.offsetHeight || 0;
    const footHeight = document.querySelector("footer")?.offsetHeight || 0;
    const availableHeight = window.innerHeight - navHeight - footHeight;

    container.style.position = "relative";
    container.style.height = availableHeight + "px";
    container.style.width = "100%";
  }

  // Set dimensions before creating the map
  setMapDimensions();

  const map = new maplibregl.Map({
    container: "map",
    style:
      "https://api.maptiler.com/maps/streets-v4/style.json?key=2s3sHm0MZZMQLMHyYJLn",
    center: [-123.1207, 49.2827],
    zoom: 10,
  });

  container._map = map;

  map.on("load", function () {
    addParksToMap(map);
    addPathsToMap(map);
  });

  // Handle window resize
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      setMapDimensions();
      map.resize();
    }, 250);
  });
}

async function addPathsToMap(map) {
  const mongoData = await getMongoMapData("paths");
  // Assume 'mongoData' is the array of objects you retrieved from db.trails.find().toArray()
  const geojsonSource = {
    type: "FeatureCollection",
    features: mongoData.map((doc) => ({
      type: "Feature",
      geometry: doc.geometry, // This must be a valid GeoJSON object (Point, LineString, etc.)
      properties: {
        id: doc._id.toString(), // Convert ObjectId to string
        // Spread any other metadata you want to use for styling
        ...doc.properties,
      },
    })),
  };

  map.addSource("paths-data", {
    type: "geojson",
    data: geojsonSource, // The object we created in step 1
  });

  // Add Layer to visualize polygons
  map.addLayer({
    id: "trails-layer",
    type: "line",
    source: "paths-data",
    paint: {
      "line-color": [
        "match",
        ["get", "surface"],

        // ─── PAVED (Greys/Blues) ──────────────────────────
        ["asphalt", "paved", "rubbercrumb"],
        "#333333", // Dark Charcoal
        ["concrete", "concrete:plates", "metal"],
        "#95a5a6", // Light Grey
        ["paving_stones", "sett", "unhewn_cobblestone"],
        "#7f8c8d", // Stone Grey

        // ─── UNPAVED/LOOSE (Browns/Tans) ──────────────────
        ["gravel", "fine_gravel", "pebblestone"],
        "#d35400", // Burnt Orange/Rust
        ["compacted", "sand", "stone", "rock"],
        "#e67e22", // Sandy Brown
        ["dirt", "ground", "earth", "unpaved"],
        "#8b4513", // Saddle Brown

        // ─── NATURAL/ORGANIC (Greens/Wood) ────────────────
        ["wood", "woodchips", "boardwalk"],
        "#a0522d", // Sienna (Woody)
        ["grass", "grass_paver", "stepping_stones"],
        "#27ae60", // Green

        // ─── FALLBACK ─────────────────────────────────────
        "#ad7c10", // Default Gold/Brown
      ],
      "line-opacity": 0.7,
      // Set line width to 5 pixels
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        1, // At zoom 10 (or less), width is 1px
        15,
        5, // At zoom 15 (or more), width is 5px
      ],
    },
  });
}

async function addParksToMap(map) {
  const mongoData = await getMongoMapData("parks");
  // Assume 'mongoData' is the array of objects you retrieved from db.trails.find().toArray()
  const geojsonSource = {
    type: "FeatureCollection",
    features: mongoData.map((doc) => ({
      type: "Feature",
      geometry: doc.geometry, // This must be a valid GeoJSON object (Point, LineString, etc.)
      properties: {
        id: doc._id.toString(), // Convert ObjectId to string
        // Spread any other metadata you want to use for styling
        ...doc.properties,
      },
    })),
  };

  map.addSource("parks-data", {
    type: "geojson",
    data: geojsonSource, // The object we created in step 1
  });

  // Add Layer to visualize polygons
  map.addLayer({
    id: "parks-layer",
    type: "fill",
    source: "parks-data",
    paint: {
      "fill-color": "#008000",
      "fill-opacity": 0.5,
    },
  });

  // 2. THE TEXT LABEL
  map.addLayer({
    id: "park-labels",
    type: "symbol", // Controls the text
    source: "parks-data",
    layout: {
      // Get the 'value' property and convert it to a string for display
      //"text-field": ["concat", ["to-string", ["get", "value"]], "%"],
      "text-field": ["concat", ["to-string", ["get", "park_name"]], "\n50%"],
      "text-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        10, // At zoom 10 (or less),
        15,
        18, // At zoom 15 (or more),
      ],
    },
    paint: {
      "text-color": "#000000",
    },
  });
}

async function getMongoMapData(collectionName) {
  try {
    const response = await fetch("/api/" + collectionName); // Calls the route we made above
    const data = await response.json();

    console.log("Here are the " + collectionName + ": ", data);
    // Now you can loop through 'data' and display it in your HTML
    return data;
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}
