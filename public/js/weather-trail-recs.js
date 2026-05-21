/* ── weather-trail-recs.js ────────────────────────────────────────
 * Weather-based trail recommendations for the weather page.
 * Drop this file alongside weather.js and include it after.
 *
 * Depends on:
 *   - lastWeatherData  (set by weather.js after fetch)
 *   - calcShadeScore() (defined in weather.js)
 *   - displayTemp()    (defined in weather.js)
 * ─────────────────────────────────────────────────────────────── */

/* ── Trail pool (same sample data as discover.js) ─────────────── */
const TRAIL_POOL = [
  { _id: 's1', name: 'Lynn Canyon Loop',       difficulty: 'moderate', distance: 4.2, location: 'North Vancouver',  lat: 49.3502, lng: -123.0210, duration: '1.5 hr', elevation: 120,  tags: ['forest','canopy','valley'],  description: 'Dense old-growth canopy. Natural shelter from rain and harsh sun.' },
  { _id: 's2', name: 'Capilano River Trail',   difficulty: 'easy',     distance: 7.5, location: 'North Vancouver',  lat: 49.3453, lng: -123.1161, duration: '2 hr',   elevation: 40,   tags: ['river','flat','canopy'],      description: 'Flat riverside trail through dense cedar and fir. Excellent shade.' },
  { _id: 's3', name: 'Burnaby Mountain Trail', difficulty: 'moderate', distance: 5.0, location: 'Burnaby',          lat: 49.2788, lng: -122.9195, duration: '2 hr',   elevation: 200,  tags: ['exposed','summit','forest'],  description: 'Forested trail to the summit — exposed near the top.' },
  { _id: 's4', name: 'Crippen Regional Park',  difficulty: 'easy',     distance: 3.0, location: 'Bowen Island',     lat: 49.3847, lng: -123.3614, duration: '1 hr',   elevation: 60,   tags: ['forest','wetland','shelter'], description: 'Island trails through second-growth forest and wetlands.' },
  { _id: 's5', name: 'Pacific Spirit Park',    difficulty: 'easy',     distance: 6.0, location: 'Vancouver (UBC)',  lat: 49.2627, lng: -123.2042, duration: '1.5 hr', elevation: 30,   tags: ['canopy','urban','flat'],      description: 'Urban forest with over 70 km of sheltered trails.' },
  { _id: 's6', name: 'Garibaldi Panorama',     difficulty: 'hard',     distance: 30.0, location: 'Squamish',        lat: 49.9253, lng: -122.9908, duration: '8 hr',   elevation: 1200, tags: ['alpine','exposed','summit'],  description: 'Challenging alpine. Stunning in good weather; dangerous in rain or wind.' },
  { _id: 's7', name: 'Quarry Rock Trail',      difficulty: 'easy',     distance: 3.6, location: 'Deep Cove',        lat: 49.3281, lng: -122.9503, duration: '1.5 hr', elevation: 100,  tags: ['forest','canopy','viewpoint'],description: 'Dense tree cover most of the way, open rock at the viewpoint.' },
  { _id: 's8', name: 'Minnekhada Park',        difficulty: 'moderate', distance: 8.0, location: 'Coquitlam',        lat: 49.3378, lng: -122.6775, duration: '3 hr',   elevation: 180,  tags: ['forest','marsh','mixed'],     description: 'Marsh boardwalk, forest trail, and rocky outcrops. Varied conditions.' },
  { _id: 's9', name: 'Derby Reach Park',       difficulty: 'easy',     distance: 5.5, location: 'Langley',          lat: 49.1834, lng: -122.6097, duration: '1.5 hr', elevation: 20,   tags: ['river','flat','open'],        description: 'Riverside trails along the Fraser — mostly open, some shade.' },
];

/* ── Scoring engine ───────────────────────────────────────────────
 * Returns { score: 0-100, badge: string, badgeClass: string,
 *           reason: string, warnings: string[] }
 * ─────────────────────────────────────────────────────────────── */
