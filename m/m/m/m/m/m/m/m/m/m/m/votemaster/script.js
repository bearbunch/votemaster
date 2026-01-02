/* ===========================
   COMMON UTILITIES
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

const KEY_CURRENT = 'vapp_current';
const KEY_HISTORY = 'vapp_history';

function loadCurrent(){ 
  try { return JSON.parse(localStorage.getItem(KEY_CURRENT) || 'null'); } 
  catch(e){ return null; } 
}

function saveCurrent(obj){ 
  if(obj) localStorage.setItem(KEY_CURRENT, JSON.stringify(obj)); 
  else localStorage.removeItem(KEY_CURRENT); 
}

function loadHistory(){ 
  try { return JSON.parse(localStorage.getItem(KEY_HISTORY) || '[]'); } 
  catch(e){ return []; } 
}

function saveHistory(arr){ localStorage.setItem(KEY_HISTORY, JSON.stringify(arr)); }

function escapeHtml(s){ 
  return String(s||'').replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m])); 
}

/* ===========================
   CREATE PAGE FUNCTIONS
   =========================== */

function addOption(name){
  if(!name) return;
  const list = document.getElementById('optionsList');
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <input class="option-input" type="text" value="${escapeHtml(name)}" placeholder="Option name">
    <button class="btn btn-ghost small" onclick="removeNode(this)">Remove</button>
  `;
  list.appendChild(row);
}

function addRole(){
  const rolesList = document.getElementById('rolesList');
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
      const options = Array.from(document.querySelectorAll('#optionsList .option-input')).map(o=>o.value).filter(v=>v);
      options.forEach(o=>{
        const opt = document.createElement('option'); opt.value=opt.text=o; extraSelect.add(opt);
      });
      extraSelect.style.display = options.length ? 'inline-block':'none';
    } else if(type==='multiplier'){
      ['2','3','4','5'].forEach(x=>{ const opt=document.createElement('option'); opt.value=x; opt.text=x; extraSelect.add(opt); });
      extraSelect.style.display='inline-block';
    } else extraSelect.style.display='none';
  });
}

function removeNode(btn){ 
  const row = btn.closest('.item-row'); 
  if(row) row.remove(); 
}

function startVoteFromCreator(){
  const titleEl = document.getElementById('voteTitle');
  const title = titleEl.value.trim();
  if(!title) return alert('Enter poll title');

  const optionsEls = Array.from(document.querySelectorAll('#optionsList .option-input'));
  const options = optionsEls.map(o=>o.value.trim()).filter(o=>o);
  if(!options.length) return alert('Add at least one option');

  const rolesEls = Array.from(document.querySelectorAll('#rolesList .item-row'));
  const roles = rolesEls.map(r=>{
    const name = r.querySelector('.role-name').value.trim();
    const amount = Number(r.querySelector('.role-amount').value) || 0;
    const type = r.querySelector('.role-type').value;
    const extra = r.querySelector('.role-extra').value || null;
    return { name, amount, type, extra };
  });

  const current = {
    id: Date.now(),
    title,
    options,
    roles,
    votes: [],
    created: new Date().toISOString()
  };
  saveCurrent(current);
  go('current.html');
}

/* ===========================
   CURRENT PAGE FUNCTIONS
   =========================== */

let selectedRoleIndex = null;

function renderCurrentCard(){
  const container = document.getElementById('currentCard');
  if(!container) return;
  const current = loadCurrent();
  if(!current){
    container.innerHTML='<div class="tiny">No active vote</div>';
    return;
  }

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
      case 'notallowed':
        if(role.extra===current.options[optionIdx]) applied=false;
        break;
      case 'multiplier': weight=Number(role.extra)||2; break;
      case 'halfvote': weight=0.5; break;
      case 'tiebreaker': weight=0; break;
    }
  }
  if(!applied) return;

  current.votes.push({ optionIdx, weight, roleIndex:selectedRoleIndex, ts:Date.now() });
  saveCurrent(current);
  renderCurrentCard();
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

  const snapshot={
    id:Date.now(),
    title:current.title,
    created:current.created,
    ended:new Date().toISOString(),
    options:current.options.map((label,i)=>({label,votes:totals[i]})),
    roles:current.roles,
    voteLog: current.votes
  };

  const history=loadHistory(); history.unshift(snapshot); saveHistory(history);
  saveCurrent(null); go('past.html');
}

function resetActiveVote(){ const c=loadCurrent(); if(!c) return; c.votes=[]; saveCurrent(c); renderCurrentCard(); }

/* ===========================
   SHARE LINK FUNCTIONS
   =========================== */

let share_lastLink = "";

function xorEncrypt(text, key){
  return [...text].map((c,i)=>String.fromCharCode(c.charCodeAt(0)^key.charCodeAt(i%key.length))).join('');
}
function xorDecrypt(text, key){ return xorEncrypt(text,key); }

function showShareLinkPopup(){
  const cur = loadCurrent();
  if(!cur) return alert("No active vote");

  let pw = prompt("Optional password (leave blank for none):");
  let payload;
  if(pw){
    payload = btoa(JSON.stringify({ protected:true, data:xorEncrypt(JSON.stringify(cur),pw) }));
  } else {
    payload = btoa(JSON.stringify(cur));
  }

  const link = location.origin + location.pathname + "?data=" + encodeURIComponent(payload);
  share_lastLink = link;

  const linkInput = document.getElementById('share_link');
  if(linkInput) linkInput.value = link;
  const popup = document.getElementById('share_popup');
  if(popup) popup.style.display='block';
}

function share_copy(){
  if(!share_lastLink) return alert("No link to copy");
  try{
    navigator.clipboard.writeText(share_lastLink).then(()=>alert("Link copied!"));
  }catch(e){ alert("Copy failed, select manually"); }
}

function share_close(){
  const popup = document.getElementById('share_popup');
  const qr = document.getElementById('share_qr');
  if(popup) popup.style.display='none';
  if(qr){ qr.style.display='none'; qr.innerHTML=''; }
}

function share_showQR(){
  if(!share_lastLink) return alert("No link to generate QR");
  const box = document.getElementById("share_qr");
  if(!box) return;
  box.innerHTML = "";
  box.style.display='block';
  new QRCode(box,{text:share_lastLink,width:200,height:200});
}

/* ===========================
   IMPORT VOTE FROM LINK
   =========================== */

function importVoteFromLink(){
  const p = new URLSearchParams(location.search);
  if(!p.has('data')) return;

  try{
    const raw = atob(p.get('data'));
    let decoded;

    if(raw.startsWith("{") && raw.includes('"protected":')){
      const wrapper = JSON.parse(raw);
      if(!wrapper.protected) return;

      // Keep prompting until correct password
      while(true){
        const pw = prompt("Enter password to unlock vote:");
        if(pw === null){
          alert("Password required to open vote.");
          continue;
        }
        try{
          const decrypted = xorDecrypt(wrapper.data,pw);
          decoded = JSON.parse(decrypted);
          break;
        }catch(e){
          alert("Incorrect password. Please try again.");
        }
      }
    }else{
      decoded = JSON.parse(raw);
    }

    saveCurrent(decoded);
  }catch(e){
    console.error(e);
    alert("Invalid or corrupted vote link.");
  }
}

/* ===========================
   INIT ON LOAD
   =========================== */

document.addEventListener('DOMContentLoaded',()=>{
  importVoteFromLink();
  renderCurrentCard();
});
