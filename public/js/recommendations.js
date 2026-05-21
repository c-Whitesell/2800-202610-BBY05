let allTrails = [];
let savedIds = [];
let activeFilter = 'all';
let activeSort = 'default';

// ── Spotlight Stories (static curated content) ────────
const STORIES = [
    { emoji: '🌲', category: 'Featured', title: 'Top 5 Shaded Trails in North Vancouver', excerpt: 'Beat the heat with these densely canopied routes through Lynn Canyon and beyond.', meta: '3 min read · Trail Tips' },
    { emoji: '🦅', category: 'Wildlife', title: 'Bald Eagles of Boundary Bay Trail', excerpt: 'Spot resident and migratory eagles along this flat, scenic coastal path.', meta: '4 min read · Wildlife' },
    { emoji: '🌧️', category: 'Seasonal', title: 'Best Rainy-Day Trails with Tree Cover', excerpt: 'When it rains in Vancouver, these trails keep you dry under dense forest canopy.', meta: '5 min read · Seasonal' },
    { emoji: '🏔️', category: 'Beginner', title: 'Your First Hike: Burnaby Mountain Loop', excerpt: 'Perfect for first-timers — gentle elevation, great views, and plenty of shade.', meta: '3 min read · Beginner Guide' },
    { emoji: '🌊', category: 'Waterfront', title: 'Seawall to Forest: The Best of Both Worlds', excerpt: 'Combine Stanley Park\'s seawall with its interior forest trails for a complete experience.', meta: '6 min read · Routes' },
    { emoji: '🍂', category: 'Autumn', title: 'Fall Colours on the Capilano River Trail', excerpt: 'Autumn transforms this riverside trail into a golden corridor worth every step.', meta: '4 min read · Seasonal' },
];

function renderSpotlight() {
    const strip = document.getElementById('spotlight-strip');
    strip.innerHTML = STORIES.map(s => `
      <div class="spotlight-card">
        <div class="spotlight-card__img">
          ${s.emoji}
          <span class="spotlight-card__category">${s.category}</span>
        </div>
        <div class="spotlight-card__body">
          <div class="spotlight-card__title">${s.title}</div>
          <div class="spotlight-card__excerpt">${s.excerpt}</div>
          <div class="spotlight-card__meta">${s.meta}</div>
        </div>
      </div>
    `).join('');
}

// ── Data helpers ──────────────────────────────────────
function getField(obj, ...keys) {
    for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    }
    return null;
}

function normaliseTrail(raw, source) {
    const props = raw.properties || {};
    const coords = raw.geometry?.coordinates;

    // Get center coordinate
    let lat = 0, lng = 0;
    if (raw.geometry?.type === 'LineString' && coords?.length) {
        const mid = coords[Math.floor(coords.length / 2)];
        lng = mid[0]; lat = mid[1];
    } else if (raw.geometry?.type === 'Polygon' && coords?.[0]?.length) {
        lng = props.geo_point_2d?.lon || coords[0][0][0];
        lat = props.geo_point_2d?.lat || coords[0][0][1];
    } else if (props.geo_point_2d) {
        lng = props.geo_point_2d.lon;
        lat = props.geo_point_2d.lat;
    }

    return {
        _id: raw._id || props.park_id || Math.random().toString(36).slice(2),
        name: props.name || props.park_name || 'Unnamed Trail',
        difficulty: props.difficulty || props.classification || '',
        distance: parseFloat(props.distance || props.area_ha || 0),
        length: parseFloat(props.length || props.area_ha || 0),
        description: props.description || props.surface ? `Surface: ${props.surface}` : '',
        location: props.park_name || props.area || '',
        duration: props.duration || '',
        elevation: props.elevation || '',
        lat, lng,
        source,
        raw,
    };
}

function difficultyBadge(d) {
    const dl = (d || '').toLowerCase();
    if (dl.includes('easy') || dl === 'low') return { cls: 'badge--easy', label: 'Easy' };
    if (dl.includes('hard') || dl === 'high') return { cls: 'badge--hard', label: 'Hard' };
    if (dl.includes('mod') || dl === 'medium') return { cls: 'badge--moderate', label: 'Moderate' };
    if (dl) return { cls: 'badge--default', label: d };
    return null;
}

function trailEmoji(t) {
    const n = (t.name + t.location).toLowerCase();
    if (n.includes('lake') || n.includes('pond')) return '🏞️';
    if (n.includes('creek') || n.includes('river')) return '🌊';
    if (n.includes('mountain') || n.includes('peak')) return '🏔️';
    if (n.includes('forest') || n.includes('wood')) return '🌲';
    if (n.includes('beach') || n.includes('shore')) return '🏖️';
    if (n.includes('canyon') || n.includes('gorge')) return '🏜️';
    return '🥾';
}

