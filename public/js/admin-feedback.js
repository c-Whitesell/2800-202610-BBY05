document.addEventListener('DOMContentLoaded', () => {
  initializeAdminFeedback();
});

function initializeAdminFeedback() {
  setupFilters();
  setupStatusButtons();
  setupDeleteButtons();
  setupToasts();
}

function setupFilters() {
  const statusFilter = document.getElementById('feedbackFilter');
  const typeFilter = document.getElementById('typeFilter');

  if (statusFilter) {
    statusFilter.addEventListener('change', applyFilters);
  }

  if (typeFilter) {
    typeFilter.addEventListener('change', applyFilters);
  }
}

function applyFilters() {
  const statusFilter =
    document.getElementById('feedbackFilter')?.value || 'all';
  const typeFilter = document.getElementById('typeFilter')?.value || 'all';
  const feedbackCards = document.querySelectorAll('.st-feedback-card');

  feedbackCards.forEach((card) => {
    const cardStatus = card.getAttribute('data-status');
    const cardType = card.getAttribute('data-type');

    const statusMatch = statusFilter === 'all' || cardStatus === statusFilter;
    const typeMatch = typeFilter === 'all' || cardType === typeFilter;

    card.style.display = statusMatch && typeMatch ? '' : 'none';
  });
}

function setupStatusButtons() {
  const statusButtons = document.querySelectorAll('.st-feedback-btn--status');

  statusButtons.forEach((button) => {
    button.addEventListener('click', async (e) => {
      e.preventDefault();

      const feedbackId = button.getAttribute('data-feedback-id');
      const newStatus = button.getAttribute('data-new-status');

      try {
        const response = await fetch('/api/admin/feedback/update-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            feedbackId,
            status: newStatus,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          showToast(data.error || 'Failed to update status', 'error');
          return;
        }

        const card = document.querySelector(
          `article[data-feedback-id="${feedbackId}"]`,
        );
        if (card) {
          const statusBadge = card.querySelector('.st-feedback-card__status');

          card.setAttribute('data-status', newStatus);
          statusBadge.className = `st-feedback-card__status st-feedback-card__status-${newStatus}`;
          statusBadge.textContent =
            newStatus.charAt(0).toUpperCase() + newStatus.slice(1);

          const allStatusButtons = card.querySelectorAll(
            '.st-feedback-btn--status',
          );
          allStatusButtons.forEach((btn) => {
            const btnStatus = btn.getAttribute('data-new-status');
            btn.disabled = btnStatus === newStatus;
          });
        }

        showToast(data.message, 'success');
      } catch (error) {
        console.error('Error:', error);
        showToast('An error occurred while updating status', 'error');
      }
    });
  });
}

function setupDeleteButtons() {
  const deleteButtons = document.querySelectorAll('.st-feedback-btn--delete');

  deleteButtons.forEach((button) => {
    button.addEventListener('click', async (e) => {
      e.preventDefault();

      const feedbackId = button.getAttribute('data-feedback-id');
      const confirmed = confirm(
        'Are you sure you want to delete this feedback? This action cannot be undone.',
      );

      if (!confirmed) return;

      try {
        const response = await fetch('/api/admin/feedback/delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ feedbackId }),
        });

        const data = await response.json();

        if (!response.ok) {
          showToast(data.error || 'Failed to delete feedback', 'error');
          return;
        }

        const card = document.querySelector(
          `article[data-feedback-id="${feedbackId}"]`,
        );
        if (card) {
          card.classList.add('st-feedback-card--deleting');
          setTimeout(() => {
            card.remove();

            const remainingCards =
              document.querySelectorAll('.st-feedback-card');
            if (remainingCards.length === 0) {
              const container = document.getElementById('feedbackContainer');
              if (container) {
                container.innerHTML = `
                  <div class="st-admin-feedback__empty-state">
                    <div class="st-admin-feedback__empty-icon">📭</div>
                    <h3>No Feedback</h3>
                    <p>All feedback has been deleted.</p>
                  </div>
                `;
              }
            }
          }, 300);
        }

        showToast(data.message, 'success');
      } catch (error) {
        console.error('Error:', error);
        showToast('An error occurred while deleting feedback', 'error');
      }
    });
  });
}

function setupToasts() {
  window.showToast = showToast;
}

function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `st-admin-feedback__toast st-admin-feedback__toast--${type}`;

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
  };

  toast.innerHTML = `<span class="st-admin-feedback__toast-icon">${icons[type]}</span><span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => toast.classList.add('st-admin-feedback__toast--show'), 10);

  setTimeout(() => {
    toast.classList.remove('st-admin-feedback__toast--show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
