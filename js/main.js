import { session, DEPT_NAME, DEPT_COLOR } from './config.js';
import { switchView } from './ui.js';
import { handleLogin, handleLogout } from './auth.js';

import { 
  initDailyMode, changeDailyDate, switchDailyTab, submitDailyOne, 
  editDailyQty, toggleDailyStatus, // 🌟 新增這兩個
  openAdminSort, toggleVisibility, highlightSearchItem, rebuildAdminList, saveAdminDataToServer, renderDailyItems 
} from './daily.js';

import { 
  initMonthlyMode, switchMonthlyTab, switchStockSubTab, switchDeskSubTab, switchOnlineSubTab, 
  handleStockSearch, handleOnlineSearch, selectStockDrug, selectOnlineDrug, 
  handleTableSelectChange, submitMonthlyDeskOne, submitMonthlyStock, submitMonthlyOnline, 
  updateOnlineUI, startLiveScanner, closeLiveScanner, parseBarcodeAndSubmit, 
  loadUserRecords, handleRecordFilterSearch, clearRecordFilter, applyRecordFilter, 
  editRecord, toggleMonthlyRecordStatus, refreshMonthlyData,
  refreshDashboardData, renderMonthlyDashboard, showTableDetailModal, enterTableInventory, handleMonthlyBack
} from './monthly.js';

import { 
  initHistoryMode, addHistoryDate, removeHistoryDate, handleDrugSearch, selectDrugFilter, clearDrugFilter, 
  renderHistoryTable, toggleModalCol, addQuickDate, openNoteModal, submitDrugNote, voidDrugNote 
} from './history.js';


// ==========================================
// 🚀 全院多藥局「環境外觀動態渲染引擎」
// ==========================================
(function applyDynamicEnvironment() {
  if (!currentDept) {
    // 💡 情況 A：網址沒有參數，停在大廳
    switchView('view-lobby');
    document.title = '盤點系統入口大廳';
  } else {
    // 💡 情況 B：網址有參數，進入該藥局登入畫面並套用主題
    switchView('view-login');
    document.title = `${DEPT_NAME}盤點APP`;
    document.documentElement.style.setProperty('--academic-primary', DEPT_COLOR);
    const brandEl = document.querySelector('.navbar-brand');
    if (brandEl) brandEl.innerHTML = `<i class="bi bi-capsule"></i> ${DEPT_NAME}盤點APP`;
  }
})();

// 🌟 點擊大廳按鈕：加上參數並重新載入網頁 (乾淨切換環境)
window.enterPharmacy = function(deptCode) {
  window.location.href = `?dept=${deptCode}`;
};

// 🌟 返回模式選擇 (每日/月盤點)
window.backToModeSelect = function() {
  switchView('view-mode-select');
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
window.handleStockSearch = handleStockSearch;
window.handleOnlineSearch = handleOnlineSearch;
window.selectStockDrug = selectStockDrug;
window.selectOnlineDrug = selectOnlineDrug;
window.handleTableSelectChange = handleTableSelectChange;
window.submitMonthlyDeskOne = submitMonthlyDeskOne;
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
window.handleMonthlyBack = handleMonthlyBack;
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
