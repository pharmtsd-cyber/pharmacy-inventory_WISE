/**
 * ui.js - 負責畫面切換、載入動畫與提示訊息
 */

// 切換全螢幕載入動畫
export function toggleLoader(show) {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.style.display = show ? 'flex' : 'none';
  }
}

import { session, DEPT_NAME, currentDept } from './config.js';

/**
 * 切換主畫面 View，並自動動態渲染頂部 Navbar 資訊欄位
 */
export function switchView(viewId) {
  // 1. 切換各節點的 active 狀態 (維持您原有的核心邏輯)
  document.querySelectorAll('.view-section').forEach(el => {
    el.classList.remove('active');
  });
  const target = document.getElementById(viewId);
  if (target) {
    target.classList.add('active');
  }

  // 2. 抓取 Navbar 所有新設計的動態欄位元件
  const deptEl = document.getElementById('nav-dept-name');
  const idEl = document.getElementById('nav-user-id');
  const nameEl = document.getElementById('nav-user-name');
  const modeEl = document.getElementById('nav-mode-name');
  const backBtn = document.getElementById('nav-back-btn');
  const logoutBtn = document.getElementById('nav-logout-btn');

  if (!deptEl) return; // 安全防呆

  // 3. 永遠即時鎖定最新的單位名稱
  deptEl.innerText = DEPT_NAME || '亞東紀念醫院';

  // 4. 動態路由分流排版引擎 (精準判斷各欄位何時該露臉)
  if (viewId === 'view-lobby' || viewId === 'view-login') {
    // 💡 情況 A：在大廳或登入畫面
    idEl.style.display = 'none';
    nameEl.style.display = 'none';
    modeEl.style.display = 'none';
    backBtn.style.display = 'none';
    logoutBtn.style.display = 'none';
    
  } else if (viewId === 'view-mode-select') {
    // 💡 情況 B：成功登入，在功能大主選單 (每日/月盤選擇頁)
    idEl.innerText = session.id || '';
    nameEl.innerText = session.name ? `${session.name} 藥師` : '';
    
    idEl.style.display = session.id ? 'inline-block' : 'none';
    nameEl.style.display = session.name ? 'inline-block' : 'none';
    
    modeEl.style.display = 'none'; // 還沒選模式，先隱藏
    backBtn.style.display = 'none'; // 已經在最頂層主選單，不需要返回按鈕
    logoutBtn.style.display = 'inline-block'; // 顯示最右邊登出
    
  } else {
    // 💡 情況 C：已經點進去某個特定盤點作業模式中
    idEl.innerText = session.id || '';
    nameEl.innerText = session.name ? `${session.name} 藥師` : '';
    
    idEl.style.display = session.id ? 'inline-block' : 'none';
    nameEl.style.display = session.name ? 'inline-block' : 'none';

    // 精準給予作業模式名稱
    if (viewId === 'view-daily-app') {
      modeEl.innerText = '每日盤點作業';
    } else if (viewId === 'view-monthly-app') {
      modeEl.innerText = '月盤點作業';
    } else if (viewId === 'view-history-app') {
      modeEl.innerText = '對帳與趨勢分析';
    } else {
      modeEl.innerText = '系統作業中';
    }
    
    modeEl.style.display = 'inline-block';      // 秀出模式標籤
    backBtn.style.display = 'inline-block';     // 🌟 核心：秀出返回上一層按鈕
    logoutBtn.style.display = 'inline-block';   // 秀出登出按鈕
  }
}

// 顯示提示訊息 (Toast)
export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  
  // 根據 type 決定顏色
  let bgClass = 'bg-success';
  if (type === 'error') bgClass = 'bg-danger';
  if (type === 'delete') bgClass = 'bg-warning text-dark';
  
  toast.className = `custom-toast ${bgClass}`;
  toast.innerText = message;
  
  container.appendChild(toast);
  
  // 動畫效果
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// 掃描條碼成功時的提示音
export function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.connect(ctx.destination);
    osc.frequency.value = 800; // 頻率
    osc.start();
    osc.stop(ctx.currentTime + 0.1); // 短促音
  } catch(e) {
    // 瀏覽器不支援時忽略
  }
}

// 掃描時保持螢幕常亮 (防止休眠)
let wakeLock = null;
export async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (err) {
    console.warn('Wake Lock error:', err);
  }
}

export function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release().then(() => wakeLock = null);
  }
}
