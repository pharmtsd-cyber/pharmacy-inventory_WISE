import { WEB_APP_URL } from './config.js';

// 🌟 新增 retryCount 參數，預設自動重試 3 次
export function fetchBackend(action, data = {}, retryCount = 3) {
  return new Promise((resolve, reject) => {
    
    const payload = { action: action };
    
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      Object.assign(payload, data);
    } else if (data) {
      payload.id = data;
    }

    const params = new URLSearchParams();
    for (const key in payload) {
      params.append(key, payload[key]);
    }

    const finalUrl = `${WEB_APP_URL}?${params.toString()}`;

    // 🌟 將 fetch 包裝成一個可以遞迴重試的內部函式
    const attemptFetch = (retriesLeft) => {
      fetch(finalUrl, {
        method: 'GET',
        redirect: 'follow'
      })
      .then(response => {
        if (!response.ok) throw new Error('網路回應錯誤，狀態碼: ' + response.status);
        return response.json();
      })
      .then(result => {
        // 🌟 攔截後端回傳的「系統忙線中」
        if (!result.success && result.message && result.message.includes('忙線中')) {
          if (retriesLeft > 0) {
            console.warn(`[自動重試機制] 偵測到鎖定碰撞，剩餘重試次數: ${retriesLeft}`);
            // 加入 1秒 ~ 2秒 的隨機延遲 (Jitter) 錯開併發衝擊
            setTimeout(() => attemptFetch(retriesLeft - 1), 1000 + Math.random() * 1000);
          } else {
            resolve(result); // 重試次數用盡，真的沒辦法才回傳錯誤
          }
        } else {
          resolve(result); // 正常成功或其他業務錯誤
        }
      })
      .catch(error => {
        // 處理斷網等極端網路錯誤
        if (retriesLeft > 0) {
          console.warn(`[自動重試機制] 網路連線異常，準備重試: ${retriesLeft}`);
          setTimeout(() => attemptFetch(retriesLeft - 1), 1500);
        } else {
          console.error('API Fetch 錯誤:', error);
          reject(error);
        }
      });
    };

    // 開始第一次執行
    attemptFetch(retryCount);
  });
}
