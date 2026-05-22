/**
 * weather.js
 * Manages weather data fetching, rendering, and UI interactions for the application.
 */

const LOCATION = {
  lat: 49.2827,
  lon: -123.1207,
  label: "Vancouver, BC",
};

const AUTO_REFRESH_MS = 10 * 60 * 1000;
const STALE_THRESHOLD_MS = 20 * 60 * 1000;

let currentUnit = "C";
let lastWeatherData = null;
let lastFetchTime = null;
let autoRefreshTimer = null;
let staleCheckTimer = null;
let isRefreshing = false;

const WMO_CODES = {
  0: { label: "Clear Sky", icon: "wi-sun", tiIcon: "ti-sun" },
  1: { label: "Mainly Clear", icon: "wi-sun", tiIcon: "ti-sun" },
  2: { label: "Partly Cloudy", icon: "wi-cloud-sun", tiIcon: "ti-cloud-sun" },
  3: { label: "Overcast", icon: "wi-cloud", tiIcon: "ti-cloud" },
  45: { label: "Foggy", icon: "wi-cloud-fog", tiIcon: "ti-cloud-fog" },
  48: { label: "Icy Fog", icon: "wi-cloud-fog", tiIcon: "ti-cloud-fog" },
  51: {
    label: "Light Drizzle",
    icon: "wi-cloud-drizzle",
    tiIcon: "ti-cloud-drizzle",
  },
  53: {
    label: "Drizzle",
    icon: "wi-cloud-drizzle",
    tiIcon: "ti-cloud-drizzle",
  },
  55: {
    label: "Heavy Drizzle",
    icon: "wi-cloud-drizzle",
    tiIcon: "ti-cloud-drizzle",
  },
  61: { label: "Light Rain", icon: "wi-cloud-rain", tiIcon: "ti-cloud-rain" },
  63: { label: "Rain", icon: "wi-cloud-rain", tiIcon: "ti-cloud-rain" },
  65: { label: "Heavy Rain", icon: "wi-cloud-rain", tiIcon: "ti-cloud-rain" },
  71: { label: "Light Snow", icon: "wi-snowflake", tiIcon: "ti-snowflake" },
  73: { label: "Snow", icon: "wi-snowflake", tiIcon: "ti-snowflake" },
  75: { label: "Heavy Snow", icon: "wi-snowflake", tiIcon: "ti-snowflake" },
  80: { label: "Showers", icon: "wi-cloud-rain", tiIcon: "ti-cloud-rain" },
  81: {
    label: "Heavy Showers",
    icon: "wi-cloud-storm",
    tiIcon: "ti-cloud-storm",
  },
  95: {
    label: "Thunderstorm",
    icon: "wi-cloud-storm",
    tiIcon: "ti-cloud-storm",
  },
  99: { label: "Hail Storm", icon: "wi-cloud-storm", tiIcon: "ti-cloud-storm" },
};

/**
 * Retrieves the metadata for a given WMO weather code.
 * @param {number} code - The WMO weather code.
 * @returns {Object} The weather condition metadata including labels and icons.
 */
function getWmo(code) {
  return (
    WMO_CODES[code] ?? {
      label: "Unknown",
      icon: "wi-cloud",
      tiIcon: "ti-cloud",
    }
  );
}

/**
 * Updates the class and style of a DOM element to display the correct weather icon.
 * @param {HTMLElement} el - The target element (typically an <i> tag).
 * @param {Object} wmoEntry - The metadata object retrieved from WMO_CODES.
 * @param {string} [size] - Optional CSS font-size string.
 */
function setAnimatedIcon(el, wmoEntry, size) {
  el.className = `wi ${wmoEntry.icon}`;
  if (size) el.style.fontSize = size;
}

/**
 * Calculates a shade score based on cloud cover and UV index.
 * @param {number} wmoCode - The WMO weather code.
 * @param {number} uvIndex - The current UV index value.
 * @returns {number} A score between 0 and 100.
 */
