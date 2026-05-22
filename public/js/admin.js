/**
 * Initializes the admin dashboard functionality once the DOM is fully loaded.
 */
document.addEventListener("DOMContentLoaded", () => {
  initializeAdminDashboard();
});

/**
 * Bootstraps the admin dashboard features by setting up navigation, search, role management, and notifications.
 * @param {void}
 * @returns {void}
 */
function initializeAdminDashboard() {
  setupNavigation();
  setupUserSearch();
  setupRoleToggle();
  setupToasts();
}

/**
 * Attaches click event listeners to navigation links to handle section visibility and smooth scrolling.
 * @param {void}
 * @returns {void}
 */
function setupNavigation() {
  const navLinks = document.querySelectorAll(".st-admin__nav-link");
  const sections = document.querySelectorAll(".st-admin__section");

  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      const sectionId = link.getAttribute("data-section");

      if (!sectionId) return;
      e.preventDefault();

      const targetSection = document.getElementById(sectionId);

      // Reset active states for all links and sections
      navLinks.forEach((l) => l.classList.remove("active"));
      sections.forEach((s) => s.classList.remove("st-admin__section--active"));

      // Apply active states to the clicked link and target section
      link.classList.add("active");
      targetSection.classList.add("st-admin__section--active");

      targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

/**
 * Attaches an input event listener to the search bar to dynamically filter the user table.
 * @param {void}
 * @returns {void}
 */
function setupUserSearch() {
  const searchInput = document.getElementById("userSearch");
  const tableRows = document.querySelectorAll(".st-admin__table-row");

  if (!searchInput) return;

  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();

    tableRows.forEach((row) => {
      const name =
        row.querySelector(".st-admin__user-name")?.textContent.toLowerCase() ||
        "";
      const email =
        row.querySelector(".st-admin__email")?.textContent.toLowerCase() || "";

      // Check if the search query matches the user's name or email
      const matches = name.includes(query) || email.includes(query);
      row.style.display = matches ? "" : "none";
    });
  });
}

/**
 * Attaches event listeners to role toggle buttons to handle asynchronous user promotions and demotions.
 * @param {void}
 * @returns {void}
 */
function setupRoleToggle() {
  const toggleButtons = document.querySelectorAll(".st-admin__btn-toggle-role");

  toggleButtons.forEach((button) => {
    button.addEventListener("click", async (e) => {
      const email = button.getAttribute("data-email");
      const currentRole = button.getAttribute("data-current-role");

      const confirmed = confirm(
        `Are you sure you want to ${currentRole === "admin" ? "demote this user to regular user?" : "promote this user to admin?"}`,
      );

      if (!confirmed) return;

      try {
        // Send the role update request to the server
        const response = await fetch("/api/admin/toggle-role", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (!response.ok) {
          showToast(data.error || "Failed to update user role", "error");
          return;
        }

        // Update the UI dynamically to reflect the new role
        const row = document.querySelector(`tr[data-email="${email}"]`);
        if (row) {
          const roleSpan = row.querySelector(".st-admin__role-badge");
          const actionBtn = row.querySelector(".st-admin__btn-toggle-role");

          const newRole = data.newRole;
          const isAdmin = newRole === "admin";

          roleSpan.textContent = isAdmin ? "Admin" : "User";
          roleSpan.className = `st-admin__role-badge st-admin__role-${newRole}`;

          actionBtn.textContent = isAdmin ? "⬇️ Demote" : "⬆️ Promote";
          actionBtn.setAttribute("data-current-role", newRole);
          actionBtn.title = isAdmin ? "Demote to User" : "Promote to Admin";
        }

        showToast(data.message, "success");
      } catch (error) {
        console.error("Error:", error);
        showToast("An error occurred while updating user role", "error");
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
  toast.className = `st-admin__toast st-admin__toast--${type}`;
  toast.textContent = message;

  const icons = {
    success: "✓",
    error: "✕",
    info: "ℹ",
    warning: "⚠",
  };

  toast.innerHTML = `<span class="st-admin__toast-icon">${icons[type]}</span><span>${message}</span>`;

  container.appendChild(toast);

  // Trigger CSS transition for entry
  setTimeout(() => toast.classList.add("st-admin__toast--show"), 10);

  // Handle toast removal after duration elapses
  setTimeout(() => {
    toast.classList.remove("st-admin__toast--show");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
