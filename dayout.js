(async function () {
  const [locations, categories] = await Promise.all([loadLocations(), loadCategories()]);

  const PRIORITY = ['hikes', 'beaches', 'coffee', 'restaurants', 'pubs', 'viewpoints', 'museums', 'gardens', 'shopping', 'activities', 'ww2'];
  const nonRouteLocations = locations.filter(l => l.category !== 'essentials');

  // --- Map setup ---
  const map = L.map('map').setView([49.4626, -2.5852], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  // Faint context markers for every POI
  nonRouteLocations.forEach(loc => {
    const cat = categories[loc.category];
    L.circleMarker([loc.lat, loc.lng], {
      radius: 4, color: cat.color, weight: 1, fillColor: cat.color, fillOpacity: 0.6
    }).bindTooltip(loc.name, { direction: 'top' }).addTo(map);
  });

  let anchor = { lat: 49.4403576, lng: -2.5992789, name: 'The Farmhouse Hotel' }; // default: our hotel
  const anchorIcon = L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#2F4858;border:2px solid #fff;transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [22, 22], iconAnchor: [11, 22]
  });
  const anchorMarker = L.marker([anchor.lat, anchor.lng], { icon: anchorIcon, draggable: true }).addTo(map);
  const radiusCircle = L.circle([anchor.lat, anchor.lng], {
    radius: 4000, color: '#2F4858', weight: 1.5, fillColor: '#2F4858', fillOpacity: 0.08
  }).addTo(map);

  function setAnchor(lat, lng, name) {
    anchor = { lat, lng, name: name || 'Custom spot' };
    anchorMarker.setLatLng([lat, lng]);
    radiusCircle.setLatLng([lat, lng]);
  }

  map.on('click', (e) => setAnchor(e.latlng.lat, e.latlng.lng, 'Dropped pin'));
  anchorMarker.on('dragend', () => {
    const ll = anchorMarker.getLatLng();
    setAnchor(ll.lat, ll.lng, 'Dropped pin');
    anchorSelect.value = '';
  });

  // --- Anchor dropdown (alternate way to pick a start point) ---
  const anchorSelect = document.getElementById('anchor');
  const blankOpt = document.createElement('option');
  blankOpt.value = '';
  blankOpt.textContent = 'Pick a place, or tap the map';
  anchorSelect.appendChild(blankOpt);

  const sorted = [...nonRouteLocations].sort((a, b) => {
    const ai = PRIORITY.indexOf(a.category), bi = PRIORITY.indexOf(b.category);
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });
  sorted.forEach(loc => {
    const opt = document.createElement('option');
    opt.value = loc.id;
    opt.textContent = `${categories[loc.category].icon} ${loc.name} (${loc.area || categories[loc.category].label})`;
    anchorSelect.appendChild(opt);
  });
  anchorSelect.addEventListener('change', () => {
    if (!anchorSelect.value) return;
    const loc = locations.find(l => l.id === anchorSelect.value);
    setAnchor(loc.lat, loc.lng, loc.name);
    map.setView([loc.lat, loc.lng], 13);
  });

  // --- Radius slider ---
  const radiusInput = document.getElementById('radius');
  const radiusValue = document.getElementById('radiusValue');
  function updateRadiusCircle() {
    const km = Number(radiusInput.value);
    radiusValue.textContent = `${km} km`;
    radiusCircle.setRadius(km * 1000);
  }
  radiusInput.addEventListener('input', updateRadiusCircle);
  updateRadiusCircle();

  // --- Cluster search ---
  document.getElementById('go').addEventListener('click', () => {
    const radiusKm = Number(radiusInput.value);
    const results = document.getElementById('results');
    results.innerHTML = '';

    const withDistance = nonRouteLocations
      .map(l => ({ loc: l, dist: haversine(anchor.lat, anchor.lng, l.lat, l.lng) }))
      .filter(x => x.dist <= radiusKm)
      .sort((a, b) => a.dist - b.dist);

    const byCategory = {};
    withDistance.forEach(({ loc, dist }) => {
      if (!byCategory[loc.category]) byCategory[loc.category] = { loc, dist };
    });

    const heading = document.createElement('h2');
    heading.textContent = `Suggested cluster around ${anchor.name}`;
    results.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'poi-list';
    let count = 0;
    PRIORITY.forEach(catKey => {
      const entry = byCategory[catKey];
      if (!entry) return;
      count++;
      const { loc, dist } = entry;
      const cat = categories[catKey];
      const card = document.createElement('div');
      card.className = 'poi-card';
      card.style.borderLeftColor = cat.color;
      card.innerHTML = `<h3>${cat.icon} ${loc.name}<span class="area">${dist.toFixed(1)} km away</span></h3>
        ${loc.note ? `<p class="note">${loc.note}</p>` : ''}
        <a class="map-link" href="index.html?focus=${loc.id}">View in full guide →</a>`;
      list.appendChild(card);
    });
    results.appendChild(list);

    if (!count) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = `Nothing found within ${radiusKm} km, try widening the radius.`;
      results.appendChild(empty);
    }
  });
})();
