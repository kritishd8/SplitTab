/* ─────────────────────────────────────────
   SplitTab — UI Components
   Reusable UI components and builders
───────────────────────────────────────── */

import { state, saveState, uid } from './state.js';
import { 
  fmt, 
  getItemSubtotal, 
  getBillSubtotal, 
  getBillTotal, 
  getPersonSubtotal, 
  getPersonTotal,
  getRemainingQty,
  getAssignedQtyForPerson,
  getTotalAssignedQty,
  getAssignmentProgress,
  isFullyAssigned
} from './calculations.js';
import { escHtml } from './utils.js';

// ── NAVIGATION COMPONENTS ──
function buildNav(showBack, showNext, nextLabel = 'Next →') {
  const footer = document.createElement('div');
  footer.className = 'nav-footer';

  if (showBack) {
    const back = document.createElement('button');
    back.className = 'btn btn-secondary';
    back.textContent = '← Back';
    back.addEventListener('click', () => import('./navigation.js').then(nav => nav.prevStep()));
    footer.appendChild(back);
  }

  if (showNext) {
    const next = document.createElement('button');
    next.className = 'btn btn-primary';
    next.textContent = nextLabel;
    next.addEventListener('click', () => import('./navigation.js').then(nav => nav.nextStep()));
    footer.appendChild(next);
  }

  return footer;
}

// ── STEP 1 COMPONENTS ──
function buildItemCard(item, idx) {
  const card = document.createElement('div');
  card.className = 'item-card';
  card.dataset.id = item.id;

  const total = getItemSubtotal(item);

  card.innerHTML = `
    <div class="item-card-header">
      <span class="item-num">ITEM ${String(idx + 1).padStart(2, '0')}</span>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="item-total">${fmt(total)}</span>
        <button class="btn-remove" data-id="${item.id}">✕</button>
      </div>
    </div>
    <div class="input-row" style="grid-template-columns:1fr;margin-bottom:8px">
      <div>
        <label>Item name</label>
        <input type="text" class="item-name" data-id="${item.id}" placeholder="e.g. Chicken Momo" value="${escHtml(item.name)}">
      </div>
    </div>
    <div class="input-row cols-2">
      <div>
        <label>Qty</label>
        <input type="number" class="item-qty" data-id="${item.id}" placeholder="1" value="${item.quantity || ''}" min="0.1" step="0.5">
      </div>
      <div>
        <label>Unit price</label>
        <input type="number" class="item-price" data-id="${item.id}" placeholder="0.00" value="${item.unitPrice || ''}" min="0" step="0.01">
      </div>
    </div>
  `;

  // Events
  card.querySelector('.btn-remove').addEventListener('click', () => removeItem(item.id));

  card.querySelector('.item-name').addEventListener('input', (e) => {
    const i = state.items.find(x => x.id === item.id);
    if (i) { i.name = e.target.value; saveState(); }
    refreshBillPreview();
  });

  card.querySelector('.item-qty').addEventListener('input', (e) => {
    const i = state.items.find(x => x.id === item.id);
    if (i) {
      const newQty = parseFloat(e.target.value) || 0;
      // Check if assigned qty exceeds new qty
      const assigned = getTotalAssignedQty(item.id);
      if (assigned > newQty) {
        import('./utils.js').then(utils => utils.showError(`Cannot reduce quantity — ${fmt(assigned)} already assigned. Adjust assignments first.`));
        e.target.value = i.quantity;
        return;
      }
      i.quantity = newQty;
      saveState();
      updateItemTotal(item.id);
      refreshBillPreview();
    }
  });

  card.querySelector('.item-price').addEventListener('input', (e) => {
    const i = state.items.find(x => x.id === item.id);
    if (i) { i.unitPrice = parseFloat(e.target.value) || 0; saveState(); }
    updateItemTotal(item.id);
    refreshBillPreview();
  });

  return card;
}

function updateItemTotal(itemId) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;
  const card = document.querySelector(`.item-card[data-id="${itemId}"]`);
  if (!card) return;
  const totalEl = card.querySelector('.item-total');
  if (totalEl) totalEl.textContent = fmt(getItemSubtotal(item));
}