function calcShadeScore(wmoCode, uvIndex) {
  let cloudShade;
  if (wmoCode <= 1) cloudShade = 5;
  else if (wmoCode === 2) cloudShade = 45;
  else if (wmoCode === 3) cloudShade = 70;
  else cloudShade = 80;

  const uvShade = Math.max(0, Math.round(100 - (uvIndex / 11) * 80));
  return Math.min(100, Math.round((cloudShade + uvShade) / 2));
}

/**
 * Returns the CSS class corresponding to the shade score level.
 * @param {number} score - The shade score.
 * @returns {string} The CSS class name.
 */
function shadeClass(score) {
  if (score >= 65) return "high";
  if (score >= 40) return "medium";
  return "low";
}

/**
 * Returns a human-readable caption string for the shade score.
 * @param {number} score - The shade score.
 * @returns {string} HTML string representing the caption.
 */
function shadeCaption(score) {
  if (score >= 65) return "Good shade<br>conditions";
  if (score >= 40) return "Moderate shade<br>conditions";
  return "Low shade<br>today";
}

/**
 * Returns the color hex code for the shade progress bar.
 * @param {number} score - The shade score.
 * @returns {string} The CSS color code.
 */
function shadeBarColor(score) {
  if (score >= 65) return "#3b6d11";
  if (score >= 40) return "#ba7517";
  return "#c0392b";
}

/**
 * Returns an emoji representation of the current shade level.
 * @param {number} score - The shade score.
 * @returns {string} The emoji character.
 */
function shadeEmoji(score) {
  if (score >= 65) return "🌿";
  if (score >= 40) return "⛅";
  return "☀️";
}

/**
 * Converts Celsius to Fahrenheit.
 * @param {number} c - Temperature in Celsius.
 * @returns {number} Temperature in Fahrenheit.
 */
function toF(c) {
  return Math.round((c * 9) / 5 + 32);
}

/**
 * Formats the temperature display based on the currently selected unit.
 * @param {number} c - Temperature in Celsius.
 * @returns {number} The formatted temperature.
 */
function displayTemp(c) {
  return currentUnit === "C" ? Math.round(c) : toF(c);
}

/**
 * Returns the unit label string.
 * @returns {string} Either '°C' or '°F'.
 */
function unitLabel() {
  return currentUnit === "C" ? "°C" : "°F";
}

/**
 * Returns a human-readable description for apparent temperature.
 * @param {number} apparentC - Apparent temperature in Celsius.
 * @returns {string} Comfort descriptor.
 */
function feelsLikeLabel(apparentC) {
  if (apparentC <= -10) return "Dangerously cold";
  if (apparentC <= 0) return "Very cold";
  if (apparentC <= 8) return "Cold";
  if (apparentC <= 14) return "Cool";
  if (apparentC <= 20) return "Comfortable";
  if (apparentC <= 26) return "Warm";
  if (apparentC <= 32) return "Hot";
  return "Very hot";
}

/**
 * Formats an ISO date string to a 12-hour format string (e.g., "12 PM").
 * @param {string} isoStr - ISO date string.
 * @returns {string} Formatted hour string.
 */
