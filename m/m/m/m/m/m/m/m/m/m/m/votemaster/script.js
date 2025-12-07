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
   SETTINGS FUNCTIONS
   - Settings stored as two simple keys:
     v_autoCSV: "true" / "false"
     v_saveVotes: "true" / "false"
   =========================== */
function loadSettings(){
  return {
    autoCSV: localStorage.getItem('v_autoCSV') === 'true',
    saveVotes: localStorage.getItem('v_saveVotes') === 'true'
  };
}

function initSettingsPage(){
  const autoEl = document.getElementById('autoCSV');
  const saveEl = document.getElementById('saveVotes');
  if(!autoEl || !saveEl) return;

  const s = loadSettings();
  autoEl.checked = s.autoCSV;
  saveEl.checked = s.saveVotes;

  // Keep checkboxes interactive - also Save button calls saveSettings()
  autoEl.addEventListener('change', ()=> {
    // optional immediate save (also saved when pressing Save)
    localStorage.setItem('v_autoCSV', autoEl.checked ? 'true' : 'false');
  });
  saveEl.addEventListener('change', ()=> {
    localStorage.setItem('v_saveVotes', saveEl.checked ? 'true' : 'false');
  });
}

function saveSettings(){
  const autoEl = document.getElementById('autoCSV');
  const saveEl = document.getElementById('saveVotes');
  if(!autoEl || !saveEl) return showCustomAlert('Settings elements not found.');

  localStorage.setItem('v_autoCSV', autoEl.checked ? 'true' : 'false');
  localStorage.setItem('v_saveVotes', saveEl.checked ? 'true' : 'false');
  showCustomAlert('Settings saved.');
}

/* ===========================
   CREATE PAGE FUNCTIONS
   =========================== */

function addOptionInput(value=''){
  const container = document.getElementById('optionsContainer');
  if(!container) return;
  const div = document.createElement('div');
  div.className = 'row';
  div.innerHTML = `
    <input type="text" class="option-input" placeholder="Option name" value="${escapeHtml(value)}">
    <button class="btn btn-ghost small" onclick="this.parentNode.remove(); updateBlockedOptionDropdowns();">Remove</button>
  `;
  container.appendChild(div);
  updateBlockedOptionDropdowns();
}

function addSampleOptions(){
  ['A','B','C'].forEach(o => addOptionInput(o));
}

function addRoleInput(name='', uses='', type='normal', extraValue=''){
  const container = document.getElementById('rolesContainer');
  if(!container) return;
  const div = document.createElement('div');
  div.className = 'row';
  div.innerHTML = `
    <input type="text" class="role-name" placeholder="Role name" value="${escapeHtml(name)}">
    <input type="number" class="role-uses" placeholder="Uses (blank = unlimited)" value="${uses}" min="0">
    <select class="role-type" onchange="updateRoleExtra(this)">
      <option value="normal" ${type==='normal'?'selected':''}>Normal</option>
      <option value="notallowed" ${type==='notallowed'?'selected':''}>Cannot vote for a specific option</option>
      <option value="multiplier" ${type==='multiplier'?'selected':''}>Multiplier</option>
      <option value="tiebreaker" ${type==='tiebreaker'?'selected':''}>Tiebreaker</option>
      <option value="halfvote" ${type==='halfvote'?'selected':''}>Half Vote</option>
    </select>
    <span class="role-extra"></span>
    <button class="btn btn-ghost small" onclick="this.parentNode.remove()">Remove</button>
  `;
  container.appendChild(div);
  updateRoleExtra(div.querySelector('.role-type'), extraValue);
}

function clearRoles(){
  const container = document.getElementById('rolesContainer');
  if(container) container.innerHTML = '';
}