function refreshBillPreview() {
  const old = document.getElementById('billPreview');
  const main = document.getElementById('main');
  if (state.items.length === 0) { if (old) old.remove(); return; }
  const fresh = buildBillPreview();
  if (old) { old.replaceWith(fresh); }
  else { main.querySelector('.fade-in').appendChild(fresh); }
}

function buildBillPreview() {
  const sub = getBillSubtotal();
  const vat = sub * (parseFloat(state.charges.vatPercent) || 0) / 100;
  const svc = sub * (parseFloat(state.charges.servicePercent) || 0) / 100;
  const total = sub + vat + svc;

  const div = document.createElement('div');
  div.className = 'bill-summary';
  div.id = 'billPreview';
  div.innerHTML = `
    <div class="bill-summary-row"><span>Subtotal</span><span>${fmt(sub)}</span></div>
    ${vat > 0 ? `<div class="bill-summary-row"><span>VAT (${state.charges.vatPercent}%)</span><span>${fmt(vat)}</span></div>` : ''}
    ${svc > 0 ? `<div class="bill-summary-row"><span>Service (${state.charges.servicePercent}%)</span><span>${fmt(svc)}</span></div>` : ''}
    <div class="bill-summary-row total"><span>Bill Total</span><span>${fmt(total)}</span></div>
  `;
  return div;
}

function buildChargesSection() {
  const wrap = document.createElement('div');

  const toggle = document.createElement('div');
  toggle.className = 'charges-toggle';
  toggle.innerHTML = `
    <div class="toggle-switch ${state.charges.showCharges ? 'on' : ''}"></div>
    <span>Add VAT / Service charge?</span>
  `;
  toggle.addEventListener('click', () => {
    state.charges.showCharges = !state.charges.showCharges;
    saveState();
    // Re-render charges section only
    const existing = document.getElementById('chargesFields');
    if (existing) {
      existing.style.display = state.charges.showCharges ? 'block' : 'none';
    }
    toggle.querySelector('.toggle-switch').classList.toggle('on', state.charges.showCharges);
    refreshBillPreview();
  });

  const fields = document.createElement('div');
  fields.id = 'chargesFields';
  fields.style.display = state.charges.showCharges ? 'block' : 'none';
  fields.innerHTML = `
    <div class="input-row cols-2" style="margin-top:10px">
      <div>
        <label>VAT %</label>
        <input type="number" id="vatInput" placeholder="0" value="${state.charges.vatPercent || ''}" min="0" max="100" step="0.5">
      </div>
      <div>
        <label>Service %</label>
        <input type="number" id="svcInput" placeholder="0" value="${state.charges.servicePercent || ''}" min="0" max="100" step="0.5">
      </div>
    </div>
  `;

  wrap.appendChild(toggle);
  wrap.appendChild(fields);

  setTimeout(() => {
    const vatEl = document.getElementById('vatInput');
    const svcEl = document.getElementById('svcInput');
    if (vatEl) vatEl.addEventListener('input', e => { state.charges.vatPercent = parseFloat(e.target.value) || 0; saveState(); refreshBillPreview(); });
    if (svcEl) svcEl.addEventListener('input', e => { state.charges.servicePercent = parseFloat(e.target.value) || 0; saveState(); refreshBillPreview(); });
  }, 0);

  return wrap;
}

// ── STEP 2 COMPONENTS ──
function buildNameList() {
  const wrap = document.getElementById('nameListWrap');
  if (!wrap) return;
  wrap.innerHTML = '';

  if (!state.nameMode) return;

  const list = document.createElement('div');
  list.className = 'name-list';

  state.people.forEach((person, idx) => {
    const row = document.createElement('div');
    row.className = 'name-item';
    row.innerHTML = `
      <div class="name-badge">${idx + 1}</div>
    `;
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = `Person ${idx + 1}`;
    input.value = person.name || '';
    input.addEventListener('input', (e) => {
      const p = state.people.find(x => x.id === person.id);
      if (p) p.name = e.target.value || `Person ${idx + 1}`;
      saveState();
    });
    row.appendChild(input);
    list.appendChild(row);
  });

  wrap.appendChild(list);
}

