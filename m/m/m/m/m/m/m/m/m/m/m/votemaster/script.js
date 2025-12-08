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

  const typeSelect = row.querySelector('.role-type');
  const extraSelect = row.querySelector('.role-extra');

  typeSelect.addEventListener('change',()=>{
    const type = typeSelect.value;
    if(type==='notallowed'){
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
    id:Date.now(),
    title:current.title,
    created:current.created,
    ended:new Date().toISOString(),
    options:current.options.map((label,i)=>({label,votes:totals[i]})),
    roles:current.roles,
    voteLog: current.votes // SAVES RAW VOTES
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
  const idx=Number(localStorage.getItem('v_view_idx')||-1); 
  const history=loadHistory();
  if(idx<0||idx>=history.length){
    document.getElementById('viewCard').innerHTML='<div class="tiny">Not found</div>';
    return;
  }
  const rec=history[idx];
  document.getElementById('viewCard').innerHTML=`
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

/* ---- VIEW PAGE CSV EXPORT ---- */

function downloadCSV_viewRecord() {
  const idx = Number(localStorage.getItem('v_view_idx') || -1);
  const history = loadHistory();
  const rec = history[idx];
  if (!rec) return alert("No data to export!");

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
    csv += `"${(r.name || "").replace(/"/g, '""')}",${r.type},${r.amount},${r.extra}\n`;
  });

  csv += "\nTimestamp,Option,Role Used,Weight\n";
  (rec.voteLog || []).forEach(v => {
    const time = new Date(v.ts).toLocaleString();
    const opt = rec.options[v.optionIdx]?.label || "";
    const role = rec.roles[v.roleIndex]?.name || "";
    csv += `"${time}","${opt}","${role}",${v.weight}\n`;
  });

  const filename = rec.title.replace(/[^\w\-]+/g, "_") + ".csv";
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });

  triggerDownloadBlob(blob, filename);
}

/* ---- PAST PAGE CSV EXPORT ---- */

function downloadCSV_index(idx) {
  const history = loadHistory();
  const rec = history[idx];
  if (!rec) return alert("No data to export!");

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
    csv += `"${(r.name || "").replace(/"/g, '""')}",${r.type},${r.amount},${r.extra}\n`;
  });

  csv += "\nTimestamp,Option,Role Used,Weight\n";
  (rec.voteLog || []).forEach(v => {
    const time = new Date(v.ts).toLocaleString();
    const opt = rec.options[v.optionIdx]?.label || "";
    const role = rec.roles[v.roleIndex]?.name || "";
    csv += `"${time}","${opt}","${role}",${v.weight}\n`;
  });

  const filename = rec.title.replace(/[^\w\-]+/g, "_") + ".csv";
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });

  triggerDownloadBlob(blob, filename);
}

/* ===========================
   ENCRYPTION / SHARE HELPERS
   =========================== */

/*
 Secure password embedding approach:

 - When creating a protected link:
    1) User provides password.
    2) We derive a key using PBKDF2(password, salt).
    3) We encrypt a short marker JSON (marker + timestamp) using AES-GCM with a random iv.
    4) We add to the URL: &lock=<base64(ciphertext)>&salt=<base64(salt)>&iv=<base64(iv)>&data=<base64(vote)>
    (vote itself remains in data= like before)
 - When opening the link:
    1) If lock param exists, prompt for password.
    2) Derive key using PBKDF2(password, salt from URL).
    3) Attempt to decrypt lock. If decrypted marker matches expected string, accept password and load vote.
    4) Remove lock/salt/iv from URL for cleanliness.
*/

// utils: base64 <-> Uint8Array
function u8ToB64(u8){ return btoa(String.fromCharCode(...u8)); }
function b64ToU8(b64){ return Uint8Array.from(atob(b64), c=>c.charCodeAt(0)); }

async function deriveKeyFromPassword(password, saltU8){
  const enc = new TextEncoder();
  const pwKey = await crypto.subtle.importKey('raw', enc.encode(password), {name:'PBKDF2'}, false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltU8, iterations: 150000, hash: 'SHA-256' },
    pwKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt','decrypt']
  );
  return key;
}

async function createLockForPassword(password){
  // random salt + iv
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKeyFromPassword(password, salt);

  const marker = { marker: 'VoteMasterLock', ts: Date.now() };
  const enc = new TextEncoder().encode(JSON.stringify(marker));
  const ct = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, enc);

  return {
    lock: u8ToB64(new Uint8Array(ct)),
    salt: u8ToB64(salt),
    iv: u8ToB64(iv)
  };
}

async function tryUnlockWithPassword(password, lockB64, saltB64, ivB64){
  try {
    const salt = b64ToU8(saltB64);
    const iv = b64ToU8(ivB64);
    const key = await deriveKeyFromPassword(password, salt);
    const ct = b64ToU8(lockB64);
    const plain = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, key, ct);
    const txt = new TextDecoder().decode(plain);
    const obj = JSON.parse(txt);
    if(obj && obj.marker === 'VoteMasterLock') return true;
    return false;
  } catch(e){
    return false;
  }
}

/* ===========================
   SHARE UI FUNCTIONS (CURRENT PAGE)
   =========================== */

let __share_last_link = "";

