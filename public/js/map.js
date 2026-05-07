const map = new maplibregl.Map({
  container: "map", // container id
  style:
    "https://api.maptiler.com/maps/streets-v4/style.json?key=2s3sHm0MZZMQLMHyYJLn",
  center: [-123.001, 49.2505], // starting position [lng, lat]
  zoom: 12, // starting zoom
});

const popup = new maplibregl.Popup({ offset: 25 }).setText("Vancouver, BC");

const marker = new maplibregl.Marker()
  .setLngLat([-123.1207, 49.2827])
  .setPopup(popup) // Bind the popup to the marker
  .addTo(map);

map.on("load", function () {
  // Add GeoJSON Source
  map.addSource("vancouver-parks", {
    type: "geojson",
    data: "./data/parks-polygon-representation.geojson",
  });

  // Add Layer to visualize polygons
  map.addLayer({
    id: "parks-layer",
    type: "fill",
    source: "vancouver-parks",
    paint: {
      "fill-color": "#008000",
      "fill-opacity": 0.5,
    },
  });
});
