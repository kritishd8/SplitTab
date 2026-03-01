/* ─────────────────────────────────────────
   SplitTab — Utility Functions
   Helper functions and error handling
───────────────────────────────────────── */

// ── ERROR HANDLING ──
function showError(msg) {
  let el = document.getElementById('errorMsg');
  if (!el) {
    el = document.createElement('div');
    el.id = 'errorMsg';
    el.className = 'warn-banner';
    document.getElementById('main').prepend(el);
  }
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { if (el) el.style.display = 'none'; }, 3000);
}

// ── HTML ESCAPING ──
function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── EXPORTS ──
export { showError, escHtml };