function scoreTrailForWeather(trail, wx) {
  const { wmoCode, tempC, apparentC, uvIndex, windKmh, isRaining, isStorming, isSnowing } = wx;
  const tags = trail.tags || [];
  let score = 60;
  const reasons = [];
  const warnings = [];

  // ── Rain / drizzle ──
  if (isRaining) {
    if (tags.some(t => ['canopy','forest','shelter','valley'].includes(t))) {
      score += 18; reasons.push('Dense canopy keeps you dry');
    } else if (tags.includes('exposed') || tags.includes('alpine') || tags.includes('open')) {
      score -= 30; warnings.push('Exposed trail in rain');
    } else {
      score -= 10;
    }
    if (tags.includes('marsh') || tags.includes('river') || tags.includes('wetland')) {
      score -= 8; warnings.push('Muddy conditions likely');
    }
  }

  // ── Storm ──
  if (isStorming) {
    if (tags.includes('alpine') || tags.includes('summit') || tags.includes('exposed')) {
      score -= 50; warnings.push('Dangerous in storm');
    } else if (tags.some(t => ['canopy','forest','shelter'].includes(t))) {
      score -= 5; warnings.push('Check lightning risk near tall trees');
    } else {
      score -= 25;
    }
  }

  // ── Snow ──
  if (isSnowing) {
    if (trail.elevation > 300) { score -= 35; warnings.push('High elevation – snow/ice likely'); }
    if (trail.elevation > 600) { score -= 30; warnings.push('Alpine conditions'); }
    if (trail.elevation <= 100 && tags.includes('flat')) { score += 8; reasons.push('Low elevation stays accessible'); }
  }

  // ── UV / sun intensity ──
  if (!isRaining && !isStorming) {
    if (uvIndex >= 8) {
      if (tags.some(t => ['canopy','forest','shelter'].includes(t))) {
        score += 20; reasons.push('Great shade for high UV');
      } else if (tags.includes('exposed') || tags.includes('open')) {
        score -= 22; warnings.push('High UV, minimal shade');
      }
    } else if (uvIndex >= 4 && uvIndex < 8) {
      if (tags.some(t => ['canopy','forest'].includes(t))) {
        score += 10; reasons.push('Good shade coverage');
      } else if (tags.includes('open') || tags.includes('exposed')) {
        score -= 8; warnings.push('Limited shade midday');
      }
    } else if (uvIndex <= 2 && !isRaining) {
      // Overcast/low UV — exposed trails are fine too
      score += 5;
      if (tags.includes('summit') || tags.includes('viewpoint')) {
        reasons.push('Soft light — great for views');
      }
    }
  }

  // ── Temperature / apparent temp ──
  if (apparentC < 0) {
    score -= 15; warnings.push('Feels below freezing');
  } else if (apparentC < 5) {
    score -= 5; warnings.push('Dress in warm layers');
  } else if (apparentC >= 15 && apparentC <= 22) {
    score += 8; reasons.push('Ideal hiking temperature');
  } else if (apparentC > 28) {
    if (tags.some(t => ['canopy','forest','valley'].includes(t))) {
      score += 12; reasons.push('Canopy keeps it cool');
    } else {
      score -= 18; warnings.push('Heat exposure risk');
    }
  }

  // ── Wind ──
  if (windKmh > 50) {
    if (tags.includes('alpine') || tags.includes('summit') || tags.includes('exposed')) {
      score -= 35; warnings.push('Dangerous wind on exposed ridge');
    } else if (tags.some(t => ['forest','valley','canopy'].includes(t))) {
      score += 5; reasons.push('Forest shelters from wind');
    } else {
      score -= 15; warnings.push('Strong winds expected');
    }
  } else if (windKmh > 25) {
    if (tags.includes('exposed') || tags.includes('alpine')) {
      score -= 10; warnings.push('Gusty at exposed sections');
    }
    if (tags.some(t => ['forest','valley'].includes(t))) {
      score += 3; reasons.push('Forest windbreak');
    }
  } else if (windKmh < 10 && !isRaining) {
    score += 5; reasons.push('Calm conditions');
  }

  score = Math.max(0, Math.min(100, score));

  // ── Badge assignment ──
  let badge, badgeClass;
  if (score >= 78) {
    badge = 'Perfect today'; badgeClass = 'rec-badge--perfect';
  } else if (score >= 58) {
    badge = 'Good choice';   badgeClass = 'rec-badge--good';
  } else if (score >= 38) {
    badge = 'Use caution';   badgeClass = 'rec-badge--caution';
  } else {
    badge = 'Not recommended'; badgeClass = 'rec-badge--avoid';
  }

  // Primary reason line
  const reason = reasons.length
    ? reasons[0]
    : (warnings.length ? warnings[0] : 'Check conditions before going');

  return { score, badge, badgeClass, reason, warnings };
}

