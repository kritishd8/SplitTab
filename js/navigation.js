/* ─────────────────────────────────────────
   SplitTab — Navigation Logic
   Handles step navigation and validation
───────────────────────────────────────── */

import { state, saveState } from './state.js';
import { isFullyAssigned } from './calculations.js';
import { render } from './app.js';
import { showError } from './utils.js';

// ── NAVIGATION FUNCTIONS ──
function goTo(step) {
  // Validate navigation
  if (step < 1 || step > 4) return;
  
  // Prevent going to summary if items aren't fully assigned
  if (step === 4 && !isFullyAssigned()) {
    showError('Assign all items before viewing summary.');
    return;
  }
  
  state.step = step;
  saveState();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextStep() {
  if (state.step === 1) {
    if (state.items.length === 0) { showError('Add at least one item first.'); return; }
    if (!state.items.every(i => i.name.trim())) { showError('All items need a name.'); return; }
    goTo(2);
  } else if (state.step === 2) {
    if (!state.people.length || state.people.length < 1) { showError('Need at least 1 person.'); return; }
    goTo(3);
  } else if (state.step === 3) {
    // Check if all items are fully assigned before allowing summary
    if (!isFullyAssigned()) {
      // Move to next person instead of summary
      state.currentAssignPerson = (state.currentAssignPerson + 1) % state.people.length;
      saveState();
      renderAssignPanel();
      updatePersonPills();
      updateStep3NavLabel();
      return;
    }
    // Only go to summary if all items are assigned
    goTo(4);
  }
}

function prevStep() {
  if (state.step === 3) {
    // On assignment step, go to previous person if not on first person
    if (state.currentAssignPerson > 0) {
      state.currentAssignPerson--;
      saveState();
      renderAssignPanel();
      updatePersonPills();
      updateStep3NavLabel();
      return;
    } else {
      // On first person, go to step 2
      goTo(2);
      return;
    }
  }
  
  // For other steps, use normal navigation
  if (state.step > 1) goTo(state.step - 1);
}

// ── STEP 3 SPECIFIC FUNCTIONS ──
function updateStep3NavLabel() {
  if (state.step !== 3) return;
  
  const nextBtn = document.querySelector('.nav-footer .btn-primary');
  if (nextBtn) {
    nextBtn.textContent = isFullyAssigned() ? 'Next: Summary →' : `Next: ${state.people[(state.currentAssignPerson + 1) % state.people.length].name} →`;
  }
}

function updatePersonPills() {
  const pills = document.querySelectorAll('.person-pill');
  state.people.forEach((p, idx) => {
    if (pills[idx]) {
      pills[idx].className = 'person-pill'
        + (idx === state.currentAssignPerson ? ' active' : '')
        + ((state.assignments[p.id] || []).length > 0 ? ' has-items' : '');
    }
  });
}

// ── IMPORTS FOR CIRCULAR DEPENDENCIES ──
// These will be set by app.js to avoid circular dependencies
let renderAssignPanel;
let setRenderAssignPanel = (fn) => { renderAssignPanel = fn; };

// ── EXPORTS ──
export { 
  goTo, 
  nextStep, 
  prevStep, 
  updateStep3NavLabel, 
  updatePersonPills,
  setRenderAssignPanel
};
