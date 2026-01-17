const API = "https://bearbunch-backend-1.onrender.com";

/* ================= AUTO LOGIN ================= */

document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if (!token) return;

  console.log("🔁 Token found, attempting auto-login");

  try {
    const res = await fetch(`${API}/admin/users`, {
      headers: {
        "Authorization": token
      }
    });

    if (res.status === 401) throw new Error("Invalid token");

    const users = await res.json();
    console.log("✅ Auto-login success");

    localStorage.setItem("role", "admin");
    showAdminDashboard(users);

  } catch (err) {
    console.warn("❌ Auto-login failed, clearing token");
    localStorage.removeItem("token");
    localStorage.removeItem("role");
  }
});

/* ================= LOGIN ================= */

async function login() {
  const username = document.getElementById("loginuser").value;
  const password = document.getElementById("loginpass").value;

  try {
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    localStorage.setItem("token", data.token);
    localStorage.setItem("role", data.role);
    localStorage.setItem("username", data.username);

    console.log("✅ Login success");

    if (data.role === "admin") {
      loadAdmin();
    } else {
      window.location.href = "/view/index.html";
    }

  } catch (err) {
    alert(err.message || "Login failed");
  }
}

/* ================= REGISTER ================= */

async function register() {
  const username = document.getElementById("reg-username").value;
  const email = document.getElementById("reg-email").value;
  const password = document.getElementById("reg-password").value;

  try {
    const res = await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    alert("Registered successfully. Please login.");

  } catch (err) {
    alert(err.message || "Register failed");
  }
}

/* ================= ADMIN ================= */

async function loadAdmin() {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API}/admin/users`, {
    headers: { Authorization: token }
  });

  const users = await res.json();
  showAdminDashboard(users);
}

function showAdminDashboard(users) {
  document.getElementById("auth-section").style.display = "none";
  const dash = document.getElementById("admin-dashboard");
  dash.style.display = "block";

  const list = document.getElementById("user-list");
  list.innerHTML = "";

  users.forEach(u => {
    const li = document.createElement("li");
    li.innerHTML = `
      <b>${u.username}</b> (${u.role})
      <button onclick="terminateUser('${u.username}')">Terminate</button>
    `;
    list.appendChild(li);
  });
}

async function terminateUser(username) {
  if (!confirm(`Terminate ${username}?`)) return;

  const token = localStorage.getItem("token");

  const res = await fetch(`${API}/admin/terminate-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": token
    },
    body: JSON.stringify({ username })
  });

  const data = await res.json();
  if (!res.ok) return alert(data.error);

  loadAdmin();
}

/* ================= LOGOUT ================= */

function logout() {
  localStorage.clear();
  location.reload();
}

/* ================= KEEP RENDER AWAKE ================= */

setInterval(() => {
  fetch(`${API}/ping`, { method: "POST" }).catch(() => {});
}, 30000);
/* ===========================
   GLOBAL SETTINGS
=========================== */

const BACKEND_URL = "https://bearbunch-backend-1.onrender.com";
const KEEP_ALIVE_INTERVAL = 30000; // 30s
const MAX_REQUEST_TIME = 120000; // 2min

/* ===========================
   UTILITY FUNCTIONS
=========================== */

function go(path){ location.href = path; }

function toggleTheme(){
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('v_theme', next);
}
if(localStorage.getItem('v_theme'))
  document.documentElement.setAttribute('data-theme', localStorage.getItem('v_theme'));

function escapeHtml(s){ return String(s||'').replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m])); }

function fetchWithTimeout(url,opts={},timeout=MAX_REQUEST_TIME){
  return Promise.race([
    fetch(url,opts),
    new Promise((_,rej)=>setTimeout(()=>rej(new Error("Timeout")),timeout))
  ]);
}

/* ===========================
   LOCAL STORAGE
=========================== */

const KEY_CURRENT = 'vapp_current';
const KEY_HISTORY = 'vapp_history';

function loadCurrent(){ try { return JSON.parse(localStorage.getItem(KEY_CURRENT) || 'null'); } catch(e){ return null; } }
function saveCurrent(obj){ if(obj) localStorage.setItem(KEY_CURRENT, JSON.stringify(obj)); else localStorage.removeItem(KEY_CURRENT); }

function loadHistory(){ try { return JSON.parse(localStorage.getItem(KEY_HISTORY) || '[]'); } catch(e){ return []; } }
function saveHistory(arr){ localStorage.setItem(KEY_HISTORY, JSON.stringify(arr)); }

function addPastIfMissing(v){
  const history = loadHistory();
  if(!history.find(h=>h.id===v.id)){ history.unshift(v); saveHistory(history); }
}

