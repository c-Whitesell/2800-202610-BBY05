let allItems = [];
let savedIds = [];
 
function normalisePark(raw) {
    const props = raw.properties || {};
    const coords = raw.geometry?.coordinates;
 
    let lat = 0, lng = 0;
    if (props.geo_point_2d) {
        lat = props.geo_point_2d.lat;
        lng = props.geo_point_2d.lon;
    } else if (raw.geometry?.type === 'Polygon' && coords?.[0]?.length) {
        lng = coords[0][0][0];
        lat = coords[0][0][1];
    }
 
    return {
        _id: String(raw._id),
        name: props.park_name || props.name || 'Unnamed Park',
        difficulty: props.classification || '',
        distance: parseFloat(props.area_ha || 0),
        length: parseFloat(props.area_ha || 0),
        description: props.aiSummary || '',
        location: props.park_name || '',
        duration: '',
        elevation: '',
        lat, lng,
        source: 'park',
        raw,
    };
}
 
function normalisePath(raw) {
    const props = raw.properties || {};
    const coords = raw.geometry?.coordinates;
 
    let lat = 0, lng = 0;
    if (raw.geometry?.type === 'LineString' && coords?.length) {
        const mid = coords[Math.floor(coords.length / 2)];
        lng = mid[0]; lat = mid[1];
    } else if (props.geo_point_2d) {
        lat = props.geo_point_2d.lat;
        lng = props.geo_point_2d.lon;
    }
 
    return {
        _id: String(raw._id),
        name: props.name || props.park_name || 'Unnamed Path',
        difficulty: props.classification || props.highway || '',
        distance: 0,
        length: 0,
        description: props.surface ? `Surface: ${props.surface}` : '',
        location: props.park_name || '',
        duration: '',
        elevation: '',
        lat, lng,
        source: 'path',
        raw,
    };
}
 
// ── Helpers ───────────────────────────────────────────
function difficultyBadge(d) {
    const dl = (d || '').toLowerCase();
    if (dl.includes('easy') || dl === 'low' || dl === 'neighbourhood') return { cls: 'badge--easy', label: dl === 'neighbourhood' ? 'Neighbourhood' : 'Easy' };
    if (dl.includes('hard') || dl === 'high') return { cls: 'badge--hard', label: 'Hard' };
    if (dl.includes('mod') || dl === 'medium') return { cls: 'badge--moderate', label: 'Moderate' };
    if (dl === 'footway' || dl === 'path' || dl === 'cycleway') return { cls: 'badge--default', label: dl.charAt(0).toUpperCase() + dl.slice(1) };
    if (dl) return { cls: 'badge--default', label: d };
    return null;
}
 
