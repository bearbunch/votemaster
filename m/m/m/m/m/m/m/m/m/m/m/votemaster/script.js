/* =========================== COMMON UTILITIES =========================== */
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
const KEY_SETTINGS = 'vapp_settings';

function loadCurrent(){ try { return JSON.parse(localStorage.getItem(KEY_CURRENT) || 'null'); } catch(e){ return null; } }
function saveCurrent(obj){ if(obj) localStorage.setItem(KEY_CURRENT, JSON.stringify(obj)); else localStorage.removeItem(KEY_CURRENT); }
function loadHistory(){ try { return JSON.parse(localStorage.getItem(KEY_HISTORY) || '[]'); } catch(e){ return []; } }
function saveHistory(arr){ localStorage.setItem(KEY_HISTORY, JSON.stringify(arr)); }
function loadSettings(){ try { return JSON.parse(localStorage.getItem(KEY_SETTINGS)||'{}'); } catch(e){ return {}; } }
function saveSettings(settings){ localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings)); }

/* =========================== CREATE PAGE FUNCTIONS =========================== */
// (same as before, unchanged — omitted for brevity)

/* =========================== CURRENT PAGE FUNCTIONS =========================== */
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
      ${current.roles.map((r,i)=>`<button class="btn btn-ghost small" onclick="selectRole(${i})">${escapeHtml(r.name)}${r.uses && r.uses!==Infinity?` (${r.uses})`:''}</button>`).join('')}
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

  const totals=current.options.map(_=>0); 
  const tiebreakers=[];

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

  const settings = loadSettings();
  const history = loadHistory();

  // Save votes unless dontSaveVotes is true
  if(!settings.dontSaveVotes){
    history.unshift(snapshot);
    saveHistory(history);

    // Auto CSV download if enabled
    if(settings.autoCSV && history.length){
      downloadCSV_index(0); // newest vote
    }
  }

  saveCurrent(null);
  go('past.html');
}

function resetActiveVote(){ const c=loadCurrent(); if(!c) return; c.votes=[]; saveCurrent(c); renderCurrentCard(); }

/* =========================== PAST & VIEW PAGE FUNCTIONS =========================== */
// renderPastList(), openView(), renderViewPage(), downloadCSV_index(), downloadCSV_viewRecord() 
// same as your previous scripts.js (unchanged)

/* =========================== SETTINGS FUNCTIONS =========================== */
function initSettings(){
  let settings = loadSettings();

  // Defaults
  if(settings.autoCSV===undefined) settings.autoCSV=false; 
  if(settings.dontSaveVotes===undefined) settings.dontSaveVotes=false; 

  // Sync with checkboxes if page has them
  const autoCSVBox=document.getElementById('autoCSV');
  if(autoCSVBox) autoCSVBox.checked = settings.autoCSV;

  const dontSaveBox=document.getElementById('dontSaveVotes');
  if(dontSaveBox) dontSaveBox.checked = settings.dontSaveVotes;
}

function saveSettingsFromPage(){
  const autoCSVBox=document.getElementById('autoCSV');
  const dontSaveBox=document.getElementById('dontSaveVotes');

  const settings = {
    autoCSV: autoCSVBox ? autoCSVBox.checked : false,
    dontSaveVotes: dontSaveBox ? dontSaveBox.checked : false
  };

  saveSettings(settings);
  showCustomAlert("Settings saved!");
}

/* =========================== UTILS =========================== */
function showCustomAlert(msg){
  const alertMsg = document.getElementById('alertMessage');
  const alertDiv = document.getElementById('customAlert');
  if(alertMsg && alertDiv){
    alertMsg.innerHTML = msg;
    alertDiv.style.display = "flex";
  } else {
    alert(msg);
  }
}

function closeAlert(){ const alertDiv = document.getElementById('customAlert'); if(alertDiv) alertDiv.style.display="none"; }

function escapeHtml(s){ if(!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* =========================== INIT =========================== */
document.addEventListener('DOMContentLoaded',()=>{
  if(document.getElementById('currentCard')) renderCurrentCard();
  if(document.getElementById('pastList')) renderPastList();
  if(document.getElementById('viewCard')) renderViewPage();
  if(document.getElementById('autoCSV') || document.getElementById('dontSaveVotes')) initSettings();
});
