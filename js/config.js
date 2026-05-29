// ==========================================
// ⚙️ 全院多藥局系統 - 核心設定與路由分流
// ==========================================

// 🌟 1. 自動讀取網址列後方的參數 (例如：?dept=opd)
const urlParams = new URLSearchParams(window.location.search);
// 若無參數，預設進入「智能運管組(admin)」的開發測試環境
const currentDept = urlParams.get('dept') || 'admin'; 

// 🌟 2. 各單位的「GAS 後端網址」對照表
const BACKEND_MAP = {
  admin: "https://script.google.com/macros/s/AKfycbyi8p5Mz9K68ZKBQuHv6MWa10KPLjKrKdcm_vZMYz1L6pNli6aLBKkQdG94Mnsj-uoC/exec", // 智能運管組 (目前的開發網址)
  ipd: "https://script.google.com/macros/s/AKfycbydOWsDkwmX8BRKyOdbdidsdbC7cT0FIBmWVkmdjKKYw-4XxUXaQElx99AFMz_KIPlVsg/exec",
  opd: "https://script.google.com/macros/s/AKfycbymGL_J04TEDCFV7xH-M5-zCYmgj8BAtz6WVE06m3MR4Sl1rZ1SGs6ALDyAlWbsoDmHBg/exec", 
  erd: "https://script.google.com/macros/s/AKfycbyMTHmPUdKmhyLO4Gm-OPKuYyAFpclId_bwFcSAUsAIt4QKLlMCXpUOGXBI1MPfxmKg/exec", 
  comp: "https://script.google.com/macros/s/AKfycbwQzl8Cbi6ZZtcMDcnm50m-5L6771mJyxIVoX_d_yIlgA7QJ3iN0ss_RonUBZeHuzFhig/exec" 
};

// 🌟 3. 各單位的「顯示名稱」對照表
const DEPT_NAME_MAP = {
  admin: "智能運管組",
  ipd: "住院藥局",
  opd: "門診藥局",
  erd: "急診藥局",
  comp: "調配藥局"
};

// 🌟 4. 各單位的「環境主題色」對照表
const DEPT_COLOR_MAP = {
  admin: "#495057", // 深灰色 (沉穩內斂的開發者專屬色)
  ipd: "#1E4D2B",   // 海軍綠
  opd: "#1A365D",   // 海軍藍
  erd: "#7A1717",   // 海軍紅
  comp: "#4E342E"   // 海軍棕
};

// 🌟 5. 導出動態變數給全系統元件使用 (若參數亂打，預設導回 admin)
export const WEB_APP_URL = BACKEND_MAP[currentDept] || BACKEND_MAP['admin'];
export const DEPT_NAME = DEPT_NAME_MAP[currentDept] || DEPT_NAME_MAP['admin'];
export const DEPT_COLOR = DEPT_COLOR_MAP[currentDept] || DEPT_COLOR_MAP['admin'];

export let session = { id: '', name: '', mode: '', isAdmin: false };
