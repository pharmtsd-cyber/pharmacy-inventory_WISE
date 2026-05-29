/**
 * ui.js - 負責畫面切換、載入動畫與提示訊息
 */
import { session, DEPT_NAME } from './config.js';

// 切換全螢幕載入動畫
export function toggleLoader(show) {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.style.display = show ? 'flex' : 'none';
  }
}

/**
 * 切換主畫面 View，並自動動態渲染頂部 Navbar 資訊欄位
 */
export function switchView(viewId) {
  // 1. 切換各節點的 active 狀態
  document.querySelectorAll('.view-section').forEach(el => {
    el.classList.remove('active');
  });
  const target = document.getElementById(viewId);
  if (target) {
    target.classList.add('active');
  }

  // 2. 抓取 Navbar 所有新設計的獨立動態欄位元件
  const idEl = document.getElementById('nav-user-id');
  const nameEl = document.getElementById('nav-user-name');
  const modeEl = document.getElementById('nav-mode-name');
  const backBtn = document.getElementById('nav-back-btn');
  const logoutBtn = document.getElementById('nav-logout-btn');

  // 🌟 安全防呆，確保程式絕對不中斷
  if (!idEl) return; 

  // 3. 動態路由分流排版引擎
  if (viewId === 'view-lobby' || viewId === 'view-login') {
    idEl.style.display = 'none';
    nameEl.style.display = 'none';
    modeEl.style.display = 'none';
    backBtn.style.display = 'none';
    logoutBtn.style.display = 'none';
    
  } else if (viewId === 'view-mode-select') {
    idEl.innerText = session.id || '';
    nameEl.innerText = session.name ? `${session.name} 藥師` : '';
    
    idEl.style.display = session.id ? 'inline-block' : 'none';
    nameEl.style.display = session.name ? 'inline-block' : 'none';
    
    modeEl.style.display = 'none'; 
    backBtn.style.display = 'none'; 
    logoutBtn.style.display = 'inline-block'; 
    
  } else {
    idEl.innerText = session.id || '';
    nameEl.innerText = session.name ? `${session.name} 藥師` : '';
    
    idEl.style.display = session.id ? 'inline-block' : 'none';
    nameEl.style.display = session.name ? 'inline-block' : 'none';

    if (viewId === 'view-daily-app') {
      modeEl.innerText = '每日盤點';
    } else if (viewId === 'view-monthly-app') {
      modeEl.innerText = '月盤點';
    } else if (viewId === 'view-history-app') {
      modeEl.innerText = '對帳分析';
    } else {
      modeEl.innerText = '作業中';
    }
    
    modeEl.style.display = 'inline-block';      
    backBtn.style.display = 'inline-block';     
    logoutBtn.style.display = 'inline-block';   
  }
}

// 顯示提示訊息 (Toast)
export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  
  let bgClass = 'bg-success';
  if (type === 'error') bgClass = 'bg-danger';
  if (type === 'delete') bgClass = 'bg-warning text-dark';
  
  toast.className = `custom-toast ${bgClass}`;
  toast.innerText = message;
  
  container.appendChild(toast);
  
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
    osc.frequency.value = 800; 
    osc.start();
    osc.stop(ctx.currentTime + 0.1); 
  } catch(e) {}
}

// ==========================================
// 🌟 螢幕長亮控制 (防止盤點時手機自動休眠)
// ==========================================
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
    wakeLock.release().then(() => {
      wakeLock = null;
    });
  }
}
