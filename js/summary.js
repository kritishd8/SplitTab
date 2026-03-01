/* ─────────────────────────────────────────
   SplitTab — Summary Actions
   Handles receipt generation and download
───────────────────────────────────────── */

import { state } from './state.js';
import { 
  fmt, 
  getBillTotal, 
  getPersonSubtotal, 
  getPersonTotal 
} from './calculations.js';
import { escHtml } from './utils.js';

// ── DOWNLOAD SUMMARY ──
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
    import('./utils.js').then(utils => utils.showError('Failed to generate receipt. Please try again.'));
  });
}

// ── CREATE PRINTABLE RECEIPT ──
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

// ── EXPORTS ──
export { downloadSummary, createPrintableReceipt };
