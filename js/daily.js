import { fetchBackend } from './api.js'; 
import { toggleLoader, switchView, showToast } from './ui.js'; 
import { session } from './config.js';

export let dailyItems = []; 
export let currentDailyTab = '未盤'; 
export let adminCombinedList = []; 
export let sortableInstance = null; 
export let adminData = null;

export function initDailyMode() { 
  currentDailyTab = '未盤'; 
  updateTabUI(); 
  switchView('view-daily-app'); 
  
  // 🌟 修正點：在進入畫面的瞬間，直接取得當下日期並填入選擇器
  const today = new Date();
  // 確保格式為標準的 YYYY-MM-DD (HTML date input 規定月份與日期必須強制補零)
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const dateSelect = document.getElementById('header-date-select');
  if (dateSelect) {
    dateSelect.value = todayStr;
  }

  // 直接帶著今天的日期字串去跟後端要資料
  loadDailyData(todayStr); 
}
export function changeDailyDate() { loadDailyData(document.getElementById('header-date-select').value); }

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
  }).catch(err => { 
    toggleLoader(false); 
    document.getElementById('daily-list-area').innerHTML = '<div class="text-center p-5 text-muted fw-bold">無資料或讀取失敗</div>'; 
  });
}

export function switchDailyTab(tabName) { 
  if (currentDailyTab === tabName) return; 
  currentDailyTab = tabName; 
  
  // 🌟 新增：切換分頁時，自動清空搜尋框的字
  const searchInput = document.getElementById('daily-search-input');
  if (searchInput) searchInput.value = '';
  
  updateTabUI(); 
  renderDailyItems(); 
}

export function updateTabUI() {
  const btnUn = document.getElementById('btn-tab-uncounted'); const btnCo = document.getElementById('btn-tab-counted');
  btnUn.className = currentDailyTab === '未盤' ? 'nav-link active fw-bold border bg-academic shadow-sm text-white py-2' : 'nav-link fw-bold border text-academic shadow-sm bg-white py-2';
  btnCo.className = currentDailyTab === '已盤' ? 'nav-link active fw-bold border bg-success shadow-sm text-white py-2' : 'nav-link fw-bold border text-success shadow-sm bg-white py-2';
  
  document.getElementById('count-uncounted').innerText = dailyItems.filter(i => !i.hasRecord || i.status === '作廢').length;
  document.getElementById('count-counted').innerText = dailyItems.filter(i => i.hasRecord).length;
}

