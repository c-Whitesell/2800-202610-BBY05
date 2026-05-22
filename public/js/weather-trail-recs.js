/* ── weather-trail-recs.js ────────────────────────────────────────
 * Weather-based trail recommendations for the weather page.
 * Fetches live trail data from /api/parks and /api/paths
 * (same endpoints as discover.js), with a static fallback.
 *
 * Depends on:
 *   - lastWeatherData  (set by weather.js after fetch)
 * ─────────────────────────────────────────────────────────────── */

/* ── State ────────────────────────────────────────────────────── */
let wtrTrailPool = [];
let wtrPoolReady = false;
let wtrPendingRender = false;

/* ── Normalise trail from API (mirrors discover.js) ───────────── */
function wtrNormalise(raw, source) {
  const props  = raw.properties || {};
  const coords = raw.geometry?.coordinates;

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

  const name       = props.name || props.park_name || 'Unnamed Trail';
  const difficulty = props.difficulty || props.classification || '';
  const distance   = parseFloat(props.distance || props.length || props.area_ha || 0);
  const elevation  = parseFloat(props.elevation || 0);
  const surface    = (props.surface || '').toLowerCase();
  const highway    = (props.highway || '').toLowerCase();
  const location   = props.park_name || props.area || props.municipality || '';

  return {
    _id:        raw._id || props.park_id || Math.random().toString(36).slice(2),
    name,
    difficulty,
    distance,
    elevation,
    location,
    duration:   props.duration || '',
    description: props.description || (surface ? `Surface: ${surface}` : ''),
    lat, lng,
    source,
    tags:       wtrInferTags({ name, difficulty, distance, elevation, surface, highway, location, props }),
    raw,
  };
}

/* ── Infer weather-scoring tags from trail properties ─────────── */
function wtrInferTags({ name, difficulty, distance, elevation, surface, highway, location, props }) {
  const tags = [];
  const n    = (name + ' ' + location).toLowerCase();

  // Terrain type from name / location
  if (n.match(/forest|wood|cedar|fir|grove|canopy|rainforest/))   tags.push('forest', 'canopy');
  if (n.match(/creek|river|stream|riparian|waterway/))             tags.push('river');
  if (n.match(/lake|pond|reservoir/))                              tags.push('lake');
  if (n.match(/mountain|peak|summit|alpine|ridge|bluff/))         tags.push('summit', 'exposed', 'alpine');
  if (n.match(/canyon|gorge|ravine|valley/))                      tags.push('valley', 'shelter');
  if (n.match(/beach|shore|coast|sea|ocean|bay/))                 tags.push('open', 'exposed');
  if (n.match(/meadow|field|prairie/))                            tags.push('open');
  if (n.match(/wetland|marsh|bog|swamp/))                         tags.push('wetland', 'marsh');
  if (n.match(/park|garden|urban|greenway/))                      tags.push('urban');

  // Surface type
  if (surface.match(/gravel|dirt|unpaved|ground/))                tags.push('unpaved');
  if (surface.match(/paved|asphalt|concrete/))                    tags.push('paved');

  // Elevation-based
  if (elevation > 800)                                            tags.push('alpine', 'exposed');
  else if (elevation > 300)                                       tags.push('summit');
  else if (elevation <= 80)                                       tags.push('flat');

  // Difficulty-based
  const dl = (difficulty || '').toLowerCase();
  if (dl.match(/easy|low/))                                       tags.push('flat');
  if (dl.match(/hard|difficult|high|strenuous/))                  tags.push('exposed');

  // Highway type (OSM paths data)
  if (highway === 'footway' || highway === 'path')                tags.push('forest');
  if (highway === 'cycleway' || highway === 'pedestrian')         tags.push('paved', 'urban');

  // Deduplicate
  return [...new Set(tags)];
}

