class TutorialSystemHome {
  constructor(initialTutorialMode = true) {
    this.tutorialMode = initialTutorialMode;
    this.hintShown = sessionStorage.getItem('hintShown') === 'true';
  }

  init() {
    if (this.tutorialMode && !this.hintShown) {
      this.showTutorialHint();
      sessionStorage.setItem('hintShown', 'true');
    }
  }

  showTutorialHint() {
    const hint = document.getElementById('tutorial-hint');
    if (hint) {
      hint.style.display = 'flex';
      setTimeout(() => {
        hint.classList.add('hint-show');
      }, 100);
    }
  }

  closeTutorialHint() {
    const hint = document.getElementById('tutorial-hint');
    if (hint) {
      hint.classList.remove('hint-show');
      setTimeout(() => {
        hint.style.display = 'none';
      }, 300);
    }
  }

  startTutorial() {
    const modal = document.createElement('div');
    modal.className = 'tutorial-modal-home';
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

  closeModal() {
    const modal = document.querySelector('.tutorial-modal-home');
    if (modal) {
      modal.classList.add('fade-out');
      setTimeout(() => modal.remove(), 300);
    }
  }

  toggleTutorialMode() {
    this.tutorialMode = !this.tutorialMode;

    fetch('/toggle-tutorial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tutorialMode: this.tutorialMode }),
    })
      .then((res) => res.json())
      .then((data) => {
        this.closeModal();
        if (!this.tutorialMode) {
          alert('Tips turned off. You can enable them in Settings.');
        }
      })
      .catch((err) => console.error('Error toggling tutorial:', err));
  }
}

// Pass the server value from the page
const tutorialSystemHome = new TutorialSystemHome(
  typeof window.TUTORIAL_MODE !== 'undefined' ? window.TUTORIAL_MODE : true,
);

document.addEventListener('DOMContentLoaded', () => {
  tutorialSystemHome.init();
});
