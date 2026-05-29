import { WEB_APP_URL } from './config.js';

export function fetchBackend(action, data = {}) {
  return new Promise((resolve, reject) => {
    // 建立標準的 JSON 封包
    const payload = { action: action, ...data };

    // 🌟 改回 POST 請求，因為 POST 沒有網址長度限制，能容納所有排序資料
    fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(response => {
      if (!response.ok) throw new Error('網路回應錯誤: ' + response.status);
      return response.json();
    })
    .then(result => resolve(result))
    .catch(error => {
      console.error('API Fetch 錯誤:', error);
      reject(error);
    });
  });
}
