/* ======================================================
   UTILITIES
   ====================================================== */

function go(page) {
  window.location.href = page;
}

function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute("data-theme");
  const next = current === "light" ? "dark" : "light";
  html.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
}

(function loadThemeOnStart() {
  const saved = localStorage.getItem("theme");
  if (saved) document.documentElement.setAttribute("data-theme", saved);
})();

/* ======================================================
   LOCAL STORAGE HELPERS
   ====================================================== */

function saveCurrentVote(vote) {
  localStorage.setItem("currentVote", JSON.stringify(vote));
}

function getCurrentVote() {
  return JSON.parse(localStorage.getItem("currentVote") || "{}");
}

function savePastVote(vote) {
  let past = JSON.parse(localStorage.getItem("pastVotes") || "[]");
  past.push(vote);
  localStorage.setItem("pastVotes", JSON.stringify(past));
}

function getPastVotes() {
  return JSON.parse(localStorage.getItem("pastVotes") || "[]");
}

/* ======================================================
   RENDER: CURRENT VOTE
   ====================================================== */

function renderCurrentCard() {
  const container = document.getElementById("currentCard");
  if (!container) return;

  let vote = getCurrentVote();

  if (!vote.question) {
    container.innerHTML = `
      <div class="empty">No active vote</div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="question">${vote.question}</div>
    <div class="options">
      ${vote.options
        .map((o, i) => `<button class="btn" onclick="castVote(${i})">${o}</button>`)
        .join("")}
    </div>
  `;
}

function castVote(index) {
  let vote = getCurrentVote();
  if (!vote.results) vote.results = Array(vote.options.length).fill(0);
  vote.results[index]++;

  saveCurrentVote(vote);
  alert("Vote recorded!");
}

/* ======================================================
   RENDER: PAST VOTES LIST
   ====================================================== */

function renderPast() {
  const container = document.getElementById("pastCard");
  if (!container) return;

  let list = getPastVotes();

  if (list.length === 0) {
    container.innerHTML = `<div class="empty">No past votes</div>`;
    return;
  }

  container.innerHTML = list
    .map(
      (v, i) => `
    <div class="past-item" onclick="openPast(${i})">
      <div class="question">${v.question}</div>
      <div class="meta">${new Date(v.timestamp).toLocaleString()}</div>
    </div>`
    )
    .join("");
}

function openPast(index) {
  localStorage.setItem("viewIndex", index);
  go("view.html");
}

/* ======================================================
   RENDER: VIEW VOTE
   ====================================================== */

function renderView() {
  const container = document.getElementById("viewCard");
  if (!container) return;

  let past = getPastVotes();
  let index = Number(localStorage.getItem("viewIndex"));
  let vote = past[index];

  if (!vote) {
    container.innerHTML = `<div class="empty">Vote not found</div>`;
    return;
  }

  let rows = vote.options
    .map((opt, i) => {
      let count = vote.results[i] || 0;
      return `<div class="row"><b>${opt}</b><span>${count}</span></div>`;
    })
    .join("");

  container.innerHTML = `
    <div class="question">${vote.question}</div>
    ${rows}
    <button class="btn btn-primary" onclick="downloadCSV_viewRecord()">Download CSV</button>
  `;
}

/* ======================================================
   CSV EXPORT (VIEW PAGE)
   ====================================================== */

function downloadCSV_viewRecord() {
  let past = getPastVotes();
  let index = Number(localStorage.getItem("viewIndex"));
  let vote = past[index];

  if (!vote) return;

  let csv = "Option,Votes\n";
  vote.options.forEach((opt, i) => {
    csv += `"${opt}",${vote.results[i] || 0}\n`;
  });

  let blob = new Blob([csv], { type: "text/csv" });
  let a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${vote.question.replace(/[^a-z0-9]/gi, "_")}.csv`;
  a.click();

  // show alert
  showCSVPopup();
}

/* Custom popup */
function showCSVPopup() {
  const div = document.createElement("div");
  div.style.cssText = `
    position:fixed; bottom:20px; left:50%; transform:translateX(-50%);
    background:var(--card-bg); border-radius:14px; padding:12px 18px;
    box-shadow:0 4px 12px rgba(0,0,0,0.25); z-index:9999;
  `;
  div.textContent =
    "If Excel does not open the file, you can use Notepad or any text viewer.";

  document.body.appendChild(div);

  setTimeout(() => div.remove(), 3500);
}

/* ======================================================
   SHARE LINK POPUP + PASSWORD PROTECTION
   ====================================================== */

function showShareLinkPopup() {
  const popup = document.getElementById("share_popup");
  const checkbox = document.getElementById("share_protect");
  const pwField = document.getElementById("share_password");
  const linkBox = document.getElementById("share_link");

  let vote = getCurrentVote();
  let encoded = btoa(JSON.stringify(vote));
  let url = `${location.origin}${location.pathname}?data=${encoded}`;
  linkBox.value = url;

  popup.style.display = "block";

  checkbox.onchange = updateShareLink;
  pwField.oninput = updateShareLink;
}

function updateShareLink() {
  const checkbox = document.getElementById("share_protect");
  const pw = document.getElementById("share_password").value;
  const linkBox = document.getElementById("share_link");

  let vote = getCurrentVote();
  let encoded = btoa(JSON.stringify(vote));
  let url = `${location.origin}${location.pathname}?data=${encoded}`;

  if (checkbox.checked && pw.length > 0)
    url += `&pw=${encodeURIComponent(pw)}`;

  linkBox.value = url;
}

function share_close() {
  document.getElementById("share_popup").style.display = "none";
  document.getElementById("share_qr").style.display = "none";
}

function share_copy() {
  const box = document.getElementById("share_link");
  box.select();
  navigator.clipboard.writeText(box.value);
}

function share_showQR() {
  let container = document.getElementById("share_qr");
  container.innerHTML = "";
  new QRCode(container, document.getElementById("share_link").value);
  container.style.display = "block";
}

/* ======================================================
   IMPORT FROM SHARED LINK  (WITH PASSWORD CHECK)
   ====================================================== */

function importVoteFromLink() {
  const params = new URLSearchParams(location.search);
  const data = params.get("data");
  const pw = params.get("pw");

  if (!data) return;

  let decoded = JSON.parse(atob(data));

  if (pw) {
    let input = prompt("Enter password to access this vote:");
    if (input !== pw) {
      alert("Incorrect password.");
      return;
    }
  }

  saveCurrentVote(decoded);
}



