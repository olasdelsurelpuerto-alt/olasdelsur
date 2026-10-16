// Load YouTube only after a visitor chooses to play it.
let atmPlayer;
let videoHasStarted = false;
const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function onYouTubeIframeAPIReady() {
    atmPlayer = new YT.Player('atmYTPlayer', {
        videoId: '-zQbS5or5-k', host: 'https://www.youtube-nocookie.com',
        playerVars: { controls: 1, cc_load_policy: 1, rel: 0, playsinline: 1, autoplay: 0 },
        events: { onReady: event => { if (videoHasStarted) event.target.playVideo(); } }
    });
}

function startCinematicVideo() {
    if (window._inAppBrowser) return;
    videoHasStarted = true;
    document.getElementById('videoOverlay')?.classList.add('hidden');
    if (atmPlayer) { atmPlayer.playVideo(); return; }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
}

function startAtmosphereAudioOnce(btn) {
    startCinematicVideo();
    if (btn) btn.classList.add('fading');
    if (typeof umami !== 'undefined') umami.track('click-play-atmosphere-video');
}

// ── Map Setup (MapLibre GL 3D) ──
let map;
const mapMarkers = {};
let _autoRotate = false, _bearing = 0, _rotateRAF = null;
let _mapLoaded = false, _mapVisible = false, _revealed = false;
let _mapDark = false, _flyoverActive = false;

const FLYOVER_STOPS = [
    { center: [-6.2450, 36.5780], zoom: 12.5, pitch: 45, bearing: -10, duration: 4000 }, // panoramica città
    { center: [-6.2552, 36.5803], zoom: 14,   pitch: 55, bearing:  35, duration: 4500 }, // Puerto Sherry marina
    { center: [-6.2253, 36.5737], zoom: 14,   pitch: 55, bearing: -40, duration: 4500 }, // Playa Valdelagrana
    { center: [-6.2270, 36.5965], zoom: 15,   pitch: 50, bearing:  20, duration: 4000 }, // centro storico
    { center: [-6.2320, 36.5885], zoom: 14,   pitch: 45, bearing:   0, duration: 3500 }, // home — fine tour
];

const MAP_STYLES = {
    light: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    dark:  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
};
const HOME = { lat: 36.588769, lng: -6.231999 };

