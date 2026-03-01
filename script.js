/* ─────────────────────────────────────────
   SplitTab — Expense Splitter
   Vanilla JS, no frameworks, PWA-ready
───────────────────────────────────────── */

// ── SERVICE WORKER REGISTRATION ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .catch(() => {}); // silent fail
  });
}

// ── PWA INSTALL PROMPT ──
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  // Store the event for later use if needed
  window.deferredPrompt = e;
});

// ── STATE ──
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

let state = loadState();

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

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ── ID GENERATOR ──
let _id = Date.now();
function uid() { return (++_id).toString(36); }

// ── CURRENCY FORMAT ──
function fmt(n) {
  const num = parseFloat(n) || 0;
  return num.toFixed(2);
}

// ── DERIVED CALCULATIONS ──
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

// Compute remaining quantities based on assignments
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

// Total assigned across all people
function getTotalAssignedQty(itemId) {
  return Object.values(state.assignments)
    .flat()
    .filter(a => a.itemId === itemId)
    .reduce((s, a) => s + (parseFloat(a.quantity) || 0), 0);
}

function isFullyAssigned() {
  return state.items.every(item => Math.abs(getRemainingQty(item.id)) < 0.001);
}

function getAssignmentProgress() {
  const totalQty = state.items.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0);
  const assignedQty = state.items.reduce((s, i) => s + getTotalAssignedQty(i.id), 0);
  return totalQty === 0 ? 0 : Math.round((assignedQty / totalQty) * 100);
}

// ── NAVIGATION ──
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

// ── ERROR ──
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

// ── RENDER ──
function render() {
  renderDots();
  const main = document.getElementById('main');
  main.innerHTML = '';

  if (state.step === 1) renderStep1(main);
  else if (state.step === 2) renderStep2(main);
  else if (state.step === 3) renderStep3(main);
  else if (state.step === 4) renderStep4(main);
}

function renderDots() {
  const el = document.getElementById('stepDots');
  el.innerHTML = '';
  for (let i = 1; i <= 4; i++) {
    const d = document.createElement('div');
    d.className = 'step-dot' + (i === state.step ? ' active' : i < state.step ? ' done' : '');
    d.title = ['Items', 'People', 'Assign', 'Summary'][i - 1];
    d.addEventListener('click', () => {
      if (i <= state.step || i === state.step + 1) {
        // Additional check for summary step
        if (i === 4 && !isFullyAssigned()) {
          showError('Assign all items before viewing summary.');
          return;
        }
        goTo(i);
      }
    });
    el.appendChild(d);
  }
}

// ── STEP 1 ──
function renderStep1(container) {
  const wrap = document.createElement('div');
  wrap.className = 'fade-in';
  wrap.innerHTML = `
    <div class="step-eyebrow">Step 1 of 4</div>
    <div class="step-title">What's on the bill?</div>
  `;

  // Items
  const itemsWrap = document.createElement('div');
  itemsWrap.id = 'itemsWrap';

  state.items.forEach((item, idx) => {
    itemsWrap.appendChild(buildItemCard(item, idx));
  });

  // Add item btn
  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-ghost';
  addBtn.innerHTML = '＋ Add item';
  addBtn.addEventListener('click', () => {
    addItem();
  });

  wrap.appendChild(itemsWrap);
  wrap.appendChild(addBtn);

  // Charges toggle
  const chargesSection = buildChargesSection();
  wrap.appendChild(chargesSection);

  // Bill preview
  if (state.items.length > 0) {
    wrap.appendChild(buildBillPreview());
  }

  container.appendChild(wrap);

  // Nav
  container.appendChild(buildNav(false, true, 'Next: People →'));
}

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
        showError(`Cannot reduce quantity — ${fmt(assigned)} already assigned. Adjust assignments first.`);
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
  render();
}

