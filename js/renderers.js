/* ─────────────────────────────────────────
   SplitTab — Step Renderers
   Handles rendering for each step of the app
───────────────────────────────────────── */

import { state, saveState } from './state.js';
import { getAssignmentProgress, isFullyAssigned, fmt } from './calculations.js';
import { escHtml } from './utils.js';
import { 
  buildNav, 
  buildItemCard, 
  buildChargesSection, 
  buildNameList, 
  buildPersonReceipt, 
  buildPayerSection,
  adjustPeople,
  setAssignment
} from './components.js';
import { updateStep3NavLabel, updatePersonPills, goTo } from './navigation.js';

// ── MAIN RENDER FUNCTION ──
function render() {
  renderDots();
  const main = document.getElementById('main');
  main.innerHTML = '';

  if (state.step === 1) renderStep1(main);
  else if (state.step === 2) renderStep2(main);
  else if (state.step === 3) renderStep3(main);
  else if (state.step === 4) renderStep4(main);
}

// ── STEP INDICATOR ──
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
          import('./utils.js').then(utils => utils.showError('Assign all items before viewing summary.'));
          return;
        }
        goTo(i);
      }
    });
    el.appendChild(d);
  }
}

// ── STEP 1: ITEMS ──
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
    import('./components.js').then(comp => comp.addItem());
  });

  wrap.appendChild(itemsWrap);
  wrap.appendChild(addBtn);

  // Charges toggle
  const chargesSection = buildChargesSection();
  wrap.appendChild(chargesSection);

  // Bill preview
  if (state.items.length > 0) {
    import('./components.js').then(comp => {
      const preview = comp.buildBillPreview();
      wrap.appendChild(preview);
    });
  }

  container.appendChild(wrap);

  // Nav
  container.appendChild(buildNav(false, true, 'Next: People →'));
}

// ── STEP 2: PEOPLE ──
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
    buildNameList();
  });
  wrap.appendChild(nameToggle);

  // Name list
  const nameListWrap = document.createElement('div');
  nameListWrap.id = 'nameListWrap';
  wrap.appendChild(nameListWrap);

  container.appendChild(wrap);
  container.appendChild(buildNav(true, true, 'Next: Assign →'));

  buildNameList();

  // Button events
  document.getElementById('decPeople').addEventListener('click', () => adjustPeople(-1));
  document.getElementById('incPeople').addEventListener('click', () => adjustPeople(1));
}

// ── STEP 3: ASSIGNMENTS ──
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

function renderAssignPanel() {
  const panel = document.getElementById('assignPanel');
  if (!panel) return;
  panel.innerHTML = '';

  const person = state.people[state.currentAssignPerson];
  if (!person) return;

  // Import needed functions
  Promise.all([
    import('./calculations.js'),
    import('./components.js')
  ]).then(([{ getRemainingQty, getAssignedQtyForPerson, getPersonSubtotal, getPersonTotal }, { buildPersonReceipt }]) => {
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
  });
}

function updateProgress() {
  const prog = getAssignmentProgress();
  const fill = document.getElementById('progFill');
  const pct = document.getElementById('progPct');
  if (fill) fill.style.width = prog + '%';
  if (pct) pct.textContent = prog + '%';
}

// ── STEP 4: SUMMARY ──
function renderStep4(container) {
  const wrap = document.createElement('div');
  wrap.className = 'fade-in';
  wrap.innerHTML = `
    <div class="step-eyebrow">Step 4 of 4</div>
    <div class="step-title">The split.</div>
  `;

  // Import needed functions
  Promise.all([
    import('./calculations.js'),
    import('./components.js')
  ]).then(([{ getRemainingQty, getBillTotal, getPersonTotal }, { buildPersonReceipt, buildPayerSection }]) => {
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
  });
}

// ── SUMMARY ACTIONS ──
function copySummary() {
  import('./calculations.js').then(({ getPersonTotal, fmt }) => {
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
  });
}

function downloadSummary() {
  import('./summary.js').then(summary => summary.downloadSummary());
}

function resetApp() {
  if (!confirm('Start a fresh split? All current data will be cleared.')) return;
  import('./state.js').then(({ resetState }) => {
    resetState();
    render();
    window.scrollTo({ top: 0 });
  });
}

// ── EXPORTS ──
export { render, renderAssignPanel };
