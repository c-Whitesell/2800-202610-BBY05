/* =========================================
   PROFILE PAGE TUTORIAL
   ========================================= */

// Tutorial modal content
const tutorialSteps = [
  {
    title: 'Welcome to Your Profile',
    description:
      'This is your personal profile page where you can customize your account.',
  },
  {
    title: '📷 Update Your Photo',
    description:
      'Click the camera icon on your profile picture to upload a new photo. Supported formats: JPG, PNG, GIF, WebP.',
  },
  {
    title: '✏️ Change Your Nickname',
    description:
      'Edit your display name to personalize how you appear throughout ShadyTrails.',
  },
  {
    title: '🔧 Access Settings',
    description:
      'Use the Quick Actions menu to navigate to your full settings, view trails, check weather, or manage bookmarks.',
  },
];

// Create and show tutorial modal
function initProfileTutorial() {
  // Check if user has dismissed tutorial before
  const dismissed = sessionStorage.getItem('profileTutorialDismissed');
  if (dismissed) return;

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'tutorial-modal-home';
  modal.innerHTML = `
    <div class="tutorial-modal-content-home">
      <button class="modal-close">&times;</button>
      <div class="modal-header">
        <h2>Profile Guide</h2>
        <p>Get the most out of your profile</p>
      </div>
      <div class="modal-body">
        ${tutorialSteps
          .map(
            (step, idx) => `
          <div class="tutorial-step">
            <div class="step-number">${idx + 1}</div>
            <div class="step-content">
              <h4>${step.title}</h4>
              <p>${step.description}</p>
            </div>
          </div>
        `,
          )
          .join('')}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="dismissProfileTutorial()">Skip</button>
        <button class="btn btn-primary" onclick="dismissProfileTutorial()">Got it!</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close button handler
  modal
    .querySelector('.modal-close')
    .addEventListener('click', dismissProfileTutorial);
}

function dismissProfileTutorial() {
  sessionStorage.setItem('profileTutorialDismissed', 'true');
  const modal = document.querySelector('.tutorial-modal-home');
  if (modal) {
    modal.classList.add('fade-out');
    setTimeout(() => modal.remove(), 300);
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initProfileTutorial);
