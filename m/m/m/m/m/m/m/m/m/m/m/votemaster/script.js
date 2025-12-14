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

if(localStorage.getItem('v_theme')){
  document.documentElement.setAttribute('data-theme', localStorage.getItem('v_theme'));
}

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

function saveHistory(arr){
  localStorage.setItem(KEY_HISTORY, JSON.stringify(arr));
}

/* ===========================
   CREATE PAGE
   =========================== */

function addOption(name){
  if(!name) return;
  const list = document.getElementById('optionsList');
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <input class="option-input" type="text" value="${escapeHtml(name)}">
    <button class="btn btn-ghost small" onclick="removeNode(this)">Remove</button>
  `;
  list.appendChild(row);
}

function addRole(){
  const list = document.getElementById('rolesList');
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <input class="role-name" placeholder="Role name">
    <input class="role-amount small" type="number" min="0" placeholder="Uses">
    <select class="role-type">
      <option value="normal">Normal</option>
      <option value="notallowed">Cannot vote for option</option>
      <option value="multiplier">Multiplier</option>
      <option value="halfvote">Half vote</option>
      <option value="tiebreaker">Tiebreaker</option>
    </select>
    <select class="role-extra" style="display:none"></select>
    <button class="btn btn-ghost small" onclick="removeNode(this)">Remove</button>
  `;
  list.appendChild(row);

  const type = row.querySelector('.role-type');
  const extra = row.querySelector('.role-extra');

  type.addEventListener('change',()=>{
    extra.innerHTML='';
    if(type.value==='notallowed'){
      document.querySelectorAll('.option-input').forEach(o=>{
        if(o.value){
          const opt=document.createElement('option');
          opt.text=o.value;
          extra.add(opt);
        }
      });
      extra.style.display='inline-block';
    }
    else if(type.value==='multiplier'){
      ['2','3','4','5'].forEach(n=>{
        const opt=document.createElement('option');
        opt.text=n;
        extra.add(opt);
      });
      extra.style.display='inline-block';
    }
    else{
      extra.style.display='none';
    }
  });
}

function removeNode(btn){
  const row = btn.closest('.item-row');
  if(row) row.remove();
}

function startVoteFromCreator(){
  const title = document.getElementById('voteTitle').value.trim();
  if(!title) return alert("Enter poll title");

  const options = [...document.querySelectorAll('.option-input')]
    .map(o=>o.value.trim()).filter(Boolean);
  if(!options.length) return alert("Add options");

  const roles = [...document.querySelectorAll('#rolesList .item-row')].map(r=>({
    name: r.querySelector('.role-name').value.trim(),
    amount: Number(r.querySelector('.role-amount').value)||0,
    type: r.querySelector('.role-type').value,
    extra: r.querySelector('.role-extra').value||null
  }));

  saveCurrent({
    id: Date.now(),
    title,
    options,
    roles,
    votes: [],
    created: new Date().toISOString()
  });

  go('current.html');
}

/* ===========================
   CURRENT PAGE
   =========================== */

let selectedRoleIndex=null;

function renderCurrentCard(){
  const box=document.getElementById('currentCard');
  if(!box) return;

  const cur=loadCurrent();
  if(!cur){
    box.innerHTML='<div class="tiny">No active vote</div>';
    return;
  }

  box.innerHTML=`
    <b>${escapeHtml(cur.title)}</b>
    <div class="divider"></div>
    ${cur.options.map((o,i)=>
      `<button class="btn btn-primary vote-btn" onclick="castVote(${i})">${escapeHtml(o)}</button>`
    ).join('')}
    <div class="divider"></div>
    <button class="btn btn-ghost" onclick="endActiveVote()">End Vote</button>
  `;
}

function castVote(i){
  const c=loadCurrent();
  if(!c) return;
  c.votes.push({optionIdx:i,weight:1,ts:Date.now()});
  saveCurrent(c);
  renderCurrentCard();
}

function endActiveVote(){
  const c=loadCurrent();
  if(!c) return;

  const totals=c.options.map(()=>0);
  c.votes.forEach(v=>totals[v.optionIdx]+=v.weight||1);

  const rec={
    id:Date.now(),
    title:c.title,
    created:c.created,
    ended:new Date().toISOString(),
    options:c.options.map((l,i)=>({label:l,votes:totals[i]})),
    roles:c.roles,
    voteLog:c.votes
  };

  const h=loadHistory();
  h.unshift(rec);
  saveHistory(h);
  saveCurrent(null);
  go('past.html');
}

/* ===========================
   PAST PAGE
   =========================== */

function renderPastList(){
  const box=document.getElementById('pastList');
  if(!box) return;

  const h=loadHistory();
  if(!h.length){
    box.innerHTML='<div class="tiny">No past votes</div>';
    return;
  }

  box.innerHTML='';
  h.forEach((r,i)=>{
    const d=document.createElement('div');
    d.className='item-row';
    d.innerHTML=`
      <div>${escapeHtml(r.title)}</div>
      <button onclick="openView(${i})">View</button>
    `;
    box.appendChild(d);
  });
}

function openView(i){
  localStorage.setItem('v_view_idx',i);
  go('view.html');
}

function renderViewPage(){
  const box=document.getElementById('viewCard');
  if(!box) return;

  const i=Number(localStorage.getItem('v_view_idx'));
  const h=loadHistory();
  const r=h[i];
  if(!r){ box.textContent="Not found"; return; }

  box.innerHTML=r.options.map(o=>
    `<div>${escapeHtml(o.label)} — ${o.votes}</div>`
  ).join('');
}

/* ===========================
   SHARE LINK (FIXED)
   =========================== */

let share_lastLink="";

function xorEncrypt(t,k){
  return [...t].map((c,i)=>
    String.fromCharCode(c.charCodeAt(0)^k.charCodeAt(i%k.length))
  ).join('');
}
const xorDecrypt=xorEncrypt;

function showShareLinkPopup(){
  const cur=loadCurrent();
  if(!cur) return alert("No active vote");

  const pw=prompt("Optional password (leave blank for none):");
  let payload;

  if(pw){
    payload=btoa(JSON.stringify({
      protected:true,
      data:xorEncrypt(JSON.stringify(cur),pw)
    }));
  }else{
    payload=btoa(JSON.stringify(cur));
  }

  const link=location.origin+location.pathname+"?data="+encodeURIComponent(payload);
  share_lastLink=link;

  document.getElementById('share_link').value=link;
  document.getElementById('share_popup').style.display='block';
}

function importVoteFromLink(){
  const p=new URLSearchParams(location.search);
  if(!p.has('data')) return;

  try{
    const raw=JSON.parse(atob(p.get('data')));
    if(raw.protected){
      const pw=prompt("Password?");
      if(!pw) return;
      saveCurrent(JSON.parse(xorDecrypt(raw.data,pw)));
    }else{
      saveCurrent(raw);
    }
  }catch(e){
    alert("Invalid link");
  }
}

/* ===========================
   INIT
   =========================== */

document.addEventListener('DOMContentLoaded',()=>{
  importVoteFromLink();
  renderCurrentCard();
  renderPastList();
  renderViewPage();
});

function escapeHtml(s){
  return String(s||'').replace(/[&<>]/g,m=>({
    '&':'&amp;','<':'&lt;','>':'&gt;'
  }[m]));
}
