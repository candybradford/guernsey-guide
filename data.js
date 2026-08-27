async function loadLocations() {
  const res = await fetch('data/locations.json');
  return res.json();
}

async function loadCategories() {
  const res = await fetch('data/categories.json');
  return res.json();
}

async function loadRoutes() {
  const res = await fetch('data/ww2_routes.json');
  return res.json();
}

async function loadHikeRoutes() {
  const res = await fetch('data/hike_routes.json');
  return res.json();
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371; // km
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function qs(name) {
  return new URLSearchParams(location.search).get(name);
}
