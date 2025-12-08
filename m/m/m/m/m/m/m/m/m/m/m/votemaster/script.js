/* ============================================================
   VoteMaster — FULL SCRIPT.JS
   Complete vote engine, share-link encryption, CSV exporter,
   UI popups, role system, import/export, and backup logic.
   ============================================================ */

/* ======================
   GLOBAL STATE
   ====================== */

let selectedRoleIndex = null;

/* ======================
   BASIC HELPERS
   ====================== */

function go(page) {
  window.location.href = page;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* LocalStorage wrappers */
function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function load(key) {
  let raw = localStorage.getItem(key);
  if (!raw) return null;
  try { return JSON.parse(raw); }
  catch { return null; }
}

/* Active + past vote helpers */
function saveCurrent(obj) { save("vapp_current", obj); }
function loadCurrent(obj) { return load("vapp_current"); }

function savePast(list) { save("vapp_past", list); }
function loadPast() { return load("vapp_past") || []; }

/* ======================
   CUSTOM ALERT POPUP
   ====================== */

function showPopup(message, buttonText = "OK", callback = null) {
  let old = document.getElementById("vm_popup");
  if (old) old.remove();

  let popup = document.createElement("div");
  popup.id = "vm_popup";
  popup.style.position = "fixed";
  popup.style.left = "0";
  popup.style.top = "0";
  popup.style.width = "100vw";
  popup.style.height = "100vh";
  popup.style.background = "rgba(0,0,0,0.45)";
  popup.style.display = "flex";
  popup.style.alignItems = "center";
  popup.style.justifyContent = "center";
  popup.style.zIndex = "99999";

  popup.innerHTML = `
    <div class="card" style="width:320px;text-align:center;">
      <div style="font-weight:800;margin-bottom:8px;">Notice</div>
      <div style="margin-bottom:16px;">${escapeHtml(message)}</div>
      <button class="btn btn-primary" id="popupConfirm">${buttonText}</button>
    </div>
  `;

  document.body.appendChild(popup);

  document.getElementById("popupConfirm").onclick = () => {
    popup.remove();
    if (callback) callback();
  };
}

/* ======================
   VALIDATOR
   ====================== */

function validateCurrent(obj) {
  const problems = [];
  if (!obj) problems.push("null object");
  else {
    if (!obj.title) problems.push("missing title");
    if (!Array.isArray(obj.options) || obj.options.length === 0)
      problems.push("options missing");
    if (!Array.isArray(obj.roles)) problems.push("roles must be array");
    if (!Array.isArray(obj.votes)) problems.push("votes must be array");
  }
  return problems;
}

/* ============================================================
   CREATE VOTE PAGE — startVoteFromCreator()
   ============================================================ */

function startVoteFromCreator() {
  try {
    const title = document.getElementById("voteTitle").value.trim();
    if (!title) return showPopup("Enter a title.");

    const optionsEls = Array.from(document.querySelectorAll(".option-input"));
    const options = optionsEls.map(o => o.value.trim()).filter(x => x);
    if (!options.length) return showPopup("Add at least one option.");

    const rolesEls = Array.from(document.querySelectorAll(".role-row"));
    const roles = rolesEls.map(row => {
      return {
        name: row.querySelector(".role-name").value.trim(),
        amount: Number(row.querySelector(".role-amount").value) || 0,
        type: row.querySelector(".role-type").value,
        extra: row.querySelector(".role-extra").value
      };
    });

    const current = {
      id: Date.now(),
      title,
      options,
      roles,
      votes: [],
      created: new Date().toISOString()
    };

    const problems = validateCurrent(current);
    if (problems.length)
      return showPopup("Vote invalid: " + problems.join(", "));

    saveCurrent(current);
    console.log("Current vote saved:", current);
    go("current.html");
  } catch (err) {
    console.error("startVoteFromCreator error:", err);
    showPopup("Error creating vote — see console.");
  }
}

/* ============================================================
   CURRENT PAGE — ROLE SELECTOR
   ============================================================ */

function selectRole(index) {
  selectedRoleIndex = index;
  renderCurrentCard();
}

/* ============================================================
   CURRENT PAGE — RENDER
   ============================================================ */

function renderCurrentCard() {
  const container = document.getElementById("currentCard");
  if (!container) return;

  const current = loadCurrent();
  if (!current) {
    container.innerHTML = `<div class="tiny">No active vote.</div>`;
    return;
  }

  const problems = validateCurrent(current);
  if (problems.length) {
    container.innerHTML = `<div class="tiny">Corrupt vote data.</div>`;
    return;
  }

  const rolesHtml = current.roles
    .map((r, i) => {
      let active = selectedRoleIndex === i ? "btn-primary" : "btn-ghost";
      return `<button class="btn ${active} small" onclick="selectRole(${i})">${escapeHtml(r.name)} (${r.amount})</button>`;
    })
    .join("");

  const optionsHtml = current.options
    .map((opt, i) => {
      return `<button class="btn btn-primary vote-btn" style="display:block;margin:6px 0;" onclick="castVote(${i})">${escapeHtml(opt)}</button>`;
    })
    .join("");

  container.innerHTML = `
    <div style="font-weight:800;font-size:18px;">${escapeHtml(current.title)}</div>
    <div class="tiny" style="margin-bottom:10px;">Created: ${new Date(current.created).toLocaleString()}</div>

    <div class="tiny">Select a role:</div>
    <div style="margin:8px 0;">${rolesHtml}</div>

    <div class="divider"></div>

    <div>${optionsHtml}</div>

    <div class="divider"></div>

    <div class="row">
      <button class="btn btn-ghost" onclick="endActiveVote()">End Vote</button>
      <button class="btn btn-ghost" onclick="resetActiveVote()">Reset</button>
      <button class="btn btn-primary" onclick="openSharePopup()">Get Share Link</button>
    </div>
  `;
}

/* ============================================================
   VOTING ENGINE — castVote()
   ============================================================ */

function castVote(optionIdx) {
  const current = loadCurrent();
  if (!current) return showPopup("No vote found.");

  let weight = 1;
  let role = selectedRoleIndex != null ? current.roles[selectedRoleIndex] : null;
  let allowed = true;

  if (role) {
    switch (role.type) {
      case "notallowed":
        if (role.extra === current.options[optionIdx]) allowed = false;
        break;
      case "multiplier":
        weight = Number(role.extra) || 2;
        break;
      case "halfvote":
        weight = 0.5;
        break;
      case "tiebreaker":
        weight = 0;
        break;
    }
  }

  if (!allowed) return showPopup("Your role does not allow voting for that option.");

  current.votes.push({
    optionIdx,
    weight,
    roleIndex: selectedRoleIndex,
    ts: Date.now()
  });

  saveCurrent(current);
  renderCurrentCard();
}

/* ============================================================
   END VOTE — Save to Past
   ============================================================ */

function endActiveVote() {
  const current = loadCurrent();
  if (!current) return showPopup("No active vote.");

  const past = loadPast();
  past.push(current);
  savePast(past);
  localStorage.removeItem("vapp_current");

  showPopup("Vote ended and saved to history.", "OK", () => {
    go("past.html");
  });
}

function resetActiveVote() {
  const current = loadCurrent();
  if (!current) return;

  current.votes = [];
  saveCurrent(current);
  showPopup("Votes reset.");
  renderCurrentCard();
}

/* ============================================================
   SHARE LINK — PASSWORD → ENCRYPT → GENERATE
   ============================================================ */

function openSharePopup() {
  let old = document.getElementById("sharePopup");
  if (old) old.remove();

  let wrap = document.createElement("div");
  wrap.id = "sharePopup";
  wrap.style.position = "fixed";
  wrap.style.left = 0;
  wrap.style.top = 0;
  wrap.style.width = "100vw";
  wrap.style.height = "100vh";
  wrap.style.background = "rgba(0,0,0,0.45)";
  wrap.style.display = "flex";
  wrap.style.alignItems = "center";
  wrap.style.justifyContent = "center";
  wrap.style.zIndex = "99999";

  wrap.innerHTML = `
    <div class="card" style="width:330px;">
      <div style="font-weight:800;margin-bottom:10px;">Create Share Link</div>
      <div class="tiny" style="margin-bottom:4px;">Choose a password:</div>
      <input id="sharePw" class="input" type="password" placeholder="Password">
      <div class="row" style="margin-top:16px;">
        <button class="btn btn-ghost" onclick="document.getElementById('sharePopup').remove()">Cancel</button>
        <button class="btn btn-primary" onclick="generateEncryptedLink()">Create</button>
      </div>
    </div>
  `;

  document.body.appendChild(wrap);
}

function generateEncryptedLink() {
  const pw = document.getElementById("sharePw").value.trim();
  if (!pw) return showPopup("Enter a password.");

  const current = loadCurrent();
  if (!current) return showPopup("No current vote.");

  const json = JSON.stringify(current);
  const encrypted = btoa(
    json
      .split("")
      .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ pw.charCodeAt(i % pw.length)))
      .join("")
  );

  const cleanURL = location.href.split("?")[0];
  const finalLink = `${cleanURL}?data=${encodeURIComponent(encrypted)}&pw=${encodeURIComponent(
    btoa(pw)
  )}`;

  navigator.clipboard.writeText(finalLink);

  showPopup("Link created and copied to clipboard.");
  document.getElementById("sharePopup").remove();
}