function calcWalk(lat, lng) {
    const R = 6371000;
    const dLat = (lat - HOME.lat) * Math.PI / 180;
    const dLng = (lng - HOME.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(HOME.lat * Math.PI/180) * Math.cos(lat * Math.PI/180) * Math.sin(dLng/2)**2;
    const d = Math.round(R * 2 * Math.asin(Math.sqrt(a)));
    const mins = Math.max(1, Math.round(d / 83));
    return { m: d, mins, distStr: d < 1000 ? d + ' m' : (d / 1000).toFixed(1) + ' km' };
}

function startAutoRotate() {
    _autoRotate = true;
    (function tick() {
        if (!_autoRotate || !map) return;
        _bearing = (_bearing + 0.04) % 360;
        map.setBearing(_bearing);
        _rotateRAF = requestAnimationFrame(tick);
    })();
}

function stopAutoRotate() {
    _autoRotate = false;
    if (_flyoverActive) {
        _flyoverActive = false;
        map.stop();
    }
    if (_rotateRAF) { cancelAnimationFrame(_rotateRAF); _rotateRAF = null; }
    if (map) _bearing = map.getBearing();
}

function startPanoramicFly() {
    if (_revealed || !map || prefersReducedMotion) return;
    _revealed = true;
    _flyoverActive = true;
    let step = 0;

    function flyNext() {
        if (!_flyoverActive || step >= FLYOVER_STOPS.length) {
            _flyoverActive = false;
            // tour completato — mappa ferma, nessuna rotazione automatica
            return;
        }
        map.flyTo({ ...FLYOVER_STOPS[step++], essential: true });
        map.once('moveend', flyNext);
    }

    flyNext();
}

function applyStyleLayers() {
    enhanceMapColors();
}

function enhanceMapColors() {
    const style = map.getStyle();
    if (!style?.layers) return;

    const waterFill = _mapDark ? '#0a3550' : '#1fbccc';
    const waterLine = _mapDark ? '#0a3550' : '#18a8c0';
    const beachFill = _mapDark ? '#7a6535' : '#f2ce60';

    style.layers.forEach(l => {
        const sl = l['source-layer'];
        if (!sl) return;
        try {
            // Sea, lakes, Guadalete river polygons
            if (sl === 'water' && l.type === 'fill') {
                map.setPaintProperty(l.id, 'fill-color', waterFill);
            }
            // Waterway lines (rivers, canals)
            if (sl === 'waterway' && l.type === 'line') {
                map.setPaintProperty(l.id, 'line-color', waterLine);
            }
            // Beach / sand areas (OpenMapTiles: landcover class=sand)
            if ((sl === 'landcover' || sl === 'landuse') && l.type === 'fill') {
                const filterStr = JSON.stringify(l.filter || '');
                if (filterStr.includes('sand') || filterStr.includes('beach') ||
                    l.id.toLowerCase().includes('sand') || l.id.toLowerCase().includes('beach')) {
                    map.setPaintProperty(l.id, 'fill-color', beachFill);
                    map.setPaintProperty(l.id, 'fill-opacity', 0.85);
                }
            }
        } catch(e) { /* layer might not accept this property */ }
    });
}

class DarkModeControl {
    onAdd(m) {
        this._container = document.createElement('div');
        this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
        const btn = document.createElement('button');
        btn.id = 'map-darkmode-btn';
        btn.title = 'Mappa scura / Dark map';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Attiva mappa scura / Toggle dark map');
        btn.textContent = '🌙';
        btn.style.cssText = 'font-size:15px;width:29px;height:29px;cursor:pointer;background:white;border:none;line-height:1;';
        btn.onclick = toggleMapStyle;
        this._container.appendChild(btn);
        return this._container;
    }
    onRemove() { this._container.parentNode?.removeChild(this._container); }
}

function toggleMapStyle() {
    _mapDark = !_mapDark;
    const btn = document.getElementById('map-darkmode-btn');
    if (btn) { btn.textContent = _mapDark ? '☀️' : '🌙'; btn.style.background = _mapDark ? '#1a1a2e' : 'white'; btn.setAttribute('aria-label', _mapDark ? 'Attiva mappa chiara / Toggle light map' : 'Attiva mappa scura / Toggle dark map'); }
    document.querySelector('.map-section')?.classList.toggle('dark-map', _mapDark);
    map.setStyle(_mapDark ? MAP_STYLES.dark : MAP_STYLES.light);
}

function injectDistances() {
    if (typeof places === 'undefined') return;
    places.forEach(p => {
        if (p.id === 'home') return;
        const card = document.getElementById('card-' + p.id);
        if (!card) return;
        const walk = calcWalk(p.lat, p.lng);
        let badge = card.querySelector('.poi-walk');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'poi-walk';
            const info = card.querySelector('.poi-info');
            if (info) info.appendChild(badge);
        }
        badge.textContent = `🚶 ${walk.mins} min · ${walk.distStr}`;
    });
}

function initMap() {
    const mapEl = document.getElementById('map');
    if (!mapEl || typeof maplibregl === 'undefined') return;

    map = new maplibregl.Map({
        container: 'map',
        style: MAP_STYLES.light,
        center: [-6.2320, 36.5885],
        zoom: 14,
        pitch: 0,
        bearing: 0
    });

    map.on('error', () => { if (!navigator.onLine) document.getElementById('map-offline').hidden = false; });
    window.addEventListener('offline', () => { document.getElementById('map-offline').hidden = false; });
    window.addEventListener('online', () => { document.getElementById('map-offline').hidden = true; });
    map.addControl(new maplibregl.NavigationControl(), 'top-left');
    map.addControl(new DarkModeControl(), 'top-left');

    ['mousedown', 'touchstart', 'wheel', 'dragstart'].forEach(evt => map.on(evt, stopAutoRotate));

    map.on('load', () => {
        _mapLoaded = true;
        applyStyleLayers();
        renderMarkers();
        injectDistances();
        if (_mapVisible && !prefersReducedMotion) startPanoramicFly();
    });

    // Re-apply custom layers after every style change (dark/light toggle)
    map.on('style.load', () => {
        if (_mapLoaded) applyStyleLayers();
    });

    // Home pulse ring
    const pulseEl = document.createElement('div');
    pulseEl.style.cssText = 'width:30px;height:30px;border-radius:50%;border:3px solid #E8501A;background:rgba(232,80,26,0.15);animation:pulseRing 2s infinite;';
    new maplibregl.Marker({ element: pulseEl, anchor: 'center' })
        .setLngLat([-6.231999, 36.588769]).addTo(map);

    const styleEl = document.createElement('style');
    styleEl.textContent = '@keyframes pulseRing{0%{transform:scale(1);opacity:1}100%{transform:scale(4);opacity:0}}';
    document.head.appendChild(styleEl);

    // IntersectionObserver: pitch reveal on scroll
    const mapSection = document.querySelector('.map-section') || mapEl;
    if ('IntersectionObserver' in window) {
        const obs = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting && !_mapVisible) {
                    _mapVisible = true;
                    if (_mapLoaded) startPanoramicFly();
                    obs.unobserve(mapSection);
                }
            });
        }, { threshold: 0.25 });
        obs.observe(mapSection);
    } else {
        _mapVisible = true;
    }
}

