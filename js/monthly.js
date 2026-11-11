import { fetchBackend } from './api.js';
import { toggleLoader, switchView, showToast, playBeep, requestWakeLock, releaseWakeLock } from './ui.js';
import { session } from './config.js';

export let monthlyDrugMaster = []; export let monthlyTables = []; export let myRecordsData = []; 
export let activeRecordFilters = { stock: null, desk: null, online: null, records: null }; 
export let html5QrCode = null; export let stockSelectedDrug = null; export let onlineSelectedDrug = null;
export let barcodeQtyResolve = null; export let allRecordsData = [];

// ==========================================
// ⚡ 月盤點：全域背景佇列與 60 秒定時上傳機制
// ==========================================
const MONTHLY_QUEUE_KEY = 'femh_monthly_pending_queue';
let monthlyTimerId = null;

function getMonthlyQueue() {
  try { return JSON.parse(localStorage.getItem(MONTHLY_QUEUE_KEY)) || []; }
  catch(e) { return []; }
}

function saveMonthlyQueue(queue) {
  localStorage.setItem(MONTHLY_QUEUE_KEY, JSON.stringify(queue));
  updateMonthlyPendingBadge();
}

function updateMonthlyPendingBadge() {
  const queue = getMonthlyQueue();
  const count = queue.length;
  ['desk', 'stock', 'online'].forEach(type => {
    const badge = document.getElementById(`monthly-pending-count-${type}`);
    if (badge) {
      badge.innerText = count;
      if (count > 0) badge.classList.remove('d-none');
      else badge.classList.add('d-none');
    }
  });
}

// 啟動月盤點 60 秒背景打包上傳計時器
function startMonthlyAutoFlushTimer() {
  if (monthlyTimerId) clearInterval(monthlyTimerId);
  monthlyTimerId = setInterval(() => {
    flushMonthlyQueue(false); // 靜默背景打包
  }, 60000); // 60 秒
}

// 主動強行打包上傳佇列中所有資料
export async function flushMonthlyQueue(showMask = true) {
  const queue = getMonthlyQueue();
  if (queue.length === 0) return;

  const batchArray = queue.map(item => ({
    action: 'submitInventory',
    data: {
      mode: '月盤點', userId: session.id, userName: session.name, type: item.type,
      actionSrc: item.actionSrc || '', dispType: item.dispType || '',
      drugCode: item.drugCode, drugName: item.drugName, priceCodeSelect: item.priceCodeSelect || '',
      handQty: item.handQty, tableId: item.tableId || '', locCode: item.locCode || '', barcode: item.barcode || ''
    }
  }));

  if (showMask) toggleLoader(true, `📦 正在背景打包同步 ${batchArray.length} 筆月盤資料...`, true);

  try {
    const res = await fetchBackend('syncBatchOfflineData', { batchArray: JSON.stringify(batchArray) });
    if (res && res.success) {
      saveMonthlyQueue([]); // 清空佇列
      if (showMask) toggleLoader(false, '', true);
      showToast(`🎉 已成功同步 ${batchArray.length} 筆月盤紀錄至雲端`);
      refreshMonthlyData(false);
    } else {
      if (showMask) { toggleLoader(false, '', true); alert("⚠️ 佇列寫入失敗：" + (res ? res.message : '')); }
    }
  } catch (err) {
    if (showMask) { toggleLoader(false, '', true); alert("連線異常，已儲存於本機暫存區：" + err.message); }
  }
}

// 離頁 / 關閉分頁主動攔截
window.addEventListener('beforeunload', () => {
  const queue = getMonthlyQueue();
  if (queue.length > 0) flushMonthlyQueue(false);
});


// ==========================================
// 🚀 月盤點：初始化與各子系統操作
// ==========================================
export function initMonthlyMode() {
  switchView('view-monthly-app'); 
  switchMonthlyTab('tab-dashboard'); 
  document.querySelectorAll('input[name="actionType"]').forEach(radio => { if (radio.value !== '手動') radio.checked = true; });
  updateOnlineUI(); 
  startMonthlyAutoFlushTimer();

  toggleLoader(true);
  fetchBackend('getMonthlyInitData').then(res => {
    monthlyDrugMaster = res.drugMaster; monthlyTables = res.tables;
    const select = document.getElementById('monthly-table-select'); 
    if(select) select.innerHTML = monthlyTables.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    loadUserRecords(() => { 
      renderMonthlyDashboard(); 
      toggleLoader(false); 
      updateMonthlyPendingBadge();
    });
  }).catch(err => { toggleLoader(false); alert("載入失敗"); });
}

