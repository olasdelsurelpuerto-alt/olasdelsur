// ── YouTube Iframe API Setup ──
var tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
document.head.appendChild(tag);

var atmPlayer;
var videoHasStarted = false;

function onYouTubeIframeAPIReady() {
    atmPlayer = new YT.Player('atmYTPlayer', {
        videoId: '-zQbS5or5-k',
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
            controls: 0, rel: 0, modestbranding: 1,
            iv_load_policy: 3, playsinline: 1,
            autoplay: 0, disablekb: 1, fs: 0,
            showinfo: 0
        },
        events: {
            onReady: function(e) {
                e.target.setPlaybackQuality('hd1080');
                e.target.mute();
            },
            onStateChange: function(e) {
                var startOverlay = document.getElementById('videoOverlay');
                var endOverlay = document.getElementById('videoEndOverlay');
                
                if (e.data === YT.PlayerState.PLAYING && videoHasStarted) {
                    // Fade out the start overlay after 4s
                    setTimeout(function() {
                        if (startOverlay) startOverlay.classList.add('hidden');
                    }, 4000);

                    // Poll for the end of the video to show end overlay 1s early
                    var checkEndInterval = setInterval(function() {
                        var currentTime = e.target.getCurrentTime();
                        var duration = e.target.getDuration();
                        if (duration > 0 && (duration - currentTime) <= 1.2) { // 1.2s to ensure it's visible before black
                            if (endOverlay) endOverlay.classList.add('visible');
                            clearInterval(checkEndInterval);
                        }
                    }, 200);
                }
            }
        }
    });
}

function startCinematicVideo() {
    if (videoHasStarted) return; // Block restart
    videoHasStarted = true;
    
    // Show the shield to block all clicks
    var shield = document.getElementById('videoShield');
    if (shield) shield.classList.add('active');
    
    if (atmPlayer && atmPlayer.playVideo) {
        atmPlayer.unMute();
        atmPlayer.setVolume(100);
        atmPlayer.playVideo();
    }
}

function startAtmosphereAudioOnce(btn) {
    startCinematicVideo();
    if (btn) btn.classList.add('fading');
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
    if (_revealed || !map) return;
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
    try {
        map.addLayer({
            id: 'sky', type: 'sky',
            paint: { 'sky-type': 'atmosphere', 'sky-atmosphere-sun': [0.0, 60.0], 'sky-atmosphere-sun-intensity': 10 }
        });
    } catch(e) { console.warn('Sky:', e.message); }

    try {
        map.setFog({
            range: [0.8, 8], color: 'rgba(200,220,240,0.9)', 'horizon-blend': 0.06,
            'high-color': '#b8d4f0', 'space-color': '#0A0E27', 'star-intensity': 0.15
        });
    } catch(e) { console.warn('Fog:', e.message); }

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
    if (btn) { btn.textContent = _mapDark ? '☀️' : '🌙'; btn.style.background = _mapDark ? '#1a1a2e' : 'white'; }
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

    map.addControl(new maplibregl.NavigationControl(), 'top-left');
    map.addControl(new DarkModeControl(), 'top-left');

    ['mousedown', 'touchstart', 'wheel', 'dragstart'].forEach(evt => map.on(evt, stopAutoRotate));

    map.on('load', () => {
        _mapLoaded = true;
        applyStyleLayers();
        renderMarkers();
        initCardClicks();
        injectDistances();
        if (_mapVisible) startPanoramicFly();
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
    const inner = document.createElement('div');
    inner.innerHTML = emoji;
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
        const popup = new maplibregl.Popup({ offset: [0, isHome ? -28 : -22], maxWidth: '230px' });
        popup.on('open', () => popup.setHTML(renderPopup(p)));
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([p.lng, p.lat]).setPopup(popup).addTo(map);
        mapMarkers[p.id] = { marker, place: p };
        el.addEventListener('click', () => {
            stopAutoRotate();
            map.flyTo({ center: [p.lng, p.lat], zoom: 16, pitch: 60, duration: 2000 });
            highlightCard(p.id);
        });
    });
}