// ── STEP 2 ──
function renderStep2(container) {
  const wrap = document.createElement('div');
  wrap.className = 'fade-in';
  wrap.innerHTML = `
    <div class="step-eyebrow">Step 2 of 4</div>
    <div class="step-title">How many people are splitting?</div>
  `;

  // Count control
  const countRow = document.createElement('div');
  countRow.className = 'people-count-row';
  countRow.innerHTML = `
    <div class="count-control">
      <button class="count-btn" id="decPeople">−</button>
      <span class="count-val" id="peopleCount">${state.people.length}</span>
      <button class="count-btn" id="incPeople">＋</button>
    </div>
    <span class="text-muted">people</span>
  `;
  wrap.appendChild(countRow);

  // Name toggle
  const nameToggle = document.createElement('div');
  nameToggle.className = 'charges-toggle';
  nameToggle.innerHTML = `
    <div class="toggle-switch ${state.nameMode ? 'on' : ''}"></div>
    <span>Name them?</span>
  `;
  nameToggle.addEventListener('click', () => {
    state.nameMode = !state.nameMode;
    saveState();
    nameToggle.querySelector('.toggle-switch').classList.toggle('on', state.nameMode);
    renderNameList();
  });
  wrap.appendChild(nameToggle);

  // Name list
  const nameListWrap = document.createElement('div');
  nameListWrap.id = 'nameListWrap';
  wrap.appendChild(nameListWrap);

  container.appendChild(wrap);
  container.appendChild(buildNav(true, true, 'Next: Assign →'));

  renderNameList();

  // Button events
  document.getElementById('decPeople').addEventListener('click', () => adjustPeople(-1));
  document.getElementById('incPeople').addEventListener('click', () => adjustPeople(1));
}

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
  renderNameList();
}