export function refreshMonthlyData(showLoader = true) {
  if (showLoader) toggleLoader(true);
  fetchBackend('getMonthlyInitData').then(res => {
    monthlyDrugMaster = res.drugMaster; monthlyTables = res.tables;
    loadUserRecords(() => {
      if (showLoader) toggleLoader(false);
      renderMonthlyDesk();
      renderAllRecordLists();
    });
  }).catch(err => { if (showLoader) toggleLoader(false); });
}


// ==========================================
// 1️⃣ 月盤點：盤點調劑台 (單筆零延遲隱藏)
// ==========================================
export function submitMonthlyDeskInstant(locCode) {
  const input = document.getElementById(`m-qty-${locCode}`);
  if (!input) return;
  const val = input.value.trim();

  if (val === '' || Number(val) < 0) return alert('請輸入有效數量！');

  const drugCode = input.getAttribute('data-code');
  const drugName = input.getAttribute('data-name');
  const tableId = input.getAttribute('data-table');

  // 1. 推入佇列
  const queue = getMonthlyQueue();
  queue.push({
    type: '盤點調劑台', locCode, drugCode, drugName, tableId, handQty: val, time: new Date().toLocaleTimeString()
  });
  saveMonthlyQueue(queue);

  // 2. 本地標記已盤
  const tableData = monthlyTables.find(t => t.id === tableId);
  if (tableData) {
    const item = tableData.items.find(i => i.locCode === locCode);
    if (item) item.hasCounted = true;
  }

  // 3. 瞬間卡片消失
  const card = document.getElementById(`m-card-${locCode}`);
  if (card) {
    card.style.transition = 'all 0.25s ease-out';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.9)';
    setTimeout(() => {
      card.remove();
      renderMonthlyDesk();
      showToast(`✅ ${drugName.substring(0, 8)}... 已暫存 (待背景上傳)`);
    }, 250);
  }
}

export function renderMonthlyDesk() { 
  const tableId = document.getElementById('monthly-table-select').value; 
  const area = document.getElementById('monthly-desk-area'); 
  if (!tableId) { area.innerHTML = ''; return; } 
  const tableData = monthlyTables.find(t => t.id === tableId); 
  if (!tableData) return; 
  
  const queue = getMonthlyQueue();
  const queuedLocs = queue.filter(q => q.type === '盤點調劑台').map(q => q.locCode);

  const uncountedItems = tableData.items.filter(i => !i.hasCounted && !queuedLocs.includes(i.locCode)); 
  const uncountedBadge = document.getElementById('count-desk-uncounted'); 
  if (uncountedBadge) uncountedBadge.innerText = uncountedItems.length; 
  
  if (uncountedItems.length === 0) { 
    area.innerHTML = '<div class="text-center p-5 text-muted fw-bold">所有藥品皆已盤點完成！</div>'; 
    return; 
  }
  
  const uniqueDrugs = []; 
  tableData.items.forEach(item => { if (!uniqueDrugs.includes(item.drugCode)) uniqueDrugs.push(item.drugCode); }); 
  const getDrugColor = (code) => { const index = uniqueDrugs.indexOf(code); return index % 2 === 0 ? 'var(--academic-primary)' : '#adb5bd'; }; 

  let html = `
    <div class="d-flex justify-content-between align-items-center mb-2 px-1">
      <span class="text-muted small"><i class="bi bi-clock-history"></i> 自動背景上傳：每 60 秒</span>
      <button class="btn btn-sm btn-outline-academic fw-bold" onclick="flushMonthlyQueue(true)">
        <i class="bi bi-cloud-arrow-up-fill me-1"></i>立即打包上傳 (<span id="monthly-pending-count-desk" class="badge bg-danger">0</span>)
      </button>
    </div>`; 

  uncountedItems.forEach(item => { 
    const borderColor = getDrugColor(item.drugCode); 
    const encodedName = btoa(encodeURIComponent(item.drugName || '')); 

    let hintHtml = '';
    if (item.desc && item.desc !== '') hintHtml += `<div class="text-danger small fw-bold mb-1"><i class="bi bi-exclamation-triangle-fill me-1"></i>盤點說明：${item.desc}</div>`;
    if (item.remark && item.remark !== '') hintHtml += `<div class="text-secondary small mb-1" style="font-size: 0.8rem;"><i class="bi bi-info-square-fill me-1"></i>藥品備註：${item.remark}</div>`;

    html += `<div class="card drug-card mb-3 shadow-sm border-0" style="border-left: 6px solid ${borderColor} !important;" id="m-card-${item.locCode}">
      <div class="card-body p-3">
        <div class="fw-bold fs-5 text-dark mb-2">${item.drugName}</div>
        <div class="d-flex flex-wrap gap-1 mb-2">
          <span class="badge bg-light text-dark border border-secondary">儲位: ${item.locCode}</span>
          <span class="badge bg-light text-dark border border-secondary">代碼: ${item.drugCode}</span>
        </div>
        ${hintHtml ? `<div class="bg-light rounded p-2 mb-2 border border-light-subtle">${hintHtml}</div>` : ''}
        <div class="input-group shadow-sm">
          <input type="number" id="m-qty-${item.locCode}" class="form-control form-control-lg bg-white fw-bold text-center border-secondary" 
            data-loc="${item.locCode}" data-code="${item.drugCode}" data-name="${item.drugName}" data-table="${item.tableId}" 
            placeholder="數量" inputmode="numeric" pattern="[0-9]*" onkeydown="if(event.key==='Enter') submitMonthlyDeskInstant('${item.locCode}')">
          <button class="btn btn-outline-secondary px-3 fw-bold bg-light border-secondary" type="button" onclick="openCalculator('m-qty-${item.locCode}', decodeURIComponent(atob('${encodedName}')))"><i class="bi bi-calculator fs-5"></i></button>
          <button class="btn btn-academic fw-bold px-3" type="button" onclick="submitMonthlyDeskInstant('${item.locCode}')"><i class="bi bi-check-lg fs-4"></i></button>
        </div>
      </div>
    </div>`; 
  }); 
  area.innerHTML = html;
  updateMonthlyPendingBadge();
}