// ── STEP 3 COMPONENTS ──
function buildPersonReceipt(person) {
  const assigns = state.assignments[person.id] || [];
  const sub = getPersonSubtotal(person.id);
  const total = getPersonTotal(person.id);
  const vatAmt = sub * (parseFloat(state.charges.vatPercent) || 0) / 100;
  const svcAmt = sub * (parseFloat(state.charges.servicePercent) || 0) / 100;
  const initials = person.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const div = document.createElement('div');
  div.className = 'receipt';

  let itemLines = '';
  if (assigns.length === 0) {
    itemLines = `<div class="receipt-line"><span class="item-name" style="color:var(--text-dim)">Nothing assigned</span><span class="item-price">—</span></div>`;
  } else {
    assigns.forEach(a => {
      const item = state.items.find(i => i.id === a.itemId);
      if (!item) return;
      const lineTotal = (parseFloat(item.unitPrice) || 0) * (parseFloat(a.quantity) || 0);
      itemLines += `
        <div class="receipt-line">
          <span class="item-name">${escHtml(item.name)} × ${a.quantity % 1 === 0 ? a.quantity : fmt(a.quantity)}</span>
          <span class="item-price">${fmt(lineTotal)}</span>
        </div>
      `;
    });
  }

  let taxLines = '';
  if (vatAmt > 0) taxLines += `<div class="receipt-line sub"><span class="item-name">VAT (${state.charges.vatPercent}%)</span><span class="item-price">${fmt(vatAmt)}</span></div>`;
  if (svcAmt > 0) taxLines += `<div class="receipt-line sub"><span class="item-name">Service (${state.charges.servicePercent}%)</span><span class="item-price">${fmt(svcAmt)}</span></div>`;

  div.innerHTML = `
    <div class="receipt-header">
      <div class="receipt-person">
        <div class="receipt-avatar">${initials}</div>
        <div class="receipt-name">${escHtml(person.name)}</div>
      </div>
      <div class="receipt-total">${fmt(total)}</div>
    </div>
    <div class="receipt-body">
      ${itemLines}
      ${taxLines}
    </div>
  `;

  return div;
}

function buildPayerSection() {
  const div = document.createElement('div');
  div.className = 'payer-section';

  const toggleRow = document.createElement('div');
  toggleRow.className = 'payer-select-row charges-toggle';
  toggleRow.innerHTML = `
    <div class="toggle-switch ${state.payer !== null ? 'on' : ''}"></div>
    <span>Who paid the bill?</span>
  `;

  const selectWrap = document.createElement('div');
  selectWrap.id = 'payerSelectWrap';
  selectWrap.style.display = state.payer !== null ? 'block' : 'none';

  if (state.payer !== null) {
    selectWrap.appendChild(buildPayerSelect());
    selectWrap.appendChild(buildSettlement());
  }

  toggleRow.addEventListener('click', () => {
    const isOn = state.payer !== null;
    if (isOn) {
      state.payer = null;
      saveState();
      selectWrap.style.display = 'none';
      selectWrap.innerHTML = '';
      toggleRow.querySelector('.toggle-switch').classList.remove('on');
    } else {
      state.payer = state.people[0]?.id || null;
      saveState();
      selectWrap.style.display = 'block';
      selectWrap.appendChild(buildPayerSelect());
      selectWrap.appendChild(buildSettlement());
      toggleRow.querySelector('.toggle-switch').classList.add('on');
    }
  });

  div.appendChild(toggleRow);
  div.appendChild(selectWrap);
  return div;
}

function buildPayerSelect() {
  const sel = document.createElement('select');
  sel.id = 'payerSelect';
  state.people.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    opt.selected = p.id === state.payer;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', (e) => {
    state.payer = e.target.value;
    saveState();
    const old = document.getElementById('settlementWrap');
    if (old) old.replaceWith(buildSettlement());
    else document.getElementById('payerSelectWrap').appendChild(buildSettlement());
  });
  return sel;
}