/* ===========================
   XOR ENCRYPTION
=========================== */

function xorEncrypt(text,key){
  return [...text].map((c,i)=>String.fromCharCode(c.charCodeAt(0)^key.charCodeAt(i%key.length))).join('');
}
function xorDecrypt(text,key){ return xorEncrypt(text,key); }

/* ===========================
   LOGIN CHECK
=========================== */

function loggedIn(){
  const token = localStorage.getItem("auth_token");
  return !!token;
}

/* ===========================
   KEEP ALIVE
=========================== */

setInterval(()=>{
  fetch(BACKEND_URL+"/ping",{method:"POST"}).catch(()=>{});
},KEEP_ALIVE_INTERVAL);

/* ===========================
   CREATE PAGE FUNCTIONS
=========================== */

function addOption(name){
  if(!name) return;
  const list = document.getElementById('optionsList') || document.getElementById('optionsContainer');
  if(!list) return;
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <input class="option-input" type="text" value="${escapeHtml(name)}" placeholder="Option name">
    <button class="btn btn-ghost small" onclick="removeNode(this)">Remove</button>
  `;
  list.appendChild(row);
}

function addRole(){
  const rolesList = document.getElementById('rolesList') || document.getElementById('rolesContainer');
  if(!rolesList) return;
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <input class="role-name" type="text" placeholder="Role name">
    <input class="role-amount small" type="number" placeholder="Uses (blank = unlimited)" min="0">
    <select class="role-type">
      <option value="normal">Normal</option>
      <option value="notallowed">Cannot vote for option</option>
      <option value="multiplier">Multiplier</option>
      <option value="tiebreaker">Tiebreaker</option>
      <option value="halfvote">Half vote</option>
    </select>
    <select class="role-extra" style="display:none;"></select>
    <button class="btn btn-ghost small" onclick="removeNode(this)">Remove</button>
  `;
  rolesList.appendChild(row);

  const typeSelect = row.querySelector('.role-type');
  const extraSelect = row.querySelector('.role-extra');

  typeSelect.addEventListener('change',()=>{
    const type = typeSelect.value;
    extraSelect.innerHTML='';
    if(type==='notallowed'){
      const options = Array.from(document.querySelectorAll('#optionsList .option-input, #optionsContainer .option-input')).map(o=>o.value).filter(v=>v);
      options.forEach(o=>{ const opt = document.createElement('option'); opt.value=opt.text=o; extraSelect.add(opt); });
      extraSelect.style.display = options.length ? 'inline-block':'none';
    } else if(type==='multiplier'){
      ['2','3','4','5'].forEach(x=>{ const opt=document.createElement('option'); opt.value=x; opt.text=x; extraSelect.add(opt); });
      extraSelect.style.display='inline-block';
    } else extraSelect.style.display='none';
  });
}

function removeNode(btn){ const row=btn.closest('.item-row'); if(row) row.remove(); }

/* ===========================
   CURRENT VOTE
=========================== */

let selectedRoleIndex = null;

function renderCurrentCard(){
  const container = document.getElementById('currentCard');
  if(!container) return;
  const current = loadCurrent();
  if(!current){ container.innerHTML='<div class="tiny">No active vote</div>'; return; }

  container.innerHTML = `
    <div style="font-weight:800">${escapeHtml(current.title)}</div>
    <div class="tiny">Created: ${new Date(current.created).toLocaleString()}</div>
    <div class="divider"></div>
    <div class="tiny">Choose role (if any) then vote</div>
    <div style="margin-top:8px" id="currentRoles">
      ${current.roles.map((r,i)=>`<button class="btn btn-ghost small" onclick="selectRole(${i})">${escapeHtml(r.name)}${r.amount?` (${r.amount})`:''}</button>`).join('')}
    </div>
    <div class="divider"></div>
    <div id="currentOptions">
      ${current.options.map((o,i)=>`<button class="btn btn-primary vote-btn" style="display:block;margin:6px 0;" onclick="castVote(${i})">${escapeHtml(o)}</button>`).join('')}
    </div>
    <div class="divider"></div>
    <div class="row">
      <button class="btn btn-ghost" onclick="endActiveVote()">End Vote</button>
      <button class="btn btn-ghost" onclick="resetActiveVote()">Reset Votes</button>
      <button class="btn btn-ghost" onclick="showShareLinkPopup()">Share</button>
    </div>
  `;
}

function selectRole(idx){ selectedRoleIndex=idx; }