function renderNameList() {
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

// ── STEP 3 ──
function renderStep3(container) {
  const wrap = document.createElement('div');
  wrap.className = 'fade-in';
  wrap.innerHTML = `
    <div class="step-eyebrow">Step 3 of 4</div>
    <div class="step-title">Who had what?</div>
  `;

  if (state.people.length === 0) {
    wrap.innerHTML += `<div class="empty-state"><div class="icon">👥</div><p>Go back and add people first.</p></div>`;
    container.appendChild(wrap);
    container.appendChild(buildNav(true, false));
    return;
  }

  // Progress
  const prog = getAssignmentProgress();
  const progressEl = document.createElement('div');
  progressEl.className = 'assign-progress';
  progressEl.id = 'assignProgress';
  progressEl.innerHTML = `
    <div class="progress-label">
      <span>Items assigned</span>
      <span id="progPct">${prog}%</span>
    </div>
    <div class="progress-bar"><div class="progress-fill" id="progFill" style="width:${prog}%"></div></div>
  `;
  wrap.appendChild(progressEl);

  // Person nav pills
  const pills = document.createElement('div');
  pills.className = 'person-nav';
  pills.id = 'personNav';
  state.people.forEach((p, idx) => {
    const pill = document.createElement('button');
    pill.className = 'person-pill' + (idx === state.currentAssignPerson ? ' active' : '') + ((state.assignments[p.id] || []).length > 0 ? ' has-items' : '');
    pill.textContent = p.name;
    pill.addEventListener('click', () => {
      state.currentAssignPerson = idx;
      saveState();
      renderAssignPanel();
      updatePersonPills();
      updateStep3NavLabel();
    });
    pills.appendChild(pill);
  });
  wrap.appendChild(pills);

  // Panel
  const panel = document.createElement('div');
  panel.id = 'assignPanel';
  wrap.appendChild(panel);

  container.appendChild(wrap);
  container.appendChild(buildNav(true, true, isFullyAssigned() ? 'Next: Summary →' : `Next: ${state.people[(state.currentAssignPerson + 1) % state.people.length].name} →`));

  renderAssignPanel();
}

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

function renderAssignPanel() {
  const panel = document.getElementById('assignPanel');
  if (!panel) return;
  panel.innerHTML = '';

  const person = state.people[state.currentAssignPerson];
  if (!person) return;

  // Person header
  const header = document.createElement('div');
  header.className = 'person-header';
  const initials = person.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  header.innerHTML = `
    <div class="person-avatar">${initials}</div>
    <div class="person-info">
      <div class="sub">What did</div>
      <div class="name">${escHtml(person.name)} have?</div>
    </div>
  `;
  panel.appendChild(header);

  if (state.items.length === 0) {
    panel.innerHTML += `<div class="empty-state"><div class="icon">🧾</div><p>No items on the bill yet.</p></div>`;
    return;
  }

  // Item cards
  state.items.forEach(item => {
    const currentQty = getAssignedQtyForPerson(person.id, item.id);
    const remaining = getRemainingQty(item.id); // does NOT include current person's qty
    // Max for this person = remaining + what they already have
    const maxQty = remaining + currentQty;
    const isAssigned = currentQty > 0;

    const card = document.createElement('div');
    card.className = 'item-assign-card' + (isAssigned ? ' assigned' : '');
    card.dataset.itemId = item.id;

    card.innerHTML = `
      <div class="item-assign-left">
        <div class="item-assign-name">${escHtml(item.name) || 'Unnamed item'}</div>
        <div class="item-assign-remaining">
          ${remaining + currentQty > 0 ? `${fmt(maxQty)} available` : '<span style="color:var(--danger)">None left</span>'}
          · <span style="color:var(--text-muted)">@${fmt(item.unitPrice)} each</span>
        </div>
      </div>
      <div class="qty-control">
        <button class="qty-btn dec-btn" ${currentQty <= 0 ? 'disabled' : ''}>−</button>
        <span class="qty-val">${currentQty % 1 === 0 ? currentQty : fmt(currentQty)}</span>
        <button class="qty-btn inc-btn" ${maxQty <= currentQty ? 'disabled' : ''}>＋</button>
      </div>
    `;

    const decBtn = card.querySelector('.dec-btn');
    const incBtn = card.querySelector('.inc-btn');
    const qtyVal = card.querySelector('.qty-val');

    function updateAssignment(newQty) {
      newQty = Math.max(0, Math.min(newQty, maxQty));
      setAssignment(person.id, item.id, newQty);
      const updMax = getRemainingQty(item.id) + newQty;
      qtyVal.textContent = newQty % 1 === 0 ? newQty : fmt(newQty);
      decBtn.disabled = newQty <= 0;
      incBtn.disabled = newQty >= updMax;
      card.classList.toggle('assigned', newQty > 0);
      card.querySelector('.item-assign-remaining').innerHTML = `
        ${updMax > 0 ? `${fmt(updMax)} available` : '<span style="color:var(--danger)">None left</span>'}
        · <span style="color:var(--text-muted)">@${fmt(item.unitPrice)} each</span>
      `;
      updateProgress();
      updatePersonPills();
      updateStep3NavLabel();
    }

    decBtn.addEventListener('click', () => {
      const cur = getAssignedQtyForPerson(person.id, item.id);
      updateAssignment(cur - 0.5);
    });

    incBtn.addEventListener('click', () => {
      const cur = getAssignedQtyForPerson(person.id, item.id);
      updateAssignment(cur + 0.5);
    });

    panel.appendChild(card);
  });

  // Person subtotal
  const sub = getPersonSubtotal(person.id);
  if (sub > 0) {
    const subtotalEl = document.createElement('div');
    subtotalEl.className = 'bill-summary';
    subtotalEl.style.marginTop = '16px';
    subtotalEl.id = 'personSubtotal';
    subtotalEl.innerHTML = `
      <div class="bill-summary-row"><span>${escHtml(person.name)}'s subtotal</span><span>${fmt(sub)}</span></div>
      <div class="bill-summary-row total"><span>inc. taxes/fees</span><span>${fmt(getPersonTotal(person.id))}</span></div>
    `;
    panel.appendChild(subtotalEl);
  }
}

function updateProgress() {
  const prog = getAssignmentProgress();
  const fill = document.getElementById('progFill');
  const pct = document.getElementById('progPct');
  if (fill) fill.style.width = prog + '%';
  if (pct) pct.textContent = prog + '%';
}

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

// ── STEP 4 ──
function renderStep4(container) {
  const wrap = document.createElement('div');
  wrap.className = 'fade-in';
  wrap.innerHTML = `
    <div class="step-eyebrow">Step 4 of 4</div>
    <div class="step-title">The split.</div>
  `;

  // Unassigned warning
  const unassigned = state.items.filter(i => getRemainingQty(i.id) > 0.001);
  if (unassigned.length > 0) {
    const warn = document.createElement('div');
    warn.className = 'warn-banner';
    warn.innerHTML = `⚠️ Some items aren't fully assigned: ${unassigned.map(i => `${escHtml(i.name)} (${fmt(getRemainingQty(i.id))} left)`).join(', ')}`;
    wrap.appendChild(warn);
  }

  // Per-person receipts
  state.people.forEach(person => {
    wrap.appendChild(buildPersonReceipt(person));
  });

  // Grand total
  const grandTotal = getBillTotal();
  const splitTotal = state.people.reduce((s, p) => s + getPersonTotal(p.id), 0);

  const grand = document.createElement('div');
  grand.className = 'grand-total';
  grand.innerHTML = `
    <div>
      <div class="grand-total-label">Grand Total</div>
      <div style="font-size:0.75rem;opacity:0.6;margin-top:2px">Bill: ${fmt(grandTotal)}</div>
    </div>
    <div class="grand-total-amount">${fmt(splitTotal)}</div>
  `;
  wrap.appendChild(grand);

  // Payer / settlement
  wrap.appendChild(buildPayerSection());

  // Copy and Download buttons
  const copyRow = document.createElement('div');
  copyRow.className = 'copy-row';
  copyRow.innerHTML = `
    <button class="btn btn-secondary" id="copyBtn" style="flex:1">📋 Copy Summary</button>
    <button class="btn btn-secondary" id="downloadBtn" style="flex:1">📷 Download Receipt</button>
    <span class="copy-feedback" id="copyFeedback">Copied!</span>
    <span class="copy-feedback" id="downloadFeedback">Downloaded!</span>
    <hr>
  `;
  wrap.appendChild(copyRow);

  // Reset
  const resetDiv = document.createElement('div');
  resetDiv.className = 'reset-section';
  resetDiv.innerHTML = `<button class="btn btn-danger" id="resetBtn" style="font-size:0.8rem;padding:10px 18px">Start over</button>`;
  wrap.appendChild(resetDiv);

  container.appendChild(wrap);
  container.appendChild(buildNav(true, false));

  // Events
  document.getElementById('copyBtn').addEventListener('click', copySummary);
  document.getElementById('downloadBtn').addEventListener('click', downloadSummary);
  document.getElementById('resetBtn').addEventListener('click', resetApp);
}

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

function copySummary() {
  const lines = [`SplitTab Summary`, `${'─'.repeat(24)}`];
  state.people.forEach(p => {
    lines.push(`${p.name}: ${fmt(getPersonTotal(p.id))}`);
  });
  lines.push(`${'─'.repeat(24)}`);
  lines.push(`Total: ${fmt(state.people.reduce((s, p) => s + getPersonTotal(p.id), 0))}`);

  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    const fb = document.getElementById('copyFeedback');
    if (fb) { fb.classList.add('show'); setTimeout(() => fb.classList.remove('show'), 2000); }
  }).catch(() => {
    // Fallback
    const el = document.createElement('textarea');
    el.value = lines.join('\n');
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  });
}

