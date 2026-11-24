(() => {
const API=location.origin,$=id=>document.getElementById(id);
const authView=$('authView'),appView=$('appView'),feed=$('feed'),dmLayout=document.querySelector('.dm-layout');
let token=localStorage.getItem('bhumi_web_token')||'',username=localStorage.getItem('bhumi_web_user')||'',currentView='home',currentKind='posts',activeChat='',toastTimer;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=v=>v?(String(v).startsWith('http')?v:API+v):'';
function toast(m){const e=$('toast');e.textContent=m;e.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove('show'),2500)}
function headers(json=false){return {...(json?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})}}
async function api(path,opts={}){const isForm=opts.body instanceof FormData;const res=await fetch(API+path,{...opts,headers:{...headers(Boolean(opts.body)&&!isForm),...(opts.headers||{})}});let d={};try{d=await res.json()}catch(_){}if(!res.ok)throw Error(d.error||'Request failed ('+res.status+')');return d}
function showAuth(){authView.hidden=false;appView.hidden=true}
function showApp(){authView.hidden=true;appView.hidden=false}
function openInstallHelp(){
 const ua=navigator.userAgent||'';
 const ios=/iphone|ipad|ipod/i.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const android=/android/i.test(ua);
 const inApp=/WhatsApp|FBAN|FBAV|Instagram|Line\//i.test(ua);
 const safari=/Safari/i.test(ua)&&!/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
 const steps=$('installSteps'),note=$('installNote');
 $('installHelpTitle').textContent=ios?'Install on iPhone':android?'Install on Android':'Install Bhumi Social AI';
 if(ios){
  steps.innerHTML=(safari?'<li>Open this website directly in <strong>Safari</strong>.</li>':'<li>Open the browser Share menu and choose <strong>Open in Safari</strong>. iPhone installation is supported through Safari.</li>')+'<li>In Safari, tap the <strong>Share</strong> icon (square with an upward arrow).</li><li>Scroll down the Share sheet. If needed, tap <strong>Edit Actions</strong> or <strong>More</strong>, then choose <strong>Add to Home Screen</strong>.</li><li>Keep <strong>Open as Web App</strong> enabled if shown, then tap <strong>Add</strong>.</li>';
  note.textContent='The icon will appear on your Home Screen. If Add to Home Screen is missing, make sure you are in Safari and check Screen Time or device-management restrictions. iOS controls this menu; a website cannot force it to appear.';
 }else if(android){
  steps.innerHTML='<li>Open this link in <strong>Chrome</strong>.</li><li>Tap the <strong>⋮</strong> menu in the top-right corner.</li><li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li><li>Tap <strong>Install</strong> or <strong>Add</strong>.</li>';
  note.textContent='If the install option is unavailable, update Chrome and open the website directly in Chrome rather than inside WhatsApp.';
 }else{
  steps.innerHTML='<li>Open the Bhumi Social AI link in your phone’s main browser.</li><li>Open the browser menu or Share menu.</li><li>Choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>, if available.</li><li>Confirm the installation.</li>';
  note.textContent='Install wording varies by phone and browser. On iPhone use Safari; on Android use Chrome.';
 }
 if(inApp) note.textContent='You appear to be inside another app. First use its menu to choose Open in Safari (iPhone) or Open in Chrome (Android), then follow the steps above. '+note.textContent;
 $('installHelpModal').hidden=false;
}
function closeInstallHelp(){ $('installHelpModal').hidden=true }
function setAuthMode(mode){
 const signup=mode==='signup';
 $('loginForm').hidden=signup;
 $('signupForm').hidden=!signup;
 $('authTitle').textContent=signup?'Create your account':'Welcome back';
 $('authSubtitle').textContent=signup?'Join Bhumi Social AI — connect, create and share.':'Sign in to continue to Bhumi Social AI.';
 $('authSwitchBtn').textContent=signup?'Already have an account? Sign in':'Sign Up';
 $('iosInstallHelp').hidden=!signup;
 $('installSignupBtn').hidden=!signup;
 $('authMessage').textContent='';$('signupMessage').textContent='';
}
function switchView(view){currentView=view;document.querySelectorAll('.main-tabs .tab').forEach(b=>b.classList.toggle('active',b.dataset.view===view));['home','messages','notifications','profile'].forEach(v=>$(v+'View').hidden=v!==view);$('viewTitle').textContent={home:'Home',messages:'Messages',notifications:'Activity',profile:'Profile'}[view];if(view==='home')loadFeed();if(view==='messages')loadConversations();if(view==='notifications')loadNotifications();if(view==='profile')loadProfile()}
function mediaMarkup(item){const m=url(item.mediaUrl||item.uri);if(!m)return '';const video=(item.mediaType||'').includes('video')||/\.(mp4|mov|webm)(\?|$)/i.test(m);return video?'<video class="media" src="'+esc(m)+'" controls playsinline preload="metadata"></video>':'<img class="media" src="'+esc(m)+'" alt="Post media" loading="lazy">'}
async function loadFeed(){feed.innerHTML='<div class="loading">Loading…</div>';try{const d=await api('/api/'+currentKind);const items=Array.isArray(d.items)?d.items:[];feed.innerHTML=items.length?items.map(x=>'<article class="post"><div class="post-head"><div class="avatar">'+esc((x.username||'B').slice(0,1).toUpperCase())+'</div><div><div class="user">'+esc(x.username||'Bhumi member')+'</div><div class="date">'+esc(x.createdAt?new Date(x.createdAt).toLocaleString():'')+'</div></div></div>'+mediaMarkup(x)+(x.caption?'<div class="caption">'+esc(x.caption)+'</div>':'')+'<div class="post-actions">♥ '+esc(x.likesCount??x.likes??0)+' likes</div></article>').join(''):'<div class="empty">No '+esc(currentKind)+' to show yet.</div>'}catch(e){feed.innerHTML='<div class="empty">'+esc(e.message)+'</div>'}}
async function loadConversations(){const box=$('conversationList');box.innerHTML='<div class="loading">Loading inbox…</div>';try{const d=await api('/api/messages/conversations'),items=d.conversations||[];let unread=items.reduce((a,x)=>a+(x.unreadCount||0),0);$('dmBadge').textContent=unread;$('dmBadge').hidden=!unread;box.innerHTML=items.length?items.map(c=>'<div class="conversation '+(activeChat===c.username?'active':'')+'" data-user="'+esc(c.username)+'"><div class="avatar">'+(c.avatarUrl?'<img src="'+esc(url(c.avatarUrl))+'">':esc((c.displayName||c.username).slice(0,1).toUpperCase()))+'</div><div class="conversation-info"><strong>'+esc(c.displayName||c.username)+'</strong><small>'+esc(c.lastMessage||'Start a conversation')+'</small></div>'+(c.unreadCount?'<span class="unread">'+c.unreadCount+'</span>':'')+'</div>').join(''):'<div class="empty">No messages yet. Search a username above to start a chat.</div>';box.querySelectorAll('[data-user]').forEach(el=>el.addEventListener('click',()=>openChat(el.dataset.user)))}catch(e){box.innerHTML='<div class="empty">'+esc(e.message)+'</div>'}}
async function openChat(user){activeChat=user;$('chatName').textContent=user;$('chatAvatar').textContent=user.slice(0,1).toUpperCase();$('chatEmpty').hidden=true;$('chatActive').hidden=false;dmLayout.classList.add('chat-open');await loadMessages();loadConversations()}
async function loadMessages(){const box=$('chatMessages');box.innerHTML='<div class="loading">Loading chat…</div>';try{const d=await api('/api/messages/'+encodeURIComponent(activeChat));box.innerHTML=(d.messages||[]).map(m=>{const mine=m.sender.toLowerCase()===username.toLowerCase(),att=url(m.attachmentUrl||m.imageUrl);let media='';if(att){if(m.attachmentType==='image')media='<a href="'+esc(att)+'" target="_blank"><img src="'+esc(att)+'" alt="Attachment"></a>';else if(m.attachmentType==='video')media='<video src="'+esc(att)+'" controls playsinline></video>';else if(m.attachmentType==='audio')media='<audio src="'+esc(att)+'" controls></audio>';else media='<a href="'+esc(att)+'" target="_blank">📎 '+esc(m.attachmentName||'Download file')+'</a>'}return '<div class="bubble '+(mine?'mine':'')+'">'+media+(m.text?'<div>'+esc(m.text)+'</div>':'')+'<time>'+esc(m.createdAt?new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'')+(mine?(m.readAt?' · Seen':m.deliveredAt?' · Delivered':''):'')+'</time></div>'}).join('')||'<div class="empty">Say hello 👋</div>';box.scrollTop=box.scrollHeight}catch(e){box.innerHTML='<div class="empty">'+esc(e.message)+'</div>'}}
async function loadNotifications(){const box=$('notificationsList');box.innerHTML='<div class="loading">Loading activity…</div>';try{const d=await api('/api/notifications'),items=d.notifications||[];$('noticeBadge').textContent=d.unreadCount||'';$('noticeBadge').hidden=!(d.unreadCount);box.innerHTML=items.length?items.map(n=>'<div class="notice '+(!n.isRead?'unread-notice':'')+'" data-notice="'+esc(n.id)+'"><div class="avatar">'+esc((n.actor||'B').slice(0,1).toUpperCase())+'</div><div><p><strong>'+esc(n.actor)+'</strong> '+esc(n.kind.replace(/_/g,' '))+'</p><small>'+esc(n.createdAt?new Date(n.createdAt).toLocaleString():'')+'</small></div></div>').join(''):'<div class="empty">You are all caught up.</div>';box.querySelectorAll('[data-notice]').forEach(el=>el.addEventListener('click',async()=>{try{await api('/api/notifications/'+encodeURIComponent(el.dataset.notice)+'/read',{method:'PATCH'});el.classList.remove('unread-notice');loadNotifications()}catch(e){toast(e.message)}}))}catch(e){box.innerHTML='<div class="empty">'+esc(e.message)+'</div>'}}
async function loadProfile(){const box=$('profileCard');box.innerHTML='<div class="loading">Loading profile…</div>';try{const d=await api('/api/profile/'+encodeURIComponent(username)),p=d.profile||{};box.innerHTML='<div class="profile-avatar">'+(p.avatarUrl?'<img src="'+esc(url(p.avatarUrl))+'">':esc((p.displayName||username).slice(0,1).toUpperCase()))+'</div><h2>'+esc(p.displayName||username)+'</h2><div class="date">@'+esc(p.username||username)+' · '+esc(p.accountType||'personal')+'</div><p class="profile-bio">'+esc(p.bio||'No bio yet.')+'</p><div class="profile-stats"><div><strong>'+esc(p.postsCount||0)+'</strong><span>Posts</span></div><div><strong>'+esc(p.followersCount||0)+'</strong><span>Followers</span></div><div><strong>'+esc(p.followingCount||0)+'</strong><span>Following</span></div></div>'}catch(e){box.innerHTML='<div class="empty">'+esc(e.message)+'</div>'}}
$('authSwitchBtn').addEventListener('click',()=>setAuthMode($('signupForm').hidden?'signup':'login'));
$('iosInstallBtn').addEventListener('click',openInstallHelp);
$('installSignupBtn').addEventListener('click',openInstallHelp);
$('closeInstallHelp').addEventListener('click',closeInstallHelp);
$('installDoneBtn').addEventListener('click',closeInstallHelp);
$('installHelpModal').addEventListener('click',e=>{if(e.target===$('installHelpModal'))closeInstallHelp()});
$('signupForm').addEventListener('submit',async e=>{
 e.preventDefault();
 const b=e.currentTarget.querySelector('button[type="submit"]');
 const message=$('signupMessage');
 const password=$('signupPass').value;
 if(password!==$('signupConfirm').value){message.textContent='Passwords do not match.';return}
 b.disabled=true;message.textContent='Creating your account…';
 try{
  const d=await api('/api/auth/register',{method:'POST',body:JSON.stringify({
   full_name:$('signupName').value.trim(),username:$('signupUser').value.trim(),
   email:$('signupEmail').value.trim(),phone_number:$('signupPhone').value.trim(),password
  })});
  token=d.token;username=d.username;
  localStorage.setItem('bhumi_web_token',token);localStorage.setItem('bhumi_web_user',username);
  const accountType=$('signupType').value;
  if(accountType!=='personal'){
   await api('/api/profile/'+encodeURIComponent(username)+'/settings',{method:'PATCH',body:JSON.stringify({accountType,isPrivate:false})});
  }
  $('signupForm').reset();showApp();switchView('home');
  toast('Welcome to Bhumi Social AI!');
 }catch(err){message.textContent=err.message}
 finally{b.disabled=false}
});
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();const b=e.currentTarget.querySelector('button');b.disabled=true;$('authMessage').textContent='Signing in…';try{const d=await api('/api/auth/login',{method:'POST',body:JSON.stringify({username:$('loginUser').value.trim(),password:$('loginPass').value})});token=d.token;username=d.username;localStorage.setItem('bhumi_web_token',token);localStorage.setItem('bhumi_web_user',username);$('loginPass').value='';showApp();switchView('home')}catch(err){$('authMessage').textContent=err.message}finally{b.disabled=false}});
document.querySelectorAll('.main-tabs .tab').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
document.querySelectorAll('.content-tabs .tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.content-tabs .tab').forEach(x=>x.classList.toggle('active',x===b));currentKind=b.dataset.kind;loadFeed()}));
$('refreshBtn').addEventListener('click',()=>{if(currentView==='home')loadFeed();else if(currentView==='messages')loadConversations();else if(currentView==='notifications')loadNotifications();else loadProfile()});
$('publishBtn').addEventListener('click',async()=>{const file=$('postFile').files[0];if(!file){$('uploadMessage').textContent='Select a photo or video first.';return}const b=$('publishBtn');b.disabled=true;$('uploadMessage').textContent='Uploading…';try{const fd=new FormData();fd.append('file',file);fd.append('caption',$('postCaption').value);await api('/api/'+$('postKind').value,{method:'POST',body:fd});$('postFile').value='';$('postCaption').value='';$('uploadMessage').textContent='';currentKind=$('postKind').value;document.querySelectorAll('.content-tabs .tab').forEach(x=>x.classList.toggle('active',x.dataset.kind===currentKind));toast('Shared successfully');loadFeed()}catch(e){$('uploadMessage').textContent=e.message}finally{b.disabled=false}});
$('userSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){const name=e.currentTarget.value.trim().replace(/^@/,'');if(name&&name.toLowerCase()!==username.toLowerCase())openChat(name)}});
$('newChatBtn').addEventListener('click',()=>{$('userSearch').focus();$('userSearch').placeholder='Enter username and press Go';});
$('chatForm').addEventListener('submit',async e=>{e.preventDefault();if(!activeChat)return;const text=$('chatText').value.trim(),file=$('chatFile').files[0];if(!text&&!file)return;const b=e.currentTarget.querySelector('.send-btn');b.disabled=true;$('chatMessage').textContent='Sending…';try{let attachment={};if(file){const fd=new FormData();fd.append('file',file);const up=await api('/api/messages/upload-attachment',{method:'POST',body:fd});attachment={attachmentUrl:up.attachmentUrl,attachmentType:up.attachmentType,attachmentName:up.attachmentName,mimeType:up.mimeType,sizeBytes:up.sizeBytes}}await api('/api/messages/'+encodeURIComponent(activeChat),{method:'POST',body:JSON.stringify({text,...attachment})});$('chatText').value='';$('chatFile').value='';$('chatMessage').textContent='';await loadMessages();await loadConversations()}catch(err){$('chatMessage').textContent=err.message}finally{b.disabled=false}});
$('backInbox').addEventListener('click',()=>dmLayout.classList.remove('chat-open'));
$('readAllBtn').addEventListener('click',async()=>{try{await api('/api/notifications/read-all',{method:'PATCH'});loadNotifications()}catch(e){toast(e.message)}});
$('avatarFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;const fd=new FormData();fd.append('file',file);try{await api('/api/profile/'+encodeURIComponent(username)+'/avatar',{method:'POST',body:fd});toast('Profile photo updated');loadProfile()}catch(err){toast(err.message)}finally{e.target.value=''}});
$('logoutBtn').addEventListener('click',async()=>{try{await api('/api/auth/logout',{method:'POST'})}catch(_){}token='';username='';localStorage.removeItem('bhumi_web_token');localStorage.removeItem('bhumi_web_user');showAuth();toast('Signed out')});
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
let deferred=null;
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const isStandalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const isInAppBrowser=/WhatsApp|FBAN|FBAV|Instagram|CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent);
const isMobile=/android|iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
$('installBtn').hidden=isStandalone||!isMobile;
if(isMobile&&!isStandalone){
 $('installBtn').hidden=false;
 $('installBtn').textContent=isIOS?(isInAppBrowser?'Open in Safari to Install':'Install on iPhone'):'Install App';
 $('installBtn').setAttribute('aria-label','Show Bhumi Social AI installation steps');
 $('installSignupBtn').hidden=false;
 $('installSignupBtn').textContent=isIOS?'Install Bhumi Social AI on iPhone':'Install Bhumi Social AI';
}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;$('installBtn').hidden=false});
$('installBtn').addEventListener('click',async()=>{if(isIOS||!deferred){openInstallHelp();return}deferred.prompt();await deferred.userChoice;deferred=null;$('installBtn').hidden=true});
setAuthMode('login');
async function init(){if(!token){showAuth();return}try{const d=await api('/api/auth/me');username=d.username||username;localStorage.setItem('bhumi_web_user',username);showApp();switchView('home')}catch(_){token='';localStorage.removeItem('bhumi_web_token');showAuth()}}init();
})();