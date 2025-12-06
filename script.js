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

function loadCurrent(){ try { return JSON.parse(localStorage.getItem(KEY_CURRENT) || 'null'); } catch(e){ return null; } }
function saveCurrent(obj){ if(obj) localStorage.setItem(KEY_CURRENT, JSON.stringify(obj)); else localStorage.removeItem(KEY_CURRENT); }
function loadHistory(){ try { return JSON.parse(localStorage.getItem(KEY_HISTORY) || '[]'); } catch(e){ return []; } }
function saveHistory(arr){ localStorage.setItem(KEY_HISTORY, JSON.stringify(arr)); }

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

  // dynamically show extra field
  const typeSelect = row.querySelector('.role-type');
  const extraSelect = row.querySelector('.role-extra');

  typeSelect.addEventListener('change',()=>{
    const type = typeSelect.value;
    if(type==='notallowed'){
      // blocked options
      extraSelect.innerHTML = '';
      const options = Array.from(document.querySelectorAll('#optionsList .option-input')).map(o=>o.value).filter(v=>v);
      options.forEach(o=>{
        const opt = document.createElement('option'); opt.value=opt.text=o; extraSelect.add(opt);
      });
      extraSelect.style.display = options.length ? 'inline-block':'none';
    } else if(type==='multiplier'){
      extraSelect.innerHTML='';
      ['2','3','4','5'].forEach(x=>{ const opt=document.createElement('option'); opt.value=x; opt.text=x; extraSelect.add(opt); });
      extraSelect.style.display='inline-block';
    } else extraSelect.style.display='none';
  });
}

function removeNode(btn){ const row = btn.closest('.item-row'); if(row) row.remove(); }

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
    id:Date.now(), title:current.title, created:current.created, ended:new Date().toISOString(),
    options:current.options.map((label,i)=>({label,votes:totals[i]})), roles:current.roles
  };

  const history=loadHistory(); history.unshift(snapshot); saveHistory(history);
  saveCurrent(null); go('past.html');
}

function resetActiveVote(){ const c=loadCurrent(); if(!c) return; c.votes=[]; saveCurrent(c); renderCurrentCard(); }

/* ===========================
   PAST PAGE FUNCTIONS
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
  const idx=Number(localStorage.getItem('v_view_idx')||-1); const history=loadHistory();
  if(idx<0||idx>=history.length){ document.getElementById('viewCard').innerHTML='<div class="tiny">Not found</div>'; return; }
  const rec=history[idx];
  document.getElementById('viewCard').innerHTML=`
    <div style="font-weight:800">${escapeHtml(rec.title)}</div>
    <div class="tiny">Ended: ${new Date(rec.ended).toLocaleString()}</div>
    <div class="divider"></div>
    ${rec.options.map(o=>`<div class="result-row"><div>${escapeHtml(o.label)}</div><div>${o.votes}</div></div>`).join('')}
  `;
}

function downloadCSV_index(idx){
  const history=loadHistory(); const rec=history[idx]; if(!rec) return;
  let csv='Option,Count\n';
  rec.options.forEach(o=>csv+=`"${o.label}",${o.votes}\n`);
  triggerDownloadBlob(csv, `${rec.title.replace(/[^\w\-]+/g,'_')}.csv`);
}

function triggerDownloadBlob(text,filename){
  const blob=new Blob([text],{type:'text/csv'}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); },300);
}

function escapeHtml(s){ if(!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ===========================
   INIT ON LOAD
   =========================== */
document.addEventListener('DOMContentLoaded',()=>{
  if(document.getElementById('optionsList')) renderPastOptionsInDrop();
  if(document.getElementById('currentCard')) renderCurrentCard();
  if(document.getElementById('pastList')) renderPastList();
  if(document.getElementById('viewCard')) renderViewPage();
});

function renderPastOptionsInDrop(){
  const sel=document.getElementById('optionDrop'); if(!sel) return;
  if(sel.options.length<=1) ['Option A','Option B','Option C'].forEach(o=>{ const opt=document.createElement('option'); opt.text=o; sel.add(opt); });
}
