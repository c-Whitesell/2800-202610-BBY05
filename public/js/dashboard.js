/**
 * @description Immediately Invoked Function Expression (IIFE) to encapsulate
 * dashboard logic and prevent polluting the global namespace.
 * @returns {void}
 */
(function () {
  "use strict";

  const VANCOUVER_LAT = 49.2827;
  const VANCOUVER_LON = -123.1207;

  /**
   * @description Main initialization function triggered when the HTML document is fully loaded.
   * Boots up the dashboard by fetching initial data (weather, trails) and binding UI events/animations.
   * @returns {void}
   */
  document.addEventListener("DOMContentLoaded", function () {
    console.log("Dashboard initializing...");
    fetchWeatherData();
    fetchTrailRecommendation();
    loadTipOfDay();
    initializeTrailRecommendation();
    initializeActivityAnimations();
    initializeCardAnimations();

    const loadMoreBtn = document.getElementById("load-more-activity");
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener("click", loadMoreActivity);
    }
  });

  /**
   * @description Fetches current weather data for Vancouver from the Open-Meteo API.
   * @returns {Promise<void>} Updates DOM elements asynchronously.
   */
  async function fetchWeatherData() {
    const loadingEl = document.getElementById("weather-loading");
    const contentEl = document.getElementById("weather-content");
    const errorEl = document.getElementById("weather-error");

    try {
      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${VANCOUVER_LAT}&longitude=${VANCOUVER_LON}` +
        `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,uv_index` +
        `&timezone=auto`;

      console.log("Fetching weather from Open-Meteo...");

      // Read: Fetch external weather data (GET)
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Weather API returned ${response.status}`);
      }

      const data = await response.json();
      console.log("Weather data received:", data);

      if (!data.current) {
        throw new Error("Invalid weather data structure");
      }

      const weatherCondition = getWeatherCondition(data.current.weather_code);
      const weatherIcon = getWeatherIcon(data.current.weather_code);

      document.getElementById("weather-icon").textContent = weatherIcon;
      document.getElementById("weather-condition").textContent =
        weatherCondition;
      document.getElementById("weather-temp").textContent = Math.round(
        data.current.temperature_2m,
      );
      document.getElementById("weather-wind").textContent = Math.round(
        data.current.wind_speed_10m,
      );
      document.getElementById("weather-humidity").textContent = Math.round(
        data.current.relative_humidity_2m,
      );
      document.getElementById("weather-uv").textContent = Math.round(
        data.current.uv_index,
      );

      if (loadingEl) loadingEl.style.display = "none";
      if (contentEl) contentEl.style.display = "grid";
      if (errorEl) errorEl.style.display = "none";

      console.log("Weather data loaded successfully");
    } catch (error) {
      console.error("Weather fetch error:", error);
      showWeatherFallback(loadingEl, contentEl, errorEl);
    }
  }

  /**
   * @description Displays hardcoded fallback weather data if the API request fails.
   * @param {HTMLElement} loadingEl - The loading DOM element.
   * @param {HTMLElement} contentEl - The content DOM element.
   * @param {HTMLElement} errorEl - The error DOM element.
   * @returns {void}
   */
  function showWeatherFallback(loadingEl, contentEl, errorEl) {
    console.log("Using fallback weather data");
    try {
      document.getElementById("weather-icon").textContent = "🌤️";
      document.getElementById("weather-condition").textContent =
        "Partly cloudy";
      document.getElementById("weather-temp").textContent = "15";
      document.getElementById("weather-wind").textContent = "10";
      document.getElementById("weather-humidity").textContent = "65";
      document.getElementById("weather-uv").textContent = "3";

      if (loadingEl) loadingEl.style.display = "none";
      if (contentEl) contentEl.style.display = "grid";
      if (errorEl) errorEl.style.display = "none";
    } catch (err) {
      console.error("Error showing weather fallback:", err);
    }
  }

  /**
   * @description Maps Open-Meteo WMO weather codes to readable text conditions.
   * @param {number} code - The WMO weather code.
   * @returns {string} Readable weather condition.
   */
  function getWeatherCondition(code) {
    if (code === 0) return "Clear";
    if ([1, 2].includes(code)) return "Partly cloudy";
    if (code === 3) return "Overcast";
    if ([45, 48].includes(code)) return "Foggy";
    if ([51, 53, 55].includes(code)) return "Drizzle";
    if ([61, 63, 65, 80, 81, 82].includes(code)) return "Rainy";
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snowy";
    if ([80, 81, 82, 95, 96, 99].includes(code)) return "Thunderstorm";
    return "Cloudy";
  }

  /**
   * @description Maps Open-Meteo WMO weather codes to appropriate emojis.
   * @param {number} code - The WMO weather code.
   * @returns {string} Emoji representing the weather.
   */
  function getWeatherIcon(code) {
    if (code === 0) return "☀️";
    if ([1, 2].includes(code)) return "🌤️";
    if (code === 3) return "☁️";
    if ([45, 48].includes(code)) return "🌫️";
    if ([51, 53, 55].includes(code)) return "🌦️";
    if ([61, 63, 65, 80, 81, 82].includes(code)) return "🌧️";
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄️";
    if ([80, 81, 82, 95, 96, 99].includes(code)) return "⛈️";
    return "🌤️";
  }

  /**
   * @description Fetches the daily trail recommendation from the internal API.
   * @returns {Promise<void>} Updates DOM asynchronously.
   */
  async function fetchTrailRecommendation() {
    const loadingEl = document.getElementById("trail-loading");
    const contentEl = document.getElementById("trail-content");
    const errorEl = document.getElementById("trail-error");

    try {
      console.log(
        "Fetching trail recommendation from /api/recommended-trail...",
      );

      // Read: Fetch standard trail recommendation from internal API
      const response = await fetch("/api/recommended-trail");
      console.log("Trail API response status:", response.status);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      console.log("Trail data received:", data);

      if (data.trail) {
        updateTrailDisplay(data.trail);

        if (loadingEl) loadingEl.style.display = "none";
        if (contentEl) contentEl.style.display = "block";
        if (errorEl) errorEl.style.display = "none";
        console.log("Trail recommendation loaded successfully");
      } else {
        throw new Error("No trail data received");
      }
    } catch (error) {
      console.error("Trail recommendation error:", error);
      if (loadingEl) loadingEl.style.display = "none";
      if (contentEl) contentEl.style.display = "none";
      if (errorEl) {
        errorEl.style.display = "block";
        document.getElementById("trail-error-text").textContent =
          "Could not load trail recommendation. Make sure you're logged in.";
      }
    }
  }

  /**
   * @description Populates the DOM with the provided trail object data.
   * @param {Object} trail - The trail data object to display.
   * @returns {void}
   */
  function updateTrailDisplay(trail) {
    console.log("Updating trail display with:", trail);

    let stars = "";
    const parsedRating = parseFloat(trail.rating);
    const rating = isNaN(parsedRating) ? 0 : parsedRating;

    for (let i = 0; i < 5; i++) {
      stars += i < Math.floor(rating) ? "★" : "☆";
    }

    const nameEl = document.getElementById("trail-name");
    const starsEl = document.getElementById("trail-stars");
    const ratingEl = document.getElementById("trail-rating");
    const descEl = document.getElementById("trail-description");
    const distanceEl = document.getElementById("trail-distance");
    const durationEl = document.getElementById("trail-duration");
    const difficultyEl = document.getElementById("trail-difficulty");
    const mapLink = document.getElementById("trail-map-link");

    if (nameEl) nameEl.textContent = trail.name || "—";
    if (starsEl) starsEl.textContent = stars;
    if (ratingEl)
      ratingEl.textContent = !isNaN(rating) ? rating.toFixed(1) : "—";

    if (descEl) {
      const cleanDescription = (trail.description || "—")
        .replace(/\*\*/g, "")
        .replace(/Trail:|Name:|Distance:|Difficulty:/gi, "")
        .trim();
      descEl.textContent = cleanDescription;
    }

    if (distanceEl) distanceEl.textContent = (trail.distance || "—") + " m";
    if (durationEl) durationEl.textContent = trail.duration || "—";

    if (difficultyEl) {
      const difficulty = trail.difficulty || "—";
      difficultyEl.textContent = difficulty;
      difficultyEl.className =
        "st-trail-rec__detail-value st-trail-rec__difficulty--" +
        difficulty.toLowerCase();
    }

    if (mapLink) {
      mapLink.href = `/map?zoom=17&lat=${trail.lat}&lng=${trail.lng}`;
    }

    window.currentTrailId = trail.id;
  }

  const TIPS = [
    {
      content:
        "Start your hike early to avoid crowds and enjoy cooler temperatures.",
      category: "General Hiking Tips",
    },
    {
      content:
        "Always bring more water than you think you'll need. A good rule is 1 liter per hour of hiking.",
      category: "Safety & Hydration",
    },
    {
      content:
        "Wear layers! You can adjust them as your body temperature changes during the hike.",
      category: "Gear Tips",
    },
    {
      content:
        "Use sunscreen with at least SPF 30, even on cloudy days. UV rays can reflect off leaves and water.",
      category: "Sun Protection",
    },
    {
      content:
        "Check trail conditions before you go. Weather can change quickly in forested areas.",
      category: "Planning Tips",
    },
    {
      content:
        "Take breaks to enjoy the scenery. Hiking is not a race—savor the experience!",
      category: "Mindfulness",
    },
    {
      content:
        "Leave No Trace: Pack out everything you pack in, including snacks and trash.",
      category: "Environmental Stewardship",
    },
    {
      content: "Invest in good hiking boots. Blisters can ruin a great hike.",
      category: "Gear Tips",
    },
  ];

  /**
   * @description Calculates and displays a daily hiking tip based on the current day of the year.
   * @returns {void}
   */
  function loadTipOfDay() {
    console.log("Loading tip of the day...");

    // Algorithm: Calculate current day of the year to loop through tips sequentially
    const now = new Date();
    const dayOfYear = Math.floor(
      (now - new Date(now.getFullYear(), 0, 0)) / 86400000,
    );
    const tipIndex = dayOfYear % TIPS.length;
    const tip = TIPS[tipIndex];

    const contentEl = document.getElementById("tip-content");
    const categoryEl = document.getElementById("tip-category");

    if (contentEl) contentEl.textContent = tip.content;
    if (categoryEl) categoryEl.textContent = tip.category;

    console.log("Tip loaded:", tip);
  }

  /**
   * @description Attaches event listeners for the "next recommendation" button.
   * @returns {void}
   */
  function initializeTrailRecommendation() {
    const nextRecButton = document.getElementById("btn-next-recommendation");

    if (nextRecButton) {
      nextRecButton.addEventListener("click", function (e) {
        e.preventDefault();
        console.log("Fetching next recommendation...");
        fetchNextRecommendation();
      });
    }
  }

  /**
   * @description Fetches an AI-generated trail recommendation and updates the UI.
   * @returns {Promise<void>} Updates DOM asynchronously.
   */
  async function fetchNextRecommendation() {
    try {
      console.log("Fetching next AI recommendation...");

      // Read: Fetch AI trail recommendation from internal endpoint
      const response = await fetch("/api/recommended-trail/ai");

      if (!response.ok) {
        console.error("Failed to fetch AI recommendation:", response.status);
        return;
      }

      const data = await response.json();

      if (data.trail) {
        updateTrailDisplay(data.trail);

        const card = document.querySelector(".st-dashboard__card--trail");
        if (card) animateCardUpdate(card);
      } else {
        console.warn("No trail returned from AI endpoint");
      }
    } catch (error) {
      console.error("Error fetching next trail recommendation:", error);
    }
  }

  /**
   * @description Applies a quick scale and opacity animation to a given dashboard card.
   * @param {HTMLElement} card - The DOM element to animate.
   * @returns {void}
   */
  function animateCardUpdate(card) {
    card.style.opacity = "0.7";
    card.style.transform = "scale(0.98)";

    setTimeout(() => {
      card.style.opacity = "1";
      card.style.transform = "scale(1)";
    }, 100);
  }

  /**
   * @description Staggers the entry animation for items in the activity list.
   * @returns {void}
   */
  function initializeActivityAnimations() {
    const activityItems = document.querySelectorAll(".st-activity-item");

    activityItems.forEach((item, index) => {
      item.style.opacity = "0";
      item.style.transform = "translateY(10px)";
      item.style.transition = "opacity 0.4s ease, transform 0.4s ease";

      setTimeout(
        () => {
          item.style.opacity = "1";
          item.style.transform = "translateY(0)";
        },
        100 * (index + 1),
      );
    });
  }

  /**
   * @description Binds hover animations for all dashboard cards.
   * @returns {void}
   */
  function initializeCardAnimations() {
    const cards = document.querySelectorAll(".st-dashboard__card");

    cards.forEach((card) => {
      card.addEventListener("mouseenter", function () {
        this.style.transform = "translateY(-2px)";
      });

      card.addEventListener("mouseleave", function () {
        this.style.transform = "translateY(0)";
      });
    });
  }

  let activityOffset = 5;
  const ACTIVITY_LIMIT = 5;

  /**
   * @description Fetches the next batch of user activities and appends them to the list.
   * @returns {Promise<void>} Updates DOM asynchronously.
   */
  async function loadMoreActivity() {
    try {
      // Read: Fetch paginated user activity data
      const res = await fetch(
        `/api/activity?limit=${ACTIVITY_LIMIT}&skip=${activityOffset}`,
      );

      const data = await res.json();

      if (!data.length) {
        document.getElementById("load-more-activity").style.display = "none";
        return;
      }

      appendActivityItems(data);
      activityOffset += data.length;
    } catch (err) {
      console.error("Load more activity error:", err);
    }
  }

  /**
   * @description Creates DOM elements for new activity items and appends them to the container.
   * @param {Array<Object>} items - List of activity objects to append.
   * @returns {void}
   */
  function appendActivityItems(items) {
    const container = document.querySelector(".st-activity-list");
    if (!container) return;

    items.forEach((activity) => {
      const el = document.createElement("div");
      el.className = "st-activity-item";

      el.innerHTML = `
      <div class="st-activity-item__icon">${getActivityIcon(activity.type)}</div>
      <div class="st-activity-item__content">
        <div class="st-activity-item__text">${activity.description}</div>
        <div class="st-activity-item__time">${activity.timeAgo}</div>
      </div>
    `;

      container.appendChild(el);
    });
  }

  /**
   * @description Returns the corresponding icon for a specific activity type.
   * @param {string} type - The type of activity (e.g., "trail_completed").
   * @returns {string} Icon character/emoji.
   */
  function getActivityIcon(type) {
    if (type === "trail_completed") return "✓";
    if (type === "trail_bookmarked") return "♡";
    if (type === "profile_updated") return "⚙️";
    return "•";
  }

  /**
   * @description Scrolls the window smoothly to the specified section ID.
   * @param {string} sectionId - The ID of the DOM element to scroll to.
   * @returns {void}
   */
  window.scrollToSection = function (sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  /**
   * @description Saves a dashboard preference to the browser's local storage.
   * @param {string} key - LocalStorage key suffix.
   * @param {*} value - Data to store.
   * @returns {void}
   */
  window.saveDashboardPreference = function (key, value) {
    try {
      // Write: Save data to client local storage
      localStorage.setItem("dashboard_" + key, JSON.stringify(value));
    } catch (e) {
      console.warn("LocalStorage not available:", e);
    }
  };

  /**
   * @description Retrieves a dashboard preference from the browser's local storage.
   * @param {string} key - LocalStorage key suffix.
   * @param {*} defaultValue - Fallback value if key doesn't exist.
   * @returns {*} The parsed JSON value from storage, or the default value.
   */
  window.getDashboardPreference = function (key, defaultValue) {
    try {
      // Read: Retrieve data from client local storage
      const item = localStorage.getItem("dashboard_" + key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.warn("LocalStorage not available:", e);
      return defaultValue;
    }
  };

  /**
   * @description Updates a specific dashboard statistics card with new data and applies a flash animation.
   * @param {string} icon - The emoji or text icon to display.
   * @param {number|string} number - The stat value to display.
   * @param {string} label - The text label identifying the specific card to target.
   * @returns {void}
   */
  window.updateStatCard = function (icon, number, label) {
    const statCards = document.querySelectorAll(".st-stat-card");

    statCards.forEach((card) => {
      const cardLabel = card.querySelector(".st-stat-card__label");
      if (cardLabel && cardLabel.textContent.includes(label)) {
        const numberEl = card.querySelector(".st-stat-card__number");
        const iconEl = card.querySelector(".st-stat-card__icon");

        if (numberEl) numberEl.textContent = number;
        if (iconEl) iconEl.textContent = icon;

        card.style.background = "rgba(138, 171, 94, 0.15)";
        setTimeout(() => {
          card.style.background = "var(--glass-bg)";
        }, 1000);
      }
    });
  };

  console.log("Dashboard.js loaded and ready");
})();
