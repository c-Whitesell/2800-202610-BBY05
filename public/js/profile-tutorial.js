const tutorialSteps = [
  {
    title: "Welcome to Your Profile",
    description:
      "This is your personal profile page where you can customize your account.",
  },
  {
    title: "📷 Update Your Photo",
    description:
      "Click the camera icon on your profile picture to upload a new photo. Supported formats: JPG, PNG, GIF, WebP.",
  },
  {
    title: "✏️ Change Your Nickname",
    description:
      "Edit your display name to personalize how you appear throughout ShadyTrails.",
  },
  {
    title: "🔧 Access Settings",
    description:
      "Use the Quick Actions menu to navigate to your full settings, view trails, check weather, or manage bookmarks.",
  },
];

/**
 * @description Generates the inner HTML string for the tutorial steps list.
 * @param {Array<Object>} steps - The array of tutorial step objects.
 * @returns {string} The constructed HTML string.
 */
function buildTutorialStepsHTML(steps) {
  return steps
    .map(
      (step, index) => `
      <div class="tutorial-step">
        <div class="step-number">${index + 1}</div>
        <div class="step-content">
          <h4>${step.title}</h4>
          <p>${step.description}</p>
        </div>
      </div>
    `,
    )
    .join("");
}

/**
 * @description Initializes the profile tutorial modal if the user hasn't dismissed it previously.
 * Creates the DOM elements and binds event listeners.
 * @returns {void}
 */
function initProfileTutorial() {
  // Read: Check session storage to see if the user previously dismissed the tutorial
  const hasDismissed = sessionStorage.getItem("profileTutorialDismissed");

  if (hasDismissed) {
    return;
  }

  const modalContainer = document.createElement("div");
  modalContainer.className = "tutorial-modal-home";
  modalContainer.innerHTML = `
    <div class="tutorial-modal-content-home">
      <button class="modal-close">&times;</button>
      <div class="modal-header">
        <h2>Profile Guide</h2>
        <p>Get the most out of your profile</p>
      </div>
      <div class="modal-body">
        ${buildTutorialStepsHTML(tutorialSteps)}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="dismissProfileTutorial()">Skip</button>
        <button class="btn btn-primary" onclick="dismissProfileTutorial()">Got it!</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalContainer);

  modalContainer
    .querySelector(".modal-close")
    .addEventListener("click", dismissProfileTutorial);
}

/**
 * @description Dismisses the tutorial modal, triggers the fade-out animation,
 * and saves the dismissal state to session storage.
 * @returns {void}
 */
function dismissProfileTutorial() {
  // Write: Save dismissal state to session storage so the modal doesn't show again
  sessionStorage.setItem("profileTutorialDismissed", "true");

  const modalContainer = document.querySelector(".tutorial-modal-home");

  if (modalContainer) {
    modalContainer.classList.add("fade-out");
    setTimeout(() => {
      modalContainer.remove();
    }, 300);
  }
}

document.addEventListener("DOMContentLoaded", initProfileTutorial);
