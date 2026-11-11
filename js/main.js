import { activeUploads, syncOfflineData } from './api.js'; 
import { session, DEPT_NAME, DEPT_COLOR, currentDept, MAINTENANCE_LINK_MAP } from './config.js';
import { switchView } from './ui.js';
import { handleLogin, handleLogout } from './auth.js';

import { 
  initDailyMode, changeDailyDate, switchDailyTab, submitDailyOne, 
  editDailyQty, toggleDailyStatus, 
  openAdminSort, toggleVisibility, highlightSearchItem, rebuildAdminList, saveAdminDataToServer, renderDailyItems 
} from './daily.js';

import { 
  initMonthlyMode, switchMonthlyTab, switchStockSubTab, switchDeskSubTab, switchOnlineSubTab, switchRecordsSubTab,
  handleStockSearch, handleOnlineSearch, selectStockDrug, selectOnlineDrug, 
  handleTableSelectChange, submitMonthlyDeskBatch, submitMonthlyStock, submitMonthlyOnline, 
  updateOnlineUI, startLiveScanner, closeLiveScanner, parseBarcodeAndSubmit, 
  loadUserRecords, handleRecordFilterSearch, clearRecordFilter, applyRecordFilter, 
  editRecord, toggleMonthlyRecordStatus, refreshMonthlyData,
  refreshDashboardData, refreshDashboardDataSilently, renderMonthlyDashboard, showTableDetailModal, enterTableInventory, handleMonthlyBack
} from './monthly.js';

import { 
  initHistoryMode, addHistoryDate, removeHistoryDate, handleDrugSearch, selectDrugFilter, clearDrugFilter, 
  renderHistoryTable, toggleModalCol, addQuickDate, openNoteModal, submitDrugNote, voidDrugNote 
} from './history.js';


// ==========================================
// 🛡️ 瀏覽器與 APP 內部防護網 (防止資料遺失)
// ==========================================
window.addEventListener('beforeunload', function (e) {
  if (activeUploads > 0) {
    const msg = '尚有資料在背景上傳中，現在離開將會遺失資料！請等待同步完成。';
    e.returnValue = msg; 
    return msg;          
  }
});

// 🌟 覆寫返回按鈕，加入防護
window.backToModeSelect = function() {
  if (activeUploads > 0) {
    alert(`⚠️ 系統正在背景同步，請稍候幾秒鐘，待畫面上方顯示「已全數同步」後再離開。`);
    return;
  }
  switchView('view-mode-select');
};

const originalHandleMonthlyBack = handleMonthlyBack;
window.handleMonthlyBack = function() {
  if (activeUploads > 0) {
    alert(`⚠️ 系統正在背景同步，請稍候幾秒鐘再離開。`);
    return;
  }
  originalHandleMonthlyBack();
};

// ==========================================
// 🔄 網路監聽與智慧型靜默刷新
// ==========================================
window.addEventListener('online', syncOfflineData);
document.addEventListener('DOMContentLoaded', syncOfflineData);

function safeSilentRefresh() {
  // 1. 偵測游標是否停留在任何輸入框 (打字中)
  const activeTagName = document.activeElement ? document.activeElement.tagName : '';
  const isTyping = (activeTagName === 'INPUT' || activeTagName === 'TEXTAREA');

  // 2. 偵測畫面上是否有任何 Bootstrap 彈窗處於開啟狀態
  const hasOpenModal = document.querySelector('.modal.show') !== null;

  // 🛡️ 如果藥師正在忙，則進入「等待模式」
  if (isTyping || hasOpenModal) {
    console.log('⏳ 藥師正在操作中，暫停畫面重繪，2秒後重試...');
    setTimeout(safeSilentRefresh, 2000); 
    return;
  }

  // ✅ 安全執行畫面重繪
  if (session.mode === '月盤點') {
    loadUserRecords(() => { console.log('🔄 [靜默刷新] 月盤點軌跡已完美對齊'); });
    refreshDashboardDataSilently();
  } else if (session.mode === '每日盤點') {
    if (typeof changeDailyDate === 'function') {
      changeDailyDate();
      console.log('🔄 [靜默刷新] 每日盤點清單已完美對齊');
    }
  }
}
window.addEventListener('offline-sync-complete', safeSilentRefresh);

// ==========================================
// 🚀 全院多藥局「環境外觀動態渲染引擎」
// ==========================================
(function applyDynamicEnvironment() {
  if (!currentDept) {
    switchView('view-lobby');
    document.title = '盤點系統入口大廳';
  } else {
    switchView('view-login');
    document.title = `${DEPT_NAME}盤點APP`;
    document.documentElement.style.setProperty('--academic-primary', DEPT_COLOR);
    const brandEl = document.querySelector('.navbar-brand');
    if (brandEl) brandEl.innerHTML = `<i class="bi bi-capsule"></i> ${DEPT_NAME}盤點APP`;
  }
})();