// ==========================================
// 2️⃣ 月盤點：盤點庫存 (零延遲寫入佇列 + 歸零輸入框)
// ==========================================
export function submitMonthlyStockInstant() {
  if (!stockSelectedDrug) return alert('請先搜尋並選擇藥品！'); 
  const qty = document.getElementById('stock-qty').value.trim(); 
  if (qty === '' || Number(qty) < 0) return alert('請輸入有效數量！');

  // 1. 推入佇列
  const queue = getMonthlyQueue();
  queue.push({
    type: '盤點庫存', drugCode: stockSelectedDrug.invCode, drugName: stockSelectedDrug.name,
    priceCodeSelect: stockSelectedDrug.priceCode, handQty: qty, tableId: 'BFYYY', time: new Date().toLocaleTimeString()
  });
  saveMonthlyQueue(queue);

  // 2. 零延遲體驗：清空選擇與輸入框，直接備妥下一筆
  showToast(`✅ 已暫存 ${stockSelectedDrug.name.substring(0,8)}... x ${qty}`);
  stockSelectedDrug = null; 
  document.getElementById('stock-qty').value = ''; 
  document.getElementById('stock-selected-card').classList.add('d-none'); 
  document.getElementById('stock-drug-search').value = '';
  
  setTimeout(() => { 
    const searchInput = document.getElementById('stock-drug-search'); 
    if (searchInput) searchInput.focus(); 
  }, 10);
}


// ==========================================
// 3️⃣ 月盤點：線上調劑 (零延遲寫入佇列 + 掃條碼極速重置)
// ==========================================
export function submitMonthlyOnlineInstant(actionSrc, parsedData = null, writePriceCode = '') {
  const dispType = document.querySelector('input[name="dispType"]:checked').value;
  let payloadDrug = null; let qty = 0; let barcodeStr = '';
  
  if (actionSrc === '手動') {
    if (!onlineSelectedDrug) return alert('請先搜尋藥品！'); 
    qty = document.getElementById('online-qty').value.trim(); 
    if (qty === '' || Number(qty) < 0) return alert('請輸入有效數量！');
    payloadDrug = onlineSelectedDrug; writePriceCode = payloadDrug.priceCode;
  } else { 
    payloadDrug = parsedData; qty = parsedData.qty; barcodeStr = parsedData.barcode; writePriceCode = ''; 
  }

  // 1. 推入佇列
  const queue = getMonthlyQueue();
  queue.push({
    type: '線上調劑', actionSrc, dispType, drugCode: payloadDrug.invCode, drugName: payloadDrug.name,
    priceCodeSelect: writePriceCode, handQty: qty, tableId: 'BFZZZ', barcode: barcodeStr, time: new Date().toLocaleTimeString()
  });
  saveMonthlyQueue(queue);

  // 2. 零延遲體驗：清空重置，準備下一筆掃碼/搜尋
  showToast(`✅ [${dispType}] ${payloadDrug.name.substring(0,8)}... x ${qty}`);

  if (actionSrc === '手動') { 
    document.getElementById('online-qty').value = ''; onlineSelectedDrug = null; 
    document.getElementById('online-selected-card').classList.add('d-none'); 
    document.getElementById('online-drug-search').value=''; 
    setTimeout(() => { const searchInput = document.getElementById('online-drug-search'); if (searchInput) searchInput.focus(); }, 10);
  } else { 
    const bcInput = document.getElementById('online-barcode'); 
    if (bcInput) { bcInput.value = ''; setTimeout(() => bcInput.focus(), 10); }
  }
}

