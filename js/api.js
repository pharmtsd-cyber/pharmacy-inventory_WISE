import { WEB_APP_URL } from './config.js';

export function fetchBackend(action, data = {}) {
  return new Promise((resolve, reject) => {
    
    // 1. 建立標準的資料封包
    const payload = { action: action };
    
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      Object.assign(payload, data);
    } else if (data) {
      payload.id = data;
    }

    // 2. 關鍵修正：還原為 POST 請求，並將封包轉為 JSON 字串
    // 💡 故意不設定 Content-Type，讓瀏覽器預設以 text/plain 送出
    // 這是對付 Google Apps Script 最完美的大絕招，能完美避開 CORS Preflight (OPTIONS) 錯誤！
    fetch(WEB_APP_URL, {
      method: 'POST',
      redirect: 'follow', // 讓瀏覽器自動跟隨 GAS 的 302 重新導向
      body: JSON.stringify(payload)
    })
    .then(response => {
      if (!response.ok) throw new Error('網路回應錯誤，狀態碼: ' + response.status);
      return response.json();
    })
    .then(result => resolve(result))
    .catch(error => {
      console.error('API Fetch 錯誤:', error);
      reject(error);
    });
  });
}
