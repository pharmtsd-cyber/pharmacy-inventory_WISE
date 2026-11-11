import { fetchBackend } from './api.js'; 
import { toggleLoader, switchView, showToast } from './ui.js'; 
import { session } from './config.js';

export let dailyItems = []; 
export let currentDailyTab = '未盤'; 
export let adminCombinedList = []; 
export let sortableInstance = null; 
export let adminData = null;

// ==========================================
// ⚡ 每日盤點：零延遲背景佇列與 60 秒定時計時器
// ==========================================
const DAILY_QUEUE_KEY = 'femh_daily_pending_queue';
let dailyTimerId = null;

function getDailyQueue() {
  try { return JSON.parse(localStorage.getItem(DAILY_QUEUE_KEY)) || []; }
  catch(e) { return []; }
}

function saveDailyQueue(queue) {
  localStorage.setItem(DAILY_QUEUE_KEY, JSON.stringify(queue));
  updatePendingQueueBadge();
}

function updatePendingQueueBadge() {
  const queue = getDailyQueue();
  const badge = document.getElementById('daily-pending-count-badge');
  if (badge) {
    badge.innerText = queue.length;
    if (queue.length > 0) badge.classList.remove('d-none');
    else badge.classList.add('d-none');
  }
}

// 啟動 60 秒自動打包上傳計時器
function startDailyAutoFlushTimer() {
  if (dailyTimerId) clearInterval(dailyTimerId);
  dailyTimerId = setInterval(() => {
    flushDailyQueue(false); // 靜默發送
  }, 60000); // 60 秒
}

// 主動強行打包送出佇列中所有資料
export async function flushDailyQueue(showMask = true) {
  const queue = getDailyQueue();
  if (queue.length === 0) return;

  const dStr = document.getElementById('header-date-select') ? document.getElementById('header-date-select').value : '';
  const batchArray = queue.map(item => ({
    action: 'submitInventory',
    data: {
      mode: '每日盤點', userId: session.id, userName: session.name, type: '盤點調劑台', actionSrc: '', dispType: '',
      drugCode: item.drugCode, drugName: item.drugName, handQty: item.qty, tableId: item.tableId, locCode: item.locCode, inventoryDate: dStr, barcode: ''
    }
  }));

  if (showMask) toggleLoader(true, `📦 正在背景打包送出 ${batchArray.length} 筆資料...`, true);

  try {
    const res = await fetchBackend('syncBatchOfflineData', { batchArray: JSON.stringify(batchArray) });
    if (res && res.success) {
      saveDailyQueue([]); // 清空佇列
      if (showMask) toggleLoader(false, '', true);
      showToast(`🎉 已自動同步 ${batchArray.length} 筆資料至雲端`);
    } else {
      if (showMask) { toggleLoader(false, '', true); alert("⚠️ 佇列同步失敗：" + (res ? res.message : '')); }
    }
  } catch (err) {
    if (showMask) { toggleLoader(false, '', true); alert("網絡連線異常，已暫存至本機：" + err.message); }
  }
}

// 頁面關閉 / 刷新時攔截打包
window.addEventListener('beforeunload', (e) => {
  const queue = getDailyQueue();
  if (queue.length > 0) {
    flushDailyQueue(false);
  }
});


// ==========================================
// 🚀 初始化與視圖邏輯
// ==========================================
export function initDailyMode() { 
  currentDailyTab = '未盤'; 
  updateTabUI(); 
  switchView('view-daily-app'); 
  
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const dateSelect = document.getElementById('header-date-select');
  if (dateSelect) dateSelect.value = todayStr;

  startDailyAutoFlushTimer();
  loadDailyData(todayStr); 
}

export function changeDailyDate() {
  flushDailyQueue(true).then(() => {
    loadDailyData(document.getElementById('header-date-select').value);
  });
}