function makeMarkerEl(emoji, color, isHome) {
    const s = isHome ? 50 : 38, fs = isHome ? 22 : 16;
    // el is the outer wrapper — MapLibre controls its transform for geo-positioning
    // Never set transform on el directly or MapLibre's translate gets overwritten
    const el = document.createElement('div');
    el.style.cssText = `line-height:0;${isHome ? 'z-index:9999;' : ''}`;

    // inner is the visual circle — safe to animate independently
    const inner = document.createElement('button');
    inner.type = 'button';
    inner.textContent = emoji;
    inner.style.cssText = `width:${s}px;height:${s}px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:${fs}px;border:2px solid white;box-shadow:0 0 14px ${color};cursor:pointer;transition:transform 0.15s;`;
    inner.addEventListener('mouseenter', () => { inner.style.transform = 'scale(1.15)'; });
    inner.addEventListener('mouseleave', () => { inner.style.transform = ''; });

    el.appendChild(inner);
    return el;
}

function renderMarkers() {
    if (typeof places === 'undefined') return;
    places.forEach(p => {
        const isHome = p.category === 'home';
        const color = categoryColors[p.category] || '#08D9D6';
        const el = makeMarkerEl(p.icon, color, isHome);
        el.querySelector('button').setAttribute('aria-label', (p['name_' + (window._olasLang || 'es')] || p.title) + ' — abrir lugar / open place');
        const popup = new maplibregl.Popup({ offset: [0, isHome ? -28 : -22], maxWidth: '230px' });
        popup.on('open', () => popup.setDOMContent(renderPopup(p)));
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([p.lng, p.lat]).setPopup(popup).addTo(map);
        mapMarkers[p.id] = { marker, place: p };
        el.addEventListener('click', () => {
            if (typeof umami !== 'undefined') {
                umami.track('click-map-marker', { poi: p.id, category: p.category });
            }
            stopAutoRotate();
            map.flyTo({ center: [p.lng, p.lat], zoom: 16, pitch: prefersReducedMotion ? 0 : 60, duration: prefersReducedMotion ? 0 : 2000 });
            highlightCard(p.id);
        });
    });
}

function renderPopup(p) {
    const lang = window._olasLang || 'es';
    const record = poiData.find(x => x.id === p.id) || p;
    const title = record['name_' + lang] || record.name || p.title;
    const desc = record['desc_' + lang] || record.desc_es || '';
    const el = document.createElement('div');
    el.className = 'map-popup';
    const heading = document.createElement('strong');
    heading.textContent = title;
    el.appendChild(heading);
    if (p.id !== 'home') {
        const walk = calcWalk(p.lat, p.lng);
        const distance = document.createElement('div');
        distance.className = 'popup-distance';
        distance.textContent = `🚶 ${walk.mins} min · ${walk.distStr}`;
        el.appendChild(distance);
    }
    const description = document.createElement('p');
    description.textContent = desc;
    el.appendChild(description);
    if (p.id !== 'home') {
        const actions = document.createElement('div');
        actions.className = 'popup-actions';
        const route = document.createElement('a');
        route.href = `https://www.google.com/maps/dir/?api=1&origin=36.588769,-6.231999&destination=${p.lat},${p.lng}&travelmode=walking`;
        route.target = '_blank'; route.rel = 'noopener noreferrer';
        route.textContent = ({es:'🚶 Cómo llegar',en:'🚶 Directions',fr:'🚶 Itinéraire',de:'🚶 Wegbeschreibung',it:'🚶 Come arrivarci'})[lang];
        actions.appendChild(route);
        if (p.id === 'catamaran') {
            const schedule = document.createElement('a');
            schedule.href = 'https://siu.cmtbc.es/es/horarios_lineas_tabla.php?linea=15';
            schedule.target = '_blank'; schedule.rel = 'noopener noreferrer';
            schedule.textContent = ({es:'🕐 Ver horarios',en:'🕐 Timetable',fr:'🕐 Horaires',de:'🕐 Fahrplan',it:'🕐 Orari'})[lang];
            actions.appendChild(schedule);
        }
        el.appendChild(actions);
    }
    return el;
}