// 🌟 渲染每日盤點清單 (實作顏色交錯設計)
export function renderDailyItems() {
  const area = document.getElementById('daily-list-area');
  if (!area) return;
  if (dailyItems.length === 0) {
    area.innerHTML = '<div class="text-center p-5 text-muted fw-bold">本區本日無待盤點項目</div>';
    return;
  }

  let filtered = dailyItems;
  if (currentDailyTab === '未盤') filtered = dailyItems.filter(i => !i.hasRecord || i.status === '作廢');
  else filtered = dailyItems.filter(i => i.hasRecord && i.status === '成立');

  const kwInput = document.getElementById('daily-search-input');
  const kw = kwInput ? kwInput.value.toLowerCase().trim() : '';
  if (kw) {
    filtered = filtered.filter(i => (i.drugCode||'').toLowerCase().includes(kw) || (i.drugName||'').toLowerCase().includes(kw) || (i.locCode||'').toLowerCase().includes(kw));
  }

  // 更新頁籤上的數字 Badge
  const uCount = dailyItems.filter(i => !i.hasRecord || i.status === '作廢').length;
  const cCount = dailyItems.filter(i => i.hasRecord && i.status === '成立').length;
  const badgeU = document.getElementById('count-daily-uncounted'); if(badgeU) badgeU.innerText = uCount;
  const badgeC = document.getElementById('count-daily-counted'); if(badgeC) badgeC.innerText = cCount;

  if (filtered.length === 0) {
    area.innerHTML = `<div class="text-center p-5 text-muted fw-bold">${kw ? '查無符合條件的藥品' : '此區皆已盤點完成'}</div>`;
    return;
  }

  let html = '';
  // 🌟 關鍵修改：傳入 index 以便計算交錯顏色
  filtered.forEach((item, index) => {
    const safeName = item.drugName.replace(/'/g, "\\'"); 
    
    // 🌟 顏色分流邏輯：偶數用藥局綠 (Default)，奇數用灰色 (Gray)
    const borderColor = index % 2 === 0 ? 'var(--academic-primary)' : '#adb5bd';

    if (currentDailyTab === '未盤') {
      const lastRecordHtml = item.lastQty !== '無'
        ? `<div class="bg-light border rounded p-2 mb-2 d-flex justify-content-between align-items-center shadow-sm">
             <span class="text-secondary small fw-bold"><i class="bi bi-clock-history"></i> 前次紀錄 (${item.lastTime}):</span>
             <span class="text-academic fw-bold" style="font-size: 1.8rem; line-height: 1;">${item.lastQty}</span>
           </div>`
        : `<div class="bg-light border rounded p-2 mb-2 text-center text-muted small shadow-sm">尚無歷史盤點紀錄</div>`;

      html += `
        <div class="card drug-card mb-3 shadow-sm border-0" style="border-left: 6px solid ${borderColor} !important;" id="card-${item.locCode}">
          <div class="card-body p-3">
            <div class="fw-bold fs-5 text-dark mb-1">${item.drugName}</div>
            
            <div class="d-flex flex-wrap gap-1 mb-2">
              <span class="badge bg-academic shadow-sm">${item.tableName}</span>
              <span class="badge bg-white text-dark border border-secondary shadow-sm">儲位: ${item.locCode}</span>
            </div>
            
            ${lastRecordHtml}
            
            <div class="input-group shadow-sm mt-2">
              <input type="number" id="qty-${item.locCode}" class="form-control form-control-lg bg-white fw-bold text-center border-secondary" placeholder="本次數量" inputmode="numeric" pattern="[0-9]*">
              <button class="btn btn-outline-secondary px-3 fw-bold bg-light border-secondary" type="button" onclick="openCalculator('qty-${item.locCode}', '${safeName}')"><i class="bi bi-calculator fs-5"></i></button>
              
              <button class="btn btn-academic px-4 fw-bold fs-5" onclick="submitDailyOne('${item.locCode}', '${item.drugCode}', '${safeName}', '${item.tableId}')">確認送出</button>
            </div>
          </div>
        </div>`;
        
    } else {
       // 已盤點清單同樣套用交錯色，維持視覺統一
      html += `
        <div class="card drug-card mb-2 shadow-sm border-0" style="border-left: 6px solid ${borderColor} !important;">
          <div class="card-body p-2">
            <div class="d-flex justify-content-between mb-1">
              <div class="fw-bold text-dark text-truncate" style="max-width: 70%;">${item.drugName}</div>
              <div class="small text-muted" style="font-size:0.75rem;">${item.timeStr}</div>
            </div>
            <div class="small text-secondary mb-2">
              <span class="badge bg-success">已盤點</span>
              <span class="ms-1">儲位: ${item.locCode}</span>
            </div>
            <div class="d-flex justify-content-between align-items-center mt-1 pt-1 border-top">
              <div class="fs-4 fw-bold text-success">${item.countedQty}</div>
              <div>
                <button class="btn btn-sm btn-outline-primary py-0 me-1" onclick="editDailyQty('${item.locCode}', '${item.countedQty}')">修改</button>
                <button class="btn btn-sm btn-outline-danger py-0" onclick="toggleDailyStatus('${item.locCode}', '作廢')">作廢</button>
              </div>
            </div>
          </div>
        </div>`;
    }
  });
  area.innerHTML = html;
}

export function submitDailyOne(loc, dCode, dName, tId) {
  const qty = document.getElementById(`qty-${loc}`).value; if (qty === '' || qty < 0) return alert('請輸入有效數量');
  const dStr = document.getElementById('header-date-select').value;
  const item = dailyItems.find(i => i.locCode === loc);
  if (!item) return;

  const now = new Date();
  item.hasRecord = true; 
  item.status = '成立'; 
  item.countedQty = qty;
  item.tStamp = now.getTime();
  item.timeStr = `${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  updateTabUI(); 
  renderDailyItems(); 
  if (navigator.vibrate) navigator.vibrate(50); 
  
  // 刪除了原本寫在這裡的 showToast('盤點成功')

  fetchBackend('submitInventory', { mode: '每日盤點', userId: session.id, userName: session.name, type: '盤點調劑台', drugCode: dCode, drugName: dName, handQty: qty, tableId: tId, locCode: loc, inventoryDate: dStr })
    .catch(err => { showToast('網路連線錯誤，請重新盤點', 'delete'); loadDailyData(dStr); });
}

// ==========================================
// 🌟 升級版每日盤點修改數量
// ==========================================
export async function editDailyQty(locCode, currentQty) {
  const item = dailyItems.find(i => i.locCode === locCode);
  if (!item) return;

  // 呼叫自訂彈窗並等待藥師輸入 (取代原本的 prompt)
  const newQty = await new Promise(resolve => {
    window.resolveEditQtyModal = resolve;
    document.getElementById('edit-qty-drug-name').innerText = item.drugName;
    document.getElementById('edit-qty-old').innerText = currentQty;
    const input = document.getElementById('edit-qty-input');
    input.value = currentQty;
    new window.bootstrap.Modal(document.getElementById('editQtyModal')).show();
    
    // 彈窗開啟後自動選取數字，方便直接覆蓋輸入
    document.getElementById('editQtyModal').addEventListener('shown.bs.modal', () => { 
      input.focus(); input.select(); 
    }, { once: true });
  });

  if (newQty === null || newQty === "") return; // 藥師按了取消
  
  const dateStr = document.getElementById('header-date-select').value;
  const oldQty = item.countedQty;
  item.countedQty = newQty; 
  renderDailyItems();

  fetchBackend('modifyDailyRecord', { dateStr, locCode, newQty: newQty, newStatus: null, userId: session.id, userName: session.name })
    .then(res => {
      if (res.success) { showToast('修改成功'); } 
      else { item.countedQty = oldQty; renderDailyItems(); showToast('修改失敗: ' + res.message, 'delete'); }
    }).catch(err => { item.countedQty = oldQty; renderDailyItems(); showToast('網路異常，更新失敗', 'delete'); });
}

// ==========================================
// 🌟 升級版每日盤點作廢功能
// ==========================================
export async function toggleDailyStatus(locCode, newStatus) {
  const item = dailyItems.find(i => i.locCode === locCode);
  if (!item) return;

  if (newStatus === '作廢') {
    // 呼叫防呆作廢彈窗並等待確認 (取代原本的 confirm)
    const isConfirmed = await new Promise(resolve => {
      window.resolveVoidModal = resolve;
      document.getElementById('void-drug-name').innerText = item.drugName;
      document.getElementById('void-drug-info').innerText = item.countedQty;
      new window.bootstrap.Modal(document.getElementById('voidConfirmModal')).show();
    });
    if (!isConfirmed) return; // 藥師按了取消
  }

  const dateStr = document.getElementById('header-date-select').value;
  const oldStatus = item.status;
  item.status = newStatus;
  updateTabUI(); renderDailyItems();

  fetchBackend('modifyDailyRecord', { dateStr, locCode, newQty: null, newStatus: newStatus, userId: session.id, userName: session.name })
    .then(res => {
      if (res.success) { showToast(newStatus === '作廢' ? '紀錄已作廢' : '紀錄已還原', newStatus === '作廢' ? 'delete' : 'success'); } 
      else { item.status = oldStatus; updateTabUI(); renderDailyItems(); showToast('更新失敗: ' + res.message, 'delete'); }
    }).catch(err => { item.status = oldStatus; updateTabUI(); renderDailyItems(); showToast('網路異常，更新失敗', 'delete'); });
}

// ==========================================
// ✨ 管理排序功能區
// ==========================================

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
    
    try {
      renderSortableList(); 
      switchView('view-admin-sort'); 
    } catch(e) {
      alert('畫面渲染失敗：' + e.message);
    }
  }).catch(err => { 
    toggleLoader(false); 
    alert('🚫 系統連線失敗：' + err.message); 
  }); 
}

export function renderSortableList() {
  const container = document.getElementById('admin-sortable-list');
  if (!container) return; 

  // 排序邏輯：有排序的在上面，被隱藏的在中間，新進藥品 (order === '') 排在最下面
  adminCombinedList.sort((a, b) => { 
    const aV = a.order !== 0, bV = b.order !== 0; 
    if (aV && !bV) return -1; 
    if (!aV && bV) return 1; 
    if (aV && bV) { 
      if (a.order !== '' && b.order !== '') return a.order - b.order; 
      if (a.order !== '' && b.order === '') return -1; // 舊藥品優先
      if (a.order === '' && b.order !== '') return 1;  // 新藥品沉底
    } 
    return a.locCode.localeCompare(b.locCode); 
  });
  
  let html = '';
  adminCombinedList.forEach(item => {
    const isHidden = item.order === 0; 
    const isNew = item.order === ''; // 🌟 判斷是否為新進入 SAP 的藥品
    
    // 🌟 如果是新藥品，給它一個顯眼的黃色背景，如果被隱藏則是紅色
    const cardStyle = isHidden ? 'opacity: 0.6; border-left: 5px solid #dc3545;' : 
                     (isNew ? 'border-left: 5px solid #ffc107; background-color: #fffbeb;' : 'border-left: 5px solid var(--academic-primary);'); 
    
    const eyeIcon = isHidden ? 'bi-eye-slash-fill text-danger' : 'bi-eye-fill text-success';
    
    // 🌟 新藥品的超亮眼標籤
    const newBadge = isNew ? '<span class="badge bg-warning text-dark ms-2 shadow-sm">🆕 新進藥品</span>' : '';
    
    html += `<div class="card border-0 shadow-sm mb-2 sortable-item" style="${cardStyle}" data-loc="${item.locCode}" data-table="${item.tableId}" data-drug="${item.drugCode}" data-name="${item.drugName}" data-hidden="${isHidden}">
      <div class="card-body p-2 d-flex align-items-center">
        <div class="drag-handle"><i class="bi bi-grip-vertical"></i></div>
        <div class="flex-grow-1 px-2 text-truncate">
          <div class="fw-bold text-dark search-target">${item.drugName} ${newBadge}</div>
          <div class="small text-muted"><span class="badge bg-academic me-1">${item.tableName}</span>${item.locCode}</div>
        </div>
        <div>
          <button class="btn btn-light border p-2" onclick="toggleVisibility(this, '${item.locCode}')"><i id="eye-${item.locCode}" class="${eyeIcon} fs-5"></i></button>
        </div>
      </div>
    </div>`;
  });
  
  container.innerHTML = html; 
  if(sortableInstance) sortableInstance.destroy(); 
  sortableInstance = new window.Sortable(container, { handle: '.drag-handle', animation: 150, ghostClass: 'sortable-ghost' });
}

export function toggleVisibility(btn, locCode) { 
  const card = btn.closest('.sortable-item'); 
  const icon = document.getElementById(`eye-${locCode}`); 
  if (card.getAttribute('data-hidden') === 'true') { 
    card.setAttribute('data-hidden', 'false'); 
    card.style.opacity = '1'; 
    card.style.borderLeftColor = 'var(--academic-primary)'; 
    icon.className = 'bi bi-eye-fill text-success fs-5'; 
  } else { 
    card.setAttribute('data-hidden', 'true'); 
    card.style.opacity = '0.6'; 
    card.style.borderLeftColor = '#dc3545'; 
    icon.className = 'bi bi-eye-slash-fill text-danger fs-5'; 
  } 
}

export function highlightSearchItem() { const kw = document.getElementById('admin-search-input').value.toLowerCase(); let firstMatch = null; document.querySelectorAll('.sortable-item').forEach(card => { if (kw && (card.querySelector('.search-target').innerText.toLowerCase().includes(kw) || card.getAttribute('data-loc').toLowerCase().includes(kw))) { card.classList.add('bg-warning', 'bg-opacity-25'); if(!firstMatch) firstMatch = card; } else card.classList.remove('bg-warning', 'bg-opacity-25'); }); if (firstMatch) firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' }); }

export function rebuildAdminList() { if(confirm('確定要重建清單嗎？')) { adminCombinedList = adminData.selectable.map(i => ({ ...i, order: '' })); renderSortableList(); } }

export function saveAdminDataToServer() { 
  const payload = []; 
  let currentOrder = 1; 
  
  // 1. 確實抓取畫面上拖拉排序與隱藏後的最新狀態
  document.querySelectorAll('.sortable-item').forEach(el => { 
    payload.push({ 
      tableId: el.getAttribute('data-table'), 
      locCode: el.getAttribute('data-loc'), 
      drugCode: el.getAttribute('data-drug'), 
      drugName: el.getAttribute('data-name'), 
      order: el.getAttribute('data-hidden') === 'true' ? 0 : currentOrder++ 
    }); 
  }); 
  
  toggleLoader(true); 
  
  // 🌟 核心修正：使用 JSON.stringify(payload) 將複雜陣列打碎成標準字串傳送，徹底解決 [object Object] 的通訊 Bug！
  fetchBackend('saveAdminSortData', { payloadArray: JSON.stringify(payload) }).then(res => { 
    toggleLoader(false); 
    
    if (res && res.success) {
      showToast('🎉 管理排序順序已成功儲存至資料庫！'); 
      // 儲存成功後，順便重新載入當日資料，讓主畫面同步最新排序
      if (typeof changeDailyDate === 'function') {
        changeDailyDate();
      }
    } else {
      alert('❌ 儲存失敗：' + (res.message || '後端資料庫寫入異常'));
    }
  }).catch(err => {
    toggleLoader(false);
    console.error('排序儲存錯誤:', err);
    alert('⚠️ 儲存時連線發生異常：' + err.message);
  });
}

// ==========================================
// 🌟 彈窗全域控制方法 (給 index.html 的按鈕呼叫)
// ==========================================
window.resolveEditQtyModal = window.resolveEditQtyModal || null;
window.resolveVoidModal = window.resolveVoidModal || null;

window.confirmEditQty = () => {
  const val = document.getElementById('edit-qty-input').value;
  if (val === '') return alert('請輸入數量');
  window.bootstrap.Modal.getInstance(document.getElementById('editQtyModal')).hide();
  if(window.resolveEditQtyModal) window.resolveEditQtyModal(val);
};
window.cancelEditQty = () => {
  window.bootstrap.Modal.getInstance(document.getElementById('editQtyModal')).hide();
  if(window.resolveEditQtyModal) window.resolveEditQtyModal(null);
};
window.confirmVoid = () => {
  window.bootstrap.Modal.getInstance(document.getElementById('voidConfirmModal')).hide();
  if(window.resolveVoidModal) window.resolveVoidModal(true);
};
window.cancelVoid = () => {
  window.bootstrap.Modal.getInstance(document.getElementById('voidConfirmModal')).hide();
  if(window.resolveVoidModal) window.resolveVoidModal(false);
};
