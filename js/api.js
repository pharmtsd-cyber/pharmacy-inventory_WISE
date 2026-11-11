import { WEB_APP_URL, CF_WORKER_URL, currentDept } from './config.js';
import { updateSyncUI, showToast, toggleLoader } from './ui.js';

export let activeUploads = 0;
export let isSyncing = false;

// ==========================================
// 📦 離線佇列管理模組
// ==========================================
export function getOfflineQueue() {
  try { return JSON.parse(localStorage.getItem('femh_offline_queue')) || []; } 
  catch(e) { return []; }
}

function saveOfflineQueue(queue) {
  localStorage.setItem('femh_offline_queue', JSON.stringify(queue));
  updateSyncUI(activeUploads);
}

// ==========================================
// 🚀 背景批次自動同步引擎 (離線恢復用)
// ==========================================
export async function syncOfflineData() {
  if (isSyncing || !navigator.onLine) return;
  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  isSyncing = true;
  activeUploads++; 
  updateSyncUI(activeUploads);
  showToast(`📡 網路恢復！開始打包同步 ${queue.length} 筆離線資料...`, 'success');

  try {
    const fetchOptions = {
      method: 'POST',
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: 'syncBatchOfflineData', batchArray: queue })
    };

    const res = await fetch(WEB_APP_URL, fetchOptions);
    if (res.ok || res.type === 'opaque') {
       saveOfflineQueue([]);
       showToast(`🎉 成功批次上傳 ${queue.length} 筆暫存資料！`, 'success');
       window.dispatchEvent(new CustomEvent('offline-sync-complete'));
    }
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
       saveOfflineQueue([]);
       showToast(`🎉 成功批次上傳 ${queue.length} 筆暫存資料！`, 'success');
       window.dispatchEvent(new CustomEvent('offline-sync-complete'));
    } else {
       showToast('⚠️ 批次同步連線不穩，將於背景自動重試', 'delete');
    }
  } finally {
    activeUploads--;
    updateSyncUI(activeUploads);
    isSyncing = false;
  }
}

// ==========================================
// 🛡️ 升級版：支援斷網攔截與 CF 分流的 fetchBackend
// ==========================================
export function fetchBackend(action, data = {}, retryCount = 3) {
  return new Promise((resolve, reject) => {
    // 💡 只有這些會改變資料庫的動作，才允許進入離線佇列
    const isCriticalWrite = ['submitInventory', 'modifyDailyRecord', 'updateMonthlyRecord', 'modifyMonthlyRecordStatus', 'saveDrugNote', 'saveAdminSortData'].includes(action);

    if (isCriticalWrite) {
      activeUploads++;
      updateSyncUI(activeUploads);
    }

    // 🌟 核心修改：把部門代號 dept 一併塞進 payload 給 Cloudflare 分流
    const payload = { action: action, dept: currentDept };
    
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      Object.assign(payload, data);
    } else if (data) {
      payload.id = data;
    }

    const isLargeData = (action === 'saveAdminSortData');
    
    // 🌟 定義哪些動作要走 Cloudflare 高速通道 (包含監控 CF 待傳數量的 checkPendingSync)
    const cfActions = ['submitInventory', 'updateMonthlyRecord', 'modifyMonthlyRecordStatus', 'checkPendingSync'];
    
    // 🌟 智慧分流：CF 動作走 CF_WORKER_URL，其他走 GAS 的 WEB_APP_URL
    let finalUrl = cfActions.includes(action) ? CF_WORKER_URL : WEB_APP_URL;
    let fetchOptions = { redirect: 'follow' };

    if (isLargeData || cfActions.includes(action)) {
      fetchOptions.method = 'POST';
      // 注意：CF 接收 application/json，舊版 GAS 接收 text/plain 以避免 CORS 錯誤
      fetchOptions.headers = { "Content-Type": cfActions.includes(action) ? "application/json;charset=utf-8" : "text/plain;charset=utf-8" };
      fetchOptions.body = JSON.stringify(payload);
    } else {
      fetchOptions.method = 'GET';
      const params = new URLSearchParams();
      for (const key in payload) {
        params.append(key, payload[key]);
      }
      finalUrl = `${finalUrl}?${params.toString()}`;
    }

    const attemptFetch = (retriesLeft) => {
      // 🌟 【防線 1】：如果系統判定已經沒有網路，直接進入離線佇列
      if (!navigator.onLine && isCriticalWrite) {
        const queue = getOfflineQueue();
        queue.push({ id: Date.now().toString() + Math.random(), action, data });
        saveOfflineQueue(queue);
        
        activeUploads--;
        updateSyncUI(activeUploads);
        showToast('📴 目前無網路，資料已暫存於設備中', 'delete');
        return resolve({ success: true, message: '離線暫存成功' }); 
      }

      fetch(finalUrl, fetchOptions)
      .then(response => {
        if (!response.ok) throw new Error('網路回應錯誤，狀態碼: ' + response.status);
        return response.json();
      })
      .then(result => {
        // 🌟 成功寫入 CF 後，立刻啟動背景徽章監控，告訴藥師還有幾筆沒進 GAS
        if (result.success && ['submitInventory', 'updateMonthlyRecord', 'modifyMonthlyRecordStatus'].includes(action)) {
           startCFSyncPolling();
        }

        if (!result.success && result.message && result.message.includes('忙線中')) {
          if (retriesLeft > 0) {
            setTimeout(() => attemptFetch(retriesLeft - 1), 1000 + Math.random() * 1000);
          } else {
            if (isCriticalWrite) { activeUploads--; updateSyncUI(activeUploads); }
            resolve(result); 
          }
        } else {
          if (isCriticalWrite) { activeUploads--; updateSyncUI(activeUploads); }
          resolve(result); 
        }
      })
      .catch(error => {
        if (isLargeData && error.name === 'TypeError' && error.message.includes('fetch')) {
          if (isCriticalWrite) { activeUploads--; updateSyncUI(activeUploads); }
          return resolve({ success: true, message: '寫入成功 (已忽略導向錯誤)' });
        }

        if (retriesLeft > 0) {
          setTimeout(() => attemptFetch(retriesLeft - 1), 1500);
        } else {
          // 🌟 【防線 2】：重試 3 次還是失敗，進入離線佇列
          if (isCriticalWrite) {
            const queue = getOfflineQueue();
            queue.push({ id: Date.now().toString() + Math.random(), action, data });
            saveOfflineQueue(queue);
            
            activeUploads--;
            updateSyncUI(activeUploads);
            showToast('⚠️ 連線失敗，資料已轉存離線佇列等待重傳', 'delete');
            resolve({ success: true, message: '離線暫存成功' });
          } else {
            if (isCriticalWrite) { activeUploads--; updateSyncUI(activeUploads); }
            console.error('API Fetch 錯誤:', error);
            reject(error);
          }
        }
      });
    };

    attemptFetch(retryCount);
  });
}