function downloadSummary() {
  // Create a clean receipt element for capture
  const receiptEl = createPrintableReceipt();
  document.body.appendChild(receiptEl);
  
  // Show feedback
  const fb = document.getElementById('downloadFeedback');
  if (fb) { fb.classList.add('show'); }
  
  // Use html2canvas to capture the receipt
  html2canvas(receiptEl, {
    backgroundColor: '#ffffff',
    scale: 2,
    logging: false,
    useCORS: true
  }).then(canvas => {
    // Convert to blob and download
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `splittab-receipt-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Clean up and hide feedback
      document.body.removeChild(receiptEl);
      setTimeout(() => { if (fb) fb.classList.remove('show'); }, 2000);
    }, 'image/png');
  }).catch(error => {
    console.error('Error generating receipt:', error);
    document.body.removeChild(receiptEl);
    if (fb) fb.classList.remove('show');
    showError('Failed to generate receipt. Please try again.');
  });
}

function createPrintableReceipt() {
  const div = document.createElement('div');
  div.className = 'printable-receipt';
  div.style.cssText = `
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: 400px;
    background: #000000;
    padding: 24px;
    font-family: 'NeueMachina', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #ffffff;
    border: 1px solid #2e2e2e;
  `;

  const date = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const grandTotal = getBillTotal();
  const splitTotal = state.people.reduce((s, p) => s + getPersonTotal(p.id), 0);

  let receiptHTML = `
    <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #2e2e2e; padding-bottom: 16px;">
      <svg width="24px" height="24px" viewBox="0 0 86 90" fill="none" class="logo-image" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M0 20C0 15.286 0 12.9289 1.46447 11.4645C2.92893 10 5.28595 10 10 10H30C34.714 10 37.0711 10 38.5355 11.4645C40 12.9289 40 15.286 40 20V70C40 74.714 40 77.0711 38.5355 78.5355C37.0711 80 34.714 80 30 80H10C5.28595 80 2.92893 80 1.46447 78.5355C0 77.0711 0 74.714 0 70V20Z"
          fill="#ffffff" />
        <path
          d="M46 10H76C80.714 10 83.0711 10 84.5355 11.4645C86 12.9289 86 15.286 86 20V70C86 74.714 86 77.0711 84.5355 78.5355C83.0711 80 80.714 80 76 80H46V10Z"
          fill="#ffffff" />
        <path
          d="M44 1C44 0.447718 44.4477 0 45 0C45.5523 0 46 0.447715 46 1V89C46 89.5523 45.5523 90 45 90C44.4477 90 44 89.5523 44 89V1Z"
          fill="#ffffff" />
      </svg>
      <div style="font-size: 24px; font-weight: 800; color: #ffffff;">SplitTab</div>
      <div style="font-size: 12px; color: #888; margin-top: 4px;">Bill Split Summary</div>
      <div style="font-size: 11px; color: #666; margin-top: 8px;">${date}</div>
    </div>
  `;

  // Add each person's receipt
  state.people.forEach(person => {
    const assigns = state.assignments[person.id] || [];
    const sub = getPersonSubtotal(person.id);
    const total = getPersonTotal(person.id);
    const vatAmt = sub * (parseFloat(state.charges.vatPercent) || 0) / 100;
    const svcAmt = sub * (parseFloat(state.charges.servicePercent) || 0) / 100;

    receiptHTML += `
      <div style="margin-bottom: 20px; padding: 16px; background: #202020; border-radius: 8px; border: 1px solid #2e2e2e;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div style="font-weight: 400; font-size: 16px; color: #ffffff;">${escHtml(person.name)}</div>
          <div style="font-weight: 800; font-size: 18px; color: #ffffff;">${fmt(total)}</div>
        </div>
    `;

    if (assigns.length > 0) {
      receiptHTML += '<div style="font-size: 12px; color: #888; margin-bottom: 8px;">Items:</div>';
      assigns.forEach(a => {
        const item = state.items.find(i => i.id === a.itemId);
        if (!item) return;
        const lineTotal = (parseFloat(item.unitPrice) || 0) * (parseFloat(a.quantity) || 0);
        receiptHTML += `
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; color: #ffffff;">
            <span>${escHtml(item.name)} × ${a.quantity % 1 === 0 ? a.quantity : fmt(a.quantity)}</span>
            <span>${fmt(lineTotal)}</span>
          </div>
        `;
      });
    } else {
      receiptHTML += '<div style="font-size: 11px; color: #666; font-style: italic;">Nothing assigned</div>';
    }

    // Add taxes/fees if applicable
    if (vatAmt > 0 || svcAmt > 0) {
      receiptHTML += '<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #2e2e2e;">';
      if (vatAmt > 0) {
        receiptHTML += `
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #888;">
            <span>VAT (${state.charges.vatPercent}%)</span>
            <span>${fmt(vatAmt)}</span>
          </div>
        `;
      }
      if (svcAmt > 0) {
        receiptHTML += `
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #888;">
            <span>Service (${state.charges.servicePercent}%)</span>
            <span>${fmt(svcAmt)}</span>
          </div>
        `;
      }
      receiptHTML += '</div>';
    }

    receiptHTML += '</div>';
  });

  // Add grand total
  receiptHTML += `
    <div style="margin-top: 24px; padding: 16px; background: #ffffff; border: 2px solid #ffffff; border-radius: 8px; text-align: center;">
      <div style="font-size: 14px; font-weight: 800; color: #000000; margin-bottom: 4px;">Grand Total</div>
      <div style="font-size: 24px; font-weight: 800; color: #000000;">${fmt(splitTotal)}</div>
    </div>
  `;

  // Add payer/settlement section if exists
  if (state.payer !== null) {
    const payer = state.people.find(p => p.id === state.payer);
    if (payer) {
      const others = state.people.filter(p => p.id !== state.payer);
      if (others.length > 0) {
        receiptHTML += `
          <div style="margin-top: 20px; padding: 16px; background: #202020; border: 1px solid #2e2e2e; border-radius: 8px;">
            <div style="font-size: 14px; font-weight: 800; color: #ffffff; margin-bottom: 4px; text-align: center;">Settlement</div>
            <div style="font-size: 12px; color: #888; margin-bottom: 12px; text-align: center;">${escHtml(payer.name)} paid the bill</div>
        `;
        
        others.forEach(p => {
          const owes = getPersonTotal(p.id);
          receiptHTML += `
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; color: #ffffff;">
              <span>${escHtml(p.name)} owes ${escHtml(payer.name)}</span>
              <span>${fmt(owes)}</span>
            </div>
          `;
        });
        
        receiptHTML += '</div>';
      }
    }
  }

  // Add footer
  receiptHTML += `
    <div style="text-align: center; margin-top: 20px; padding-top: 16px; border-top: 1px solid #2e2e2e;">
      <div style="font-size: 10px; color: #666;">Generated with SplitTab</div>
      <div style="font-size: 9px; color: #888; margin-top: 2px;">kritishdhakal.com.np/SplitTab</div>
    </div>
  `;

  div.innerHTML = receiptHTML;
  return div;
}

function resetApp() {
  if (!confirm('Start a fresh split? All current data will be cleared.')) return;
  localStorage.removeItem('splittab_state');
  state = deepClone(DEFAULT_STATE);
  render();
  window.scrollTo({ top: 0 });
}

// ── NAV FOOTER ──
function buildNav(showBack, showNext, nextLabel = 'Next →') {
  const footer = document.createElement('div');
  footer.className = 'nav-footer';

  if (showBack) {
    const back = document.createElement('button');
    back.className = 'btn btn-secondary';
    back.textContent = '← Back';
    back.addEventListener('click', prevStep);
    footer.appendChild(back);
  }

  if (showNext) {
    const next = document.createElement('button');
    next.className = 'btn btn-primary';
    next.textContent = nextLabel;
    next.addEventListener('click', nextStep);
    footer.appendChild(next);
  }

  return footer;
}

// ── UTILS ──
function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  // Ensure people have proper default names if not named
  if (state.people.length === 0 && state.step > 1) {
    state.step = 1;
    saveState();
  }
  render();
});
