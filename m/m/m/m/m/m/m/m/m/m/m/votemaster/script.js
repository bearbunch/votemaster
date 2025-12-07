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
document.addEventListener('DOMContentLoaded', () => {
  if(document.getElementById('pollName')){ // create page logic

    function addOptionInput(value=''){
      const container = document.getElementById('optionsContainer');
      const div = document.createElement('div');
      div.className = 'row';
      div.innerHTML = `
        <input type="text" class="option-input" placeholder="Option name" value="${value}">
        <button class="btn btn-ghost small" onclick="this.parentNode.remove(); updateBlockedOptionDropdowns();">Remove</button>
      `;
      container.appendChild(div);
      updateBlockedOptionDropdowns();
    }

    function addSampleOptions(){ ['A','B','C'].forEach(o => addOptionInput(o)); }

    function addRoleInput(name='', uses='', type='normal', extraValue=''){
      const container = document.getElementById('rolesContainer');
      const div = document.createElement('div');
      div.className = 'row';
      div.innerHTML = `
        <input type="text" class="role-name" placeholder="Role name" value="${name}">
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

    function clearRoles(){ document.getElementById('rolesContainer').innerHTML=''; }

    function updateRoleExtra(select, extraValue=''){
      const row = select.parentNode;
      const extraSpan = row.querySelector('.role-extra');
      extraSpan.innerHTML = '';
      const options = getOptionNames();
      switch(select.value){
        case 'notallowed':
          if(options.length){
            const sel = document.createElement('select');
            sel.innerHTML = options.map(o=>`<option value="${o}">${o}</option>`).join('');
            if(extraValue) sel.value = extraValue;
            extraSpan.appendChild(sel);
          }
          break;
        case 'multiplier':
          const mul = document.createElement('select');
          ['2','3','4','5'].forEach(x=>{
            const opt = document.createElement('option'); opt.value=x; opt.textContent='x'+x;
            if(extraValue==x) opt.selected=true;
            mul.appendChild(opt);
          });
          extraSpan.appendChild(mul);
          break;
      }
    }

    function getOptionNames(){ return Array.from(document.querySelectorAll('.option-input')).map(i=>i.value).filter(v=>v); }
    function updateBlockedOptionDropdowns(){
      const roles = document.querySelectorAll('.role-type');
      roles.forEach(sel=>{ if(sel.value==='notallowed') updateRoleExtra(sel); });
    }

    window.addOptionInput = addOptionInput;
    window.addSampleOptions = addSampleOptions;
    window.addRoleInput = addRoleInput;
    window.clearRoles = clearRoles;

    window.startPoll = function(){
      const pollName = document.getElementById('pollName').value.trim();
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
        return { name, uses: uses? Number(uses): Infinity, type, extra };
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
  }
});

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
  const tempSave = settings.autoCSV && settings.dontSaveVotes;

  if(!settings.dontSaveVotes || tempSave){
      history.unshift(snapshot);
      saveHistory(history);

      if(settings.autoCSV && history.length){
          setTimeout(()=>{
              downloadCSV_index(0);
              if(tempSave){
                  const hist = loadHistory();
                  hist.shift();
                  saveHistory(hist);
              }
          }, 100);
      }
  }

  saveCurrent(null);
  go('past.html');
}

function resetActiveVote(){ const c=loadCurrent(); if(!c) return; c.votes=[]; saveCurrent(c); renderCurrentCard(); }

/* =========================== PAST & VIEW PAGE FUNCTIONS =========================== */
// renderPastList(), openView(), renderViewPage(), downloadCSV_index(), downloadCSV_viewRecord() 
// same as previous scripts.js

/* =========================== SETTINGS FUNCTIONS =========================== */
function initSettings(){
  let settings = loadSettings();
  if(settings.autoCSV===undefined) settings.autoCSV=false; 
  if(settings.dontSaveVotes===undefined) settings.dontSaveVotes=false; 

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