window.enterPharmacy = function(deptCode) {
  window.location.href = `?dept=${deptCode}`;
};

window.openMaintenanceLink = function() {
  const link = MAINTENANCE_LINK_MAP[currentDept];
  if (link) window.open(link, '_blank');
  else alert('尚未設定此單位的盤點表維護連結！');
};

window.switchView = switchView;
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;

window.selectMode = function(modeName) {
  session.mode = modeName;
  if(modeName === '每日盤點') initDailyMode();
  else if (modeName === '月盤點') initMonthlyMode();
};

window.refreshMonthlyData = refreshMonthlyData;
window.initDailyMode = initDailyMode;
window.changeDailyDate = changeDailyDate;
window.switchDailyTab = switchDailyTab;
window.submitDailyOne = submitDailyOne;
window.openAdminSort = openAdminSort;
window.toggleVisibility = toggleVisibility;
window.highlightSearchItem = highlightSearchItem;
window.rebuildAdminList = rebuildAdminList;
window.saveAdminDataToServer = saveAdminDataToServer;
window.renderDailyItems = renderDailyItems;

window.initMonthlyMode = initMonthlyMode;
window.switchMonthlyTab = switchMonthlyTab;
window.switchStockSubTab = switchStockSubTab;
window.switchDeskSubTab = switchDeskSubTab;
window.switchOnlineSubTab = switchOnlineSubTab;

window.switchRecordsSubTab = switchRecordsSubTab;

window.handleStockSearch = handleStockSearch;
window.handleOnlineSearch = handleOnlineSearch;
window.selectStockDrug = selectStockDrug;
window.selectOnlineDrug = selectOnlineDrug;
window.handleTableSelectChange = handleTableSelectChange;
window.submitMonthlyDeskBatch = submitMonthlyDeskBatch; // 🌟 替換為批次送出
window.submitMonthlyStock = submitMonthlyStock;
window.submitMonthlyOnline = submitMonthlyOnline;
window.updateOnlineUI = updateOnlineUI;
window.startLiveScanner = startLiveScanner;
window.closeLiveScanner = closeLiveScanner;
window.parseBarcodeAndSubmit = parseBarcodeAndSubmit;
window.loadUserRecords = loadUserRecords;
window.handleRecordFilterSearch = handleRecordFilterSearch;
window.clearRecordFilter = clearRecordFilter;
window.applyRecordFilter = applyRecordFilter;
window.editRecord = editRecord;
window.editDailyQty = editDailyQty;
window.toggleDailyStatus = toggleDailyStatus;
window.toggleMonthlyRecordStatus = toggleMonthlyRecordStatus;

window.refreshDashboardData = refreshDashboardData;
window.renderMonthlyDashboard = renderMonthlyDashboard;
window.showTableDetailModal = showTableDetailModal;

window.initHistoryMode = initHistoryMode;
window.addHistoryDate = addHistoryDate;
window.removeHistoryDate = removeHistoryDate;
window.handleDrugSearch = handleDrugSearch;
window.selectDrugFilter = selectDrugFilter;
window.clearDrugFilter = clearDrugFilter;
window.renderHistoryTable = renderHistoryTable;
window.toggleModalCol = toggleModalCol;
window.addQuickDate = addQuickDate;
window.openNoteModal = openNoteModal;
window.submitDrugNote = submitDrugNote;
window.voidDrugNote = voidDrugNote;

window.enterTableInventory = enterTableInventory;
window.refreshMonthlyData = refreshMonthlyData;

// ==========================================
// ✨ 全域小算盤功能
// ==========================================
let calcTargetId = null;
let calcExpression = '';

window.openCalculator = function(targetId, title = '小算盤') {
  calcTargetId = targetId;
  const targetInput = document.getElementById(targetId);
  // 如果輸入框已經有數字，就帶入作為算式開頭
  calcExpression = targetInput ? targetInput.value || '' : '';
  document.getElementById('calc-title').innerText = title;
  updateCalcDisplay();
  
  const calcModal = new window.bootstrap.Modal(document.getElementById('calculatorModal'));
  calcModal.show();
};

window.calcPress = function(val) {
  if (calcExpression === 'Error') calcExpression = '';
  calcExpression += val;
  updateCalcDisplay();
};

window.calcClear = function() {
  calcExpression = '';
  updateCalcDisplay();
};