function updateRoleExtra(select, extraValue=''){
  const row = select.parentNode;
  const extraSpan = row.querySelector('.role-extra');
  extraSpan.innerHTML = '';
  const options = getOptionNames();
  switch(select.value){
    case 'notallowed':
      if(options.length){
        const sel = document.createElement('select');
        sel.innerHTML = options.map(o=>`<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
        if(extraValue) sel.value = extraValue;
        extraSpan.appendChild(sel);
      }
      break;
    case 'multiplier':
      const mul = document.createElement('select');
      ['2','3','4','5'].forEach(x=>{
        const opt = document.createElement('option');
        opt.value = x;
        opt.textContent = 'x'+x;
        if(extraValue==x) opt.selected = true;
        mul.appendChild(opt);
      });
      extraSpan.appendChild(mul);
      break;
    // normal, tiebreaker, halfvote -> no extra input
  }
}

function getOptionNames(){
  return Array.from(document.querySelectorAll('.option-input')).map(i=>i.value).filter(v=>v);
}

function updateBlockedOptionDropdowns(){
  const roles = document.querySelectorAll('.role-type');
  roles.forEach(sel=>{
    if(sel.value === 'notallowed') updateRoleExtra(sel);
  });
}

function startPoll(){
  const pollNameEl = document.getElementById('pollName');
  if(!pollNameEl) return;
  const pollName = pollNameEl.value.trim();
  if(!pollName) return alert('Enter poll name');

  const options = getOptionNames();
  if(options.length < 1) return alert('Add at least one option');

  const rolesEls = document.querySelectorAll('#rolesContainer .row');
  const roles = Array.from(rolesEls).map(r=>{
    const name = r.querySelector('.role-name').value.trim();
    const uses = r.querySelector('.role-uses').value.trim();
    const type = r.querySelector('.role-type').value;
    let extra = null;
    const extraInput = r.querySelector('.role-extra select');
    if(extraInput) extra = extraInput.value;
    return {
      name,
      uses: uses ? Number(uses) : Infinity,
      type,
      extra
    };
  });

  const current = {
    id: Date.now(),
    title: pollName,
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
      ${current.roles.map((r,i)=>`<button class="btn btn-ghost small" onclick="selectRole(${i})">${escapeHtml(r.name)}${r.uses!==Infinity?` (${r.uses})`:''}</button>`).join('')}
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
    id:Date.now(),
    title:current.title,
    created:current.created,
    ended:new Date().toISOString(),
    options:current.options.map((label,i)=>({label,votes:totals[i]})),
    roles:current.roles,
    voteLog: current.votes // SAVES RAW VOTES
  };

  const settings = loadSettings();
  let historyIndex = -1;

  if(settings.saveVotes){
    const history=loadHistory();
    history.unshift(snapshot);
    saveHistory(history);
    historyIndex = 0; // new item at beginning
  }

  // Auto CSV: per your request, use downloadCSV_index(idx)
  // This only works when the vote is saved to history (so historyIndex !== -1)
  if(settings.autoCSV && historyIndex !== -1){
    // downloadCSV_index expects an index in saved history
    downloadCSV_index(historyIndex);
  }

  // If saveVotes is disabled, votes are not preserved (user requested this behavior)
  saveCurrent(null);
  go('past.html');
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

function renderViewPage(snapshot=null){
  let rec;
  if(snapshot){
    rec = snapshot;
  } else {
    const idx=Number(localStorage.getItem('v_view_idx')||-1);
    const history=loadHistory();
    if(idx<0||idx>=history.length){
      const viewCard = document.getElementById('viewCard');
      if(viewCard) viewCard.innerHTML='<div class="tiny">Not found</div>';
      return;
    }
    rec=history[idx];
  }
  const viewCard = document.getElementById('viewCard');
  if(!viewCard) return;
  viewCard.innerHTML=`
    <div style="font-weight:800">${escapeHtml(rec.title)}</div>
    <div class="tiny">Ended: ${new Date(rec.ended).toLocaleString()}</div>
    <div class="divider"></div>
    ${rec.options.map(o=>`<div class="result-row"><div>${escapeHtml(o.label)}</div><div>${o.votes}</div></div>`).join('')}
  `;
}

/* ===========================
   CSV DOWNLOAD HELPERS
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

function downloadCSV_viewRecord(snapshot=null){
  let rec;
  if(snapshot) rec=snapshot;
  else{
    const idx = Number(localStorage.getItem('v_view_idx') || -1);
    const history = loadHistory();
    rec = history[idx];
    if(!rec) return alert("No data to export!");
  }

  let csv = "";
  csv += `Title,"${(rec.title || "").replace(/"/g, '""')}"\n`;
  csv += `Created,"${rec.created}"\n`;
  csv += `Ended,"${rec.ended}"\n\n`;
  csv += "Option,Total Votes\n";
  rec.options.forEach(o => {
    csv += `"${o.label.replace(/"/g, '""')}",${o.votes}\n`;
  });
  csv += "\nRole Name,Type,Amount,Extra\n";
  (rec.roles || []).forEach(r => {
    // roles in some places use 'uses' or 'amount' naming - attempt to read possible fields
    const amount = (r.uses !== undefined) ? r.uses : (r.amount !== undefined ? r.amount : '');
    csv += `"${(r.name || "").replace(/"/g, '""')}",${r.type},${amount},${r.extra || ''}\n`;
  });
  csv += "\nTimestamp,Option,Role Used,Weight\n";
  (rec.voteLog || []).forEach(v => {
    const time = new Date(v.ts).toLocaleString();
    const opt = rec.options[v.optionIdx]?.label || "";
    const role = rec.roles[v.roleIndex]?.name || "";
    csv += `"${time}","${opt}","${role}",${v.weight}\n`;
  });

  const filename = (rec.title || 'results').replace(/[^\w\-]+/g, "_") + ".csv";
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownloadBlob(blob, filename);
}

function downloadCSV_index(idx) {
  const history = loadHistory();
  const rec = history[idx];
  if (!rec) return alert("No data to export!");
  // Reuse view CSV generator (works with passed snapshot)
  downloadCSV_viewRecord(rec);
}

/* ===========================
   CUSTOM ALERT
   =========================== */
function showCustomAlert(msg) {
  const alertEl = document.getElementById('customAlert');
  const msgEl = document.getElementById('alertMessage');
  if(!alertEl || !msgEl){
    // fallback native alert if custom UI not present
    alert(msg);
    return;
  }
  msgEl.innerHTML = msg;
  alertEl.style.display = "flex";
}

function closeAlert() {
  const alertEl = document.getElementById('customAlert');
  if(alertEl) alertEl.style.display = "none";
}

/* ===========================
   HELPER FUNCTIONS
   =========================== */
function escapeHtml(s){
  if(s === null || s === undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g, '&quot;');
}

/* ===========================
   INIT ON LOAD
   =========================== */
document.addEventListener('DOMContentLoaded', ()=>{
  // Settings page
  if(document.getElementById('autoCSV') || document.getElementById('saveVotes')) initSettingsPage();

  // Create page
  if(document.getElementById('optionsContainer')) {
    // If there are no option inputs, add one by default (optional)
    // leave as-is; create.html's buttons handle adding
    renderPastOptionsInDrop();
  }

  // Current vote
  if(document.getElementById('currentCard')) renderCurrentCard();

  // Past votes
  if(document.getElementById('pastList')) renderPastList();

  // View results
  if(document.getElementById('viewCard')) renderViewPage();
});

function renderPastOptionsInDrop(){
  const sel=document.getElementById('optionDrop'); if(!sel) return;
  if(sel.options.length<=1) ['Option A','Option B','Option C'].forEach(o=>{
    const opt=document.createElement('option'); opt.text=o; sel.add(opt);
  });
}

/* ===========================
   CUSTOM ALERT
   =========================== */
function showCustomAlert(msg) {
  document.getElementById('alertMessage').innerHTML = msg;
  document.getElementById('customAlert').style.display = "flex";
}

function closeAlert() {
  document.getElementById('customAlert').style.display = "none";
}

/* ===========================
   INIT ON LOAD
   =========================== */
document.addEventListener('DOMContentLoaded',()=>{
  if(document.getElementById('viewCard')) renderViewPage();
  if(document.getElementById('currentCard')) renderCurrentCard();
  if(document.getElementById('pastList')) renderPastList();

  if(document.getElementById('autoCSV')){
    const settings = loadSettings();
    document.getElementById('autoCSV').checked = !!settings.autoCSV;
    document.getElementById('saveVotes').checked = !!settings.saveVotes;
  }
});

function escapeHtml(s){ 
  if(!s) return ''; 
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); 
}

