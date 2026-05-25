import { session } from './config.js';
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
