/**
 * Initializes the admin feedback functionality once the DOM is fully loaded.
 */
document.addEventListener("DOMContentLoaded", () => {
  initializeAdminFeedback();
});

/**
 * Bootstraps the feedback page features by setting up filters, buttons, and notifications.
 * @param {void}
 * @returns {void}
 */
function initializeAdminFeedback() {
  setupFilters();
  setupStatusButtons();
  setupDeleteButtons();
  setupToasts();
}

/**
 * Attaches change event listeners to the feedback status and type filter dropdowns.
 * @param {void}
 * @returns {void}
 */
function setupFilters() {
  const statusFilter = document.getElementById("feedbackFilter");
  const typeFilter = document.getElementById("typeFilter");

  if (statusFilter) {
    statusFilter.addEventListener("change", applyFilters);
  }

  if (typeFilter) {
    typeFilter.addEventListener("change", applyFilters);
  }
}

/**
 * Filters the feedback cards displayed on the page based on the selected dropdown values.
 * @param {void}
 * @returns {void}
 */
function applyFilters() {
  const statusFilter =
    document.getElementById("feedbackFilter")?.value || "all";
  const typeFilter = document.getElementById("typeFilter")?.value || "all";
  const feedbackCards = document.querySelectorAll(".st-feedback-card");

  feedbackCards.forEach((card) => {
    const cardStatus = card.getAttribute("data-status");
    const cardType = card.getAttribute("data-type");

    // Check if the current card matches the selected filter criteria
    const statusMatch = statusFilter === "all" || cardStatus === statusFilter;
    const typeMatch = typeFilter === "all" || cardType === typeFilter;

    // Toggle card visibility
    card.style.display = statusMatch && typeMatch ? "" : "none";
  });
}

/**
 * Attaches event listeners to status update buttons to handle asynchronous backend updates.
 * @param {void}
 * @returns {void}
 */
function setupStatusButtons() {
  const statusButtons = document.querySelectorAll(".st-feedback-btn--status");

  statusButtons.forEach((button) => {
    button.addEventListener("click", async (e) => {
      e.preventDefault();

      const feedbackId = button.getAttribute("data-feedback-id");
      const newStatus = button.getAttribute("data-new-status");

      try {
        // Send the status update request to the server
        const response = await fetch("/api/admin/feedback/update-status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            feedbackId,
            status: newStatus,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          showToast(data.error || "Failed to update status", "error");
          return;
        }

        // Update the UI to reflect the new status dynamically
        const card = document.querySelector(
          `article[data-feedback-id="${feedbackId}"]`,
        );
        if (card) {
          const statusBadge = card.querySelector(".st-feedback-card__status");

          card.setAttribute("data-status", newStatus);
          statusBadge.className = `st-feedback-card__status st-feedback-card__status-${newStatus}`;
          statusBadge.textContent =
            newStatus.charAt(0).toUpperCase() + newStatus.slice(1);

          // Disable the button for the currently active status to prevent redundant clicks
          const allStatusButtons = card.querySelectorAll(
            ".st-feedback-btn--status",
          );
          allStatusButtons.forEach((btn) => {
            const btnStatus = btn.getAttribute("data-new-status");
            btn.disabled = btnStatus === newStatus;
          });
        }

        showToast(data.message, "success");
      } catch (error) {
        console.error("Error:", error);
        showToast("An error occurred while updating status", "error");
      }
    });
  });
}

/**
 * Attaches event listeners to delete buttons to handle permanent feedback removal.
 * @param {void}
 * @returns {void}
 */
function setupDeleteButtons() {
  const deleteButtons = document.querySelectorAll(".st-feedback-btn--delete");

  deleteButtons.forEach((button) => {
    button.addEventListener("click", async (e) => {
      e.preventDefault();

      const feedbackId = button.getAttribute("data-feedback-id");
      const confirmed = confirm(
        "Are you sure you want to delete this feedback? This action cannot be undone.",
      );

      if (!confirmed) return;

      try {
        // Send deletion request to the server
        const response = await fetch("/api/admin/feedback/delete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ feedbackId }),
        });

        const data = await response.json();

        if (!response.ok) {
          showToast(data.error || "Failed to delete feedback", "error");
          return;
        }

        // Remove the deleted card from the DOM with a transition delay
        const card = document.querySelector(
          `article[data-feedback-id="${feedbackId}"]`,
        );
        if (card) {
          card.classList.add("st-feedback-card--deleting");
          setTimeout(() => {
            card.remove();

            // Display an empty state UI if no feedback cards remain
            const remainingCards =
              document.querySelectorAll(".st-feedback-card");
            if (remainingCards.length === 0) {
              const container = document.getElementById("feedbackContainer");
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

        showToast(data.message, "success");
      } catch (error) {
        console.error("Error:", error);
        showToast("An error occurred while deleting feedback", "error");
      }
    });
  });
}

/**
 * Exposes the showToast notification function globally for external access.
 * @param {void}
 * @returns {void}
 */
function setupToasts() {
  window.showToast = showToast;
}

/**
 * Displays a temporary toast notification message on the screen.
 * @param {string} message - The text content to display in the notification.
 * @param {string} [type='info'] - The visual style of the toast (success, error, info, warning).
 * @param {number} [duration=3000] - The time in milliseconds before the toast is removed.
 * @returns {void}
 */
function showToast(message, type = "info", duration = 3000) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `st-admin-feedback__toast st-admin-feedback__toast--${type}`;

  const icons = {
    success: "✓",
    error: "✕",
    info: "ℹ",
    warning: "⚠",
  };

  toast.innerHTML = `<span class="st-admin-feedback__toast-icon">${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);

  // Trigger CSS transition for entry
  setTimeout(() => toast.classList.add("st-admin-feedback__toast--show"), 10);

  // Handle toast removal after duration elapses
  setTimeout(() => {
    toast.classList.remove("st-admin-feedback__toast--show");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