// 條碼解析後寫入
export async function parseBarcodeAndSubmit() { 
  const bcInput = document.getElementById('online-barcode'); const bcStr = bcInput.value.trim(); if (!bcStr) return;
  let qty = 1; let parsedDrug = null; let searchKey = bcStr;
  if (bcStr.includes(';')) { 
    const parts = bcStr.split(';'); 
    if (parts.length >= 3) {
      searchKey = parts[1].toUpperCase().trim(); parsedDrug = monthlyDrugMaster.find(d => (d.priceCode || '').toUpperCase() === searchKey);
      if (parsedDrug) {
        if (parts.length >= 4 && parts[3].trim() !== '') qty = parseInt(parts[3], 10) || 1;
        const dispType = document.querySelector('input[name="dispType"]:checked').value;
        if (dispType === '退藥' || !(parts.length >= 4 && parts[3].trim() !== '')) {
          const userQty = await openBarcodeQtyModal(parsedDrug.name, `批價碼: ${parsedDrug.priceCode}`, qty);
          if (userQty === null) { bcInput.value = ''; setTimeout(() => bcInput.focus(), 10); return; }
          qty = parseInt(userQty, 10);
        }
      }
    } 
  }
  if (!parsedDrug) { alert(`❌ 系統查無此藥品！`); bcInput.value = ''; setTimeout(() => bcInput.focus(), 10); return; }
  submitMonthlyOnlineInstant('條碼', { priceCode: parsedDrug.priceCode, invCode: parsedDrug.invCode, name: parsedDrug.name, qty: qty, barcode: bcStr }, '');
}

// ==========================================
// 🔀 分頁與子切換 (全部主動觸發 Queue 刷洗)
// ==========================================
export function switchMonthlyTab(tabId) {
  // 切換大分頁時主動衝刷佇列
  flushMonthlyQueue(false);

  document.querySelectorAll('.monthly-content-section').forEach(s => s.classList.add('d-none'));
  document.getElementById(tabId).classList.remove('d-none');
  const tabsContainer = document.getElementById('monthly-tabs');
  if (tabsContainer) { tabsContainer.querySelectorAll('.nav-link').forEach(btn => { btn.classList.remove('active', 'bg-academic', 'text-white'); btn.classList.add('bg-white', 'text-academic'); }); }
  const activeBtnId = tabId.replace('tab-', 'btn-tab-'); const activeBtn = document.getElementById(activeBtnId);
  if (activeBtn) { activeBtn.classList.remove('bg-white', 'text-academic'); activeBtn.classList.add('active', 'bg-academic', 'text-white'); }
  if (tabId === 'tab-records') renderAllRecordLists();
  if (tabId === 'tab-dashboard') renderMonthlyDashboard();
  if (tabId === 'tab-online') { 
    switchOnlineSubTab('input'); 
    document.querySelectorAll('input[name="actionType"]').forEach(radio => { if (radio.value !== '手動') radio.checked = true; }); 
    updateOnlineUI(); 
  }
}

export function switchDeskSubTab(view) { 
  flushMonthlyQueue(false);
  const btnIn = document.getElementById('btn-desk-sub-input'), btnList = document.getElementById('btn-desk-sub-list'); 
  if(btnIn) btnIn.className = 'nav-link fw-bold border text-academic bg-white shadow-sm py-2'; 
  if(btnList) btnList.className = 'nav-link fw-bold border text-success bg-white shadow-sm py-2'; 
  
  if (view === 'input') { 
    if(btnIn) btnIn.className = 'nav-link active fw-bold border bg-academic text-white shadow-sm py-2'; 
    document.getElementById('area-desk-input').classList.remove('d-none'); document.getElementById('area-desk-list').classList.add('d-none'); 
    renderMonthlyDesk(); 
  } else { 
    if(btnList) btnList.className = 'nav-link active fw-bold border bg-success text-white shadow-sm py-2'; 
    document.getElementById('area-desk-input').classList.add('d-none'); document.getElementById('area-desk-list').classList.remove('d-none'); 
    renderAllRecordLists(); 
  } 
}