function highlightCard(id) {
    document.querySelectorAll('.poi-card').forEach(c => c.classList.remove('active'));
    const card = document.getElementById('card-' + id);
    if (card) {
        card.classList.add('active');
        card.scrollIntoView({ behavior: prefersReducedMotion ? 'instant' : 'smooth', block:'nearest' });
    }
}

function initCardClicks() {
    document.querySelectorAll('.poi-card').forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
            const id = card.id.replace('card-', '');
            if (typeof umami !== 'undefined') {
                umami.track('click-poi-card', { poi: id });
            }
            const item = mapMarkers[id];
            if (!item) return;
            const { marker, place } = item;
            Object.values(mapMarkers).forEach(m => {
                if (m.marker.getPopup().isOpen()) m.marker.togglePopup();
            });
            highlightCard(id);
            map.flyTo({ center: [place.lng, place.lat], zoom: Math.max(map.getZoom(), 15), duration: prefersReducedMotion ? 0 : 700, essential: !prefersReducedMotion });
            setTimeout(() => { if (!marker.getPopup().isOpen()) marker.togglePopup(); }, 500);
        });
    });
}

function filterMapMarkers(cat) {
    // Filter MapLibre markers by toggling element visibility
    for (const id in mapMarkers) {
        const item = mapMarkers[id];
        const visible = cat === 'all' || item.place.category === cat || item.place.category === 'home';
        const el = item.marker.getElement();
        if (el) el.style.display = visible ? '' : 'none';
    }

    // Filter sidebar cards
    document.querySelectorAll('.poi-card').forEach(card => {
        if (cat === 'all') {
            card.style.display = 'flex';
        } else {
            const placeId = card.id.replace('card-', '');
            const place = places.find(x => x.id === placeId);
            card.style.display = (place && (place.category === cat || (placeId === 'home' && cat === 'home'))) ? 'flex' : 'none';
        }
    });
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function safeExternalUrl(value) {
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? escapeHtml(url.href) : '#'; }
    catch { return '#'; }
}

// ── POI Explorer ──
function renderPoiChips(filter) {
    const lang = window._olasLang || 'es';
    const container = document.getElementById('poiChips');
    if (!container) return;
    const filtered = filter === 'all' ? poiData : poiData.filter(p => p.cat === filter);
    container.replaceChildren(...filtered.map(p => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'poi-chip'; button.dataset.id = p.id;
        const emoji = document.createElement('span'); emoji.className = 'poi-chip-emoji'; emoji.textContent = p.emoji;
        const info = document.createElement('span'); info.className = 'poi-chip-info';
        const name = document.createElement('span'); name.className = 'poi-chip-name'; name.textContent = p['name_' + lang] || p.name;
        const category = document.createElement('span'); category.className = 'poi-chip-cat'; category.style.color = catColors[p.cat] || '#888'; category.textContent = p['badge_' + lang] || p.badge_es;
        info.append(name, category); button.append(emoji, info);
        button.addEventListener('click', () => showPoiDetail(p.id));
        return button;
    }));
}

