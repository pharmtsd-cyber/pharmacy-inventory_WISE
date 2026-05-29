import { WEB_APP_URL } from './config.js';

export function fetchBackend(action, data = {}) {
  return new Promise((resolve, reject) => {
    
    // 創造一個隨機的專屬接收器名稱
    const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
    
    const params = new URLSearchParams();
    params.append('action', action);
    params.append('callback', callbackName); // 🌟 告訴 Google 把資料包裝到這個接收器裡
    
    if (typeof data === 'object' && data !== null) {
      for (const key in data) params.append(key, data[key]);
    } else {
      params.append('id', data);
      params.append('data', data);
    }

    const finalUrl = `${WEB_APP_URL}?${params.toString()}`;

    // 🌟 準備好接收資料的機關
    window[callbackName] = function(result) {
      delete window[callbackName];
      document.body.removeChild(script);
      resolve(result); // 成功拿到資料！
    };

    // 🚀 核心大絕招：不用 fetch，直接產生一個 <script> 標籤！
    // 瀏覽器對 <script> 標籤絕對不會阻擋，完美繞過所有 CORS 防火牆
    const script = document.createElement('script');
    script.src = finalUrl;
    script.onerror = function() {
      delete window[callbackName];
      document.body.removeChild(script);
      reject(new Error('JSONP 連線失敗，伺服器無回應'));
    };
    
    document.body.appendChild(script);
  });
}