export function loadDailyData(dateStr) {
  if(dateStr && dateStr.includes('-')) dateStr = dateStr.replace(/-/g, '/');
  toggleLoader(true);
  fetchBackend('getDailyInventoryByDate', { dateStr: dateStr }).then(data => {
    toggleLoader(false); 
    dailyItems = data.items || []; 
    if (data.selectedDate) {
      document.getElementById('header-date-select').value = data.selectedDate.replace(/\//g, '-');
    }
    updateTabUI(); 
    renderDailyItems(); 
    checkAdminNewDrugs();
    updatePendingQueueBadge();
  }).catch(err => { 
    toggleLoader(false); 
    document.getElementById('daily-list-area').innerHTML = '<div class="text-center p-5 text-muted fw-bold">無資料或讀取失敗</div>'; 
  });
}

export function switchDailyTab(tabName) { 
  if (currentDailyTab === tabName) return; 
  // 切換分頁時主動衝刷上傳佇列
  flushDailyQueue(false);

  currentDailyTab = tabName; 
  const searchInput = document.getElementById('daily-search-input');
  if (searchInput) searchInput.value = '';
  updateTabUI(); 
  renderDailyItems(); 
}

export function updateTabUI() {
  const btnUn = document.getElementById('btn-tab-uncounted'); const btnCo = document.getElementById('btn-tab-counted');
  btnUn.className = currentDailyTab === '未盤' ? 'nav-link active fw-bold border bg-academic shadow-sm text-white py-2' : 'nav-link fw-bold border text-academic shadow-sm bg-white py-2';
  btnCo.className = currentDailyTab === '已盤' ? 'nav-link active fw-bold border bg-success shadow-sm text-white py-2' : 'nav-link fw-bold border text-success shadow-sm bg-white py-2';
  
  const queue = getDailyQueue();
  const queuedLocs = queue.map(q => q.locCode);

  const uncounted = dailyItems.filter(i => (!i.hasRecord || i.status === '作廢') && !queuedLocs.includes(i.locCode)).length;
  const counted = dailyItems.filter(i => i.hasRecord || queuedLocs.includes(i.locCode)).length;

  document.getElementById('count-uncounted').innerText = uncounted;
  document.getElementById('count-counted').innerText = counted;
}

// 🌟 ⚡ 單筆零延遲確認：點擊確認立即隱藏卡片並進入背景佇列
export function submitDailyItemInstant(locCode) {
  const input = document.getElementById(`qty-${locCode}`);
  if (!input) return;
  const val = input.value.trim();

  if (val === '' || Number(val) < 0) {
    return alert('請輸入有效的數量！');
  }

  const drugCode = input.getAttribute('data-code');
  const drugName = input.getAttribute('data-name');
  const tableId = input.getAttribute('data-table');

  // 1. 寫入背景佇列
  const queue = getDailyQueue();
  queue.push({ locCode, drugCode, drugName, tableId, qty: val, time: new Date().toLocaleTimeString() });
  saveDailyQueue(queue);

  // 2. 本地狀態更新
  const item = dailyItems.find(i => i.locCode === locCode);
  if (item) {
    item.hasRecord = true;
    item.countedQty = val;
    item.status = '成立';
    item.timeStr = '待同步';
  }

  // 3. 畫面 DOM 動態消失 (零延遲體感)
  const card = document.getElementById(`card-${locCode}`);
  if (card) {
    card.style.transition = 'all 0.25s ease-out';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.9)';
    setTimeout(() => {
      card.remove();
      updateTabUI();
      showToast(`✅ ${drugName.substring(0, 8)}... 已暫存 (待背景上傳)`);
    }, 250);
  }
}