async function openShareModal() {
  // show the modal defined in current.html (share modal)
  const modal = document.getElementById('shareModal');
  if(!modal) return alert('Share UI not found in HTML');

  // clear fields
  document.getElementById('sharePassword').value = '';
  document.getElementById('shareShowPassword').checked = false;
  document.getElementById('shareProtectToggle').checked = false;
  document.getElementById('shareLinkBox').value = '';
  document.getElementById('shareQR').innerHTML = '';
  document.getElementById('shareQR').style.display = 'none';

  modal.style.display = 'block';
  document.getElementById('shareOverlay').style.display = 'block';
}

function closeShareModal(){
  const modal = document.getElementById('shareModal');
  if(!modal) return;
  modal.style.display = 'none';
  document.getElementById('shareOverlay').style.display = 'none';
}

async function generateShareLink() {
  const current = loadCurrent();
  if(!current) return alert('No active vote to share');

  // encode vote data (base64)
  const voteB64 = u8ToB64(new TextEncoder().encode(JSON.stringify(current)));

  const protect = document.getElementById('shareProtectToggle').checked;
  const pw = document.getElementById('sharePassword').value || '';

  let urlBase = location.href.split('?')[0];
  let finalLink = urlBase + '?data=' + encodeURIComponent(voteB64);

  if(protect && pw){
    // create lock (encrypt marker) and embed lock+salt+iv in URL (base64)
    const lockObj = await createLockForPassword(pw);
    finalLink += '&lock=' + encodeURIComponent(lockObj.lock)
               + '&salt=' + encodeURIComponent(lockObj.salt)
               + '&iv=' + encodeURIComponent(lockObj.iv);
  }

  __share_last_link = finalLink;
  document.getElementById('shareLinkBox').value = finalLink;

  // optional: show QR
  const qrBox = document.getElementById('shareQR');
  qrBox.innerHTML = '';
  qrBox.style.display = 'none';
}

function copyShareLinkToClipboard(){
  const box = document.getElementById('shareLinkBox');
  if(!box) return;
  box.select();
  navigator.clipboard.writeText(box.value.trim()).then(()=>{
    showTransientNotice('Link copied to clipboard');
  }, ()=> {
    showTransientNotice('Copy failed — select and copy manually');
  });
}

function showShareQRCode(){
  const qrBox = document.getElementById('shareQR');
  if(!qrBox) return;
  qrBox.innerHTML = '';
  const txt = document.getElementById('shareLinkBox').value || __share_last_link;
  if(!txt) return;
  qrBox.style.display = 'block';
  // create QR (if QRCode lib is loaded)
  if(window.QRCode) new QRCode(qrBox, { text: txt, width: 200, height: 200 });
}

/* transient notice */
function showTransientNotice(msg, time=3000){
  let n=document.getElementById('__vm_notice');
  if(!n){
    n=document.createElement('div'); n.id='__vm_notice';
    n.style.position='fixed';
    n.style.top='18px';
    n.style.right='18px';
    n.style.zIndex='1200';
    n.style.padding='10px 12px';
    n.style.borderRadius='10px';
    n.style.boxShadow='0 6px 18px rgba(0,0,0,0.12)';
    n.style.background='var(--card-bg, #fff)';
    n.style.color='var(--text-color, #000)';
    n.style.fontSize='13px';
    document.body.appendChild(n);
  }
  n.innerText = msg;
  n.style.opacity = '1';
  clearTimeout(n._t);
  n._t = setTimeout(()=>{ n.style.opacity='0'; setTimeout(()=>n.remove(),300); }, time);
}

/* ===========================
   IMPORT FROM SHARED LINK
   =========================== */

async function importVoteFromURLIfPresent() {
  const params = new URLSearchParams(location.search);
  const dataParam = params.get('data');
  if(!dataParam) return; // nothing to do

  // decode vote
  try {
    const voteBytes = b64ToU8(decodeURIComponent(dataParam));
    const voteText = new TextDecoder().decode(voteBytes);
    // if there is no lock, just save and render
    const lock = params.get('lock');
    const salt = params.get('salt');
    const iv = params.get('iv');

    if(!lock){
      // no protection
      saveCurrent(JSON.parse(voteText));
      // clean URL
      if(history && history.replaceState) history.replaceState({}, document.title, location.pathname);
      // render (if we're on current page)
      if(document.getElementById('currentCard')) renderCurrentCard();
      return;
    }

    // if protected, show a modal password prompt (custom)
    const pass = await promptForPasswordModal('Enter password to open shared vote');
    if(pass === null){
      showTransientNotice('Password required to open vote');
      return;
    }

    // try to unlock
    const ok = await tryUnlockWithPassword(pass, decodeURIComponent(lock), decodeURIComponent(salt), decodeURIComponent(iv));
    if(!ok){
      alert('Incorrect password — cannot open vote.');
      return;
    }

    // if ok, save vote
    saveCurrent(JSON.parse(voteText));

    // clean URL (remove lock params) so password data isn't left in address bar
    params.delete('lock'); params.delete('salt'); params.delete('iv');
    const clean = location.pathname + (params.toString() ? '?' + params.toString() : '');
    if(history && history.replaceState) history.repla