function showPoiDetail(id) {
    window._currentPoiId = id;
    const lang = window._olasLang || 'es';
    const p = poiData.find(x => x.id === id);
    if (!p) return;
    
    // Track POI detail view
    if (typeof umami !== 'undefined') {
        umami.track('click-poi-explorer-chip', { poi: id, category: p.cat });
    }
    
    // Highlight the clicked chip
    document.querySelectorAll('.poi-chip').forEach(c => c.classList.remove('active'));
    const chip = document.querySelector(`.poi-chip[data-id="${id}"]`);
    if (chip) chip.classList.add('active');
    
    const content = document.getElementById('poiDetailContent');
    if (!content) return;
    
    document.getElementById('poiDefaultMsg').style.display = 'none';
    content.style.display = 'block';
    
    const labels = {
      es: { website: "Sitio Web / Info", tip: "Tip:", howToGet: "🚶‍♀️ Cómo llegar" },
      en: { website: "Website / Info", tip: "Tip:", howToGet: "🚶‍♀️ How to get there" },
      fr: { website: "Site Web / Info", tip: "Astuce:", howToGet: "🚶‍♀️ Comment s'y rendre" },
      de: { website: "Website / Info", tip: "Tipp:", howToGet: "🚶‍♀️ Wegbeschreibung" },
      it: { website: "Sito Web / Info", tip: "Suggerimento:", howToGet: "🚶‍♀️ Come arrivarci" }
    };
    const t = labels[lang] || labels['es'];
    
    let html = `
      <div class="poi-detail-header">
        <span class="poi-detail-emoji">${p.emoji}</span>
        <h3 class="poi-detail-name"></h3>
        <span class="poi-detail-cat-badge"></span>
      </div>
      <div class="poi-detail-body">
        <p class="poi-detail-desc"></p>
        <div class="poi-detail-info">
    `;
    
    if (p.address) {
        html += `<div class="poi-detail-row"><span class="poi-detail-row-icon">📍</span><div class="poi-detail-row-text">${escapeHtml(p.address)}</div></div>`;
    }
    if (p.hours_es) {
        html += `<div class="poi-detail-row"><span class="poi-detail-row-icon">🕒</span><div class="poi-detail-row-text">${escapeHtml(p['hours_'+lang]||p.hours_es)}</div></div>`;
    }
    if (p.phone) {
        html += `<div class="poi-detail-row"><span class="poi-detail-row-icon">📞</span><div class="poi-detail-row-text"><a href="tel:${p.phone.replace(/[^+\d]/g,'')}">${escapeHtml(p.phone)}</a></div></div>`;
    }
    if (p.whatsapp) {
        html += `<div class="poi-detail-row"><span class="poi-detail-row-icon">💬</span><div class="poi-detail-row-text"><a href="https://wa.me/${p.whatsapp.replace(/[^\d]/g,'')}" target="_blank" rel="noopener noreferrer">WhatsApp</a></div></div>`;
    }
    if (p.www || p.link) {
        html += `<div class="poi-detail-row"><span class="poi-detail-row-icon">🌐</span><div class="poi-detail-row-text"><a href="${safeExternalUrl(p.www || p.link)}" target="_blank" rel="noopener noreferrer" style="color:var(--coral);text-decoration:none;font-weight:600;">${t.website}</a></div></div>`;
    }
    if (p.tips_es) {
        html += `<div class="poi-detail-row" style="margin-top:8px;"><span class="poi-detail-row-icon">💡</span><div class="poi-detail-row-text"><strong>${t.tip}</strong> ${escapeHtml(p['tips_'+lang]||p.tips_es)}</div></div>`;
    }
    
    html += `</div>`; // close poi-detail-info
    
    // Add Google Maps Route Button
    const place = places.find(x => x.id === id);
    if (place && place.lat && place.lng) {
        const routeUrl = `https://www.google.com/maps/dir/?api=1&origin=36.588769,-6.231999&destination=${place.lat},${place.lng}&travelmode=walking`;
        html += `
        <div class="poi-detail-actions" style="margin-top: 20px;">
          <a href="${routeUrl}" target="_blank" rel="noopener noreferrer" class="poi-btn-primary" style="display:inline-block; padding:12px 24px; background:var(--coral); color:#fff; border-radius:12px; text-decoration:none; font-weight:700;">${t.howToGet}</a>
        </div>
        `;
    }
    
    html += `</div>`; // close poi-detail-body
    content.innerHTML = html;
    content.querySelector('.poi-detail-name').textContent = p['name_' + lang] || p.name;
    content.querySelector('.poi-detail-cat-badge').textContent = p['badge_' + lang] || p.badge_es;
    content.querySelector('.poi-detail-desc').textContent = p['desc_' + lang] || p.desc_es || '';
}