/* ============================================================
   IMPORT ENCRYPTED VOTE FROM URL
   ============================================================ */

function importVoteFromLink() {
  const params = new URLSearchParams(location.search);
  const data = params.get("data");
  const pwEncoded = params.get("pw");

  if (!data) return; // nothing to import

  const pw = pwEncoded ? atob(pwEncoded) : "";

  let inputPw = pw;
  if (pw) inputPw = prompt("Enter the password for this vote:");

  if (!inputPw) {
    showPopup("Password required.");
    return;
  }

  try {
    const decoded = atob(data);
    const decrypted = decoded
      .split("")
      .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ inputPw.charCodeAt(i % inputPw.length)))
      .join("");

    const obj = JSON.parse(decrypted);

    saveCurrent(obj);

    params.delete("pw");
    const cleanURL = `${location.pathname}?${params.toString()}`;
    history.replaceState({}, "", cleanURL);
  } catch (err) {
    console.error("Import error:", err);
    showPopup("Could not decrypt vote.");
  }
}

/* ============================================================
   PAST PAGE — RENDER LIST
   ============================================================ */

function renderPastList() {
  const container = document.getElementById("pastList");
  if (!container) return;

  const past = loadPast();

  if (!past.length) {
    container.innerHTML = "<div class='tiny'>No past votes.</div>";
    return;
  }

  container.innerHTML = past
    .map(
      v => `
      <div class="card" style="margin-bottom:10px;">
        <div style="font-weight:800;">${escapeHtml(v.title)}</div>
        <div class="tiny">Created: ${new Date(v.created).toLocaleString()}</div>
        <div class="row" style="margin-top:10px;">
          <button class="btn btn-primary" onclick="openPastView(${v.id})">Open</button>
        </div>
      </div>
    `
    )
    .join("");
}

