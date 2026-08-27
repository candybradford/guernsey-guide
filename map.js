(async function () {
  const [locations, categories, wwRoutes, hikeRoutes] = await Promise.all([
    loadLocations(), loadCategories(), loadRoutes(), loadHikeRoutes()
  ]);

  const map = L.map('map', { zoomControl: true }).setView([49.4626, -2.5852], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  const activeCats = new Set(Object.keys(categories));
  const markersByCat = {};   // category -> [{marker, loc}]
  const markerByLocId = {};

  function makeIcon(color, isEssential) {
    const size = isEssential ? 20 : 16;
    const shape = isEssential
      ? `<div style="width:${size}px;height:${size}px;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.45);clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);"></div>`
      : `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>`;
    return L.divIcon({ className: '', html: shape, iconSize: [size, size], iconAnchor: [size/2, size/2], popupAnchor: [0, -size/2] });
  }

  // Point markers (skip hikes that have a routed path, those render as lines below)
  locations.forEach(loc => {
    const cat = categories[loc.category];
    if (!cat) return;
    if (loc.category === 'hikes' && loc.route_id && hikeRoutes[loc.route_id]) return;
    const isEssential = loc.category === 'essentials';
    const marker = L.marker([loc.lat, loc.lng], { icon: makeIcon(cat.color, isEssential) });
    const areaLine = loc.area ? `<div class="meta">${loc.area}</div>` : '';
    const noteLine = loc.note ? `<div>${loc.note}</div>` : '';
    marker.bindPopup(`<h3>${cat.icon} ${loc.name}</h3>${areaLine}${noteLine}`);
    marker.addTo(map);
    (markersByCat[loc.category] = markersByCat[loc.category] || []).push(marker);
    markerByLocId[loc.id] = marker;
  });

  // Hike routes as polylines
  const hikeLines = [];
  locations.filter(l => l.category === 'hikes' && l.route_id && hikeRoutes[l.route_id]).forEach(loc => {
    const route = hikeRoutes[loc.route_id];
    const cat = categories.hikes;
    const line = L.polyline(route.path, { color: cat.color, weight: 4, opacity: 0.85 });
    const noteLine = loc.note ? `<div>${loc.note}</div>` : '';
    line.bindPopup(`<h3>${cat.icon} ${loc.name}</h3>${noteLine}`);
    line.addTo(map);
    hikeLines.push({ line, loc });
    (markersByCat['hikes'] = markersByCat['hikes'] || []).push(line);
    markerByLocId[loc.id] = line;
  });

  // WW2 railway/perimeter route lines (from the original 2016 map, not tied to a POI card)
  const wwLines = wwRoutes.map(r => {
    const line = L.polyline(r.path, { color: '#54565F', weight: 3, opacity: 0.5, dashArray: '6 4' });
    line.bindPopup(`<h3>${r.name}</h3><div>${r.description || ''}</div>`);
    line.addTo(map);
    return line;
  });
  markersByCat['ww2'] = (markersByCat['ww2'] || []).concat(wwLines);

  // --- Filter chips (multi-select, always visible) ---
  const bar = document.getElementById('filterBar');
  const chipByCat = {};
  Object.entries(categories).forEach(([key, cat]) => {
    const chip = document.createElement('div');
    chip.className = 'filter-chip';
    chip.innerHTML = `<span class="dot" style="background:${cat.color}"></span>${cat.icon} ${cat.label}`;
    chip.addEventListener('click', () => {
      if (activeCats.has(key)) {
        activeCats.delete(key);
        chip.classList.add('off');
      } else {
        activeCats.add(key);
        chip.classList.remove('off');
      }
      applyFilter();
    });
    chipByCat[key] = chip;
    bar.appendChild(chip);
  });

  function applyFilter() {
    Object.entries(markersByCat).forEach(([key, layers]) => {
      const show = activeCats.has(key);
      layers.forEach(l => {
        if (show) { if (!map.hasLayer(l)) l.addTo(map); }
        else { if (map.hasLayer(l)) map.removeLayer(l); }
      });
    });
    renderList();
  }

  // --- List below map, synced to active filters ---
  const listEl = document.getElementById('list');

  function detailRows(loc) {
    const rows = [];
    if (loc.cuisine) rows.push(['Cuisine', loc.cuisine]);
    if (loc.type) rows.push(['Type', loc.type]);
    if (loc.subcategory) rows.push(['Maintained by', loc.subcategory]);
    if (loc.hours) rows.push(['Opening times', loc.hours]);
    if (loc.parking) rows.push(['Nearest parking', loc.parking]);
    if (loc.booking) rows.push(['Booking', loc.booking]);
    if (loc.contact) rows.push(['Contact', loc.contact]);
    if (!rows.length) return '';
    return `<dl class="details">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  }

  function card(loc) {
    const cat = categories[loc.category];
    const div = document.createElement('div');
    div.className = 'poi-card';
    div.style.borderLeftColor = cat.color;
    div.id = `poi-${loc.id}`;
    div.innerHTML = `
      <h3>${loc.name}<span class="area">${loc.area || ''}</span></h3>
      ${loc.note ? `<p class="note">${loc.note}</p>` : ''}
      ${detailRows(loc)}
      <a class="map-link" href="#">Show on map →</a>
    `;
    div.querySelector('.map-link').addEventListener('click', (e) => {
      e.preventDefault();
      focusLocation(loc);
    });
    return div;
  }

  const openCats = new Set(); // which category accordions are expanded, preserved across re-renders

  function renderList() {
    listEl.innerHTML = '';
    const active = [...activeCats];
    if (!active.length) {
      listEl.innerHTML = '<p class="empty-state">No categories selected. Tap a badge above to browse.</p>';
      return;
    }
    active.forEach(catKey => {
      const cat = categories[catKey];
      const items = locations.filter(l => l.category === catKey);
      if (!items.length) return;

      const details = document.createElement('details');
      details.className = 'subcat-group';
      details.open = openCats.has(catKey);
      details.addEventListener('toggle', () => {
        if (details.open) openCats.add(catKey); else openCats.delete(catKey);
      });

      const summary = document.createElement('summary');
      summary.innerHTML = `<h2>${cat.icon} ${cat.label}<span class="count">${items.length}</span></h2>`;
      details.appendChild(summary);

      const wrap = document.createElement('div');
      wrap.className = 'poi-list';

      if (catKey === 'ww2') {
        const groups = {};
        items.forEach(loc => {
          const key = loc.subcategory || (loc.free_access ? 'Free / open access' : 'Other');
          (groups[key] = groups[key] || []).push(loc);
        });
        Object.entries(groups).sort((a, b) => b[1].length - a[1].length).forEach(([groupName, groupItems]) => {
          const sub = document.createElement('div');
          sub.innerHTML = `<h2 style="font-size:0.78rem;margin-top:14px;">${groupName} (${groupItems.length})</h2>`;
          wrap.appendChild(sub);
          groupItems.forEach(loc => wrap.appendChild(card(loc)));
        });
      } else {
        items.forEach(loc => wrap.appendChild(card(loc)));
      }
      details.appendChild(wrap);
      listEl.appendChild(details);
    });
  }

  function focusLocation(loc) {
    if (!openCats.has(loc.category)) {
      openCats.add(loc.category);
      renderList();
    }
    map.setView([loc.lat, loc.lng], 16, { animate: true });
    window.scrollTo({ top: document.getElementById('map').offsetTop - 8, behavior: 'smooth' });
    const layer = markerByLocId[loc.id];
    if (layer) setTimeout(() => layer.openPopup(loc.lat ? [loc.lat, loc.lng] : undefined), 350);
  }

  applyFilter();

  // Deep link support: index.html?focus=<id>
  const focusId = qs('focus');
  if (focusId) {
    const loc = locations.find(l => l.id === focusId);
    if (loc) focusLocation(loc);
  }
})();