function renderPopup(p) {
    const lang = window._olasLang || 'es';
    
    // Find more complete data in poiData
    const pData = typeof poiData !== 'undefined' ? poiData.find(x => x.id === p.id) : null;
    
    // Title translation
    let title = p.title;
    if (pData) {
        title = pData['name_' + lang] || pData.name || p.title;
    }

    // Description translation
    let desc = p.desc;
    if (pData) {
        desc = pData['desc_' + lang] || pData.desc_es || p.desc;
    } else {
        desc = p['desc_' + lang] || p.desc;
    }
    
    const btnLabels = {
        es: "🚶 Cómo llegar",
        en: "🚶 Directions",
        fr: "🚶 Itinéraire",
        de: "🚶 Wegbeschreibung",
        it: "🚶 Come arrivarci"
    };
    const scheduleLabels = {
        es: "🕐 Ver horarios",
        en: "🕐 Timetable",
        fr: "🕐 Horaires",
        de: "🕐 Fahrplan",
        it: "🕐 Orari"
    };
    const label = btnLabels[lang] || btnLabels.es;
    const mapsLink = `https://www.google.com/maps/dir/?api=1&origin=36.588769,-6.231999&destination=${p.lat},${p.lng}&travelmode=walking`;
    const btnStyle = `display:inline-block;color:white;padding:5px 12px;border-radius:20px;text-decoration:none;font-weight:bold;font-size:0.78rem;`;
    const scheduleBtn = p.id === 'catamaran' ? `<a href="https://www.google.com/maps/place/Terminal+Mar%C3%ADtima+El+Puerto/@36.5936483,-6.2268356,18z/data=!4m8!3m7!1s0xd0dcfc34903c125:0xc5cfcba5b149cff2!6m1!1v9!8m2!3d36.593778!4d-6.226493!16s%2Fg%2F11fqscvq1h" target="_blank" style="${btnStyle}background:#1D4ED8;">${scheduleLabels[lang] || scheduleLabels.es}</a>` : '';
    const btnHtml = p.id === 'home' ? '' : `<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;"><a href="${mapsLink}" target="_blank" style="${btnStyle}background:var(--coral, #E8501A);">${label}</a>${scheduleBtn}</div>`;

    let walkHtml = '';
    if (p.id !== 'home') {
        const walkLabels = { es: 'a pie', en: 'walk', fr: 'à pied', de: 'zu Fuß', it: 'a piedi' };
        const walk = calcWalk(p.lat, p.lng);
        walkHtml = `<style>@keyframes wfade{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}</style><div style="display:inline-flex;align-items:center;gap:5px;margin:4px 0 8px;padding:3px 10px;border-radius:20px;background:rgba(232,80,26,0.1);border:1px solid rgba(232,80,26,0.25);animation:wfade 0.5s ease;"><span style="font-size:0.8rem;">🚶</span><span style="font-size:0.8rem;font-weight:700;color:#E8501A;">${walk.mins} min</span><span style="font-size:0.75rem;color:#888;">· ${walk.distStr} ${walkLabels[lang] || 'walk'}</span></div>`;
    }

    return `<div style="font-family:sans-serif;padding:2px 18px 2px 2px"><strong style="font-size:0.88rem;line-height:1.2;display:block;margin-bottom:2px;">${title}</strong>${walkHtml}<div style="font-size:0.78rem;line-height:1.3;color:#333;">${desc}</div>${btnHtml}</div>`;
}

function highlightCard(id) {
    document.querySelectorAll('.poi-card').forEach(c => c.classList.remove('active'));
    const card = document.getElementById('card-' + id);
    if (card) {
        card.classList.add('active');
        card.scrollIntoView({ behavior:'smooth', block:'nearest' });
    }
}

