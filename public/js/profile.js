const pictureInput = document.getElementById("pictureInput");
const profilePicture = document.getElementById("profilePicture");
const nicknameInput = document.getElementById("nicknameInput");
const saveNicknameBtn = document.getElementById("saveNicknameBtn");
const toast = document.getElementById("toast");

/**
 * @description Displays a temporary toast notification to the user.
 * @param {string} message - The text content to display.
 * @param {string} [type='success'] - The notification type ('success' or 'error').
 * @returns {void}
 */
function showToast(message, type = "success") {
  toast.textContent = message;
  toast.className = "st-toast show";
  if (type === "error") {
    toast.classList.add("error");
  }

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

pictureInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showToast("Please select a valid image file", "error");
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    showToast("Image must be smaller than 2MB", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = async (readerEvent) => {
    const base64 = readerEvent.target.result;

    try {
      // Write: Update the user profile picture via API
      const response = await fetch("/api/profile/update-picture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profilePicture: base64 }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || "Failed to upload picture", "error");
        return;
      }

      profilePicture.src = base64;
      showToast("Profile picture updated! 📸");
    } catch (error) {
      console.error("Upload error:", error);
      showToast("Error uploading picture", "error");
    }
  };

  reader.readAsDataURL(file);
});

saveNicknameBtn.addEventListener("click", async () => {
  const nickname = nicknameInput.value.trim();

  if (!nickname) {
    showToast("Nickname cannot be empty", "error");
    nicknameInput.focus();
    return;
  }

  saveNicknameBtn.classList.add("loading");
  saveNicknameBtn.disabled = true;

  try {
    // Write: Update the user nickname via API
    const response = await fetch("/api/profile/update-nickname", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname }),
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.error || "Failed to update nickname", "error");
      return;
    }

    document.querySelector(".nickname-display").textContent = nickname;
    showToast("Nickname updated! ✨");
  } catch (error) {
    console.error("Save error:", error);
    showToast("Error updating nickname", "error");
  } finally {
    saveNicknameBtn.classList.remove("loading");
    saveNicknameBtn.disabled = false;
  }
});

nicknameInput.addEventListener("keypress", (event) => {
  if (event.key === "Enter") {
    saveNicknameBtn.click();
  }
});

trailSearchInput?.addEventListener("input", handleTrailSearch);
logTrailBtn?.addEventListener("click", handleTrailLog);

/**
 * @description Handles user input for searching trails by querying the API and rendering results.
 * @param {Event} event - The input event from the search field.
 * @returns {Promise<void>}
 */
async function handleTrailSearch(event) {
  const query = event.target.value.trim();
  selectedTrail = null;

  if (query.length < 2) return clearSuggestions();

  const data = await fetchTrails(query);
  renderTrailSuggestions(data);
}

/**
 * @description Read: Fetches trail data matching the search query string.
 * @param {string} query - The search query.
 * @returns {Promise<Object>} The API response containing search results.
 */
async function fetchTrails(query) {
  const response = await fetch(
    `/api/trails/search?q=${encodeURIComponent(query)}`,
  );
  return await response.json();
}

/**
 * @description Renders the search suggestion list in the UI.
 * @param {Array<Object>} data - Array of trail objects.
 * @returns {void}
 */
function renderTrailSuggestions(data) {
  trailSuggestions.innerHTML = data.map(renderSuggestion).join("");

  document.querySelectorAll(".trail-suggestion").forEach((element, index) => {
    element.addEventListener("click", () => selectTrail(data[index]));
  });
}

/**
 * @description Returns the HTML structure for a single trail suggestion.
 * @param {Object} trail - The trail object.
 * @returns {string} The HTML string.
 */
function renderSuggestion(trail) {
  return `<div class="trail-suggestion" data-id="${trail.id}">${trail.name}</div>`;
}

/**
 * @description Clears the trail suggestions container.
 * @returns {void}
 */
function clearSuggestions() {
  trailSuggestions.innerHTML = "";
}

/**
 * @description Sets the selected trail and updates the search input field.
 * @param {Object} trail - The selected trail object.
 * @returns {void}
 */
function selectTrail(trail) {
  selectedTrail = trail;
  trailSearchInput.value = trail.name;

  if (trail.distance_m) {
    trailDistanceInput.value = (trail.distance_m / 1000).toFixed(1);
  }

  clearSuggestions();
}

/**
 * @description Gathers payload, submits the trail log, and handles celebration UI if successful.
 * @returns {Promise<void>}
 */
async function handleTrailLog() {
  const payload = buildTrailPayload();
  const result = await submitTrailLog(payload);

  if (!result.ok) {
    showToast(result.error || "Failed to log trail", "error");
    return;
  }

  /**
   * @description Displays a badge celebration modal if the user earned new achievements.
   * @param {Array<string>} badges - List of earned badge IDs.
   * @returns {void}
   */
  function triggerBadgeCelebration(badges) {
    const modal = document.getElementById("badgeModal");
    const text = document.getElementById("badgeText");

    const badgeMap = {
      "10km": "You've explored 10km of trails! 🌱",
      "25km": "25km logged — you're getting serious! 🌲",
      "50km": "50km!! You're a trail legend 🏔️🔥",
    };

    const latest = badges[0];
    text.textContent = badgeMap[latest] || "New achievement unlocked!";

    modal.classList.remove("hidden");

    setTimeout(() => {
      modal.classList.add("hidden");
    }, 3500);
  }

  resetTrailForm();
  showToast("Trail logged successfully! 🥾");
  if (result.earnedBadges?.length) {
    triggerBadgeCelebration(result.earnedBadges);
  }
}

/**
 * @description Constructs the trail payload based on whether a trail was selected or manually named.
 * @returns {Object} The trail payload.
 */
function buildTrailPayload() {
  const distanceKm = parseFloat(trailDistanceInput.value);

  return selectedTrail
    ? { trailId: selectedTrail.id, distanceKm }
    : {
        trailName: trailSearchInput.value.trim(),
        distanceKm,
      };
}

/**
 * @description Write: Submits the trail log data to the backend API.
 * @param {Object} payload - The trail log data.
 * @returns {Promise<Object>} The API response status and data.
 */
async function submitTrailLog(payload) {
  const response = await fetch("/api/trails/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  return { ok: response.ok, ...data };
}

/**
 * @description Resets the trail logging form fields and clears suggestions.
 * @returns {void}
 */
function resetTrailForm() {
  trailSearchInput.value = "";
  trailDistanceInput.value = "";
  selectedTrail = null;
  clearSuggestions();
}
