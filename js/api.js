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

    // 🌟 關鍵修復：全面改用 POST 請求，將參數裝入 Body 之中
    // 徹底解決 payloadArray 過長導致的 400 Bad Request 網址字元數上限問題
    const fetchOptions = {
      method: 'POST',
      redirect: 'follow',
      // 使用 text/plain 偽裝，完美迴避 Google Apps Script 嚴格的 CORS 跨網域擋截
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload)
    };

    // 🌟 將 fetch 包裝成一個可以遞迴重試的內部函式
    const attemptFetch = (retriesLeft) => {
      
      // 這裡直接對乾淨的 WEB_APP_URL 發出請求，不再於網址列串接參數
      fetch(WEB_APP_URL, fetchOptions)
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