export function renderDailyItems() {
  const area = document.getElementById('daily-list-area');
  if (!area) return;
  if (dailyItems.length === 0) {
    area.innerHTML = '<div class="text-center p-5 text-muted fw-bold">本區本日無待盤點項目</div>';
    return;
  }

  const queue = getDailyQueue();
  const queuedLocs = queue.map(q => q.locCode);

  let filtered = dailyItems;
  if (currentDailyTab === '未盤') {
    filtered = dailyItems.filter(i => (!i.hasRecord || i.status === '作廢') && !queuedLocs.includes(i.locCode));
  } else {
    filtered = dailyItems.filter(i => (i.hasRecord && i.status === '成立') || queuedLocs.includes(i.locCode));
  }

  const kwInput = document.getElementById('daily-search-input');
  const kw = kwInput ? kwInput.value.toLowerCase().trim() : '';
  if (kw) {
    filtered = filtered.filter(i => (i.drugCode||'').toLowerCase().includes(kw) || (i.drugName||'').toLowerCase().includes(kw) || (i.locCode||'').toLowerCase().includes(kw));
  }

  if (filtered.length === 0) {
    area.innerHTML = `<div class="text-center p-5 text-muted fw-bold">${kw ? '查無符合條件的藥品' : '此區項目已全部完成！'}</div>`;
    return;
  }

  let html = '';
  
  if (currentDailyTab === '未盤') {
    html += `
      <div class="d-flex justify-content-between align-items-center mb-2 px-1">
        <span class="text-muted small"><i class="bi bi-clock-history"></i> 自動背景上傳：每 60 秒</span>
        <button class="btn btn-sm btn-outline-academic fw-bold" onclick="flushDailyQueue(true)">
          <i class="bi bi-cloud-arrow-up-fill me-1"></i>立即打包上傳 (<span id="daily-pending-count-badge" class="badge bg-danger">0</span>)
        </button>
      </div>`;

    filtered.forEach((item, index) => {
      const encodedName = btoa(encodeURIComponent(item.drugName || '')); 
      const borderColor = index % 2 === 0 ? 'var(--academic-primary)' : '#adb5bd';

      let hintHtml = '';
      if (item.infoNotice && item.infoNotice !== '') hintHtml += `<div class="text-danger small fw-bold mb-1"><i class="bi bi-exclamation-triangle-fill me-1"></i>盤點注意：${item.infoNotice}</div>`;
      if (item.infoMemo && item.infoMemo !== '') hintHtml += `<div class="text-secondary small mb-1" style="font-size: 0.8rem;"><i class="bi bi-info-square-fill me-1"></i>藥品備註：${item.infoMemo}</div>`;

      const lastRecordHtml = item.lastQty !== '無'
        ? `<div class="bg-light border rounded p-2 mb-2 d-flex justify-content-between align-items-center shadow-sm">
             <span class="text-secondary small fw-bold"><i class="bi bi-clock-history"></i> 前次紀錄 (${item.lastTime}):</span>
             <span class="text-academic fw-bold" style="font-size: 1.8rem; line-height: 1;">${item.lastQty}</span>
           </div>` : `<div class="bg-light border rounded p-2 mb-2 text-center text-muted small shadow-sm">尚無歷史盤點紀錄</div>`;

      html += `
        <div class="card drug-card mb-3 shadow-sm border-0" style="border-left: 6px solid ${borderColor} !important;" id="card-${item.locCode}">
          <div class="card-body p-3">
            <div class="fw-bold fs-5 text-dark mb-1">${item.drugName}</div>
            <div class="d-flex flex-wrap gap-1 mb-2">
              <span class="badge bg-academic shadow-sm">${item.tableName}</span>
              <span class="badge bg-white text-dark border border-secondary shadow-sm">儲位: ${item.locCode}</span>
            </div>
            ${hintHtml ? `<div class="bg-light rounded p-2 mb-2 border border-danger border-opacity-25">${hintHtml}</div>` : ''}
            ${lastRecordHtml}
            
            <div class="input-group shadow-sm mt-2">
              <input type="number" id="qty-${item.locCode}" class="form-control form-control-lg bg-white fw-bold text-center border-secondary" data-loc="${item.locCode}" data-code="${item.drugCode}" data-name="${item.drugName}" data-table="${item.tableId}" placeholder="數量" inputmode="numeric" pattern="[0-9]*" onkeydown="if(event.key==='Enter') submitDailyItemInstant('${item.locCode}')">
              <button class="btn btn-outline-secondary px-3 fw-bold bg-light border-secondary" type="button" onclick="openCalculator('qty-${item.locCode}', decodeURIComponent(atob('${encodedName}')))"><i class="bi bi-calculator fs-5"></i></button>
              <button class="btn btn-academic fw-bold px-3" type="button" onclick="submitDailyItemInstant('${item.locCode}')"><i class="bi bi-check-lg fs-4"></i></button>
            </div>
          </div>
        </div>`;
    });
  } else {
    // 已盤點區域 (包含本機尚未上傳之佇列)
    filtered.forEach((item, index) => {
      const isQueued = queuedLocs.includes(item.locCode);
      const qData = queue.find(q => q.locCode === item.locCode);
      const displayQty = isQueued ? qData.qty : item.countedQty;
      const borderColor = index % 2 === 0 ? 'var(--academic-primary)' : '#adb5bd';
      const statusBadge = isQueued ? '<span class="badge bg-warning text-dark"><i class="bi bi-cloud-upload"></i> 待自動上傳</span>' : '<span class="badge bg-success">已同步雲端</span>';

      html += `
        <div class="card drug-card mb-2 shadow-sm border-0" style="border-left: 6px solid ${borderColor} !important;">
          <div class="card-body p-2">
            <div class="d-flex justify-content-between mb-1">
              <div class="fw-bold text-dark text-truncate" style="max-width: 70%;">${item.drugName}</div>
              <div class="small text-muted text-end" style="font-size:0.75rem;">${isQueued ? qData.time : item.timeStr}</div>
            </div>
            <div class="small text-secondary mb-2">
              ${statusBadge}<span class="ms-1">儲位: ${item.locCode}</span>
            </div>
            <div class="d-flex justify-content-between align-items-center mt-1 pt-1 border-top">
              <div class="fs-4 fw-bold text-success">${displayQty}</div>
              <div>
                ${!isQueued ? `
                  <button class="btn btn-sm btn-outline-primary py-0 me-1" onclick="editDailyQty('${item.locCode}', '${item.countedQty}')">修改</button>
                  <button class="btn btn-sm btn-outline-danger py-0" onclick="toggleDailyStatus('${item.locCode}', '作廢')">作廢</button>
                ` : '<span class="text-muted small">暫存中</span>'}
              </div>
            </div>
          </div>
        </div>`;
    });
  }
  area.innerHTML = html;
  updatePendingQueueBadge();
}