/* ── Fallback pool (used if both API endpoints fail) ─────────── */
const WTR_FALLBACK = [
  { _id: 'f1', name: 'Lynn Canyon Loop',       difficulty: 'moderate', distance: 4.2, elevation: 120, location: 'North Vancouver', lat: 49.3502, lng: -123.0210, duration: '1.5 hr', description: 'Dense old-growth canopy.', tags: ['forest','canopy','valley'] },
  { _id: 'f2', name: 'Capilano River Trail',   difficulty: 'easy',     distance: 7.5, elevation: 40,  location: 'North Vancouver', lat: 49.3453, lng: -123.1161, duration: '2 hr',   description: 'Flat riverside trail through cedar and fir.', tags: ['river','flat','canopy'] },
  { _id: 'f3', name: 'Pacific Spirit Park',    difficulty: 'easy',     distance: 6.0, elevation: 30,  location: 'Vancouver (UBC)', lat: 49.2627, lng: -123.2042, duration: '1.5 hr', description: 'Urban forest with sheltered trails.', tags: ['canopy','urban','flat'] },
  { _id: 'f4', name: 'Burnaby Mountain Trail', difficulty: 'moderate', distance: 5.0, elevation: 200, location: 'Burnaby',         lat: 49.2788, lng: -122.9195, duration: '2 hr',   description: 'Forested trail to the summit.', tags: ['exposed','summit','forest'] },
  { _id: 'f5', name: 'Quarry Rock Trail',      difficulty: 'easy',     distance: 3.6, elevation: 100, location: 'Deep Cove',       lat: 49.3281, lng: -122.9503, duration: '1.5 hr', description: 'Dense canopy, open viewpoint at the top.', tags: ['forest','canopy','viewpoint'] },
  { _id: 'f6', name: 'Garibaldi Panorama',     difficulty: 'hard',     distance: 30,  elevation: 1200,location: 'Squamish',        lat: 49.9253, lng: -122.9908, duration: '8 hr',   description: 'Alpine route — dangerous in bad weather.', tags: ['alpine','exposed','summit'] },
];

/* ── Fetch trails from API ────────────────────────────────────── */
async function wtrLoadTrailPool() {
  try {
    const [parksRes, pathsRes] = await Promise.all([
      fetch('/api/parks').catch(() => ({ ok: false })),
      fetch('/api/paths').catch(() => ({ ok: false })),
    ]);

    const parks = parksRes.ok ? await parksRes.json() : [];
    const paths = pathsRes.ok ? await pathsRes.json() : [];

    const normParks = (Array.isArray(parks) ? parks : []).map(p => wtrNormalise(p, 'park'));
    const normPaths = (Array.isArray(paths) ? paths : []).map(p => wtrNormalise(p, 'path'));

    wtrTrailPool = [...normParks, ...normPaths];

    // Fall back to static pool if DB is empty
    if (wtrTrailPool.length === 0) wtrTrailPool = WTR_FALLBACK;

  } catch (e) {
    console.warn('wtr: API fetch failed, using fallback pool', e);
    wtrTrailPool = WTR_FALLBACK;
  }

  wtrPoolReady = true;

  // If weather data arrived before trails, render now
  if (wtrPendingRender) {
    wtrPendingRender = false;
    renderWeatherTrailRecs();
  }
}