export function switchStockSubTab(view) { 
  flushMonthlyQueue(false);
  const btnIn = document.getElementById('btn-stock-sub-input'), btnList = document.getElementById('btn-stock-sub-list'), btnAll = document.getElementById('btn-stock-sub-all'); 
  if(btnIn) btnIn.className = 'nav-link fw-bold border text-academic bg-white shadow-sm py-2'; if(btnList) btnList.className = 'nav-link fw-bold border text-success bg-white shadow-sm py-2'; if(btnAll) btnAll.className = 'nav-link fw-bold border text-primary bg-white shadow-sm py-2'; 
  document.getElementById('area-stock-input').classList.add('d-none'); document.getElementById('area-stock-list').classList.add('d-none'); document.getElementById('area-stock-all').classList.add('d-none');
  
  if (view === 'input') { 
    if(btnIn) btnIn.className = 'nav-link active fw-bold border bg-academic text-white shadow-sm py-2'; document.getElementById('area-stock-input').classList.remove('d-none'); 
  } else if (view === 'list') { 
    if(btnList) btnList.className = 'nav-link active fw-bold border bg-success text-white shadow-sm py-2'; document.getElementById('area-stock-list').classList.remove('d-none'); renderAllRecordLists(); 
  } else if (view === 'all') { 
    if(btnAll) btnAll.className = 'nav-link active fw-bold border bg-primary text-white shadow-sm py-2'; document.getElementById('area-stock-all').classList.remove('d-none'); renderAllRecordLists(); 
  }
}

export function switchOnlineSubTab(view) { 
  flushMonthlyQueue(false);
  const btnIn = document.getElementById('btn-online-sub-input'), btnList = document.getElementById('btn-online-sub-list'), btnAll = document.getElementById('btn-online-sub-all'); 
  if(btnIn) btnIn.className = 'nav-link fw-bold border text-academic bg-white shadow-sm py-2'; if(btnList) btnList.className = 'nav-link fw-bold border text-success bg-white shadow-sm py-2'; if(btnAll) btnAll.className = 'nav-link fw-bold border text-primary bg-white shadow-sm py-2'; 
  document.getElementById('area-online-input').classList.add('d-none'); document.getElementById('area-online-list').classList.add('d-none'); document.getElementById('area-online-all').classList.add('d-none');
  
  if (view === 'input') { 
    if(btnIn) btnIn.className = 'nav-link active fw-bold border bg-academic text-white shadow-sm py-2'; document.getElementById('area-online-input').classList.remove('d-none'); 
  } else if (view === 'list') { 
    if(btnList) btnList.className = 'nav-link active fw-bold border bg-success text-white shadow-sm py-2'; document.getElementById('area-online-list').classList.remove('d-none'); renderAllRecordLists(); 
  } else if (view === 'all') { 
    if(btnAll) btnAll.className = 'nav-link active fw-bold border bg-primary text-white shadow-sm py-2'; document.getElementById('area-online-all').classList.remove('d-none'); renderAllRecordLists(); 
  }
}


// 其他搜尋下拉與相機關閉模組...
export function startLiveScanner() {
  const scannerWrapper = document.getElementById('scanner-wrapper'); scannerWrapper.style.display = 'flex'; document.getElementById('btn-start-camera').classList.add('disabled');
  const loadingMask = document.getElementById('scanner-loading'); const scannerContainer = document.getElementById('scanner-container'); const scannerLaser = document.getElementById('scanner-laser'); const scannerHint = document.getElementById('scanner-hint');
  
  if(loadingMask) loadingMask.style.display = 'flex'; if(scannerContainer) scannerContainer.style.opacity = '0'; if(scannerLaser) scannerLaser.style.display = 'none'; if(scannerHint) scannerHint.style.display = 'none';
  requestWakeLock();
  if (!html5QrCode) html5QrCode = new window.Html5Qrcode("reader");
  const config = { fps: 20, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0, disableFlip: false };
  
  html5QrCode.start({ facingMode: "environment" }, config,
    (decodedText) => { if (navigator.vibrate) navigator.vibrate(100); playBeep(); document.getElementById('online-barcode').value = decodedText; closeLiveScanner().then(() => parseBarcodeAndSubmit()); },
    (errorMessage) => {} 
  ).then(() => {
    setTimeout(() => {
      if(loadingMask) loadingMask.style.display = 'none'; if(scannerContainer) scannerContainer.style.opacity = '1'; if(scannerLaser) scannerLaser.style.display = 'block'; if(scannerHint) scannerHint.style.display = 'block';
      try { html5QrCode.applyVideoConstraints({ advanced: [{ focusMode: "single-shot" }] }).catch(()=>{}); html5QrCode.applyVideoConstraints({ advanced: [{ zoom: 1.5 }] }).catch(()=>{}); } catch(e) {}
    }, 800); 
  }).catch((err) => { closeLiveScanner(); alert("❌ 相機啟動失敗！"); });
}