function itemEmoji(t) {
    const n = (t.name + t.location).toLowerCase();
    if (n.includes('lake') || n.includes('pond')) return '🏞️';
    if (n.includes('creek') || n.includes('river')) return '🌊';
    if (n.includes('mountain') || n.includes('peak')) return '🏔️';
    if (n.includes('forest') || n.includes('wood')) return '🌲';
    if (n.includes('beach') || n.includes('shore')) return '🏖️';
    if (n.includes('canyon') || n.includes('gorge')) return '🏜️';
    return '🥾';
}

 
//Render card
function renderCard(t) {
    const badge = difficultyBadge(t.difficulty);
    const distStr = t.distance ? `${t.distance.toFixed(2)} ha` : '';
    const durStr = t.duration || '';
    const elevStr = t.elevation ? `${t.elevation}m gain` : '';
    const hasCoords = t.lat && t.lng;
    const typeLabel = t.source === 'park' ? 'Park' : 'Path';
 
    return `
      <div class="trail-card" data-id="${t._id}">
        <div class="trail-card__img">
          <div class="trail-card__img-placeholder">${itemEmoji(t)}</div>
          <button class="trail-card__bookmark saved" onclick="toggleBookmark('${t._id}', this)" title="Remove bookmark">
            🔖
          </button>
          <span class="trail-card__type-badge">${typeLabel}</span>
        </div>
        <div class="trail-card__body">
          <div class="trail-card__top">
            <div class="trail-card__name">${t.name}</div>
            ${badge ? `<span class="trail-card__badge ${badge.cls}">${badge.label}</span>` : ''}
          </div>
          <div class="trail-card__meta">
            ${distStr ? `<span class="trail-card__meta-item"><span>📐</span>${distStr}</span>` : ''}
            ${durStr ? `<span class="trail-card__meta-item"><span>⏱️</span>${durStr}</span>` : ''}
            ${elevStr ? `<span class="trail-card__meta-item"><span>⛰️</span>${elevStr}</span>` : ''}
            ${t.location ? `<span class="trail-card__meta-item"><span>📍</span>${t.location}</span>` : ''}
          </div>
          ${t.description ? `<div class="trail-card__desc">${t.description}</div>` : ''}
          <div class="trail-card__actions">
            ${hasCoords
                ? `<button class="trail-card__btn trail-card__btn--primary" onclick="viewOnMap(${t.lat}, ${t.lng}, '${t.name.replace(/'/g, "\\'")}')">🗺️ View on Map</button>`
                : `<button class="trail-card__btn trail-card__btn--primary" onclick="viewOnMap(null,null,'${t.name.replace(/'/g, "\\'")}')">🗺️ View on Map</button>`
            }
            <button class="trail-card__btn trail-card__btn--remove" onclick="toggleBookmark('${t._id}', this)">
              🗑️ Remove
            </button>
          </div>
        </div>
      </div>
    `;
}
 
// ── Render the bookmarks grid ─────────────────────────
function renderGrid() {
    const loading = document.getElementById('bookmarksLoading');
    const empty   = document.getElementById('bookmarksEmpty');
    const section = document.getElementById('bookmarksSection');
    const grid    = document.getElementById('bookmarksContainer');
    const count   = document.getElementById('bookmarksCount');
 
    loading.classList.add('d-none');
 
    const bookmarked = allItems.filter(t => savedIds.includes(t._id));
 
    if (count) count.textContent = `${bookmarked.length} saved`;
 
    if (bookmarked.length === 0) {
        section.classList.add('d-none');
        empty.classList.remove('d-none');
        return;
    }
 
    empty.classList.add('d-none');
    section.classList.remove('d-none');
    grid.innerHTML = bookmarked.map(renderCard).join('');
}
 
// ── Toggle bookmark (remove from this page) ───────────
async function toggleBookmark(id) {
    try {
        const res = await fetch(`/bookmark/${id}`, { method: 'POST' });
 
        if (!res.ok) { showToast('Something went wrong'); return; }
 
        const data = await res.json();
 
        if (!data.saved) {
            savedIds = savedIds.filter(x => x !== id);
            showToast('Removed from bookmarks');
            renderGrid();
        }
    } catch (err) {
        console.error(err);
        showToast('Something went wrong');
    }
}
 
// ── View on map ───────────────────────────────────────
function viewOnMap(lat, lng, name) {
    if (lat && lng) {
        window.location.href = `/map?lat=${lat}&lng=${lng}&name=${encodeURIComponent(name)}`;
    } else {
        window.location.href = `/map?search=${encodeURIComponent(name)}`;
    }
}
 
// ── Toast ─────────────────────────────────────────────
function showToast(msg) {
    let t = document.getElementById('bm-toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'bm-toast';
        t.className = 'bm-toast';
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}
 
//Fetch saved IDs
async function loadBookmarks() {
    try {
        const res = await fetch('/api/bookmarks');
        if (!res.ok) return;
        const data = await res.json();
        savedIds = (data.bookmarks || []).map(String);
    } catch (err) {
        console.error('Failed to load bookmarks:', err);
    }
}
 
//Fetch all parks + paths
async function loadData() {
    try {
        const [parksRes, pathsRes] = await Promise.all([
            fetch('/api/parks').catch(() => ({ ok: false })),
            fetch('/api/paths').catch(() => ({ ok: false })),
        ]);
 
        const parks = parksRes.ok ? await parksRes.json() : [];
        const paths = pathsRes.ok  ? await pathsRes.json()  : [];
 
        const normParks  = (Array.isArray(parks) ? parks : []).map(normalisePark);
        const normPaths  = (Array.isArray(paths)  ? paths  : []).map(normalisePath);
 
        allItems = [...normParks, ...normPaths];
    } catch (err) {
        console.error('Failed to load data:', err);
    }
}
 

async function init() {
    await Promise.all([loadBookmarks(), loadData()]);
    renderGrid();
}
 
init();