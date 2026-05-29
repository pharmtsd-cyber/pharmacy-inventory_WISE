import { fetchBackend } from './api.js'; 
import { toggleLoader, switchView } from './ui.js'; 
import { session } from './config.js';

export function handleLogin() {
  const id = document.getElementById('login-id').value.trim(); 
  
  if(!id) return alert('請輸入員工編號');
  
  toggleLoader(true);
  
  // 完美打包 { id: "93397" } 送給後端
  fetchBackend('checkLogin', { id: id }).then(res => {
    toggleLoader(false);
    if(res.success) {
      // 🌟 變數名稱與後端 100% 對齊
      session.id = res.userId; 
      session.name = res.userName; 
      session.isAdmin = res.isAdmin;
      document.getElementById('nav-info').innerText = res.userName;
      
      switchView('view-mode-select'); 
    } else { 
      alert("❌ 登入失敗：" + (res.message || "未知錯誤")); 
    }
  }).catch(err => { 
    toggleLoader(false); 
    alert('⚠️ 無法連線到伺服器，請檢查網路狀態。'); 
  });
}

export function handleLogout() { 
  if(confirm('確定要登出嗎？')) location.reload(); 
}
