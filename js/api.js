import { WEB_APP_URL } from './config.js';

export function fetchBackend(action, data = {}) {
  return new Promise((resolve, reject) => {
    
    // 🌟 終極大絕招：把所有資料通通轉成網址參數 (URLSearchParams)
    // 這樣可以徹底無視 Google 轉址掉資料與版本卡死的魔咒！
    const params = new URLSearchParams();
    params.append('action', action);
    
    if (typeof data === 'object' && data !== null) {
      for (const key in data) {
        // 如果傳入的是物件 (例如盤點資料或散彈槍員編)，自動拆解成網址參數
        params.append(key, data[key]);
      }
    } else {
      // 防呆：如果是單純字串
      params.append('id', data);
      params.append('data', data);
    }

    // 拼湊出最終帶有完整資料的動態網址
    const finalUrl = `${WEB_APP_URL}?${params.toString()}`;

    // 改用 GET 請求，這在 Google Apps Script 中是 100% 最穩固、絕對不漏接的通訊方式
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