// ── Render trail card ─────────────────────────────────
function renderCard(t) {
    const badge = difficultyBadge(t.difficulty);
    const isSaved = savedIds.includes(t._id);
    const distStr = t.distance ? `${t.distance.toFixed(2)} km` : (t.length ? `${t.length} km` : '');
    const durStr = t.duration ? `${t.duration}` : '';
    const elevStr = t.elevation ? `${t.elevation}m gain` : '';
    const hasCoords = t.lat && t.lng;
    const natureIds = [15, 17, 28, 29, 33, 37, 39, 42, 43, 48, 56, 57, 63, 65, 67];
    const trailPhotos = [
        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=200&fit=crop',
        'https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&h=200&fit=crop',
        'https://images.unsplash.com/photo-1542202229-7d93c33f5d07?w=400&h=200&fit=crop',
        'https://images.unsplash.com/photo-1511497584788-876760111969?w=400&h=200&fit=crop',
        'https://images.unsplash.com/photo-1forest518338?w=400&h=200&fit=crop',
        'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=200&fit=crop',
        'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=400&h=200&fit=crop',
        'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=400&h=200&fit=crop',
        'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&h=200&fit=crop',
        'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=200&fit=crop',
    ];
    const photoIdx = Math.abs(t.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % trailPhotos.length;
    const photoUrl = trailPhotos[photoIdx];
    return `
      <div class="trail-card" data-id="${t._id}" data-difficulty="${t.difficulty}" data-distance="${t.distance || t.length || 0}" data-length="${t.length || t.distance || 0}">
        <div class="trail-card__img">
         <div class="trail-card__img-placeholder" style="background-image:url('${photoUrl}'); background-size:cover; background-position:center;"></div>
          <button class="trail-card__bookmark ${isSaved ? 'saved' : ''}" onclick="toggleBookmark('${t._id}', this)" title="${isSaved ? 'Remove bookmark' : 'Save trail'}">
            ${isSaved ? '🔖' : '🏷️'}
          </button>
        </div>
        <div class="trail-card__body">
          <div class="trail-card__top">
            <div class="trail-card__name">${t.name}</div>
            ${badge ? `<span class="trail-card__badge ${badge.cls}">${badge.label}</span>` : ''}
          </div>
          <div class="trail-card__meta">
            ${distStr ? `<span class="trail-card__meta-item"><span>📏</span>${distStr}</span>` : ''}
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
            <button class="trail-card__btn" onclick="toggleBookmark('${t._id}', null)">
              ${isSaved ? '🔖 Saved' : '＋ Save'}
            </button>
          </div>
        </div>
      </div>
    `;
}

// ── Filter + Sort + Render ────────────────────────────
function getFiltered() {
    let list = [...allTrails];

    // Filter
    if (activeFilter !== 'all') {
        list = list.filter(t => {
            const raw = t.raw?.properties || {};
            const highway = (raw.highway || '').toLowerCase();
            const classification = (raw.classification || '').toLowerCase();
            return highway === activeFilter || classification === activeFilter;
        });
    }

    // Sort
    switch (activeSort) {
        case 'name':
            list.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'distance-asc':
            list.sort((a, b) => (a.distance || a.length || 0) - (b.distance || b.length || 0));
            break;
        case 'distance-desc':
            list.sort((a, b) => (b.distance || b.length || 0) - (a.distance || a.length || 0));
            break;
        case 'length-asc':
            list.sort((a, b) => (a.length || a.distance || 0) - (b.length || b.distance || 0));
            break;
        case 'length-desc':
            list.sort((a, b) => (b.length || b.distance || 0) - (a.length || a.distance || 0));
            break;
    }

    return list;
}

function renderGrid() {
    const list = getFiltered();
    const grid = document.getElementById('rec-grid');
    const empty = document.getElementById('rec-empty');
    const count = document.getElementById('rec-count');

    count.textContent = `${list.length} trail${list.length !== 1 ? 's' : ''} found`;

    if (list.length === 0) {
        grid.innerHTML = '';
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';
        grid.innerHTML = list.map(renderCard).join('');
    }
}
// ── Bookmark ──────────────────────────────────────────
async function loadBookmarks() {
    try {
        const res = await fetch('/api/bookmarks');

        if (res.status === 401) {
            savedIds = [];
            showToast("Log in to save bookmarks");
            return;
        }

        if (!res.ok) {
            savedIds = [];
            return;
        }

        const data = await res.json();
        savedIds = data.bookmarks || [];

    } catch (err) {
        console.error(err);
        savedIds = [];
    }
}

async function toggleBookmark(id) {
    try {
        const res = await fetch(`/bookmark/${id}`, {
            method: 'POST'
        });

        if (res.status === 401 || res.redirected) {
            showToast('Please log in first');
            return;
        }

        const contentType = res.headers.get("content-type");

        if (!contentType || !contentType.includes("application/json")) {
            showToast('Please log in first');
            return;
        }

        const data = await res.json();

        if (data.saved) {
            if (!savedIds.includes(id)) savedIds.push(id);
            showToast('🔖 Trail saved');
        } else {
            savedIds = savedIds.filter(x => x !== id);
            showToast('Removed from bookmarks');
        }

        renderGrid();

    } catch (err) {
        console.error(err);
        showToast('Something went wrong');
    }
}

// ── View on Map ───────────────────────────────────────
function viewOnMap(lat, lng, name) {
    if (lat && lng) {
        window.location.href = `/map?lat=${lat}&lng=${lng}&name=${encodeURIComponent(name)}`;
    } else {
        window.location.href = `/map?search=${encodeURIComponent(name)}`;
    }
}

// ── Toast ─────────────────────────────────────────────
function showToast(msg) {
    const t = document.getElementById('rec-toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}

// ── Fetch data ────────────────────────────────────────
async function loadTrails() {
    try {
        const [parksRes, pathsRes] = await Promise.all([
            fetch('/api/parks').catch(() => ({ ok: false })),
            fetch('/api/paths').catch(() => ({ ok: false })),
        ]);

        const parks = parksRes.ok ? await parksRes.json() : [];
        const paths = pathsRes.ok ? await pathsRes.json() : [];

        const normParks = (Array.isArray(parks) ? parks : []).map(p => normaliseTrail(p, 'park'));
        const normPaths = (Array.isArray(paths) ? paths : []).map(p => normaliseTrail(p, 'path'));

        allTrails = [...normParks, ...normPaths];

        // If DB is empty, show sample Vancouver trails
        if (allTrails.length === 0) {
            allTrails = getSampleTrails();
        }

    } catch (e) {
        console.error('Failed to load trails:', e);
        allTrails = getSampleTrails();
    }

    document.getElementById('rec-loading').style.display = 'none';
    renderGrid();
}

// ── Sample trails (fallback if DB empty) ──────────────
function getSampleTrails() {
    return [
        { _id: 's1', name: 'Lynn Canyon Loop', difficulty: 'moderate', distance: 4.2, length: 4.2, location: 'North Vancouver', description: 'A beautiful loop through old-growth forest with suspension bridge views.', lat: 49.3502, lng: -123.0210, duration: '1.5 hr', elevation: '120m', source: 'sample' },
        { _id: 's2', name: 'Capilano River Trail', difficulty: 'easy', distance: 7.5, length: 7.5, location: 'North Vancouver', description: 'Flat riverside trail through dense cedar and fir forest. Excellent shade.', lat: 49.3453, lng: -123.1161, duration: '2 hr', elevation: '40m', source: 'sample' },
        { _id: 's3', name: 'Burnaby Mountain Trail', difficulty: 'moderate', distance: 5.0, length: 5.0, location: 'Burnaby', description: 'Forested trail to the summit with panoramic views of the Lower Mainland.', lat: 49.2788, lng: -122.9195, duration: '2 hr', elevation: '200m', source: 'sample' },
        { _id: 's4', name: 'Crippen Regional Park', difficulty: 'easy', distance: 3.0, length: 3.0, location: 'Bowen Island', description: 'Peaceful island trails through second-growth forest and wetlands.', lat: 49.3847, lng: -123.3614, duration: '1 hr', elevation: '60m', source: 'sample' },
        { _id: 's5', name: 'Pacific Spirit Park Loop', difficulty: 'easy', distance: 6.0, length: 6.0, location: 'Vancouver (UBC)', description: 'Urban forest park with over 70km of trails through dense second-growth.', lat: 49.2627, lng: -123.2042, duration: '1.5 hr', elevation: '30m', source: 'sample' },
        { _id: 's6', name: 'Garibaldi Panorama Ridge', difficulty: 'hard', distance: 30.0, length: 30.0, location: 'Squamish', description: 'Challenging alpine trail with stunning views of Garibaldi Lake.', lat: 49.9253, lng: -122.9908, duration: '8 hr', elevation: '1200m', source: 'sample' },
        { _id: 's7', name: 'Quarry Rock Trail', difficulty: 'easy', distance: 3.6, length: 3.6, location: 'Deep Cove', description: 'Popular trail to a rocky viewpoint above Indian Arm. Dense tree cover.', lat: 49.3281, lng: -122.9503, duration: '1.5 hr', elevation: '100m', source: 'sample' },
        { _id: 's8', name: 'Minnekhada Regional Park', difficulty: 'moderate', distance: 8.0, length: 8.0, location: 'Coquitlam', description: 'Varied terrain with marsh boardwalk, forest trail, and rocky outcrops.', lat: 49.3378, lng: -122.6775, duration: '3 hr', elevation: '180m', source: 'sample' },
        { _id: 's9', name: 'Derby Reach Regional Park', difficulty: 'easy', distance: 5.5, length: 5.5, location: 'Langley', description: 'Riverside trails along the Fraser River with historic farm sites.', lat: 49.1834, lng: -122.6097, duration: '1.5 hr', elevation: '20m', source: 'sample' },
    ];
}

// ── Event listeners ───────────────────────────────────
document.querySelectorAll('.rec-filter-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        document.querySelectorAll('.rec-filter-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        activeFilter = this.dataset.filter;
        renderGrid();
    });
});

document.getElementById('sort-select').addEventListener('change', function () {
    activeSort = this.value;
    renderGrid();
});

// ── Init ──────────────────────────────────────────────
async function init() {
    renderSpotlight();

    if (isLoggedIn) {
        loadBookmarks();
    }
    await loadTrails();
}

init();