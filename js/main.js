// ── YouTube Iframe API Setup ──
var tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
document.head.appendChild(tag);

var atmPlayer;
function onYouTubeIframeAPIReady() {
    atmPlayer = new YT.Player('atmYTPlayer', {
        videoId: '-zQbS5or5-k',
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
            controls: 1, rel: 0, modestbranding: 1,
            iv_load_policy: 3, playsinline: 1,
            autoplay: 0
        },
        events: {
            onReady: function(e) {
                e.target.setPlaybackQuality('hd1080');
                e.target.mute();
            },
            onStateChange: function(e) {
                const overlay = document.getElementById('videoOverlay');
                if (e.data === YT.PlayerState.PLAYING) {
                    setTimeout(function() {
                        if (overlay) overlay.classList.add('hidden');
                    }, 1500);
                } else if (e.data === YT.PlayerState.ENDED) {
                    if (overlay) {
                        overlay.classList.add('ended');
                        overlay.classList.remove('hidden');
                    }
                }
            }
        }
    });
}

function startCinematicVideo() {
    const overlay = document.getElementById('videoOverlay');
    if (overlay) overlay.classList.remove('ended');
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

// ── Map Setup ──
let map;
const leafletMarkers = {};

function initMap() {
    map = L.map('map', {
        center: [36.5885, -6.2320],
        zoom: 14,
        zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(map);

    renderMarkers();
    
    // Home pulse ring
    L.circle([36.588769, -6.231999], {
        color:'#FF6B35', fillColor:'#FF6B35', fillOpacity:0.07,
        weight:2, opacity:0.4, radius:130
    }).addTo(map);
}

function makeIcon(emoji, color, isHome) {
    const s = isHome ? 50 : 38;
    const fs = isHome ? 22 : 16;
    const html = `<div style="width:${s}px;height:${s}px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:${fs}px;border:2px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.25);transition:transform 0.15s;">${emoji}</div>`;
    return L.divIcon({ html, className:'', iconSize:[s,s], iconAnchor:[s/2,s/2], popupAnchor:[0,-s/2+4] });
}

function renderMarkers() {
    places.forEach(p => {
        const isHome = p.category === 'home';
        const icon = makeIcon(p.icon, categoryColors[p.category], isHome);
        const marker = L.marker([p.lat, p.lng], { icon, zIndexOffset: isHome ? 1000 : 0 });

        marker.bindPopup(() => renderPopup(p), { maxWidth: 260 });
        marker.addTo(map);
        leafletMarkers[p.id] = { marker, place: p };

        marker.on('click', () => highlightCard(p.id));
    });
}

function renderPopup(p) {
    const lang = window._olasLang || 'es';
    const desc = p['desc_' + lang] || p.desc;
    
    const btnLabels = {
        es: "🚶 Cómo llegar",
        en: "🚶 Directions",
        fr: "🚶 Itinéraire",
        de: "🚶 Wegbeschreibung",
        it: "🚶 Come arrivarci"
    };
    const label = btnLabels[lang] || btnLabels.es;
    const mapsLink = `https://www.google.com/maps/dir/?api=1&origin=36.588769,-6.231999&destination=${p.lat},${p.lng}&travelmode=walking`;
    
    const btnHtml = p.id === 'home' ? '' : `<div style="margin-top:10px;"><a href="${mapsLink}" target="_blank" style="display:inline-block;background:var(--coral, #E8501A);color:white;padding:6px 14px;border-radius:20px;text-decoration:none;font-weight:bold;font-size:0.85rem;">${label}</a></div>`;

    return `<div style="font-family:sans-serif;padding:5px"><strong>${p.title}</strong><div style="margin-top:6px;font-size:0.9rem;line-height:1.4;">${desc}</div>${btnHtml}</div>`;
}

function highlightCard(id) {
    document.querySelectorAll('.poi-card').forEach(c => c.classList.remove('active'));
    const card = document.getElementById('card-' + id);
    if (card) {
        card.classList.add('active');
        card.scrollIntoView({ behavior:'smooth', block:'nearest' });
    }
}

function filterMapMarkers(cat) {
    // 1. Filter Map Markers
    for (const id in leafletMarkers) {
        const item = leafletMarkers[id];
        const p = item.place;
        // Keep home visible or matched category
        if (cat === 'all' || p.category === cat || p.category === 'home') {
            if (!map.hasLayer(item.marker)) {
                item.marker.addTo(map);
            }
        } else {
            if (map.hasLayer(item.marker)) {
                map.removeLayer(item.marker);
            }
        }
    }
    
    // 2. Filter Sidebar Cards
    document.querySelectorAll('.poi-card').forEach(card => {
        if (cat === 'all') {
            card.style.display = 'flex';
        } else {
            const placeId = card.id.replace('card-', '');
            const place = places.find(x => x.id === placeId);
            if (place && place.category === cat) {
                card.style.display = 'flex';
            } else if (placeId === 'home' && cat === 'home') {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
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

// ── Listeners ──
window.addEventListener('load', () => {
    initMap();
    renderPoiChips('all');
    
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