function initCardClicks() {
    document.querySelectorAll('.poi-card').forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
            const id = card.id.replace('card-', '');
            const item = mapMarkers[id];
            if (!item) return;
            const { marker, place } = item;
            // Close any open popup first
            Object.values(mapMarkers).forEach(m => {
                if (m.marker.getPopup().isOpen()) m.marker.togglePopup();
            });
            highlightCard(id);
            map.flyTo({ center: [place.lng, place.lat], zoom: Math.max(map.getZoom(), 15), duration: 700, essential: true });
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

// ── POI Explorer ──
function renderPoiChips(filter) {
    const lang = window._olasLang || 'es';
    const container = document.getElementById('poiChips');
    if (!container) return;
    const filtered = filter === 'all' ? poiData : poiData.filter(p => p.cat === filter);
    container.innerHTML = filtered.map(p => `
      <div class="poi-chip" data-id="${p.id}" onclick="showPoiDetail('${p.id}')">
        <span class="poi-chip-emoji">${p.emoji}</span>
        <div class="poi-chip-info">
          <div class="poi-chip-name">${p.name}</div>
          <div class="poi-chip-cat" style="color:${catColors[p.cat]||'#888'}">${p['badge_'+lang]||p.badge_es}</div>
        </div>
      </div>
    `).join('');
}

function showPoiDetail(id) {
    window._currentPoiId = id;
    const lang = window._olasLang || 'es';
    const p = poiData.find(x => x.id === id);
    if (!p) return;
    
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
        <h3 class="poi-detail-name">${p.name}</h3>
        <span class="poi-detail-cat-badge">${p['badge_'+lang]||p.badge_es}</span>
      </div>
      <div class="poi-detail-body">
        <p class="poi-detail-desc">${p['desc_'+lang]||p.desc_es||''}</p>
        <div class="poi-detail-info">
    `;
    
    if (p.address) {
        html += `<div class="poi-detail-row"><span class="poi-detail-row-icon">📍</span><div class="poi-detail-row-text">${p.address}</div></div>`;
    }
    if (p.hours_es) {
        html += `<div class="poi-detail-row"><span class="poi-detail-row-icon">🕒</span><div class="poi-detail-row-text">${p['hours_'+lang]||p.hours_es}</div></div>`;
    }
    if (p.phone) {
        html += `<div class="poi-detail-row"><span class="poi-detail-row-icon">📞</span><div class="poi-detail-row-text"><a href="tel:${p.phone.replace(/\s+/g,'')}">${p.phone}</a></div></div>`;
    }
    if (p.www) {
        html += `<div class="poi-detail-row"><span class="poi-detail-row-icon">🌐</span><div class="poi-detail-row-text"><a href="${p.www}" target="_blank" style="color:var(--coral);text-decoration:none;font-weight:600;">${t.website}</a></div></div>`;
    }
    if (p.tips_es) {
        html += `<div class="poi-detail-row" style="margin-top:8px;"><span class="poi-detail-row-icon">💡</span><div class="poi-detail-row-text"><strong>${t.tip}</strong> ${p['tips_'+lang]||p.tips_es}</div></div>`;
    }
    
    html += `</div>`; // close poi-detail-info
    
    // Add Google Maps Route Button
    const place = places.find(x => x.id === id);
    if (place && place.lat && place.lng) {
        const routeUrl = `https://www.google.com/maps/dir/?api=1&origin=36.588769,-6.231999&destination=${place.lat},${place.lng}&travelmode=walking`;
        html += `
        <div class="poi-detail-actions" style="margin-top: 20px;">
          <a href="${routeUrl}" target="_blank" class="poi-btn-primary" style="display:inline-block; padding:12px 24px; background:var(--coral); color:#fff; border-radius:12px; text-decoration:none; font-weight:700;">${t.howToGet}</a>
        </div>
        `;
    }
    
    html += `</div>`; // close poi-detail-body
    content.innerHTML = html;
}

// ── Language ──
function setLang(lang) {
    document.documentElement.lang = lang;
    document.documentElement.className = 'lang-' + lang;
    window._olasLang = lang;
    
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
        });
    });
    
    // Add listeners for POI category tabs
    document.querySelectorAll('.poi-cat-tab').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.poi-cat-tab').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const filter = this.getAttribute('data-filter');
            renderPoiChips(filter);
        });
    });
});

// Flicker effect
(function() {
    var el = document.getElementById('heroFlicker');
    if (!el) return;
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