export function closeLiveScanner() { return new Promise((resolve) => { releaseWakeLock(); const wrapper = document.getElementById('scanner-wrapper'); const btn = document.getElementById('btn-start-camera'); if (html5QrCode && html5QrCode.isScanning) { html5QrCode.stop().then(() => { wrapper.style.display = 'none'; btn.classList.remove('disabled'); resolve(); }).catch(err => resolve()); } else { wrapper.style.display = 'none'; btn.classList.remove('disabled'); resolve(); } }); }

export function loadUserRecords(callback) {
  fetchBackend('getMonthlyUserRecords', { userId: 'ALL' }).then(res => { 
    const validMonthlyTypes = ['盤點調劑台', '盤點庫存', '線上調劑'];
    allRecordsData = res.filter(r => validMonthlyTypes.includes((r.type || '').trim())); 
    const sName = session.name ? session.name.trim() : '';
    const sId = session.id ? session.id.trim() : '';
    myRecordsData = allRecordsData.filter(r => (r.userId || '').trim() === sId || (r.updateUser || '').trim() === sName);
    
    renderAllRecordLists(); 
    if(callback) callback(); 
  }).catch(err => { toggleLoader(false); alert("紀錄載入失敗"); });
}

export function updateOnlineUI() { 
  const checkedInput = document.querySelector('input[name="actionType"]:checked'); if (!checkedInput) return;
  const areaManual = document.getElementById('area-manual'); const areaBarcode = document.getElementById('area-barcode');
  if (checkedInput.value === '手動') {
    if (areaManual) areaManual.classList.remove('d-none'); if (areaBarcode) areaBarcode.classList.add('d-none');
    const searchInput = document.getElementById('online-drug-search'); if (searchInput) setTimeout(() => searchInput.focus(), 10);
  } else {
    if (areaManual) areaManual.classList.add('d-none'); if (areaBarcode) areaBarcode.classList.remove('d-none');
    const barcodeInput = document.getElementById('online-barcode'); if (barcodeInput) setTimeout(() => barcodeInput.focus(), 10);
  }
}

export function selectStockDrug(priceCode) { const drug = monthlyDrugMaster.find(d => d.priceCode === priceCode); if (!drug) return; stockSelectedDrug = drug; document.getElementById('stock-dropdown').style.display = 'none'; document.getElementById('stock-drug-search').value = ''; document.getElementById('stock-sel-name').innerText = drug.name; document.getElementById('stock-sel-inv').innerText = drug.invCode; document.getElementById('stock-sel-price').innerText = drug.priceCode; document.getElementById('stock-selected-card').classList.remove('d-none'); document.getElementById('stock-qty').focus(); }
export function selectOnlineDrug(priceCode) { const drug = monthlyDrugMaster.find(d => d.priceCode === priceCode); if (!drug) return; onlineSelectedDrug = drug; document.getElementById('online-dropdown').style.display = 'none'; document.getElementById('online-drug-search').value = ''; document.getElementById('online-sel-name').innerText = drug.name; document.getElementById('online-sel-inv').innerText = drug.invCode; document.getElementById('online-selected-card').classList.remove('d-none'); document.getElementById('online-qty').focus(); }

