
  // Fixed location: Vancouver, BC
  const VANCOUVER_LAT   = 49.2827;
  const VANCOUVER_LON   = -123.1207;
  const VANCOUVER_LABEL = 'Vancouver, BC';

  // Auto-refresh every 10 minutes; show "Stale" badge after 20 minutes without success
  const AUTO_REFRESH_MS    = 10 * 60 * 1000;
  const STALE_THRESHOLD_MS = 20 * 60 * 1000;

  let currentUnit      = 'C';
  let lastWeatherData  = null;
  let lastFetchTime    = null;
  let autoRefreshTimer = null;
  let staleCheckTimer  = null;
  let isRefreshing     = false;

  // ── Unit toggle ──────────────────────────────────────────────
  function toF(c) { return Math.round(c * 9 / 5 + 32); }
  function displayTemp(c) { return currentUnit === 'C' ? Math.round(c) : toF(c); }
  function unitLabel() { return currentUnit === 'C' ? '°C' : '°F'; }

  function setUnit(unit) {
    if (unit === currentUnit) return;
    currentUnit = unit;
    document.getElementById('btn-c').classList.toggle('active', unit === 'C');
    document.getElementById('btn-f').classList.toggle('active', unit === 'F');
    if (lastWeatherData) updateTemperatureDisplays();
  }

  function updateTemperatureDisplays() {
    const { cur, hrly, dly, sliceStart, times } = lastWeatherData;
    const ul = unitLabel();
    document.getElementById('temp-display').innerHTML =
      `${displayTemp(cur.temperature_2m)}<sup>${ul}</sup>`;
    document.getElementById('feels-like').textContent =
      `Feels like ${displayTemp(cur.apparent_temperature)}° · High ${displayTemp(dly.temperature_2m_max[0])}° · Low ${displayTemp(dly.temperature_2m_min[0])}°`;
    const strip = document.getElementById('hourly-strip');
    strip.innerHTML = '';
    times.slice(sliceStart, sliceStart + 6).forEach((t, i) => {
      const idx        = sliceStart + i;
      const temp       = displayTemp(hrly.temperature_2m[idx]);
      const wmoH       = getWmo(hrly.weather_code[idx]);
      const uvH        = hrly.uv_index ? hrly.uv_index[idx] : 0;
      const shadeH     = calcShadeScore(hrly.weather_code[idx], uvH);
      const shadeEmoji = shadeH >= 65 ? '🌿' : shadeH >= 40 ? '⛅' : '☀️';
      strip.innerHTML +=
        `<div class="hour-card${i === 0 ? ' now' : ''}">
          <div class="hour-time">${i === 0 ? 'Now' : fmtHour(t)}</div>
          <i class="ti ${wmoH.icon}"></i>
          <div class="hour-temp">${temp}°</div>
          <div class="hour-shade">${shadeEmoji} ${shadeH}%</div>
        </div>`;
    });
  }

  // ── Refresh helpers ──────────────────────────────────────────
  function setRefreshSpinning(spinning) {
    const btn = document.getElementById('refresh-btn');
    if (!btn) return;
    btn.classList.toggle('spinning', spinning);
    btn.disabled = spinning;
  }

  function markStale(stale) {
    const badge = document.getElementById('stale-badge');
    if (badge) badge.style.display = stale ? 'inline' : 'none';
  }

  function scheduleAutoRefresh() {
    clearTimeout(autoRefreshTimer);
    clearTimeout(staleCheckTimer);
    autoRefreshTimer = setTimeout(() => fetchWeather({ silent: true }), AUTO_REFRESH_MS);
    staleCheckTimer  = setTimeout(() => markStale(true), STALE_THRESHOLD_MS);
  }

  async function manualRefresh() {
    if (isRefreshing) return;
    await fetchWeather({ silent: true });
  }

  // ── WMO helpers ──────────────────────────────────────────────
  const WMO_CODES = {
    0:  { label: 'Clear Sky',     icon: 'ti-sun' },
    1:  { label: 'Mainly Clear',  icon: 'ti-sun' },
    2:  { label: 'Partly Cloudy', icon: 'ti-cloud-sun' },
    3:  { label: 'Overcast',      icon: 'ti-cloud' },
    45: { label: 'Foggy',         icon: 'ti-cloud-fog' },
    48: { label: 'Icy Fog',       icon: 'ti-cloud-fog' },
    51: { label: 'Light Drizzle', icon: 'ti-cloud-drizzle' },
    53: { label: 'Drizzle',       icon: 'ti-cloud-drizzle' },
    55: { label: 'Heavy Drizzle', icon: 'ti-cloud-drizzle' },
    61: { label: 'Light Rain',    icon: 'ti-cloud-rain' },
    63: { label: 'Rain',          icon: 'ti-cloud-rain' },
    65: { label: 'Heavy Rain',    icon: 'ti-cloud-rain' },
    71: { label: 'Light Snow',    icon: 'ti-snowflake' },
    73: { label: 'Snow',          icon: 'ti-snowflake' },
    75: { label: 'Heavy Snow',    icon: 'ti-snowflake' },
    80: { label: 'Showers',       icon: 'ti-cloud-rain' },
    81: { label: 'Heavy Showers', icon: 'ti-cloud-storm' },
    95: { label: 'Thunderstorm',  icon: 'ti-cloud-storm' },
    99: { label: 'Hail Storm',    icon: 'ti-cloud-storm' },
  };

  function getWmo(code) { return WMO_CODES[code] || { label: 'Unknown', icon: 'ti-cloud' }; }

  function calcShadeScore(wmoCode, uvIndex) {
    let cloudShade = 0;
    if (wmoCode <= 1)       cloudShade = 5;
    else if (wmoCode === 2) cloudShade = 45;
    else if (wmoCode === 3) cloudShade = 70;
    else                    cloudShade = 80;
    const uvShade = Math.max(0, Math.round(100 - (uvIndex / 11) * 80));
    return Math.min(100, Math.round((cloudShade * 0.5) + (uvShade * 0.5)));
  }

  function shadeClass(score)   { return score >= 65 ? 'high' : score >= 40 ? 'medium' : 'low'; }
  function shadeCaption(score) {
    if (score >= 65) return 'Good shade<br>conditions';
    if (score >= 40) return 'Moderate shade<br>conditions';
    return 'Low shade<br>today';
  }
  function barColor(score) {
    if (score >= 65) return '#3b6d11';
    if (score >= 40) return '#ba7517';
    return '#c0392b';
  }

  function fmtHour(isoStr) {
    const h = new Date(isoStr).getHours();
    if (h === 0)  return '12 AM';
    if (h === 12) return '12 PM';
    return h < 12 ? `${h} AM` : `${h - 12} PM`;
  }

  function showError(message) {
    document.getElementById('weather-loading').style.display = 'none';
    document.getElementById('weather-content').style.display = 'none';
    document.getElementById('weather-error').style.display   = 'block';
    document.getElementById('weather-error-msg').textContent = message;
  }

  // ── Fetch ────────────────────────────────────────────────────
  // silent: true  → keep existing content visible; just spin the refresh icon
  // silent: false → show full loading screen (first load or retry from error state)
  async function fetchWeather({ silent = false } = {}) {
    if (isRefreshing) return;
    isRefreshing = true;

    const hasContent = document.getElementById('weather-content').style.display !== 'none';

    if (silent && hasContent) {
      setRefreshSpinning(true);
    } else {
      document.getElementById('weather-loading').style.display = 'block';
      document.getElementById('weather-error').style.display   = 'none';
      document.getElementById('weather-content').style.display = 'none';
    }

    let data;
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${VANCOUVER_LAT}&longitude=${VANCOUVER_LON}` +
        `&current=temperature_2m,apparent_temperature,weather_code,` +
        `wind_speed_10m,relative_humidity_2m,uv_index,visibility` +
        `&hourly=temperature_2m,weather_code,uv_index` +
        `&daily=temperature_2m_max,temperature_2m_min` +
        `&timezone=auto&forecast_days=1`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      data = await res.json();
    } catch (err) {
      console.error('Weather API error:', err);
      if (silent && hasContent) {
        // Keep existing data; mark stale and reschedule
        markStale(true);
        scheduleAutoRefresh();
      } else {
        showError('Could not load weather data. Check your connection and try again.');
      }
      setRefreshSpinning(false);
      isRefreshing = false;
      return;
    }

    if (!data.current || !data.hourly || !data.daily) {
      console.error('Unexpected API response shape:', data);
      if (!silent || !hasContent) {
        showError('Received unexpected data from the weather service. Please try again.');
      }
      setRefreshSpinning(false);
      isRefreshing = false;
      return;
    }

    try {
      renderWeather(data);
      lastFetchTime = Date.now();
      markStale(false);
      scheduleAutoRefresh();
    } catch (renderErr) {
      console.error('Render error:', renderErr);
      if (!silent || !hasContent) {
        showError('Something went wrong displaying the weather. Please try again.');
      }
    }

    setRefreshSpinning(false);
    isRefreshing = false;
  }

  // ── Render ───────────────────────────────────────────────────
  function renderWeather(data) {
    const cur  = data.current;
    const hrly = data.hourly;
    const dly  = data.daily;
    const now  = new Date();

    const times      = hrly.time;
    const startIdx   = times.findIndex(t => new Date(t).getHours() === now.getHours());
    const sliceStart = startIdx >= 0 ? startIdx : 0;

    lastWeatherData = { cur, hrly, dly, times, sliceStart };

    document.getElementById('location-name-text').textContent = VANCOUVER_LABEL;
    document.getElementById('location-sub').textContent =
      `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    document.getElementById('location-date').textContent =
      now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

    const wmo = getWmo(cur.weather_code);
    document.getElementById('condition-icon').className   = `ti ${wmo.icon}`;
    document.getElementById('condition-text').textContent = wmo.label;
    document.getElementById('temp-display').innerHTML     = `${displayTemp(cur.temperature_2m)}<sup>${unitLabel()}</sup>`;
    document.getElementById('feels-like').textContent     =
      `Feels like ${displayTemp(cur.apparent_temperature)}° · High ${displayTemp(dly.temperature_2m_max[0])}° · Low ${displayTemp(dly.temperature_2m_min[0])}°`;

    const score = calcShadeScore(cur.weather_code, cur.uv_index ?? 0);
    const cls   = shadeClass(score);
    document.getElementById('shade-ring').className    = `shade-ring shade-${cls}`;
    document.getElementById('shade-score').className   = `shade-ring-num shade-${cls}`;
    document.getElementById('shade-score').textContent = score;
    document.getElementById('shade-caption').innerHTML = shadeCaption(score);

    document.getElementById('m-humidity').textContent   = `${cur.relative_humidity_2m}%`;
    document.getElementById('m-wind').textContent       = `${Math.round(cur.wind_speed_10m)} km/h`;
    document.getElementById('m-uv').textContent         = `UV ${Math.round(cur.uv_index ?? 0)}`;
    document.getElementById('m-visibility').textContent = `${Math.round((cur.visibility ?? 0) / 1000)} km`;

    const strip = document.getElementById('hourly-strip');
    strip.innerHTML = '';
    times.slice(sliceStart, sliceStart + 6).forEach((t, i) => {
      const idx        = sliceStart + i;
      const temp       = displayTemp(hrly.temperature_2m[idx]);
      const wmoH       = getWmo(hrly.weather_code[idx]);
      const uvH        = hrly.uv_index ? hrly.uv_index[idx] : 0;
      const shadeH     = calcShadeScore(hrly.weather_code[idx], uvH);
      const shadeEmoji = shadeH >= 65 ? '🌿' : shadeH >= 40 ? '⛅' : '☀️';
      strip.innerHTML +=
        `<div class="hour-card${i === 0 ? ' now' : ''}">
          <div class="hour-time">${i === 0 ? 'Now' : fmtHour(t)}</div>
          <i class="ti ${wmoH.icon}"></i>
          <div class="hour-temp">${temp}°</div>
          <div class="hour-shade">${shadeEmoji} ${shadeH}%</div>
        </div>`;
    });

    function avgShadeForWindow(startH, endH) {
      const indices = times.reduce((acc, t, i) => {
        const h = new Date(t).getHours();
        if (h >= startH && h < endH) acc.push(i);
        return acc;
      }, []);
      if (!indices.length) return 50;
      const scores = indices.map(i =>
        calcShadeScore(hrly.weather_code[i], hrly.uv_index ? hrly.uv_index[i] : 0)
      );
      return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }

    const windows = [
      { id: 'morning',   start: 6,  end: 12 },
      { id: 'midday',    start: 12, end: 14 },
      { id: 'afternoon', start: 14, end: 18 },
      { id: 'evening',   start: 18, end: 22 },
    ];

    let lowestWindow = null;
    let lowestScore  = 100;

    windows.forEach(({ id, start, end }) => {
      const s = avgShadeForWindow(start, end);
      document.getElementById(`bar-${id}`).style.width      = `${s}%`;
      document.getElementById(`bar-${id}`).style.background = barColor(s);
      document.getElementById(`pct-${id}`).textContent      = `${s}%`;
      if (s < lowestScore) { lowestScore = s; lowestWindow = id; }
    });

    document.getElementById('shade-alert').style.display = 'none';
    if (lowestScore < 55) {
      const labels = {
        morning:   'Morning (6 AM–12 PM)',
        midday:    'Midday (12–2 PM)',
        afternoon: 'Afternoon (2–6 PM)',
        evening:   'Evening (6–10 PM)',
      };
      document.getElementById('shade-alert-text').innerHTML =
        `<strong>Low shade during ${labels[lowestWindow]}</strong>` +
        `Shade coverage drops to ${lowestScore}% during this window. ` +
        `Consider trails with dense tree cover, or visit during a shadier time of day.`;
      document.getElementById('shade-alert').style.display = 'flex';
    }

    document.getElementById('weather-loading').style.display = 'none';
    document.getElementById('weather-content').style.display = 'block';
  }

  // ── Refresh when tab regains focus after being away ──────────
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && lastFetchTime) {
      if (Date.now() - lastFetchTime >= AUTO_REFRESH_MS) {
        fetchWeather({ silent: true });
      }
    }
  });

  // ── Initial load ─────────────────────────────────────────────
  fetchWeather();
