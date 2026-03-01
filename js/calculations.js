/* ─────────────────────────────────────────
   SplitTab — Calculation Utilities
   Handles all bill calculations and derived values
───────────────────────────────────────── */

import { state } from './state.js';

// ── CURRENCY FORMAT ──
function fmt(n) {
  const num = parseFloat(n) || 0;
  return num.toFixed(2);
}

// ── ITEM CALCULATIONS ──
function getItemSubtotal(item) {
  return (parseFloat(item.unitPrice) || 0) * (parseFloat(item.quantity) || 0);
}

function getBillSubtotal() {
  return state.items.reduce((s, item) => s + getItemSubtotal(item), 0);
}

function getBillTotal() {
  const sub = getBillSubtotal();
  const vat = sub * (parseFloat(state.charges.vatPercent) || 0) / 100;
  const svc = sub * (parseFloat(state.charges.servicePercent) || 0) / 100;
  return sub + vat + svc;
}

function getVatMultiplier() {
  return 1 + (parseFloat(state.charges.vatPercent) || 0) / 100
             + (parseFloat(state.charges.servicePercent) || 0) / 100;
}

// ── ASSIGNMENT CALCULATIONS ──
function getRemainingQty(itemId) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return 0;
  const total = parseFloat(item.quantity) || 0;
  const assigned = Object.values(state.assignments)
    .flat()
    .filter(a => a.itemId === itemId)
    .reduce((s, a) => s + (parseFloat(a.quantity) || 0), 0);
  return total - assigned;
}

function getPersonSubtotal(personId) {
  const assigns = state.assignments[personId] || [];
  return assigns.reduce((s, a) => {
    const item = state.items.find(i => i.id === a.itemId);
    if (!item) return s;
    return s + (parseFloat(item.unitPrice) || 0) * (parseFloat(a.quantity) || 0);
  }, 0);
}

function getPersonTotal(personId) {
  const sub = getPersonSubtotal(personId);
  return sub * getVatMultiplier();
}

function getAssignedQtyForPerson(personId, itemId) {
  const assigns = state.assignments[personId] || [];
  const a = assigns.find(a => a.itemId === itemId);
  return a ? parseFloat(a.quantity) || 0 : 0;
}

function getTotalAssignedQty(itemId) {
  return Object.values(state.assignments)
    .flat()
    .filter(a => a.itemId === itemId)
    .reduce((s, a) => s + (parseFloat(a.quantity) || 0), 0);
}

// ── PROGRESS CALCULATIONS ──
function isFullyAssigned() {
  return state.items.every(item => Math.abs(getRemainingQty(item.id)) < 0.001);
}

function getAssignmentProgress() {
  const totalQty = state.items.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0);
  const assignedQty = state.items.reduce((s, i) => s + getTotalAssignedQty(i.id), 0);
  return totalQty === 0 ? 0 : Math.round((assignedQty / totalQty) * 100);
}

// ── EXPORTS ──
export {
  fmt,
  getItemSubtotal,
  getBillSubtotal,
  getBillTotal,
  getVatMultiplier,
  getRemainingQty,
  getPersonSubtotal,
  getPersonTotal,
  getAssignedQtyForPerson,
  getTotalAssignedQty,
  isFullyAssigned,
  getAssignmentProgress
};