/* ── Scoring engine ───────────────────────────────────────────── */
function scoreTrailForWeather(trail, wx) {
  const { apparentC, uvIndex, windKmh, isRaining, isStorming, isSnowing } = wx;
  const tags = trail.tags || [];
  let score  = 60;
  const reasons  = [];
  const warnings = [];

  // Rain / drizzle
  if (isRaining) {
    if (tags.some(t => ['canopy','forest','shelter','valley'].includes(t))) {
      score += 18; reasons.push('Dense canopy keeps you dry');
    } else if (tags.some(t => ['exposed','alpine','open'].includes(t))) {
      score -= 30; warnings.push('Exposed trail in rain');
    } else {
      score -= 10;
    }
    if (tags.some(t => ['marsh','river','wetland'].includes(t))) {
      score -= 8; warnings.push('Muddy conditions likely');
    }
  }

  // Storm
  if (isStorming) {
    if (tags.some(t => ['alpine','summit','exposed'].includes(t))) {
      score -= 50; warnings.push('Dangerous in storm');
    } else if (tags.some(t => ['canopy','forest','shelter'].includes(t))) {
      score -= 5; warnings.push('Check lightning risk near tall trees');
    } else {
      score -= 25;
    }
  }

  // Snow
  if (isSnowing) {
    if (trail.elevation > 300) { score -= 35; warnings.push('High elevation – snow/ice likely'); }
    if (trail.elevation > 600) { score -= 30; warnings.push('Alpine conditions'); }
    if (trail.elevation <= 100 && tags.includes('flat')) { score += 8; reasons.push('Low elevation stays accessible'); }
  }

  // UV / sun
  if (!isRaining && !isStorming) {
    if (uvIndex >= 8) {
      if (tags.some(t => ['canopy','forest','shelter'].includes(t))) {
        score += 20; reasons.push('Great shade for high UV');
      } else if (tags.some(t => ['exposed','open'].includes(t))) {
        score -= 22; warnings.push('High UV, minimal shade');
      }
    } else if (uvIndex >= 4) {
      if (tags.some(t => ['canopy','forest'].includes(t))) {
        score += 10; reasons.push('Good shade coverage');
      } else if (tags.some(t => ['open','exposed'].includes(t))) {
        score -= 8; warnings.push('Limited shade midday');
      }
    } else if (uvIndex <= 2) {
      score += 5;
      if (tags.some(t => ['summit','viewpoint'].includes(t))) reasons.push('Soft light — great for views');
    }
  }

  // Temperature
  if (apparentC < 0)              { score -= 15; warnings.push('Feels below freezing'); }
  else if (apparentC < 5)         { score -= 5;  warnings.push('Dress in warm layers'); }
  else if (apparentC >= 15 && apparentC <= 22) { score += 8; reasons.push('Ideal hiking temperature'); }
  else if (apparentC > 28) {
    if (tags.some(t => ['canopy','forest','valley'].includes(t))) {
      score += 12; reasons.push('Canopy keeps it cool');
    } else {
      score -= 18; warnings.push('Heat exposure risk');
    }
  }

  // Wind
  if (windKmh > 50) {
    if (tags.some(t => ['alpine','summit','exposed'].includes(t))) {
      score -= 35; warnings.push('Dangerous wind on exposed ridge');
    } else if (tags.some(t => ['forest','valley','canopy'].includes(t))) {
      score += 5; reasons.push('Forest shelters from wind');
    } else {
      score -= 15; warnings.push('Strong winds expected');
    }
  } else if (windKmh > 25) {
    if (tags.some(t => ['exposed','alpine'].includes(t))) { score -= 10; warnings.push('Gusty at exposed sections'); }
    if (tags.some(t => ['forest','valley'].includes(t)))  { score += 3;  reasons.push('Forest windbreak'); }
  } else if (windKmh < 10 && !isRaining) {
    score += 5; reasons.push('Calm conditions');
  }

  score = Math.max(0, Math.min(100, score));

  let badge, badgeClass;
  if      (score >= 78) { badge = 'Perfect today';      badgeClass = 'rec-badge--perfect'; }
  else if (score >= 58) { badge = 'Good choice';        badgeClass = 'rec-badge--good';    }
  else if (score >= 38) { badge = 'Use caution';        badgeClass = 'rec-badge--caution'; }
  else                  { badge = 'Not recommended';    badgeClass = 'rec-badge--avoid';   }

  const reason = reasons.length ? reasons[0] : (warnings.length ? warnings[0] : 'Check conditions before going');
  return { score, badge, badgeClass, reason, warnings };
}

/* ── Parse weather conditions ─────────────────────────────────── */
function parseWxConditions(cur) {
  const code = cur.weather_code;
  return {
    wmoCode:    code,
    tempC:      cur.temperature_2m,
    apparentC:  cur.apparent_temperature,
    uvIndex:    cur.uv_index ?? 0,
    windKmh:    cur.wind_speed_10m,
    isRaining:  code >= 51 && code <= 67,
    isStorming: code >= 80,
    isSnowing:  code >= 71 && code <= 77,
  };
}

/* ── Context headline ─────────────────────────────────────────── */
function getWeatherContextHeadline(wx) {
  if (wx.isStorming)                              return { icon: '⛈️', text: 'Storm warning — sheltered trails only' };
  if (wx.isSnowing)                               return { icon: '❄️', text: 'Snow conditions — low elevation recommended' };
  if (wx.isRaining)                               return { icon: '🌧️', text: 'Rainy day — canopy trails ranked first' };
  if (wx.uvIndex >= 8)                            return { icon: '☀️', text: 'High UV — shade is your best friend' };
  if (wx.uvIndex >= 5)                            return { icon: '🌤️', text: 'Moderate sun — canopy trails favoured' };
  if (wx.windKmh > 40)                            return { icon: '💨', text: 'Windy — valley & forest trails recommended' };
  if (wx.apparentC >= 15 && wx.apparentC <= 22)   return { icon: '🌿', text: 'Ideal conditions — most trails open' };
  if (wx.apparentC < 2)                           return { icon: '🥶', text: 'Cold out — bundle up, pick shorter trails' };
  return { icon: '🥾', text: 'Good hiking weather today' };
}

