/**
 * Manages the user tutorial walkthrough for the Weather/Shade page.
 * Handles hint visibility, modal interactions, and persistent settings.
 */
class TutorialSystemWeather {
  /**
   * @param {boolean} [initialTutorialMode=true] - Whether the tutorial is enabled by default.
   */
  constructor(initialTutorialMode = true) {
    this.tutorialMode = initialTutorialMode;
    this.hintShown = sessionStorage.getItem("weatherHintShown") === "true";
  }

  /**
   * Initializes the tutorial state and displays hints if conditions are met.
   */
  init() {
    if (this.tutorialMode && !this.hintShown) {
      this.showTutorialHint();
      sessionStorage.setItem("weatherHintShown", "true");
    }
  }

  /**
   * Displays the non-intrusive tutorial hint element.
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
   * Hides the tutorial hint element.
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
   * Creates and appends the full tutorial modal to the document body.
   */
  startTutorial() {
    const modal = document.createElement("div");
    modal.className = "tutorial-modal-weather";
    modal.innerHTML = `
      <div class="tutorial-modal-content-weather">
        <button class="modal-close" onclick="tutorialSystemWeather.closeModal()">×</button>
        <div class="modal-header">
          <h2>🌿 Reading the Weather Page</h2>
          <p>Here's how to get the most out of your shade forecast</p>
        </div>
        <div class="modal-body">
          <div class="tutorial-step">
            <div class="step-number">1</div>
            <div class="step-content">
              <h4>Shade Score</h4>
              <p>The circle on the right of the weather card shows today's <strong>shade score</strong> (0–100). Higher means more shade — great for avoiding the sun on the trail.</p>
            </div>
          </div>
          <div class="tutorial-step">
            <div class="step-number">2</div>
            <div class="step-content">
              <h4>Hourly Forecast</h4>
              <p>Scroll the hourly strip to see how shade and temperature change throughout the day. The 🌿 emoji means good shade; ☀️ means low shade.</p>
            </div>
          </div>
          <div class="tutorial-step">
            <div class="step-number">3</div>
            <div class="step-content">
              <h4>Best Time to Hike</h4>
              <p>Use the <strong>shade coverage bars</strong> to compare morning, midday, afternoon, and evening. Green bars mean ideal shaded conditions.</p>
            </div>
          </div>
          <div class="tutorial-step">
            <div class="step-number">4</div>
            <div class="step-content">
              <h4>Nearby Trails</h4>
              <p>Scroll down to see trails ranked by shade level. Look for the <span style="background:#eaf3de;color:#27500a;padding:1px 7px;border-radius:99px;font-size:0.8rem;font-weight:500;">High shade</span> badge for the best experience today.</p>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" onclick="tutorialSystemWeather.closeModal()">Got It!</button>
          <button class="btn btn-secondary" onclick="tutorialSystemWeather.toggleTutorialMode()">Turn Off Tips</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  /**
   * Closes the tutorial modal with a fade-out animation.
   */
  closeModal() {
    const modal = document.querySelector(".tutorial-modal-weather");
    if (modal) {
      modal.classList.add("fade-out");
      setTimeout(() => modal.remove(), 300);
    }
  }

  /**
   * Toggles the tutorial mode preference via API and updates UI.
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

const tutorialSystemWeather = new TutorialSystemWeather(
  typeof window.TUTORIAL_MODE !== "undefined" ? window.TUTORIAL_MODE : true,
);

document.addEventListener("DOMContentLoaded", () => {
  tutorialSystemWeather.init();
});
