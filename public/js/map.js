const map = new maplibregl.Map({
  container: 'map', // container id
  style:
    'https://api.maptiler.com/maps/streets-v4/style.json?key=2s3sHm0MZZMQLMHyYJLn',
  center: [-123.001, 49.2505], // starting position [lng, lat]
  zoom: 12, // starting zoom
});
