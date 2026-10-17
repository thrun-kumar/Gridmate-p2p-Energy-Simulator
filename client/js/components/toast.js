/**
 * GRIDMATE - Toast Notification Component
 */

window.Toast = {
  show(message, type = 'success', duration = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconHtml = window.Icons.checkCircle('w-5 h-5 text-emerald-400');
    if (type === 'error') {
      iconHtml = window.Icons.alertCircle('w-5 h-5 text-red-400');
    } else if (type === 'info') {
      iconHtml = window.Icons.activity('w-5 h-5 text-blue-400');
    }

    toast.innerHTML = `
      <div class="flex-shrink-0">${iconHtml}</div>
      <div class="flex-1 font-medium text-sm">${message}</div>
      <button class="text-slate-400 hover:text-white text-xs ml-2 cursor-pointer" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(30px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error', 5500); },
  info(msg) { this.show(msg, 'info'); }
};