// ── Language ──
function setLang(lang) {
    document.documentElement.lang = lang;
    document.documentElement.className = 'lang-' + lang;
    window._olasLang = lang;

    if (typeof umami !== 'undefined') {
        umami.track('click-change-language', { lang: lang });
    }
    
    // Update active lang button
    document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById('btn-' + lang);
    if (activeBtn) activeBtn.classList.add('active');
    
    // Update active tab filter
    const activeTab = document.querySelector('.poi-cat-tab.active');
    const filter = activeTab ? activeTab.getAttribute('data-filter') : 'all';
    renderPoiChips(filter);
    
    // Update active detail panel
    if (window._currentPoiId) {
        showPoiDetail(window._currentPoiId);
    }

}

// ── CTA background alignment ──
// Moves the background image so its center sits precisely behind the boat video.
// Adjust CTA_BG_OFFSET_X (px) if the image's focal point is not at its center.
const CTA_BG_OFFSET_X = 0;

function alignCtaBg() {
    const video   = document.querySelector('.sherry-video-wrapper');
    const section = document.querySelector('.cta-section');
    if (!video || !section) return;
    const vr = video.getBoundingClientRect();
    const sr = section.getBoundingClientRect();
    const centerInSection = (vr.left - sr.left) + vr.width / 2 + CTA_BG_OFFSET_X;
    const xPct = Math.max(0, Math.min(100, (centerInSection / sr.width) * 100));
    section.style.backgroundPositionX = xPct.toFixed(1) + '%';
}

// ── Listeners ──
window.addEventListener('load', () => {
    initCardClicks();
    initMap();
    renderPoiChips('all');
    alignCtaBg();
    window.addEventListener('resize', alignCtaBg);
    
    // Map Filter Buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const cat = this.getAttribute('data-cat');
            filterMapMarkers(cat);
            // Track map category filter
            if (typeof umami !== 'undefined') {
                umami.track('click-map-filter', { category: cat });
            }
        });
    });
    
    // Add listeners for POI category tabs
    document.querySelectorAll('.poi-cat-tab').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.poi-cat-tab').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const filter = this.getAttribute('data-filter');
            renderPoiChips(filter);
            // Track POI explorer tab switch
            if (typeof umami !== 'undefined') {
                umami.track('click-poi-explorer-tab', { filter });
            }
        });
    });
});

// Flicker effect
(function() {
    var el = document.getElementById('heroFlicker');
    if (!el) return;
    if (prefersReducedMotion) return;
    setInterval(() => {
        el.style.opacity = Math.random() > 0.9 ? 0.3 : 0;
    }, 2000);
})();

// ── Intersection Observer for Fade-In Elements ──
document.addEventListener("DOMContentLoaded", () => {
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
});

// Native video controls; defer the lower video until it enters the viewport.
function setupVideos() {
    const boat = document.querySelector('.sherry-video');
    const boatSource = boat?.querySelector('source[data-src]');
    if (boat && boatSource) {
        const loadBoat = () => {
            boatSource.src = boatSource.dataset.src;
            boatSource.removeAttribute('data-src');
            boat.load();
            if (!prefersReducedMotion) boat.play().catch(() => {});
        };
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver(entries => {
                if (entries.some(e => e.isIntersecting)) { loadBoat(); observer.disconnect(); }
            }, { rootMargin: '100px' });
            observer.observe(boat);
        } else loadBoat();
    }
    if (!prefersReducedMotion) document.querySelector('.hero-bg-video')?.play().catch(() => {});
    document.querySelectorAll('.video-toggle').forEach(button => {
        button.addEventListener('click', () => {
            const video = document.querySelector(button.dataset.video);
            if (!video) return;
            if (video.paused) video.play().catch(() => {}); else video.pause();
            button.textContent = video.paused ? '▶' : '⏸';
            button.setAttribute('aria-label', video.paused ? 'Riproduci video / Play video' : 'Pausa video / Pause video');
        });
    });
}
window.addEventListener('load', setupVideos);
