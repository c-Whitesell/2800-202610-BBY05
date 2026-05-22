/**
 * Manages the tutorial overlay system for the homepage.
 */
class TutorialSystemHome {
  /**
   * Initializes the tutorial system.
   * @param {boolean} initialTutorialMode - Whether the tutorial is enabled.
   */
  constructor(initialTutorialMode = true) {
    this.tutorialMode = initialTutorialMode;
    this.hintShown = sessionStorage.getItem("hintShown") === "true";
  }

  /**
   * Initializes the hint display if enabled and not already shown.
   */
  init() {
    if (this.tutorialMode && !this.hintShown) {
      this.showTutorialHint();
      sessionStorage.setItem("hintShown", "true");
    }
  }

  /**
   * Displays the initial tutorial hint bubble.
   */
  showTutorialHint() {
    const hint = document.getElementById("tutorial-hint");
    if (hint) {
      hint.style.display = "flex";
      setTimeout(() => {
        hint.classList.add("hint-show");
      }, 100);
    }
  }

  /**
   * Hides the tutorial hint bubble with a transition.
   */
  closeTutorialHint() {
    const hint = document.getElementById("tutorial-hint");
    if (hint) {
      hint.classList.remove("hint-show");
      setTimeout(() => {
        hint.style.display = "none";
      }, 300);
    }
  }

  /**
   * Creates and displays the full-screen tutorial modal.
   */
  startTutorial() {
    const modal = document.createElement("div");
    modal.className = "tutorial-modal-home";
    modal.innerHTML = `
      <div class="tutorial-modal-content-home">
        <button class="modal-close" onclick="tutorialSystemHome.closeModal()">×</button>
        <div class="modal-header">
          <h2>Getting Started 🚀</h2>
          <p>Learn how to use ShadyTrails</p>
        </div>
        <div class="modal-body">
          <div class="tutorial-step">
            <div class="step-number">1</div>
            <div class="step-content">
              <h4>Explore Trails</h4>
              <p>Click <strong>"Explore"</strong> in the navbar to see an interactive map of all available shaded trails.</p>
            </div>
          </div>
          <div class="tutorial-step">
            <div class="step-number">2</div>
            <div class="step-content">
              <h4>Create an Account</h4>
              <p>Sign up or log in to bookmark your favorite trails and track your hiking progress.</p>
            </div>
          </div>
          <div class="tutorial-step">
            <div class="step-number">3</div>
            <div class="step-content">
              <h4>Check Conditions</h4>
              <p>View real-time weather, UV index, and shade ratings before you hike.</p>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" onclick="tutorialSystemHome.closeModal()">Got It!</button>
          <button class="btn btn-secondary" onclick="tutorialSystemHome.toggleTutorialMode()">Turn Off Tips</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  /**
   * Closes the active modal and removes it from the DOM.
   */
  closeModal() {
    const modal = document.querySelector(".tutorial-modal-home");
    if (modal) {
      modal.classList.add("fade-out");
      setTimeout(() => modal.remove(), 300);
    }
  }

  /**
   * Toggles the user's tutorial preference via API call.
   */
  toggleTutorialMode() {
    this.tutorialMode = !this.tutorialMode;

    fetch("/toggle-tutorial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tutorialMode: this.tutorialMode }),
    })
      .then((res) => res.json())
      .then(() => {
        this.closeModal();
        if (!this.tutorialMode) {
          alert("Tips turned off. You can enable them in Settings.");
        }
      })
      .catch((err) => console.error("Error toggling tutorial:", err));
  }
}

const tutorialSystemHome = new TutorialSystemHome(
  typeof window.TUTORIAL_MODE !== "undefined" ? window.TUTORIAL_MODE : true,
);

document.addEventListener("DOMContentLoaded", () => {
  tutorialSystemHome.init();
});
