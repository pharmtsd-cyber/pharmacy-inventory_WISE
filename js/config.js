// ==========================================
// ⚙️ 全院多藥局系統 - 核心設定與路由分流
// ==========================================

// 🌟 1. 自動讀取網址列後方的參數
const urlParams = new URLSearchParams(window.location.search);
export const currentDept = urlParams.get('dept');

// 🌟 2. 全面升級：統一指向 Cloudflare Worker 高速 API
// 請將下方引號內的網址，替換成您在 Cloudflare 部署成功後拿到的 workers.dev 網址
const CF_WORKER_URL = "https://femh-inventory-api.pharm-tsd.workers.dev"; 

const BACKEND_MAP = {
  admin: CF_WORKER_URL, 
  ipd: CF_WORKER_URL,
  opd: CF_WORKER_URL, 
  erd: CF_WORKER_URL, 
  comp: CF_WORKER_URL 
};

// 🌟 🚀 新增：各單位專屬的「盤點表維護連結」對照表
// 請將下方的網址替換成各藥局真實的 Google 表單或試算表連結
export const MAINTENANCE_LINK_MAP = {
  admin: "https://docs.google.com/spreadsheets/d/您的運管組維護網址", // 運管組
  ipd: "https://docs.google.com/spreadsheets/d/1HXOY5vYQogaruF8hdSr9WqhIhBESYJh7f0l7plR4azs/edit?usp=sharing", // 住院藥局
  opd: "https://docs.google.com/spreadsheets/d/19FeUxkDPYJ-G_ggj_HjifKUTWxVfVn30QwZdX8WVIsg/edit?usp=sharing", // 門診藥局
  erd: "https://docs.google.com/spreadsheets/d/1sTt9kEmYgyVcUvEwwJWemo1dFImF6sqK4QCOiEZCvO0/edit?usp=sharing", // 急診藥局
  comp: "https://docs.google.com/spreadsheets/d/1OoWvEidJVldKy75HI6mwbiaGzyeiw_VP7I0RDgMsuE4/edit?usp=sharing" // 調配藥局
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

// 🌟 5. 導出動態變數給全系統元件使用 (若在大廳無參數，給予空防呆)
export const WEB_APP_URL = currentDept ? BACKEND_MAP[currentDept] : '';
export const DEPT_NAME = currentDept ? DEPT_NAME_MAP[currentDept] : '亞東紀念醫院藥學部';
export const DEPT_COLOR = currentDept ? DEPT_COLOR_MAP[currentDept] : '#495057';

export let session = { id: '', name: '', mode: '', isAdmin: false };