// 雲端歷史筆數修改/作廢...
export async function editDailyQty(locCode, currentQty) {
  const item = dailyItems.find(i => i.locCode === locCode);
  if (!item || !item.sn) return alert('此筆紀錄尚未取得雲端識別碼，請稍候再試。');
  const newQty = await new Promise(resolve => {
    window.resolveEditQtyModal = resolve;
    document.getElementById('edit-qty-drug-name').innerText = item.drugName;
    document.getElementById('edit-qty-old').innerText = currentQty;
    const input = document.getElementById('edit-qty-input'); input.value = currentQty;
    new window.bootstrap.Modal(document.getElementById('editQtyModal')).show();
    document.getElementById('editQtyModal').addEventListener('shown.bs.modal', () => { input.focus(); input.select(); }, { once: true });
  });
  if (newQty === null || newQty === "") return; 
  
  const oldQty = item.countedQty; item.countedQty = newQty; renderDailyItems();
  fetchBackend('modifyDailyRecord', { sn: item.sn, newQty: newQty, newStatus: '成立', userId: session.id, userName: session.name })
    .then(res => { if (res.success) { showToast('修改成功'); } else { item.countedQty = oldQty; renderDailyItems(); showToast('修改失敗', 'delete'); } })
    .catch(err => { item.countedQty = oldQty; renderDailyItems(); showToast('更新失敗', 'delete'); });
}

