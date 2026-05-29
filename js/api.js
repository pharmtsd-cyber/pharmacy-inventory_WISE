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

    // 2. 關鍵大絕招：將所有參數綁定到網址後方 (URLSearchParams)
    // 這會讓 fetch 的行為跟您在瀏覽器網址列直接敲 Enter 完全相同，百分之百穿透資安防火牆
    const params = new URLSearchParams();
    for (const key in payload) {
      params.append(key, payload[key]);
    }

    const finalUrl = `${WEB_APP_URL}?${params.toString()}`;

    // 3. 強制使用 GET 請求
    fetch(finalUrl, {
      method: 'GET',
      redirect: 'follow'
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
