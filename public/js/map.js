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

  const marker = new maplibregl.Marker()
    .setLngLat([-123.1207, 49.2827])
    .setPopup(popup)
    .addTo(map);

  map.on('load', function () {
    // Add GeoJSON Source
    map.addSource('vancouver-parks', {
      type: 'geojson',
      data: './data/parks-polygon-representation.geojson',
    });

    // Add Layer to visualize polygons
    map.addLayer({
      id: 'parks-layer',
      type: 'fill',
      source: 'vancouver-parks',
      paint: {
        'fill-color': '#008000',
        'fill-opacity': 0.5,
      },
    });
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
