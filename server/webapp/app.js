(() => {
  const API = location.origin;
  const $ = (id) => document.getElementById(id);
  const authView = $('authView'), feedView = $('feedView'), feed = $('feed');
  let token = localStorage.getItem('bhumi_web_token') || '';
  let username = localStorage.getItem('bhumi_web_user') || '';
  let currentKind = 'posts';
  let toastTimer;
  function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600)}
  function headers(json=false){return {...(json?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})}}
  async function api(path, options={}){const response=await fetch(API+path,{...options,headers:{...headers(Boolean(options.body)),...(options.headers||{})}});let data={};try{data=await response.json()}catch(_){}if(!response.ok)throw new Error(data.error||'Request failed ('+response.status+')');return data}
  function showAuth(){authView.hidden=false;feedView.hidden=true}
  function showFeed(){authView.hidden=true;feedView.hidden=false;$('welcomeTitle').textContent='Hello, '+(username||'there')}
  function safe(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function mediaUrl(value){if(!value)return '';return value.startsWith('http')?value:API+value}
  function render(items){
    if(!items.length){feed.innerHTML='<div class="empty">No '+safe(currentKind)+' to show yet.</div>';return}
    feed.innerHTML=items.map(item=>{
      const user=safe(item.user||item.username||'Bhumi member');
      const caption=safe(item.caption||'');
      const media=mediaUrl(item.mediaUrl||item.uri);
      const isVideo=(item.mediaType||'').includes('video')||/\.(mp4|mov|webm)(\?|$)/i.test(media);
      const visual=media?(isVideo?'<video class="media" src="'+safe(media)+'" controls playsinline preload="metadata"></video>':'<img class="media" src="'+safe(media)+'" alt="Post by '+user+'" loading="lazy">'):'';
      const date=item.createdAt?new Date(item.createdAt).toLocaleDateString():'';
      return '<article class="post"><div class="post-head"><div class="avatar">'+safe(user.slice(0,1).toUpperCase())+'</div><div><div class="user">'+user+'</div><div class="date">'+safe(date)+'</div></div></div>'+visual+(caption?'<div class="caption">'+caption+'</div>':'')+'<div class="post-actions">♥ '+safe(item.likesCount??item.likes??0)+' likes</div></article>';
    }).join('');
  }
  async function loadFeed(){feed.innerHTML='<div class="loading">Loading…</div>';try{const data=await api('/api/'+currentKind);render(Array.isArray(data.items)?data.items:[])}catch(e){feed.innerHTML='<div class="empty">'+safe(e.message)+'</div>'}}
  async function checkSession(){if(!token){showAuth();return}try{const data=await api('/api/auth/me');username=data.username||username;localStorage.setItem('bhumi_web_user',username);showFeed();await loadFeed()}catch(_){token='';localStorage.removeItem('bhumi_web_token');showAuth()}}
  $('loginForm').addEventListener('submit',async e=>{e.preventDefault();const button=e.currentTarget.querySelector('button');button.disabled=true;$('authMessage').textContent='Signing in…';try{const data=await api('/api/auth/login',{method:'POST',body:JSON.stringify({username:$('loginUser').value.trim(),password:$('loginPass').value})});token=data.token;username=data.username;localStorage.setItem('bhumi_web_token',token);localStorage.setItem('bhumi_web_user',username);$('loginPass').value='';showFeed();await loadFeed()}catch(err){$('authMessage').textContent=err.message}finally{button.disabled=false}});
  $('refreshBtn').addEventListener('click',loadFeed);
  document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===btn));currentKind=btn.dataset.kind;loadFeed()}));
  $('logoutBtn').addEventListener('click',async()=>{try{await api('/api/auth/logout',{method:'POST'})}catch(_){}token='';username='';localStorage.removeItem('bhumi_web_token');localStorage.removeItem('bhumi_web_user');showAuth();toast('Signed out')});
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
  let deferredPrompt=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBtn').hidden=false});
  $('installBtn').addEventListener('click',async()=>{if(!deferredPrompt){toast('On iPhone: Share → Add to Home Screen');return}deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBtn').hidden=true});
  checkSession();
})();