function fmtHour(isoStr) {
  const h = new Date(isoStr).getHours();
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

/**
 * Shorthand for document.getElementById.
 * @param {string} id - The DOM element ID.
 * @returns {HTMLElement|null}
 */
function el(id) {
  return document.getElementById(id);
}

/**
 * Updates the application's temperature unit preference.
 * @param {string} unit - The unit to set ('C' or 'F').
 */
function setUnit(unit) {
  if (unit === currentUnit) return;
  currentUnit = unit;
  el("btn-c").classList.toggle("active", unit === "C");
  el("btn-f").classList.toggle("active", unit === "F");
  if (lastWeatherData) updateTemperatureDisplays();
}

/**
 * Refreshes all temperature-related UI components in the DOM.
 */
function updateTemperatureDisplays() {
  const { cur, hrly, dly, sliceStart, times } = lastWeatherData;
  el("temp-display").innerHTML =
    `${displayTemp(cur.temperature_2m)}<sup>${unitLabel()}</sup>`;
  renderFeelsLike(cur, dly);
  renderHourlyStrip(hrly, times, sliceStart);
}

/**
 * Renders the feels-like information section.
 * @param {Object} cur - Current weather data.
 * @param {Object} dly - Daily forecast data.
 */
function renderFeelsLike(cur, dly) {
  const apparentC = cur.apparent_temperature;
  const label = feelsLikeLabel(apparentC);
  const diff = Math.round(apparentC - cur.temperature_2m);
  const diffStr = diff === 0 ? "" : diff > 0 ? ` (+${diff}°)` : ` (${diff}°)`;

  el("feels-like").innerHTML =
    `Feels like <strong>${displayTemp(apparentC)}°</strong>` +
    `<span class="feels-label">${label}</span>` +
    `<span class="feels-diff">${diffStr}</span>` +
    `<span class="feels-range">` +
    `↑ ${displayTemp(dly.temperature_2m_max[0])}°` +
    `<span class="feels-range-sep">·</span>` +
    `↓ ${displayTemp(dly.temperature_2m_min[0])}°` +
    `</span>`;
}

/**
 * Shows the loading state in the UI.
 */
function showLoading() {
  el("weather-loading").style.display = "block";
  el("weather-error").style.display = "none";
  el("weather-content").style.display = "none";
}

/**
 * Displays an error message in the UI.
 * @param {string} message - The error message text.
 */
function showError(message) {
  el("weather-loading").style.display = "none";
  el("weather-content").style.display = "none";
  el("weather-error").style.display = "block";
  el("weather-error-msg").textContent = message;
}

/**
 * Shows the main content area and hides loading elements.
 */
function showContent() {
  el("weather-loading").style.display = "none";
  el("weather-content").style.display = "block";
}

/**
 * Toggles the loading animation on the refresh button.
 * @param {boolean} spinning - Whether to show the spinning animation.
 */
function setRefreshSpinning(spinning) {
  const btn = el("refresh-btn");
  if (!btn) return;
  btn.classList.toggle("spinning", spinning);
  btn.disabled = spinning;
}

/**
 * Shows or hides the stale data indicator.
 * @param {boolean} stale - Whether the current data is considered stale.
 */
function markStale(stale) {
  el("stale-badge").style.display = stale ? "inline" : "none";
}

/**
 * Schedules automatic data refreshes and sets up a timer for staleness alerts.
 */
function scheduleAutoRefresh() {
  clearTimeout(autoRefreshTimer);
  clearTimeout(staleCheckTimer);
  autoRefreshTimer = setTimeout(
    () => fetchWeather({ silent: true }),
    AUTO_REFRESH_MS,
  );
  staleCheckTimer = setTimeout(() => markStale(true), STALE_THRESHOLD_MS);
}

/**
 * Triggers a manual data refresh.
 */
function manualRefresh() {
  if (!isRefreshing) fetchWeather({ silent: true });
}

/**
 * Fetches weather data from the external API and handles success/error states.
 * @param {Object} [options] - Configuration options.
 * @param {boolean} [options.silent] - If true, avoids full-page loading indicators.
 */
async function fetchWeather({ silent = false } = {}) {
  if (isRefreshing) return;
  isRefreshing = true;

  const hasContent = el("weather-content").style.display !== "none";
  if (silent && hasContent) {
    setRefreshSpinning(true);
  } else {
    showLoading();
  }

  let data;
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", LOCATION.lat);
    url.searchParams.set("longitude", LOCATION.lon);
    url.searchParams.set(
      "current",
      "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,uv_index,visibility",
    );
    url.searchParams.set("hourly", "temperature_2m,weather_code,uv_index");
    url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", "1");

    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    data = await res.json();
  } catch (err) {
    console.error("Weather API error:", err);
    if (silent && hasContent) {
      markStale(true);
      scheduleAutoRefresh();
    } else {
      showError(
        "Could not load weather data. Check your connection and try again.",
      );
    }
    setRefreshSpinning(false);
    isRefreshing = false;
    return;
  }

  if (!data.current || !data.hourly || !data.daily) {
    console.error("Unexpected API response shape:", data);
    if (!silent || !hasContent) {
      showError(
        "Received unexpected data from the weather service. Please try again.",
      );
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
  } catch (err) {
    console.error("Render error:", err);
    if (!silent || !hasContent) {
      showError(
        "Something went wrong displaying the weather. Please try again.",
      );
    }
  }

  setRefreshSpinning(false);
  isRefreshing = false;
}

/**
 * Initiates an AI-generated summary request using the latest cached weather data.
 */
function requestAISummary() {
  if (!lastWeatherData) return;
  fetchAISummary(lastWeatherData.cur);
}

/**
 * Fetches an AI-generated summary from the backend API.
 * @param {Object} cur - The current weather metrics object.
 */
async function fetchAISummary(cur) {
  const idleEl = document.getElementById("ai-summary-idle");
  const loadingEl = document.getElementById("ai-summary-loading");
  const summaryEl = document.getElementById("ai-summary");
  const regenEl = document.getElementById("ai-summary-regen");
  const btn = document.getElementById("ai-summary-btn");

  idleEl.style.display = "none";
  loadingEl.style.display = "flex";
  summaryEl.style.display = "none";
  regenEl.style.display = "none";
  if (btn) btn.disabled = true;

  const wmo = getWmo(cur.weather_code);
  const rainChance =
    cur.weather_code >= 51 ? 70 : cur.weather_code >= 2 ? 20 : 5;

  const params = new URLSearchParams({
    temp: Math.round(cur.temperature_2m),
    rain: rainChance,
    wind: Math.round(cur.wind_speed_10m),
    uv: Math.round(cur.uv_index ?? 0),
    condition: wmo.label,
  });

  try {
    const res = await fetch(`/api/ai-weather-summary?${params}`);
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Unknown error");

    summaryEl.textContent = data.summary;
    summaryEl.style.display = "block";
    regenEl.style.display = "block";
  } catch (err) {
    console.error("AI summary error:", err);
    summaryEl.textContent =
      "AI summary unavailable. Please check the weather details manually.";
    summaryEl.style.display = "block";
    regenEl.style.display = "block";
  } finally {
    loadingEl.style.display = "none";
  }
}

/**
 * Orchestrates the rendering of all weather components on the page.
 * @param {Object} data - The full JSON object from the Open-Meteo API.
 */
function renderWeather(data) {
  const cur = data.current;
  const hrly = data.hourly;
  const dly = data.daily;
  const now = new Date();

  const times = hrly.time;
  const startIdx = times.findIndex(
    (t) => new Date(t).getHours() === now.getHours(),
  );
  const sliceStart = startIdx >= 0 ? startIdx : 0;

  lastWeatherData = { cur, hrly, dly, times, sliceStart };

  renderLocationBar(now);
  renderHeroCard(cur, dly);
  renderMetrics(cur);
  renderHourlyStrip(hrly, times, sliceStart);
  renderShadeBars(hrly, times);
  showContent();
}

/**
 * Renders the header location and last-updated information.
 * @param {Date} now - The current date/time object.
 */
function renderLocationBar(now) {
  el("location-name-text").textContent = LOCATION.label;
  el("location-sub").textContent =
    `Updated ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  el("location-date").textContent = now.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Renders the primary hero weather card with icon, temp, and shade score.
 * @param {Object} cur - Current weather data.
 * @param {Object} dly - Daily forecast data.
 */
function renderHeroCard(cur, dly) {
  const wmo = getWmo(cur.weather_code);
  const score = calcShadeScore(cur.weather_code, cur.uv_index ?? 0);
  const cls = shadeClass(score);

  const iconEl = el("condition-icon");
  setAnimatedIcon(iconEl, wmo, "1.1rem");

  el("condition-text").textContent = wmo.label;
  el("temp-display").innerHTML =
    `${displayTemp(cur.temperature_2m)}<sup>${unitLabel()}</sup>`;

  renderFeelsLike(cur, dly);

  el("shade-ring").className = `shade-ring shade-${cls}`;
  el("shade-score").className = `shade-ring-num shade-${cls}`;
  el("shade-score").textContent = score;
  el("shade-caption").innerHTML = shadeCaption(score);
}

/**
 * Renders humidity, wind, UV, and visibility metrics.
 * @param {Object} cur - Current weather data.
 */
function renderMetrics(cur) {
  el("m-humidity").textContent = `${cur.relative_humidity_2m}%`;
  el("m-wind").textContent = `${Math.round(cur.wind_speed_10m)} km/h`;
  el("m-uv").textContent = `UV ${Math.round(cur.uv_index ?? 0)}`;
  el("m-visibility").textContent =
    `${Math.round((cur.visibility ?? 0) / 1000)} km`;
}

/**
 * Renders the hourly weather forecast strip.
 * @param {Object} hrly - Hourly weather forecast object.
 * @param {Array<string>} times - Array of hourly timestamps.
 * @param {number} sliceStart - The starting index for the slice.
 */
function renderHourlyStrip(hrly, times, sliceStart) {
  const strip = el("hourly-strip");
  strip.innerHTML = "";

  times.slice(sliceStart, sliceStart + 6).forEach((t, i) => {
    const idx = sliceStart + i;
    const temp = displayTemp(hrly.temperature_2m[idx]);
    const wmoH = getWmo(hrly.weather_code[idx]);
    const uvH = hrly.uv_index?.[idx] ?? 0;
    const shadeH = calcShadeScore(hrly.weather_code[idx], uvH);

    strip.innerHTML += `<div class="hour-card${i === 0 ? " now" : ""}">
        <div class="hour-time">${i === 0 ? "Now" : fmtHour(t)}</div>
        <i class="wi ${wmoH.icon}"></i>
        <div class="hour-temp">${temp}°</div>
        <div class="hour-shade">${shadeEmoji(shadeH)} ${shadeH}%</div>
      </div>`;
  });
}

/**
 * Renders the visual shade bars for morning, midday, afternoon, and evening segments.
 * @param {Object} hrly - Hourly forecast object.
 * @param {Array<string>} times - Hourly timestamps.
 */
function renderShadeBars(hrly, times) {
  const windows = [
    { id: "morning", startH: 6, endH: 12 },
    { id: "midday", startH: 12, endH: 14 },
    { id: "afternoon", startH: 14, endH: 18 },
    { id: "evening", startH: 18, endH: 22 },
  ];

  const windowLabels = {
    morning: "Morning (6 AM–12 PM)",
    midday: "Midday (12–2 PM)",
    afternoon: "Afternoon (2–6 PM)",
    evening: "Evening (6–10 PM)",
  };

  let lowestWindow = null;
  let lowestScore = 100;

  windows.forEach(({ id, startH, endH }) => {
    const score = avgShadeForWindow(hrly, times, startH, endH);
    el(`bar-${id}`).style.width = `${score}%`;
    el(`bar-${id}`).style.background = shadeBarColor(score);
    el(`pct-${id}`).textContent = `${score}%`;
    if (score < lowestScore) {
      lowestScore = score;
      lowestWindow = id;
    }
  });

  el("shade-alert").style.display = "none";
  if (lowestScore < 55) {
    el("shade-alert-text").innerHTML =
      `<strong>Low shade during ${windowLabels[lowestWindow]}</strong>` +
      `Shade coverage drops to ${lowestScore}% during this window. ` +
      `Consider trails with dense tree cover, or visit during a shadier time of day.`;
    el("shade-alert").style.display = "flex";
  }
}

/**
 * Calculates the average shade score for a given time window.
 * @param {Object} hrly - Hourly forecast object.
 * @param {Array<string>} times - Hourly timestamps.
 * @param {number} startH - Start hour of the window.
 * @param {number} endH - End hour of the window.
 * @returns {number} Average shade score for the window.
 */
function avgShadeForWindow(hrly, times, startH, endH) {
  const indices = times.reduce((acc, t, i) => {
    const h = new Date(t).getHours();
    if (h >= startH && h < endH) acc.push(i);
    return acc;
  }, []);

  if (!indices.length) return 50;

  const scores = indices.map((i) =>
    calcShadeScore(hrly.weather_code[i], hrly.uv_index?.[i] ?? 0),
  );
  return Math.round(scores.reduce((a, b) => a + b, 0) / indices.length);
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && lastFetchTime) {
    if (Date.now() - lastFetchTime >= AUTO_REFRESH_MS) {
      fetchWeather({ silent: true });
    }
  }
});

fetchWeather();