export function handleStockSearch() { const kw = document.getElementById('stock-drug-search').value.toLowerCase().trim(); const dropdown = document.getElementById('stock-dropdown'); if (!kw) { dropdown.style.display = 'none'; return; } let filtered = monthlyDrugMaster.filter(d => { const pCode = (d.priceCode || '').toLowerCase(); const name = (d.name || '').toLowerCase(); const invCode = (d.invCode || '').toLowerCase(); return pCode.includes(kw) || name.includes(kw) || invCode.includes(kw); }); filtered.sort((a, b) => { const getScore = (d) => { let score = 999; if ((d.priceCode||'').toLowerCase().indexOf(kw) !== -1) score = Math.min(score, (d.priceCode||'').toLowerCase().indexOf(kw)); if ((d.name||'').toLowerCase().indexOf(kw) !== -1) score = Math.min(score, (d.name||'').toLowerCase().indexOf(kw)); if ((d.invCode||'').toLowerCase().indexOf(kw) !== -1) score = Math.min(score, (d.invCode||'').toLowerCase().indexOf(kw)); return score; }; return getScore(a) - getScore(b); }); filtered = filtered.slice(0, 10); if (filtered.length > 0) { dropdown.innerHTML = filtered.map(d => `<div class="search-dropdown-item" onclick="selectStockDrug('${d.priceCode}')"><div class="fw-bold text-academic">${d.name}</div><div class="small text-muted">批價: ${d.priceCode} | 加P: ${d.invCode}</div></div>`).join(''); dropdown.style.display = 'block'; } else { dropdown.innerHTML = '<div class="p-2 text-muted small">查無藥品</div>'; dropdown.style.display = 'block'; } }
export function handleOnlineSearch() { const kw = document.getElementById('online-drug-search').value.toLowerCase().trim(); const dropdown = document.getElementById('online-dropdown'); if (!kw) { dropdown.style.display = 'none'; return; } let filtered = monthlyDrugMaster.filter(d => { const pCode = (d.priceCode || '').toLowerCase(); const name = (d.name || '').toLowerCase(); const invCode = (d.invCode || '').toLowerCase(); return pCode.includes(kw) || name.includes(kw) || invCode.includes(kw); }); filtered.sort((a, b) => { const getScore = (d) => { let score = 999; if ((d.priceCode||'').toLowerCase().indexOf(kw) !== -1) score = Math.min(score, (d.priceCode||'').toLowerCase().indexOf(kw)); if ((d.name||'').toLowerCase().indexOf(kw) !== -1) score = Math.min(score, (d.name||'').toLowerCase().indexOf(kw)); if ((d.invCode||'').toLowerCase().indexOf(kw) !== -1) score = Math.min(score, (d.invCode||'').toLowerCase().indexOf(kw)); return score; }; return getScore(a) - getScore(b); }); filtered = filtered.slice(0, 10); if (filtered.length > 0) { dropdown.innerHTML = filtered.map(d => `<div class="search-dropdown-item" onclick="selectOnlineDrug('${d.priceCode}')"><div class="fw-bold text-academic">${d.name}</div><div class="small text-muted">批價: ${d.priceCode} | 加P: ${d.invCode}</div></div>`).join(''); dropdown.style.display = 'block'; } else { dropdown.innerHTML = '<div class="p-2 text-muted small">查無藥品</div>'; dropdown.style.display = 'block'; } }

export function handleTableSelectChange() { renderMonthlyDesk(); renderAllRecordLists(); }

// 歷史明細渲染...
export function renderAllRecordLists() { 
  let stockRecords = myRecordsData.filter(r => r.type === '盤點庫存'); let stockAllRecords = allRecordsData.filter(r => r.type === '盤點庫存');
  if (activeRecordFilters['stock']) { stockRecords = stockRecords.filter(r => r.code === activeRecordFilters['stock']); stockAllRecords = stockAllRecords.filter(r => r.code === activeRecordFilters['stock']); }
  const stockCount = document.getElementById('count-stock-counted'); if (stockCount) stockCount.innerText = stockRecords.length; const stockAllCount = document.getElementById('count-stock-all'); if (stockAllCount) stockAllCount.innerText = stockAllRecords.length;
  const stockArea = document.getElementById('stock-records-area'); if (stockArea) stockArea.innerHTML = generateRecordCards(stockRecords, '本月尚未輸入庫存盤點', true); const stockAllArea = document.getElementById('stock-all-records-area'); if (stockAllArea) stockAllArea.innerHTML = generateRecordCards(stockAllRecords, '本月尚無任何人輸入庫存', false); 

  const tIdSelect = document.getElementById('monthly-table-select'); const tId = tIdSelect ? tIdSelect.value : ''; 
  let deskRecords = allRecordsData.filter(r => r.type === '盤點調劑台' && r.tableId === tId); 
  if (activeRecordFilters['desk']) deskRecords = deskRecords.filter(r => r.code === activeRecordFilters['desk']); 
  const deskCount = document.getElementById('count-desk-counted'); if (deskCount) deskCount.innerText = deskRecords.length; 
  const deskArea = document.getElementById('desk-records-area'); if (deskArea) deskArea.innerHTML = generateRecordCards(deskRecords, '本區本月尚無盤點紀錄', true); 

  let onlineRecords = myRecordsData.filter(r => r.type === '線上調劑'); let onlineAllRecords = allRecordsData.filter(r => r.type === '線上調劑');
  if (activeRecordFilters['online']) { onlineRecords = onlineRecords.filter(r => r.code === activeRecordFilters['online']); onlineAllRecords = onlineAllRecords.filter(r => r.code === activeRecordFilters['online']); }
  const onlineCount = document.getElementById('count-online-counted'); if (onlineCount) onlineCount.innerText = onlineRecords.length; const onlineAllCount = document.getElementById('count-online-all'); if (onlineAllCount) onlineAllCount.innerText = onlineAllRecords.length;
  const onlineArea = document.getElementById('online-records-area'); if (onlineArea) onlineArea.innerHTML = generateRecordCards(onlineRecords, '本月尚無線上調劑紀錄', true); const onlineAllArea = document.getElementById('online-all-records-area'); if (onlineAllArea) onlineAllArea.innerHTML = generateRecordCards(onlineAllRecords, '本月尚無任何線上調劑紀錄', false); 
}