// ==========================================
// 🚀 狀態監控引擎：背景輪詢 CF 待傳數量
// ==========================================
let cfPollTimer = null;

export function startCFSyncPolling() {
  if (cfPollTimer) return;
  const syncBadge = document.getElementById('nav-sync-status');
  
  cfPollTimer = setInterval(() => {
    fetchBackend('checkPendingSync').then(res => {
      if (res && res.success) {
        if (res.pendingCount > 0) {
          if (syncBadge) {
            syncBadge.style.display = 'inline-block';
            syncBadge.className = 'badge bg-warning text-dark shadow-sm ms-2';
            syncBadge.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" style="width: 10px; height: 10px;"></span> 待存入表單: ${res.pendingCount} 筆`;
          }
        } else {
          if (syncBadge) {
            syncBadge.className = 'badge bg-success text-white shadow-sm ms-2';
            syncBadge.innerHTML = `<i class="bi bi-cloud-check-fill"></i> 已全數存入表單`;
            setTimeout(() => { if (syncBadge.innerHTML.includes('已全數存入')) syncBadge.style.display = 'none'; }, 3000);
          }
          clearInterval(cfPollTimer);
          cfPollTimer = null;
        }
      }
    });
  }, 3000); // 每 3 秒查一次
}

// ==========================================
// 🛡️ 強制遮罩引擎：必須等 CF 清空才能執行下一步
// ==========================================
export function ensureDataSynced(callback) {
  toggleLoader(true); // 立刻叫出遮罩
  const loaderText = document.querySelector('#loader .text-academic');
  if (loaderText) loaderText.innerText = '等待資料寫入 Google 表單...';

  const check = () => {
    fetchBackend('checkPendingSync').then(res => {
      // 只要待傳數量 = 0，就解除封印，執行 callback！
      if (res && res.success && res.pendingCount === 0) {
        if (loaderText) loaderText.innerText = '系統處理中...'; // 復原文字
        callback();
      } else {
        setTimeout(check, 3000); // 還沒清空，3秒後再查一次
      }
    }).catch(() => setTimeout(check, 3000));
  };
  check();
}
