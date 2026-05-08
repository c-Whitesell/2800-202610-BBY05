class TutorialSystemAuth {
  constructor(initialTutorialMode = true) {
    this.tutorialMode = initialTutorialMode;
    this.hintShown = sessionStorage.getItem('authHintShown') === 'true';
    this.pageType = this.detectPageType();
  }

  detectPageType() {
    return window.location.pathname.includes('/signup') ? 'signup' : 'login';
  }

  init() {
    if (this.tutorialMode && !this.hintShown) {
      this.showTutorialHint();
      sessionStorage.setItem('authHintShown', 'true');
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
    const isSignup = this.pageType === 'signup';

    const modal = document.createElement('div');
    modal.className = 'tutorial-modal-auth';
    modal.innerHTML = `
      <div class="tutorial-modal-content-auth">
        <button class="modal-close" onclick="tutorialSystemAuth.closeModal()">×</button>
        <div class="modal-header">
          <h2>${isSignup ? '🎉 Getting Started' : '👋 Welcome Back'}</h2>
          <p>${isSignup ? 'Start your hiking journey' : 'Access your saved trails'}</p>
        </div>
        <div class="modal-body">
          ${isSignup ? this.signupSteps() : this.loginSteps()}
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" onclick="tutorialSystemAuth.closeModal()">Got It!</button>
          <button class="btn btn-secondary" onclick="tutorialSystemAuth.toggleTutorialMode()">Disable Tips</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  signupSteps() {
    return `
      <div class="tutorial-step">
        <div class="step-number">1</div>
        <div class="step-content">
          <h4>Enter Your Info</h4>
          <p>Provide your name, email, and a secure password to create your account.</p>
        </div>
      </div>
      <div class="tutorial-step">
        <div class="step-number">2</div>
        <div class="step-content">
          <h4>Confirm Password</h4>
          <p>Make sure your passwords match to avoid any errors.</p>
        </div>
      </div>
      <div class="tutorial-step">
        <div class="step-number">3</div>
        <div class="step-content">
          <h4>Start Exploring</h4>
          <p>Once created, you'll have access to the full trail map and bookmarking features.</p>
        </div>
      </div>
    `;
  }

  loginSteps() {
    return `
      <div class="tutorial-step">
        <div class="step-number">1</div>
        <div class="step-content">
          <h4>Enter Your Email</h4>
          <p>Use the email address you registered with.</p>
        </div>
      </div>
      <div class="tutorial-step">
        <div class="step-number">2</div>
        <div class="step-content">
          <h4>Enter Your Password</h4>
          <p>Make sure caps lock is off and enter your password carefully.</p>
        </div>
      </div>
      <div class="tutorial-step">
        <div class="step-number">3</div>
        <div class="step-content">
          <h4>Access Your Account</h4>
          <p>You'll be taken to the trail map with all your saved bookmarks.</p>
        </div>
      </div>
    `;
  }

  closeModal() {
    const modal = document.querySelector('.tutorial-modal-auth');
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

const tutorialSystemAuth = new TutorialSystemAuth(
  typeof window.TUTORIAL_MODE !== 'undefined' ? window.TUTORIAL_MODE : true,
);

document.addEventListener('DOMContentLoaded', () => {
  tutorialSystemAuth.init();
});