export function generateRecordCards(recordsArray, emptyMsg, allowEdit) { 
  if (recordsArray.length === 0) return `<div class="text-center p-3 text-muted fw-bold">${emptyMsg}</div>`; 
  let html = ''; 
  recordsArray.forEach(record => { 
    const isVoid = record.status === '作廢';
    let qtyStr = record.handQty; let colorClass = 'text-primary'; let dispBadge = ''; let cardBg = ''; let borderClass = 'border-info'; 

    if (record.dispType === '調劑') { qtyStr = `-${record.handQty}`; colorClass = 'text-danger'; dispBadge = `<span class="badge bg-danger ms-1">調劑</span>`; cardBg = 'background-color: #fff0f4;'; borderClass = 'border-danger'; } 
    else if (record.dispType === '退藥') { qtyStr = `+${record.handQty}`; colorClass = 'text-success'; dispBadge = `<span class="badge bg-success ms-1">退藥</span>`; borderClass = 'border-success'; } 
    
    const cardStyle = isVoid ? `opacity: 0.6; filter: grayscale(100%); ${cardBg}` : cardBg;
    const badgeHtml = isVoid ? `<span class="badge bg-secondary ms-1">已作廢</span>` : dispBadge;
    const locInfo = record.loc ? ` | 儲位: ${record.loc}` : ''; 
    const userInfo = record.userName ? `<span class="badge bg-light text-dark border ms-1"><i class="bi bi-person-fill"></i> 建立: ${record.userName}</span>` : '';
    const updateInfo = (record.updateUser && record.updateTime) ? `<span class="badge bg-warning text-dark border ms-1"><i class="bi bi-pencil-square"></i> 修改: ${record.updateUser} (${record.updateTime})</span>` : '';
    
    const actionHtml = isVoid ? `<button class="btn btn-sm btn-outline-success py-0" onclick="toggleMonthlyRecordStatus('${record.sn}', '成立')">還原</button>` : `<button class="btn btn-sm btn-outline-primary py-0 me-1" onclick="editRecord('${record.sn}')">修改</button><button class="btn btn-sm btn-outline-danger py-0" onclick="toggleMonthlyRecordStatus('${record.sn}', '作廢')">作廢</button>`;
    const editButtons = allowEdit ? `<div class="d-flex justify-content-between align-items-center mt-1 pt-1 border-top"><div class="fs-5 fw-bold ${isVoid ? 'text-muted text-decoration-line-through' : colorClass}">${qtyStr}</div><div>${actionHtml}</div></div>` : `<div class="fs-5 fw-bold ${isVoid ? 'text-muted text-decoration-line-through' : colorClass} mt-1 pt-1 border-top">${qtyStr}</div>`; 
    
    html += `<div class="card mb-2 shadow-sm border-0 border-start border-4 ${borderClass}" style="${cardStyle}"><div class="card-body p-2"><div class="d-flex justify-content-between mb-1"><div class="fw-bold text-dark text-truncate" style="max-width: 70%;">${record.name}</div><div class="small text-muted" style="font-size:0.75rem;">${record.time}</div></div><div class="small text-secondary mt-1" style="font-size:0.8rem;"><span class="badge bg-secondary">${record.type}</span>${badgeHtml}<span class="ms-1">代碼: ${record.code}${locInfo}</span><div class="mt-1">${userInfo}${updateInfo}</div></div>${editButtons}</div></div>`; 
  }); 
  return html; 
}
