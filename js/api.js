import { WEB_APP_URL } from './config.js';

export function fetchBackend(action, data = {}) {
  return new Promise((resolve, reject) => {
    
    // 🌟 核心修正：判斷傳入的 data 是什麼格式
    let payload = { action: action };
    
    // 如果傳入的是物件 (例如盤點送出)，就正常合併
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      payload = { ...payload, ...data };
    } else {
      // 🌟 如果傳入的只是單純的字串 (例如登入員編 'F0457')，就自動幫它包裝成 id 標籤
      payload.id = data;    
      payload.data = data;  
    }

    fetch(WEB_APP_URL, {
      method: 'POST',
      redirect: 'follow', 
      headers: {
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
