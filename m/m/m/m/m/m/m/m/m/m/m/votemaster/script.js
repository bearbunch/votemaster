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
  row.innerHTML = `<input class="option-input" type="text" value="${escapeHtml(name)}" placeholder="Option name">
                   <button class="btn btn-ghost small" onclick="removeNode(this)">Remove</button>`;
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

  const current = { id: Date.now(), title, options, roles, votes: [], created: new Date().toISOString() };
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
    </div>
  `;
}

function selectRole(idx){ selectedRoleIndex=idx; }

function castVote(optionIdx){
  const current=loadCurrent(); if(!current) return;
  const buttons=document.querySelectorAll('#currentOptions .vote-btn');
  buttons.forEach(b=>{ b.disabled=true; b.style.background='gray'; b.style.opacity='0.6'; b.style.cursor='not-allowed'; });
  setTimeout(()=>{ buttons.forEach(b=>{ b.disabled=false; b.style.background=''; b.style.opacity=''; b.style.cursor='pointer'; }); },2000);

  let weight=1; let applied=true;
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
   PAST & VIEW FUNCTIONS
   =========================== */
function renderPastList(){
  const box=document.getElementById('pastList'); if(!box) return;
  const history=loadHistory();
  if(!history.length){ box.innerHTML='<div class="tiny">No past votes</div>'; return; }
  box.innerHTML='';
  history.forEach((h,idx)=>{
    const el=document.createElement('div'); el.className='item-row';
    el.innerHTML=`<div><div style="font-weight:700">${escapeHtml(h.title)}</div><div class="tiny">${new Date(h.ended).toLocaleString()}</div></div>
                  <div style="display:flex;gap:8px">
                    <button class="btn btn-ghost small" onclick="openView(${idx})">View</button>
                    <button class="btn btn-ghost small" onclick="downloadCSV_index(${idx})">CSV</button>
                  </div>`;
    box.appendChild(el);
  });
}

function openView(idx){ localStorage.setItem('v_view_idx', String(idx)); go('view.html'); }
function clearHistory(){ if(!confirm('Clear all past votes?')) return; saveHistory([]); renderPastList(); }

function renderViewPage(){
  const idx=Number(localStorage.getItem('v_view_idx')||-1); 
  const history=loadHistory();
  if(idx<0||idx>=history.length){ document.getElementById('viewCard').innerHTML='<div class="tiny">Not found</div>'; return; }
  const rec=history[idx];
  document.getElementById('viewCard').innerHTML=`
    <div style="font-weight:800">${escapeHtml(rec.title)}</div>
    <div class="tiny">Ended: ${new Date(rec.ended).toLocaleString()}</div>
    <div class="divider"></div>
    ${rec.options.map(o=>`<div class="result-row"><div>${escapeHtml(o.label)}</div><div>${o.votes}</div></div>`).join('')}
  `;
}

/* ===========================
   CSV EXPORT HELPERS
   =========================== */
function triggerDownloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadCSV_viewRecord(){ 
  const idx = Number(localStorage.getItem('v_view_idx') || -1);
  const rec = loadHistory()[idx]; if(!rec) return alert("No data to export!");
  let csv=`Title,"${(rec.title||'').replace(/"/g,'""')}"\nCreated,"${rec.created}"\nEnded,"${rec.ended}"\n\nOption,Total Votes\n`;
  rec.options.forEach(o=>{ csv+=`"${o.label.replace(/"/g,'""')}",${o.votes}\n`; });
  csv+="\nRole Name,Type,Amount,Extra\n";
  (rec.roles||[]).forEach(r=>{ csv+=`"${(r.name||'').replace(/"/g,'""')}",${r.type},${r.amount},${r.extra}\n`; });
  csv+="\nTimestamp,Option,Role Used,Weight\n";
  (rec.voteLog||[]).forEach(v=>{ 
    const time=new Date(v.ts).toLocaleString();
    const opt=rec.options[v.optionIdx]?.label||"";
    const role=rec.roles[v.roleIndex]?.name||"";
    csv+=`"${time}","${opt}","${role}",${v.weight}\n`;
  });
  const filename=rec.title.replace(/[^\w\-]+/g,"_")+".csv";
  triggerDownloadBlob(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}), filename);
}

function downloadCSV_index(idx){ 
  const rec=loadHistory()[idx]; if(!rec) return alert("No data to export!");
  let csv=`Title,"${(rec.title||'').replace(/"/g,'""')}"\nCreated,"${rec.created}"\nEnded,"${rec.ended}"\n\nOption,Total Votes\n`;
  rec.options.forEach(o=>{ csv+=`"${o.label.replace(/"/g,'""')}",${o.votes}\n`; });
  csv+="\nRole Name,Type,Amount,Extra\n";
  (rec.roles||[]).forEach(r=>{ csv+=`"${(r.name||'').replace(/"/g,'""')}",${r.type},${r.amount},${r.extra}\n`; });
  csv+="\nTimestamp,Option,Role Used,Weight\n";
  (rec.voteLog||[]).forEach(v=>{ 
    const time=new Date(v.ts).toLocaleString();
    const opt=rec.options[v.optionIdx]?.label||"";
    const role=rec.roles[v.roleIndex]?.name||"";
    csv+=`"${time}","${opt}","${role}",${v.weight}\n`;
  });
  const filename=rec.title.replace(/[^\w\-]+/g,"_")+".csv";
  triggerDownloadBlob(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}), filename);
}

/* ===========================
   SHARE LINK / XOR ENCRYPTION
   =========================== */
let share_lastLink="";

function xorEncrypt(t,k){
  return [...t].map((c,i)=>String.fromCharCode(c.charCodeAt(0)^k.charCodeAt(i%k.length))).join('');
}
const xorDecrypt=xorEncrypt;

function showShareLinkPopup(){
  const cur=loadCurrent();
  if(!cur) return alert("No active vote");
  const pw=prompt("Optional password (leave blank for none):");
  let payload;
  if(pw){
    payload=btoa(JSON.stringify({protected:true,data:xorEncrypt(JSON.stringify(cur),pw)}));
  } else payload=btoa(JSON.stringify(cur));
  const link=location.origin+location.pathname+"?data="+encodeURIComponent(payload);
  share_lastLink=link;
  document.getElementById('share_link').value=link;
  document.getElementById('share_popup').style.display='block';
}

function share_copy(){ navigator.clipboard.writeText(share_lastLink); }
function share_close(){
  document.getElementById('share_popup').style.display='none';
  document.getElementById('share_qr').style.display='none';
  document.getElementById('share_qr').innerHTML='';
}

function share_showQR(){
  const box=document.getElementById('share_qr');
  box.style.display='block';
  box.innerHTML='';
  new QRCode(box,{ text: share_lastLink, width: 200, height: 200 });
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
    } else saveCurrent(raw);
  } catch(e){ alert("Invalid link"); }
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
