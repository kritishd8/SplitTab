/* ─────────────────────────────────────────
   SplitTab — State Management
   Handles app state, persistence, and utilities
───────────────────────────────────────── */

// ── DEFAULT STATE ──
const DEFAULT_STATE = {
  step: 1,
  items: [],
  charges: { vatPercent: 0, servicePercent: 0, showCharges: false },
  people: [],
  nameMode: false,
  assignments: {},
  payer: null,
  currentAssignPerson: 0
};

// ── STATE INSTANCE ──
let state = loadState();

// ── STATE FUNCTIONS ──
function loadState() {
  try {
    const s = localStorage.getItem('splittab_state');
    return s ? JSON.parse(s) : deepClone(DEFAULT_STATE);
  } catch (e) {
    return deepClone(DEFAULT_STATE);
  }
}

function saveState() {
  try {
    localStorage.setItem('splittab_state', JSON.stringify(state));
  } catch (e) {}
}

function resetState() {
  localStorage.removeItem('splittab_state');
  state = deepClone(DEFAULT_STATE);
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ── ID GENERATOR ──
let _id = Date.now();
function uid() { return (++_id).toString(36); }

// ── EXPORTS ──
export { state, DEFAULT_STATE, saveState, resetState, deepClone, uid };
