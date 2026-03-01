/* ─────────────────────────────────────────
   SplitTab — Main Application
   Orchestrates the entire app and handles initialization
───────────────────────────────────────── */

import { state, saveState } from './state.js';
import { render, renderAssignPanel } from './renderers.js';
import { setRenderAssignPanel } from './navigation.js';

// ── SETUP CIRCULAR DEPENDENCY ──
setRenderAssignPanel(renderAssignPanel);

// ── EXPORT RENDER FUNCTION FOR OTHER MODULES ──
export { render };

// ── SERVICE WORKER REGISTRATION ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .catch(() => {}); // silent fail
  });
}

// ── PWA INSTALL PROMPT ──
let deferredPrompt = null;
let pwaPromptShown = false;

// Detect if device is mobile
function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && 
         !window.matchMedia('(display-mode: standalone)').matches;
}

// Show PWA install prompt
function showInstallPrompt() {
  if (!deferredPrompt || pwaPromptShown || !isMobile()) return;
  
  const prompt = document.getElementById('pwa-install-prompt');
  if (!prompt) return;
  
  prompt.classList.remove('hidden');
  pwaPromptShown = true;
  
  // Save that we showed the prompt
  localStorage.setItem('pwaPromptShown', 'true');
}

// Hide PWA install prompt
function hideInstallPrompt() {
  const prompt = document.getElementById('pwa-install-prompt');
  if (prompt) {
    prompt.classList.add('hidden');
  }
  
  // Show download button in header after dismissal
  showDownloadButton();
}

// Show download button in header
function showDownloadButton() {
  const downloadBtn = document.getElementById('pwa-download-btn');
  if (downloadBtn && isMobile() && deferredPrompt) {
    downloadBtn.classList.remove('hidden');
  }
}

// Hide download button in header
function hideDownloadButton() {
  const downloadBtn = document.getElementById('pwa-download-btn');
  if (downloadBtn) {
    downloadBtn.classList.add('hidden');
  }
}

// Install the PWA
async function installPWA() {
  if (!deferredPrompt) return;
  
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  
  if (outcome === 'accepted') {
    console.log('PWA installation accepted');
    // Hide download button after successful installation
    hideDownloadButton();
  } else {
    console.log('PWA installation dismissed');
  }
  
  deferredPrompt = null;
  hideInstallPrompt();
}

// Listen for beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  // Show prompt immediately on mobile if not already shown
  if (isMobile() && !pwaPromptShown && !localStorage.getItem('pwaPromptShown')) {
    // Small delay to ensure page is loaded
    setTimeout(showInstallPrompt, 1000);
  } else if (isMobile() && localStorage.getItem('pwaPromptShown')) {
    // User has previously dismissed, show download button
    showDownloadButton();
  }
});

// Handle install button click
document.addEventListener('click', (e) => {
  if (e.target.id === 'pwa-install-btn') {
    installPWA();
  } else if (e.target.id === 'pwa-dismiss-btn') {
    hideInstallPrompt();
  } else if (e.target.id === 'pwa-download-btn' || e.target.closest('#pwa-download-btn')) {
    installPWA();
  }
});

// Check if app is already installed and show prompt if needed
window.addEventListener('load', () => {
  // If we have a deferred prompt and it's mobile, show it immediately
  setTimeout(() => {
    if (deferredPrompt && isMobile() && !pwaPromptShown && !localStorage.getItem('pwaPromptShown')) {
      showInstallPrompt();
    } else if (deferredPrompt && isMobile() && localStorage.getItem('pwaPromptShown')) {
      // User has previously dismissed, show download button
      showDownloadButton();
    }
  }, 2000); // 2 second delay to let page load
});

// ── INITIALIZATION ──
document.addEventListener('DOMContentLoaded', () => {
  // Ensure people have proper default names if not named
  if (state.people.length === 0 && state.step > 1) {
    state.step = 1;
    saveState();
  }
  render();
});
