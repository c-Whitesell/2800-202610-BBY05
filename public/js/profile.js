/* =========================================
   PROFILE PAGE JAVASCRIPT
   ========================================= */

// ── DOM Elements ──
const pictureInput = document.getElementById('pictureInput');
const profilePicture = document.getElementById('profilePicture');
const nicknameInput = document.getElementById('nicknameInput');
const saveNicknameBtn = document.getElementById('saveNicknameBtn');
const toast = document.getElementById('toast');

// ── Utility: Show Toast Notification ──
function showToast(message, type = 'success') {
  toast.textContent = message;
  toast.className = 'st-toast show';
  if (type === 'error') {
    toast.classList.add('error');
  }

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

// ── Profile Picture Upload ──
pictureInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Validate file type
  if (!file.type.startsWith('image/')) {
    showToast('Please select a valid image file', 'error');
    return;
  }

  // Validate file size (max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    showToast('Image must be smaller than 2MB', 'error');
    return;
  }

  // Convert to Base64
  const reader = new FileReader();
  reader.onload = async (event) => {
    const base64 = event.target.result;

    try {
      const response = await fetch('/api/profile/update-picture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profilePicture: base64 }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || 'Failed to upload picture', 'error');
        return;
      }

      // Update the profile picture in the UI
      profilePicture.src = base64;
      showToast('Profile picture updated! 📸');
    } catch (err) {
      console.error('Upload error:', err);
      showToast('Error uploading picture', 'error');
    }
  };

  reader.readAsDataURL(file);
});

// ── Nickname Save ──
saveNicknameBtn.addEventListener('click', async () => {
  const nickname = nicknameInput.value.trim();

  if (!nickname) {
    showToast('Nickname cannot be empty', 'error');
    nicknameInput.focus();
    return;
  }

  // Set button to loading state
  saveNicknameBtn.classList.add('loading');
  saveNicknameBtn.disabled = true;

  try {
    const response = await fetch('/api/profile/update-nickname', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname }),
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.error || 'Failed to update nickname', 'error');
      return;
    }

    // Update the greeting display
    document.querySelector('.nickname-display').textContent = nickname;
    showToast('Nickname updated! ✨');
  } catch (err) {
    console.error('Save error:', err);
    showToast('Error updating nickname', 'error');
  } finally {
    saveNicknameBtn.classList.remove('loading');
    saveNicknameBtn.disabled = false;
  }
});

nicknameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    saveNicknameBtn.click();
  }
});

trailSearchInput?.addEventListener('input', handleTrailSearch);
logTrailBtn?.addEventListener('click', handleTrailLog);

async function handleTrailSearch(e) {
  const q = e.target.value.trim();
  selectedTrail = null;

  if (q.length < 2) return clearSuggestions();

  const data = await fetchTrails(q);
  renderTrailSuggestions(data);
}

async function fetchTrails(q) {
  const res = await fetch(`/api/trails/search?q=${encodeURIComponent(q)}`);
  return await res.json();
}

function renderTrailSuggestions(data) {
  trailSuggestions.innerHTML = data.map(renderSuggestion).join('');

  document.querySelectorAll('.trail-suggestion').forEach((el, i) => {
    el.addEventListener('click', () => selectTrail(data[i]));
  });
}

function renderSuggestion(t) {
  return `<div class="trail-suggestion" data-id="${t.id}">${t.name}</div>`;
}

function clearSuggestions() {
  trailSuggestions.innerHTML = '';
}

function selectTrail(trail) {
  selectedTrail = trail;
  trailSearchInput.value = trail.name;

  if (trail.distance_m) {
    trailDistanceInput.value = (trail.distance_m / 1000).toFixed(1);
  }

  clearSuggestions();
}

async function handleTrailLog() {
  const payload = buildTrailPayload();
  const result = await submitTrailLog(payload);

  if (!result.ok) {
    showToast(result.error || 'Failed to log trail', 'error');
    return;
  }

  resetTrailForm();
  showToast('Trail logged successfully! 🥾');
}

function buildTrailPayload() {
  const distanceKm = parseFloat(trailDistanceInput.value);

  return selectedTrail
    ? { trailId: selectedTrail.id, distanceKm }
    : {
        trailName: trailSearchInput.value.trim(),
        distanceKm,
      };
}

async function submitTrailLog(payload) {
  const res = await fetch('/api/trails/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  return { ok: res.ok, ...data };
}

function resetTrailForm() {
  trailSearchInput.value = '';
  trailDistanceInput.value = '';
  selectedTrail = null;
  clearSuggestions();
}