export async function toggleDailyStatus(locCode, newStatus) {
  const item = dailyItems.find(i => i.locCode === locCode);
  if (!item || !item.sn) return alert('此筆紀錄尚未取得雲端識別碼，請稍候再試。');
  if (newStatus === '作廢') {
    const isConfirmed = await new Promise(resolve => {
      window.resolveVoidModal = resolve;
      document.getElementById('void-drug-name').innerText = item.drugName;
      document.getElementById('void-drug-info').innerText = item.countedQty;
      new window.bootstrap.Modal(document.getElementById('voidConfirmModal')).show();
    });
    if (!isConfirmed) return; 
  }
  const oldStatus = item.status; item.status = newStatus; updateTabUI(); renderDailyItems();
  fetchBackend('modifyDailyRecord', { sn: item.sn, newQty: '', newStatus: newStatus, userId: session.id, userName: session.name })
    .then(res => { if (res.success) { showToast(newStatus === '作廢' ? '紀錄已作廢' : '紀錄已還原', newStatus === '作廢' ? 'delete' : 'success'); } else { item.status = oldStatus; updateTabUI(); renderDailyItems(); } })
    .catch(err => { item.status = oldStatus; updateTabUI(); renderDailyItems(); });
}

// 管理排序功能區...
export function openAdminSort() { 
  toggleLoader(true); 
  fetchBackend('getAdminData').then(data => { 
    toggleLoader(false); 
    if (data && data.success === false) { alert('⚠️ 後端資料異常: ' + data.message); return; }
    adminData = data; 
    adminCombinedList = (data.selectable || []).map(item => { 
      const savedItem = (data.saved || []).find(s => s.locCode === item.locCode);
      return { ...item, order: savedItem ? savedItem.order : '' }; 
    }); 
    try { renderSortableList(); switchView('view-admin-sort'); } catch(e) { alert('畫面渲染失敗：' + e.message); }
  }).catch(err => { toggleLoader(false); alert('🚫 系統連線失敗：' + err.message); }); 
}

export function renderSortableList() {
  const container = document.getElementById('admin-sortable-list');
  if (!container) return; 
  adminCombinedList.sort((a, b) => { 
    const aV = a.order !== 0, bV = b.order !== 0; 
    if (aV && !bV) return -1; if (!aV && bV) return 1; 
    if (aV && bV) { if (a.order !== '' && b.order !== '') return a.order - b.order; if (a.order !== '' && b.order === '') return -1; if (a.order === '' && b.order !== '') return 1; } 
    return a.locCode.localeCompare(b.locCode); 
  });
  let html = '';
  adminCombinedList.forEach(item => {
    const isHidden = item.order === 0; const isNew = item.order === ''; 
    const cardStyle = isHidden ? 'opacity: 0.6; border-left: 5px solid #dc3545;' : (isNew ? 'border-left: 5px solid #ffc107; background-color: #fffbeb;' : 'border-left: 5px solid var(--academic-primary);'); 
    const eyeIcon = isHidden ? 'bi-eye-slash-fill text-danger' : 'bi-eye-fill text-success';
    const newBadge = isNew ? '<span class="badge bg-warning text-dark ms-2 shadow-sm">🆕 新進藥品</span>' : '';
    html += `<div class="card border-0 shadow-sm mb-2 sortable-item" style="${cardStyle}" data-loc="${item.locCode}" data-table="${item.tableId}" data-drug="${item.drugCode}" data-name="${item.drugName}" data-hidden="${isHidden}">
      <div class="card-body p-2 d-flex align-items-center">
        <div class="drag-handle"><i class="bi bi-grip-vertical"></i></div>
        <div class="flex-grow-1 px-2 text-truncate"><div class="fw-bold text-dark search-target">${item.drugName} ${newBadge}</div><div class="small text-muted"><span class="badge bg-academic me-1">${item.tableName}</span>${item.locCode}</div></div>
        <div><button class="btn btn-light border p-2" onclick="toggleVisibility(this, '${item.locCode}')"><i id="eye-${item.locCode}" class="${eyeIcon} fs-5"></i></button></div>
      </div>
    </div>`;
  });
  container.innerHTML = html; 
  if(sortableInstance) sortableInstance.destroy(); 
  sortableInstance = new window.Sortable(container, { handle: '.drag-handle', animation: 150, ghostClass: 'sortable-ghost' });
}

