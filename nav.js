function renderHeader(activePage) {
  const tabs = [
    { href: 'index.html', label: 'Map & Places', key: 'map' },
    { href: 'dayout.html', label: 'Day Out', key: 'dayout' },
    { href: 'itinerary.html', label: 'Itinerary', key: 'itinerary' },
  ];
  document.body.insertAdjacentHTML('afterbegin', `
    <header class="app-header">
      <div class="brand">Guernsey Guide<small>3–8 Sept 2026</small></div>
    </header>
    <nav class="tabs">
      ${tabs.map(t => `<a href="${t.href}" class="${t.key === activePage ? 'active' : ''}">${t.label}</a>`).join('')}
    </nav>
  `);
}
