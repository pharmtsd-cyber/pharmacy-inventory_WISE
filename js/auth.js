import { fetchBackend } from './api.js'; 
import { toggleLoader, switchView } from './ui.js'; 
import { session } from './config.js';

export function handleLogin() {
  const id = document.getElementById('login-id').value.trim(); 
  
  if(!id) return alert('請輸入員工編號');
  
  toggleLoader(true);
  
fetchBackend('checkLogin', payload).then(res => {
    toggleLoader(false);
    if(res.success) {
      session.id = res.userId || res.id; 
      session.name = res.userName || res.name; 
      session.isAdmin = res.isAdmin;
      
      // 🌟 終極防呆：先檢查畫面上有沒有 'nav-info' 這個標籤，有才放名字，沒有就跳過不當機！
      const navInfoElement = document.getElementById('nav-info');
      if (navInfoElement) {
        navInfoElement.innerText = session.name;
      }
      
      // 順利切換到選單畫面
      switchView('view-mode-select'); 
    } else { 
      alert("❌ 登入失敗：" + (res.message || "未知錯誤")); 
    }
  }).catch(err => {
    toggleLoader(false); 
    // 🌟 讓系統說實話！把真正的錯誤訊息印出來
    console.error("登入過程發生錯誤:", err);
    alert('⚠️ 系統錯誤：' + err.message); 
  });
}

export function handleLogout() { 
  if(confirm('確定要登出嗎？')) location.reload(); 
}