function buildSettlement() {
  const div = document.createElement('div');
  div.className = 'settlement';
  div.id = 'settlementWrap';
  div.innerHTML = `<div class="settlement-title">Settlement</div>`;

  const payer = state.people.find(p => p.id === state.payer);
  if (!payer) return div;

  const others = state.people.filter(p => p.id !== state.payer);
  if (others.length === 0) {
    div.innerHTML += `<div class="settlement-row">Only one person — nothing to settle.</div>`;
    return div;
  }

  others.forEach(p => {
    const owes = getPersonTotal(p.id);
    const row = document.createElement('div');
    row.className = 'settlement-row';
    row.innerHTML = `<strong>${escHtml(p.name)}</strong> owes <strong>${escHtml(payer.name)}</strong> → <strong>${fmt(owes)}</strong>`;
    div.appendChild(row);
  });

  return div;
}

// ── ITEM MANAGEMENT ──
function addItem() {
  state.items.push({ id: uid(), name: '', quantity: 1, unitPrice: 0 });
  saveState();
  // Add card to DOM without full re-render
  const wrap = document.getElementById('itemsWrap');
  if (wrap) {
    const idx = state.items.length - 1;
    const card = buildItemCard(state.items[idx], idx);
    wrap.appendChild(card);
    card.querySelector('.item-name').focus();
    refreshBillPreview();
  }
}

function removeItem(id) {
  // Check if item has assignments
  const assigned = getTotalAssignedQty(id);
  if (assigned > 0) {
    if (!confirm('This item has been assigned to people. Remove it and clear those assignments?')) return;
    // Clear assignments for this item
    Object.keys(state.assignments).forEach(pid => {
      state.assignments[pid] = state.assignments[pid].filter(a => a.itemId !== id);
    });
  }
  state.items = state.items.filter(i => i.id !== id);
  saveState();
  // Re-render step1 to update indices
  import('./app.js').then(app => app.render());
}

// ── PEOPLE MANAGEMENT ──
function adjustPeople(delta) {
  const current = state.people.length;
  const newCount = Math.max(1, current + delta);
  if (newCount === current) return;

  if (newCount < current) {
    // Check if removed people have assignments
    const removed = state.people.slice(newCount);
    const hasAssign = removed.some(p => (state.assignments[p.id] || []).length > 0);
    if (hasAssign) {
      if (!confirm(`Removing ${current - newCount} person(s) will clear their assignments. Continue?`)) return;
      removed.forEach(p => { delete state.assignments[p.id]; });
    }
    state.people = state.people.slice(0, newCount);
  } else {
    for (let i = current; i < newCount; i++) {
      state.people.push({ id: uid(), name: `Person ${i + 1}` });
    }
  }

  if (state.currentAssignPerson >= state.people.length) {
    state.currentAssignPerson = Math.max(0, state.people.length - 1);
  }

  saveState();
  document.getElementById('peopleCount').textContent = state.people.length;
  buildNameList();
}

// ── ASSIGNMENT MANAGEMENT ──
function setAssignment(personId, itemId, qty) {
  if (!state.assignments[personId]) state.assignments[personId] = [];
  const assigns = state.assignments[personId];
  const idx = assigns.findIndex(a => a.itemId === itemId);
  if (qty <= 0) {
    if (idx >= 0) assigns.splice(idx, 1);
  } else {
    if (idx >= 0) assigns[idx].quantity = qty;
    else assigns.push({ itemId, quantity: qty });
  }
  saveState();
}

// ── EXPORTS ──
export {
  buildNav,
  buildItemCard,
  updateItemTotal,
  refreshBillPreview,
  buildBillPreview,
  buildChargesSection,
  buildNameList,
  buildPersonReceipt,
  buildPayerSection,
  buildPayerSelect,
  buildSettlement,
  addItem,
  removeItem,
  adjustPeople,
  setAssignment
};
