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

// ── Allow Enter key to save nickname ──
nicknameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    saveNicknameBtn.click();
  }
});