function castVote(optionIdx){
  const current=loadCurrent(); if(!current) return;

  let weight=1, applied=true;
  let role = selectedRoleIndex!==null ? current.roles[selectedRoleIndex] : null;
  if(role){
    switch(role.type){
      case 'notallowed': if(role.extra===current.options[optionIdx]) applied=false; break;
      case 'multiplier': weight=Number(role.extra)||2; break;
      case 'halfvote': weight=0.5; break;
      case 'tiebreaker': weight=0; break;
    }
  }
  if(!applied) return;

  current.votes.push({ optionIdx, weight, roleIndex:selectedRoleIndex, ts:Date.now() });
  saveCurrent(current);
  renderCurrentCard();

  // Send to backend asynchronously if logged in
  if(loggedIn()){
    fetchWithTimeout(BACKEND_URL+"/votes",{
      method:"POST",
      headers:{'Content-Type':'application/json','Authorization':localStorage.getItem("auth_token")},
      body:JSON.stringify({vote: btoa(JSON.stringify(current))})
    }).catch(()=>{});
  }
}

function endActiveVote(){
  const current=loadCurrent(); if(!current) return;
  const totals=current.options.map(_=>0); const tiebreakers=[];
  current.votes.forEach(v=>{
    const role=v.roleIndex!==null ? current.roles[v.roleIndex] : null;
    if(role && role.type==='tiebreaker') tiebreakers.push(v);
    else totals[v.optionIdx]+=(v.weight||1);
  });

  const maxVal=Math.max(...totals);
  const tied=totals.reduce((acc,val,i)=>{ if(val===maxVal) acc.push(i); return acc; },[]);
  tiebreakers.forEach(tb=>{ if(tied.includes(tb.optionIdx)) totals[tb.optionIdx]+=1; });

  const snapshot={id:Date.now(),title:current.title,created:current.created,ended:new Date().toISOString(),
                  options:current.options.map((label,i)=>({label,votes:totals[i]})),
                  roles:current.roles,voteLog:current.votes};

  const history=loadHistory(); history.unshift(snapshot); saveHistory(history);
  saveCurrent(null); go('past.html');
}

function resetActiveVote(){ const c=loadCurrent(); if(!c) return; c.votes=[]; saveCurrent(c); renderCurrentCard(); }

/* ===========================
   SHARE LINK
=========================== */

let share_lastLink = "";

function showShareLinkPopup(){
  const cur = loadCurrent(); if(!cur) return alert("No active vote");
  let pw = prompt("Optional password (leave blank for none):");
  let payload;
  if(pw){ payload = btoa(JSON.stringify({ protected:true, data:xorEncrypt(JSON.stringify(cur),pw) })); }
  else payload = btoa(JSON.stringify(cur));
  const link = location.origin + location.pathname + "?data=" + encodeURIComponent(payload);
  share_lastLink = link;
  const linkInput = document.getElementById('share_link'); if(linkInput) linkInput.value = link;
  const popup = document.getElementById('share_popup'); if(popup) popup.style.display='block';
}

function share_copy(){ if(!share_lastLink) return alert("No link to copy"); navigator.clipboard.writeText(share_lastLink).then(()=>alert("Link copied!")); }
function share_close(){ const popup = document.getElementById('share_popup'); const qr = document.getElementById('share_qr'); if(popup) popup.style.display='none'; if(qr){ qr.style.display='none'; qr.innerHTML=''; } }
function share_showQR(){ if(!share_lastLink) return alert("No link to generate QR"); const box = document.getElementById("share_qr"); if(!box) return; box.innerHTML = ""; box.style.display='block'; new QRCode(box,{text:share_lastLink,width:200,height:200}); }

/* ===========================
   IMPORT VOTE FROM LINK
=========================== */

function importVoteFromLink(){
  const p = new URLSearchParams(location.search);
  if(!p.has('data')) return;
  try {
    const raw = atob(p.get('data'));
    let decoded;
    if(raw.startsWith("{") && raw.includes('"protected":')){
      const wrapper = JSON.parse(raw);
      if(!wrapper.protected) return;
      let ipwd=null, success=false;
      while(!success){
        ipwd = prompt("Enter password to unlock vote:"); if(ipwd===null) break;
        try{ decoded = JSON.parse(xorDecrypt(wrapper.data,ipwd)); success=true; } catch(e){ alert("Incorrect password"); }
      }
    } else decoded = JSON.parse(raw);
    saveCurrent(decoded);
  } catch(e){ console.error(e); alert("Invalid vote link"); }
}

/* ===========================
   INIT
=========================== */

document.addEventListener('DOMContentLoaded',()=>{
  importVoteFromLink();
  renderCurrentCard();
});