window.calcBackspace = function() {
  if (calcExpression === 'Error') calcExpression = '';
  calcExpression = calcExpression.toString().slice(0, -1);
  updateCalcDisplay();
};

window.calcEqual = function() {
  if (!calcExpression) return;
  try {
    // 嚴格過濾字元，防止非法符號並進行安全運算
    const sanitized = calcExpression.toString().replace(/[^-()\d/*+.]/g, '');
    let result = new Function('return ' + sanitized)();
    if (result !== undefined && !isNaN(result)) {
       result = Math.round(result * 1000) / 1000; // 解決 JavaScript 浮點數誤差
       calcExpression = result.toString();
    } else {
       calcExpression = 'Error';
    }
  } catch(e) {
    calcExpression = 'Error';
  }
  updateCalcDisplay();
};

window.calcConfirm = function() {
  calcEqual(); // 點擊確認時，自動把還沒按等於的算式結算出來
  if (calcExpression !== 'Error' && calcExpression !== '') {
    const target = document.getElementById(calcTargetId);
    if (target) {
        target.value = calcExpression;
        // 🌟 觸發 input 事件，讓月盤點的「已填寫 X 筆」徽章可以即時反應
        target.dispatchEvent(new Event('input')); 
    }
  }
  window.bootstrap.Modal.getInstance(document.getElementById('calculatorModal')).hide();
};

function updateCalcDisplay() {
  const display = document.getElementById('calc-display');
  if(display) {
      display.innerText = calcExpression || '0';
      display.scrollLeft = display.scrollWidth; // 算式變長時自動往右捲動
  }
}

// ==========================================
// ✨ 全域模糊搜尋「鍵盤導航引擎」 (支援全系統所有搜尋框)
// ==========================================
let globalSearchFocus = -1;
let blockSearchKeyup = false;

// 1. 捕獲階段攔截 keyup：防止按上下鍵或 Enter 後觸發原本的 onkeyup 重新搜尋
window.addEventListener('keyup', function(e) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
    if (blockSearchKeyup) {
      e.stopPropagation(); // 封印事件，不讓它傳遞給 HTML 的 onkeyup
      blockSearchKeyup = false; // 解除封印
    }
  }
}, true); // true 代表在最高層級就先攔截下來

// 2. 監聽 keydown：處理上下移動與確認帶入
document.addEventListener('keydown', function(e) {
  // 確保目前是在輸入框裡面操作
  if (e.target.tagName !== 'INPUT') return;
  
  // 自動尋找畫面上目前被打開的下拉選單 (支援各個分頁的 dropdown)
  const activeDropdown = Array.from(document.querySelectorAll('.search-dropdown, [id$="-dropdown"]')).find(d => d.style.display === 'block');
  
  // 如果沒有下拉選單，就不介入，讓系統正常運作
  if (!activeDropdown) {
    globalSearchFocus = -1;
    return;
  }

  const items = activeDropdown.getElementsByClassName('search-dropdown-item');
  if (items.length === 0) return;

  // 如果按下的是上下鍵或 Enter
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
    e.preventDefault(); // 防止游標亂跑或觸發預設表單送出
    blockSearchKeyup = true; // 標記，要求接下來的 keyup 閉嘴
    
    if (e.key === 'ArrowDown') {
      globalSearchFocus++;
      updateGlobalSearchFocus(items);
    } else if (e.key === 'ArrowUp') {
      globalSearchFocus--;
      updateGlobalSearchFocus(items);
    } else if (e.key === 'Enter') {
      // 🚀 超級加速體驗：如果沒有用上下鍵選過，按下 Enter 會「預設直接帶入第一筆」！
      let targetIndex = globalSearchFocus > -1 ? globalSearchFocus : 0;
      if (items[targetIndex]) {
        items[targetIndex].click(); // 模擬滑鼠點擊該選項
        globalSearchFocus = -1;
      }
    }
  } else {
    // 如果按了其他打字的按鍵，重新計算選單位置
    globalSearchFocus = -1;
  }
});

// UI 高亮渲染器
function updateGlobalSearchFocus(items) {
  for (let i = 0; i < items.length; i++) {
    items[i].style.backgroundColor = '';
  }
  // 循環定位 (到底部會回到最上面)
  if (globalSearchFocus >= items.length) globalSearchFocus = 0;
  if (globalSearchFocus < 0) globalSearchFocus = (items.length - 1);
  
  // 加上高亮底色，並自動將畫面捲動到該項目
  items[globalSearchFocus].style.backgroundColor = '#e2e3e5';
  items[globalSearchFocus].scrollIntoView({ block: 'nearest' });
}
