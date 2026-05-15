/**
 * ShadyTrails Dashboard — Client-Side Interactivity
 * Handles dynamic elements, animations, and user interactions
 */

(function () {
  'use strict';

  // Constants
  const VANCOUVER_LAT = 49.2827;
  const VANCOUVER_LON = -123.1207;

  // ──────────────────────────────────────────────────────────
  // INITIALIZATION
  // ──────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    console.log('Dashboard initializing...');
    fetchWeatherData();
    fetchTrailRecommendation();
    loadTipOfDay();
    initializeTrailRecommendation();
    initializeActivityAnimations();
    initializeCardAnimations();
  });

  // ──────────────────────────────────────────────────────────
  // WEATHER — Using Open-Meteo API (with fallback)
  // ──────────────────────────────────────────────────────────

  async function fetchWeatherData() {
    const loadingEl = document.getElementById('weather-loading');
    const contentEl = document.getElementById('weather-content');
    const errorEl = document.getElementById('weather-error');

    try {
      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${VANCOUVER_LAT}&longitude=${VANCOUVER_LON}` +
        `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,uv_index` +
        `&timezone=auto`;

      console.log('Fetching weather from Open-Meteo...');
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Weather API returned ${response.status}`);
      }

      const data = await response.json();
      console.log('Weather data received:', data);

      if (!data.current) {
        throw new Error('Invalid weather data structure');
      }

      // Parse weather codes to get condition description
      const weatherCondition = getWeatherCondition(data.current.weather_code);
      const weatherIcon = getWeatherIcon(data.current.weather_code);

      // Update DOM elements
      document.getElementById('weather-icon').textContent = weatherIcon;
      document.getElementById('weather-condition').textContent =
        weatherCondition;
      document.getElementById('weather-temp').textContent = Math.round(
        data.current.temperature_2m,
      );
      document.getElementById('weather-wind').textContent = Math.round(
        data.current.wind_speed_10m,
      );
      document.getElementById('weather-humidity').textContent = Math.round(
        data.current.relative_humidity_2m,
      );
      document.getElementById('weather-uv').textContent = Math.round(
        data.current.uv_index,
      );

      // Show content, hide loading
      if (loadingEl) loadingEl.style.display = 'none';
      if (contentEl) contentEl.style.display = 'grid';
      if (errorEl) errorEl.style.display = 'none';

      console.log('Weather data loaded successfully');
    } catch (error) {
      console.error('Weather fetch error:', error);
      // Use fallback data instead of showing error
      showWeatherFallback(loadingEl, contentEl, errorEl);
    }
  }

  function showWeatherFallback(loadingEl, contentEl, errorEl) {
    // Show fallback weather data when API is unavailable
    console.log('Using fallback weather data');
    try {
      document.getElementById('weather-icon').textContent = '🌤️';
      document.getElementById('weather-condition').textContent =
        'Partly cloudy';
      document.getElementById('weather-temp').textContent = '15';
      document.getElementById('weather-wind').textContent = '10';
      document.getElementById('weather-humidity').textContent = '65';
      document.getElementById('weather-uv').textContent = '3';

      if (loadingEl) loadingEl.style.display = 'none';
      if (contentEl) contentEl.style.display = 'grid';
      if (errorEl) errorEl.style.display = 'none';
    } catch (err) {
      console.error('Error showing weather fallback:', err);
    }
  }

  function getWeatherCondition(code) {
    // WMO Weather interpretation codes
    if (code === 0) return 'Clear';
    if ([1, 2].includes(code)) return 'Partly cloudy';
    if (code === 3) return 'Overcast';
    if ([45, 48].includes(code)) return 'Foggy';
    if ([51, 53, 55].includes(code)) return 'Drizzle';
    if ([61, 63, 65, 80, 81, 82].includes(code)) return 'Rainy';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snowy';
    if ([80, 81, 82, 95, 96, 99].includes(code)) return 'Thunderstorm';
    return 'Cloudy';
  }

  function getWeatherIcon(code) {
    if (code === 0) return '☀️';
    if ([1, 2].includes(code)) return '🌤️';
    if (code === 3) return '☁️';
    if ([45, 48].includes(code)) return '🌫️';
    if ([51, 53, 55].includes(code)) return '🌦️';
    if ([61, 63, 65, 80, 81, 82].includes(code)) return '🌧️';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄️';
    if ([80, 81, 82, 95, 96, 99].includes(code)) return '⛈️';
    return '🌤️';
  }

  // ──────────────────────────────────────────────────────────
  // TRAIL RECOMMENDATION — Fetch from backend API
  // ──────────────────────────────────────────────────────────

  async function fetchTrailRecommendation() {
    const loadingEl = document.getElementById('trail-loading');
    const contentEl = document.getElementById('trail-content');
    const errorEl = document.getElementById('trail-error');

    try {
      console.log(
        'Fetching trail recommendation from /api/recommended-trail...',
      );
      const response = await fetch('/api/recommended-trail');

      console.log('Trail API response status:', response.status);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      console.log('Trail data received:', data);

      if (data.trail) {
        updateTrailDisplay(data.trail);
        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';
        if (errorEl) errorEl.style.display = 'none';
        console.log('Trail recommendation loaded successfully');
      } else {
        throw new Error('No trail data received');
      }
    } catch (error) {
      console.error('Trail recommendation error:', error);
      if (loadingEl) loadingEl.style.display = 'none';
      if (contentEl) contentEl.style.display = 'none';
      if (errorEl) {
        errorEl.style.display = 'block';
        document.getElementById('trail-error-text').textContent =
          "Could not load trail recommendation. Make sure you're logged in.";
      }
    }
  }

  function updateTrailDisplay(trail) {
    console.log('Updating trail display with:', trail);

    // Generate stars
    let stars = '';
    const rating = parseFloat(trail.rating) || 0;
    for (let i = 0; i < 5; i++) {
      stars += i < Math.floor(rating) ? '★' : '☆';
    }

    // Update DOM
    const nameEl = document.getElementById('trail-name');
    const starsEl = document.getElementById('trail-stars');
    const ratingEl = document.getElementById('trail-rating');
    const descEl = document.getElementById('trail-description');
    const distanceEl = document.getElementById('trail-distance');
    const durationEl = document.getElementById('trail-duration');
    const difficultyEl = document.getElementById('trail-difficulty');
    const mapLink = document.getElementById('trail-map-link');

    if (nameEl) nameEl.textContent = trail.name || '—';
    if (starsEl) starsEl.textContent = stars;
    if (ratingEl) ratingEl.textContent = (trail.rating || '—').toFixed(1);
    if (descEl) descEl.textContent = trail.description || '—';
    if (distanceEl) distanceEl.textContent = (trail.distance || '—') + ' km';
    if (durationEl) durationEl.textContent = trail.duration || '—';

    if (difficultyEl) {
      const difficulty = trail.difficulty || '—';
      difficultyEl.textContent = difficulty;
      difficultyEl.className =
        'st-trail-rec__detail-value st-trail-rec__difficulty--' +
        difficulty.toLowerCase();
    }

    // Update map link
    if (mapLink && trail.id) {
      mapLink.href = '/map?trail=' + trail.id;
    }

    // Store trail ID for next recommendation button
    window.currentTrailId = trail.id;
  }

  // ──────────────────────────────────────────────────────────
  // TIPS OF THE DAY — Client-side calculation
  // ──────────────────────────────────────────────────────────

  const TIPS = [
    {
      content:
        'Start your hike early to avoid crowds and enjoy cooler temperatures.',
      category: 'General Hiking Tips',
    },
    {
      content:
        "Always bring more water than you think you'll need. A good rule is 1 liter per hour of hiking.",
      category: 'Safety & Hydration',
    },
    {
      content:
        'Wear layers! You can adjust them as your body temperature changes during the hike.',
      category: 'Gear Tips',
    },
    {
      content:
        'Use sunscreen with at least SPF 30, even on cloudy days. UV rays can reflect off leaves and water.',
      category: 'Sun Protection',
    },
    {
      content:
        'Check trail conditions before you go. Weather can change quickly in forested areas.',
      category: 'Planning Tips',
    },
    {
      content:
        'Take breaks to enjoy the scenery. Hiking is not a race—savor the experience!',
      category: 'Mindfulness',
    },
    {
      content:
        'Leave No Trace: Pack out everything you pack in, including snacks and trash.',
      category: 'Environmental Stewardship',
    },
    {
      content: 'Invest in good hiking boots. Blisters can ruin a great hike.',
      category: 'Gear Tips',
    },
  ];

  function loadTipOfDay() {
    console.log('Loading tip of the day...');
    // Calculate day of year for consistent daily tips
    const now = new Date();
    const dayOfYear = Math.floor(
      (now - new Date(now.getFullYear(), 0, 0)) / 86400000,
    );
    const tipIndex = dayOfYear % TIPS.length;
    const tip = TIPS[tipIndex];

    const contentEl = document.getElementById('tip-content');
    const categoryEl = document.getElementById('tip-category');

    if (contentEl) contentEl.textContent = tip.content;
    if (categoryEl) categoryEl.textContent = tip.category;

    console.log('Tip loaded:', tip);
  }

  // ──────────────────────────────────────────────────────────
  // TRAIL RECOMMENDATION - "See Another" Functionality
  // ──────────────────────────────────────────────────────────

  function initializeTrailRecommendation() {
    const nextRecButton = document.getElementById('btn-next-recommendation');

    if (nextRecButton) {
      nextRecButton.addEventListener('click', function (e) {
        e.preventDefault();
        console.log('Fetching next recommendation...');
        fetchNextRecommendation();
      });
    }
  }

  async function fetchNextRecommendation() {
    try {
      const response = await fetch('/api/recommended-trail');

      if (!response.ok) {
        console.error('Failed to fetch next recommendation:', response.status);
        return;
      }

      const data = await response.json();

      if (data.trail) {
        updateTrailDisplay(data.trail);
        // Add animation effect
        const trailCard = document.querySelector('.st-dashboard__card--trail');
        if (trailCard) {
          animateCardUpdate(trailCard);
        }
      }
    } catch (error) {
      console.error('Error fetching next trail recommendation:', error);
    }
  }

  function animateCardUpdate(card) {
    card.style.opacity = '0.7';
    card.style.transform = 'scale(0.98)';

    setTimeout(() => {
      card.style.opacity = '1';
      card.style.transform = 'scale(1)';
    }, 100);
  }

  // ──────────────────────────────────────────────────────────
  // ACTIVITY LIST ANIMATIONS
  // ──────────────────────────────────────────────────────────

  function initializeActivityAnimations() {
    const activityItems = document.querySelectorAll('.st-activity-item');

    activityItems.forEach((item, index) => {
      item.style.opacity = '0';
      item.style.transform = 'translateY(10px)';
      item.style.transition = 'opacity 0.4s ease, transform 0.4s ease';

      setTimeout(
        () => {
          item.style.opacity = '1';
          item.style.transform = 'translateY(0)';
        },
        100 * (index + 1),
      );
    });
  }

  // ──────────────────────────────────────────────────────────
  // CARD HOVER EFFECTS
  // ──────────────────────────────────────────────────────────

  function initializeCardAnimations() {
    const cards = document.querySelectorAll('.st-dashboard__card');

    cards.forEach((card) => {
      card.addEventListener('mouseenter', function () {
        this.style.transform = 'translateY(-2px)';
      });

      card.addEventListener('mouseleave', function () {
        this.style.transform = 'translateY(0)';
      });
    });
  }

  // ──────────────────────────────────────────────────────────
  // UTILITY: Smooth scroll to section
  // ──────────────────────────────────────────────────────────

  window.scrollToSection = function (sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // ──────────────────────────────────────────────────────────
  // LOCAL STORAGE: Remember user preferences (optional)
  // ──────────────────────────────────────────────────────────

  window.saveDashboardPreference = function (key, value) {
    try {
      localStorage.setItem('dashboard_' + key, JSON.stringify(value));
    } catch (e) {
      console.warn('LocalStorage not available:', e);
    }
  };

  window.getDashboardPreference = function (key, defaultValue) {
    try {
      const item = localStorage.getItem('dashboard_' + key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.warn('LocalStorage not available:', e);
      return defaultValue;
    }
  };

  // ──────────────────────────────────────────────────────────
  // QUICK STAT UPDATES
  // ──────────────────────────────────────────────────────────

  window.updateStatCard = function (icon, number, label) {
    const statCards = document.querySelectorAll('.st-stat-card');

    statCards.forEach((card) => {
      const cardLabel = card.querySelector('.st-stat-card__label');
      if (cardLabel && cardLabel.textContent.includes(label)) {
        const numberEl = card.querySelector('.st-stat-card__number');
        const iconEl = card.querySelector('.st-stat-card__icon');

        if (numberEl) numberEl.textContent = number;
        if (iconEl) iconEl.textContent = icon;

        // Highlight with animation
        card.style.background = 'rgba(138, 171, 94, 0.15)';
        setTimeout(() => {
          card.style.background = 'var(--glass-bg)';
        }, 1000);
      }
    });
  };

  console.log('Dashboard.js loaded and ready');
})();
