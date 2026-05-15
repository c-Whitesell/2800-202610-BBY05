document.addEventListener('DOMContentLoaded', () => {
  initializeAdminDashboard();
});

function initializeAdminDashboard() {
  setupNavigation();
  setupUserSearch();
  setupRoleToggle();
  setupToasts();
}

function setupNavigation() {
  const navLinks = document.querySelectorAll('.st-admin__nav-link');
  const sections = document.querySelectorAll('.st-admin__section');

  navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      const sectionId = link.getAttribute('data-section');

      if (!sectionId) return;
      e.preventDefault();

      const targetSection = document.getElementById(sectionId);

      navLinks.forEach((l) => l.classList.remove('active'));
      sections.forEach((s) => s.classList.remove('st-admin__section--active'));

      link.classList.add('active');
      targetSection.classList.add('st-admin__section--active');

      targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function setupUserSearch() {
  const searchInput = document.getElementById('userSearch');
  const tableRows = document.querySelectorAll('.st-admin__table-row');

  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();

    tableRows.forEach((row) => {
      const name =
        row.querySelector('.st-admin__user-name')?.textContent.toLowerCase() ||
        '';
      const email =
        row.querySelector('.st-admin__email')?.textContent.toLowerCase() || '';

      const matches = name.includes(query) || email.includes(query);
      row.style.display = matches ? '' : 'none';
    });
  });
}

function setupRoleToggle() {
  const toggleButtons = document.querySelectorAll('.st-admin__btn-toggle-role');

  toggleButtons.forEach((button) => {
    button.addEventListener('click', async (e) => {
      const email = button.getAttribute('data-email');
      const currentRole = button.getAttribute('data-current-role');

      const confirmed = confirm(
        `Are you sure you want to ${currentRole === 'admin' ? 'demote this user to regular user?' : 'promote this user to admin?'}`,
      );

      if (!confirmed) return;

      try {
        const response = await fetch('/api/admin/toggle-role', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (!response.ok) {
          showToast(data.error || 'Failed to update user role', 'error');
          return;
        }

        const row = document.querySelector(`tr[data-email="${email}"]`);
        if (row) {
          const roleSpan = row.querySelector('.st-admin__role-badge');
          const actionBtn = row.querySelector('.st-admin__btn-toggle-role');

          const newRole = data.newRole;
          const isAdmin = newRole === 'admin';

          roleSpan.textContent = isAdmin ? 'Admin' : 'User';
          roleSpan.className = `st-admin__role-badge st-admin__role-${newRole}`;

          actionBtn.textContent = isAdmin ? '⬇️ Demote' : '⬆️ Promote';
          actionBtn.setAttribute('data-current-role', newRole);
          actionBtn.title = isAdmin ? 'Demote to User' : 'Promote to Admin';
        }

        showToast(data.message, 'success');
      } catch (error) {
        console.error('Error:', error);
        showToast('An error occurred while updating user role', 'error');
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
  toast.className = `st-admin__toast st-admin__toast--${type}`;
  toast.textContent = message;

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
  };

  toast.innerHTML = `<span class="st-admin__toast-icon">${icons[type]}</span><span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => toast.classList.add('st-admin__toast--show'), 10);

  setTimeout(() => {
    toast.classList.remove('st-admin__toast--show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