function openPastView(id) {
  go(`view.html?id=${id}`);
}

/* ============================================================
   VIEW PAGE — RENDER SINGLE RESULT
   ============================================================ */

function renderViewPage() {
  const container = document.getElementById("viewCard");
  if (!container) return;

  const id = Number(new URLSearchParams(location.search).get("id"));
  const past = loadPast();

  const vote = past.find(v => v.id === id);
  if (!vote) {
    container.innerHTML = "<div class='tiny'>Vote not found.</div>";
    return;
  }

  let counts = {};
  vote.options.forEach((_, i) => (counts[i] = 0));
  vote.votes.forEach(v => (counts[v.optionIdx] += v.weight));

  const rows = vote.options
    .map((opt, i) => {
      return `
        <div class="row" style="margin:4px 0;">
          <div>${escapeHtml(opt)}</div>
          <div style="font-weight:800;">${counts[i]}</div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = `
    <div style="font-weight:800;font-size:18px;margin-bottom:6px;">${escapeHtml(vote.title)}</div>
    <div class="tiny" style="margin-bottom:20px;">Created: ${new Date(vote.created).toLocaleString()}</div>

    ${rows}

    <div class="divider"></div>

    <button class="btn btn-primary" onclick="downloadCSV_view(${vote.id})">Download CSV</button>
  `;
}

/* ============================================================
   CSV EXPORT
   ============================================================ */

function downloadCSV_view(id) {
  const past = loadPast();
  const vote = past.find(v => v.id === id);
  if (!vote) return showPopup("Vote not found.");

  let csv = "Option,Weight,Role,Timestamp\n";
  vote.votes.forEach(v => {
    let roleName = v.roleIndex != null ? vote.roles[v.roleIndex].name : "";
    csv += `${escapeCsv(vote.options[v.optionIdx])},${v.weight},${escapeCsv(
      roleName
    )},${new Date(v.ts).toLocaleString()}\n`;
  });

  let blob = new Blob([csv], { type: "text/csv" });
  let url = URL.createObjectURL(blob);
  let a = document.createElement("a");
  a.href = url;
  a.download = vote.title.replace(/[^\w\s-]/g, "_") + ".csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function escapeCsv(s) {
  if (!s) return "";
  if (s.includes(",") || s.includes('"'))
    return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/* ============================================================
   THEME
   ============================================================ */
function toggleTheme() {
  const root = document.documentElement;
  const current = root.getAttribute("data-theme");
  root.setAttribute("data-theme", current === "light" ? "dark" : "light");
}

/* ============================================================
   PAGE AUTO-INIT
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  importVoteFromLink();
  renderCurrentCard();
  renderPastList();
  renderViewPage();
});
           