/* ── Render ───────────────────────────────────────────────────── */
function renderWeatherTrailRecs() {
  const section = document.getElementById('weather-trail-recs');
  if (!section) return;

  // If trails not ready yet, defer until they are
  if (!wtrPoolReady) {
    wtrPendingRender = true;
    section.innerHTML = `<p class="wtr-note">Loading trail data…</p>`;
    return;
  }

  if (!lastWeatherData) {
    section.innerHTML = `<p class="wtr-note">Weather data not yet loaded.</p>`;
    return;
  }

  const wx = parseWxConditions(lastWeatherData.cur);

  const scored = wtrTrailPool
    .map(t => ({ trail: t, ...scoreTrailForWeather(t, wx) }))
    .sort((a, b) => b.score - a.score);

  const headline = getWeatherContextHeadline(wx);

  section.innerHTML = `
    <div class="wtr-header">
      <div class="wtr-context-pill">${headline.icon} ${headline.text}</div>
    </div>
    <div class="wtr-grid">
      ${scored.slice(0, 5).map((s, i) => renderRecCard(s, i)).join('')}
    </div>
    <div class="wtr-cta">
      <a href="/discover" class="wtr-cta-link">Browse all trails <span>→</span></a>
    </div>
  `;

  requestAnimationFrame(() => {
    section.querySelectorAll('.wtr-card').forEach((card, i) => {
      card.style.animationDelay = `${i * 60}ms`;
      card.classList.add('wtr-card--enter');
    });
  });
}

function renderRecCard(s, rank) {
  const { trail, score, badge, badgeClass, reason, warnings } = s;
  const diffColors = { easy: '#3b6d11', moderate: '#ba7517', hard: '#aa2222' };
  const diffColor  = diffColors[(trail.difficulty || '').toLowerCase()] || '#888780';
  const scoreBar   = score >= 78 ? '#3b6d11' : score >= 58 ? '#639922' : score >= 38 ? '#ba7517' : '#c0392b';
  const distStr    = trail.distance ? `${parseFloat(trail.distance).toFixed(2)} km` : '';
  const safeName   = (trail.name || '').replace(/'/g, "\\'");

  return `
    <div class="wtr-card" onclick="viewTrailOnMap(${trail.lat || 0}, ${trail.lng || 0}, '${safeName}')">
      <div class="wtr-card__rank">${rank + 1}</div>
      <div class="wtr-card__body">
        <div class="wtr-card__top">
          <div class="wtr-card__name">${trail.name}</div>
          <span class="wtr-rec-badge ${badgeClass}">${badge}</span>
        </div>
        <div class="wtr-card__sub">
          ${trail.location ? `<span class="wtr-card__loc">📍 ${trail.location}</span><span class="wtr-card__dot">·</span>` : ''}
          ${distStr        ? `<span class="wtr-card__dist">📏 ${distStr}</span><span class="wtr-card__dot">·</span>` : ''}
          ${trail.difficulty ? `<span class="wtr-card__diff" style="color:${diffColor}">${trail.difficulty}</span>` : ''}
        </div>
        <div class="wtr-card__reason">${reason}</div>
        ${warnings.length ? `
          <div class="wtr-card__warnings">
            ${warnings.slice(0,2).map(w => `<span class="wtr-warning">⚠ ${w}</span>`).join('')}
          </div>` : ''}
        <div class="wtr-score-bar">
          <div class="wtr-score-fill" style="width:${score}%; background:${scoreBar};"></div>
        </div>
      </div>
      <div class="wtr-card__arrow">›</div>
    </div>
  `;
}

/* ── Navigate to map ──────────────────────────────────────────── */
function viewTrailOnMap(lat, lng, name) {
  if (lat && lng) {
    window.location.href = `/map?lat=${lat}&lng=${lng}&name=${encodeURIComponent(name)}`;
  } else {
    window.location.href = `/map?search=${encodeURIComponent(name)}`;
  }
}

/* ── Hook into weather.js render cycle ───────────────────────── */
const _origRenderWeather = typeof renderWeather === 'function' ? renderWeather : null;
if (_origRenderWeather) {
  window.renderWeather = function(data) {
    _origRenderWeather(data);
    renderWeatherTrailRecs();
  };
} else {
  document.addEventListener('weatherDataReady', renderWeatherTrailRecs);
}

/* ── Kick off trail fetch immediately on script load ─────────── */
wtrLoadTrailPool();