export function toggleVisibility(btn, locCode) { 
  const card = btn.closest('.sortable-item'); const icon = document.getElementById(`eye-${locCode}`); 
  if (card.getAttribute('data-hidden') === 'true') { 
    card.setAttribute('data-hidden', 'false'); card.style.opacity = '1'; card.style.borderLeftColor = 'var(--academic-primary)'; icon.className = 'bi bi-eye-fill text-success fs-5'; 
  } else { 
    card.setAttribute('data-hidden', 'true'); card.style.opacity = '0.6'; card.style.borderLeftColor = '#dc3545'; icon.className = 'bi bi-eye-slash-fill text-danger fs-5'; 
  } 
}
export function highlightSearchItem() { const kw = document.getElementById('admin-search-input').value.toLowerCase(); let firstMatch = null; document.querySelectorAll('.sortable-item').forEach(card => { if (kw && (card.querySelector('.search-target').innerText.toLowerCase().includes(kw) || card.getAttribute('data-loc').toLowerCase().includes(kw))) { card.classList.add('bg-warning', 'bg-opacity-25'); if(!firstMatch) firstMatch = card; } else card.classList.remove('bg-warning', 'bg-opacity-25'); }); if (firstMatch) firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
export function rebuildAdminList() { if(confirm('確定要重建清單嗎？')) { adminCombinedList = adminData.selectable.map(i => ({ ...i, order: '' })); renderSortableList(); } }

export function saveAdminDataToServer() { 
  const payload = []; let currentOrder = 1; 
  document.querySelectorAll('.sortable-item').forEach(el => { payload.push({ tableId: el.getAttribute('data-table'), locCode: el.getAttribute('data-loc'), drugCode: el.getAttribute('data-drug'), drugName: el.getAttribute('data-name'), order: el.getAttribute('data-hidden') === 'true' ? 0 : currentOrder++ }); }); 
  toggleLoader(true); 
  fetchBackend('saveAdminSortData', { payloadArray: JSON.stringify(payload) }).then(res => { 
    toggleLoader(false); 
    if (res && res.success) { showToast('🎉 管理排序已成功儲存！'); if (typeof changeDailyDate === 'function') changeDailyDate(); } else { alert('❌ 儲存失敗：' + (res.message || '異常')); }
  }).catch(err => { toggleLoader(false); alert('⚠️ 儲存發生異常：' + err.message); });
}

window.resolveEditQtyModal = window.resolveEditQtyModal || null;
window.resolveVoidModal = window.resolveVoidModal || null;
window.confirmEditQty = () => { const val = document.getElementById('edit-qty-input').value; if (val === '') return alert('請輸入數量'); window.bootstrap.Modal.getInstance(document.getElementById('editQtyModal')).hide(); if(window.resolveEditQtyModal) window.resolveEditQtyModal(val); };
window.cancelEditQty = () => { window.bootstrap.Modal.getInstance(document.getElementById('editQtyModal')).hide(); if(window.resolveEditQtyModal) window.resolveEditQtyModal(null); };
window.confirmVoid = () => { window.bootstrap.Modal.getInstance(document.getElementById('voidConfirmModal')).hide(); if(window.resolveVoidModal) window.resolveVoidModal(true); };
window.cancelVoid = () => { window.bootstrap.Modal.getInstance(document.getElementById('voidConfirmModal')).hide(); if(window.resolveVoidModal) window.resolveVoidModal(false); };

export function checkAdminNewDrugs() {
  fetchBackend('getAdminData').then(data => {
    if (data && data.success !== false) {
      const hasNew = (data.selectable || []).some(item => { return !(data.saved || []).find(s => s.locCode === item.locCode); });
      const badge = document.getElementById('admin-new-badge');
      if (badge) { if (hasNew) badge.classList.remove('d-none'); else badge.classList.add('d-none'); }
    }
  }).catch(err => { console.warn('背景檢查失敗:', err); });
}
