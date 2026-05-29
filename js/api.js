import { WEB_APP_URL } from './config.js';

export function fetchBackend(action, data = {}) {
  return new Promise((resolve, reject) => {
    
    // 🌟 將 action 一起打包進去，準備送給後端
    const payload = { action: action, ...data };

    fetch(WEB_APP_URL, {
      method: 'POST',       // 強制使用 POST
      redirect: 'follow',   // 🌟 關鍵一：Google 內部會轉址，必須允許跟隨
      headers: {
        // 🌟 關鍵二：絕對不能用 'application/json'！
        // 必須偽裝成一般文字 'text/plain' 繞過 CORS 防火牆，我們寫好的 GAS 會自動把它轉回 JSON
        'Content-Type': 'text/plain;charset=utf-8', 
      },
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