/* ── Parse current weather into scorer-friendly shape ─────────── */
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

/* ── Section renderer ─────────────────────────────────────────── */
function renderWeatherTrailRecs() {
  const section = document.getElementById('weather-trail-recs');
  if (!section) return;

  if (!lastWeatherData) {
    section.innerHTML = `<p class="wtr-note">Weather data not yet loaded.</p>`;
    return;
  }

  const wx = parseWxConditions(lastWeatherData.cur);

  // Score & sort all trails
  const scored = TRAIL_POOL.map(t => ({
    trail: t,
    ...scoreTrailForWeather(t, wx),
  })).sort((a, b) => b.score - a.score);

  // Context headline
  const headline = getWeatherContextHeadline(wx);

  section.innerHTML = `
    <div class="wtr-header">
      <div class="wtr-context-pill">${headline.icon} ${headline.text}</div>
    </div>
    <div class="wtr-grid">
      ${scored.slice(0, 5).map((s, i) => renderRecCard(s, i)).join('')}
    </div>
    <div class="wtr-cta">
      <a href="/recommendations" class="wtr-cta-link">Browse all trails <span>→</span></a>
    </div>
  `;

  // Staggered entrance
  requestAnimationFrame(() => {
    section.querySelectorAll('.wtr-card').forEach((card, i) => {
      card.style.animationDelay = `${i * 60}ms`;
      card.classList.add('wtr-card--enter');
    });
  });
}

function getWeatherContextHeadline(wx) {
  if (wx.isStorming)           return { icon: '⛈️', text: 'Storm warning — sheltered trails only' };
  if (wx.isSnowing)            return { icon: '❄️', text: 'Snow conditions — low elevation recommended' };
  if (wx.isRaining)            return { icon: '🌧️', text: 'Rainy day — canopy trails ranked first' };
  if (wx.uvIndex >= 8)         return { icon: '☀️', text: 'High UV — shade is your best friend' };
  if (wx.uvIndex >= 5)         return { icon: '🌤️', text: 'Moderate sun — canopy trails favoured' };
  if (wx.windKmh > 40)         return { icon: '💨', text: 'Windy — valley & forest trails recommended' };
  if (wx.apparentC >= 15 && wx.apparentC <= 22) return { icon: '🌿', text: 'Ideal conditions — most trails open' };
  if (wx.apparentC < 2)        return { icon: '🥶', text: 'Cold out — bundle up, pick shorter trails' };
  return { icon: '🥾', text: 'Good hiking weather today' };
}

function renderRecCard(s, rank) {
  const { trail, score, badge, badgeClass, reason, warnings } = s;
  const diffColors = { easy: '#3b6d11', moderate: '#ba7517', hard: '#aa2222' };
  const diffColor  = diffColors[(trail.difficulty || '').toLowerCase()] || '#888780';

  const scoreBar = score >= 78 ? '#3b6d11' : score >= 58 ? '#639922' : score >= 38 ? '#ba7517' : '#c0392b';

  return `
    <div class="wtr-card" onclick="viewTrailOnMap(${trail.lat}, ${trail.lng}, '${trail.name.replace(/'/g,"\\'")}')">
      <div class="wtr-card__rank">${rank + 1}</div>
      <div class="wtr-card__body">
        <div class="wtr-card__top">
          <div class="wtr-card__name">${trail.name}</div>
          <span class="wtr-rec-badge ${badgeClass}">${badge}</span>
        </div>
        <div class="wtr-card__sub">
          <span class="wtr-card__loc">📍 ${trail.location}</span>
          <span class="wtr-card__dot">·</span>
          <span class="wtr-card__dist">📏 ${trail.distance} km</span>
          <span class="wtr-card__dot">·</span>
          <span class="wtr-card__diff" style="color:${diffColor}">${trail.difficulty}</span>
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
// Patch renderWeather so recs refresh whenever weather data refreshes
const _origRenderWeather = typeof renderWeather === 'function' ? renderWeather : null;
if (_origRenderWeather) {
  window.renderWeather = function(data) {
    _origRenderWeather(data);
    renderWeatherTrailRecs();
  };
} else {
  // Fallback: wait for lastWeatherData to be set then render
  document.addEventListener('weatherDataReady', renderWeatherTrailRecs);
}