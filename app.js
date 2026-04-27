/* ═══════════════════════════════════════════════
   DCIT 101 — NEXUS PASSCO QUIZ  |  app.js
   ═══════════════════════════════════════════════ */

import { initializeApp }                    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue }  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/* ─────────────────────────────────────────────
   FIREBASE INITIALISATION
   API key is loaded from config.js (not committed
   to source control). See config.js.example.
───────────────────────────────────────────── */
import { firebaseConfig } from "./config.js";

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */

/** Nicknames that unlock Elite gold-glow status */
const ELITE_NAMES = [
  "dii", "naa naa", "away", "nhyira", "kylie",
  "wagwan", "jesse", "bongolokwekwe", "chantelle", "suabira"
];

/** Elite emoji badge appended to display name */
const ELITE_EMOJI = "⭐";

const WARRIORS = [
  { id: "male1", emoji: "⚔️",  label: "Warrior"  },
  { id: "male2", emoji: "🧙",  label: "Mage"     },
  { id: "male3", emoji: "🥷",  label: "Ninja"    },
  { id: "male4", emoji: "🕵️", label: "Agent"    },
  { id: "male5", emoji: "🦄",  label: "Maverick" },
];

const ANDROIDS = [
  { id: "fem1", emoji: "🤖", label: "Android"  },
  { id: "fem2", emoji: "👾", label: "CyberBot" },
  { id: "fem3", emoji: "🎭", label: "Mech"     },
  { id: "fem4", emoji: "🧠", label: "BioBot"   },
  { id: "fem5", emoji: "💫", label: "NovaStar" },
];

const SPECIAL     = [{ id: "anon", emoji: "👤", label: "Shadow" }];
const DEV_AVATAR  = { id: "dev",  emoji: "👑", label: "Developer", dev: true };
const DEFAULT_AVT = { id: "anon", emoji: "👤", label: "Anon" };

/* ─────────────────────────────────────────────
   APPLICATION STATE
───────────────────────────────────────────── */
const state = {
  nickname:     "",
  displayName:  "",       // may include elite emoji
  avatar:       null,
  isElite:      false,
  isRicky:      false,
  selectedYear: null,
  questions:    [],
  currentQ:     0,
  score:        0,
  correct:      0,
  wrong:        0,
  streak:       0,
  maxStreak:    0,
  answered:     false,
  pendingIndex: null,     // single-click "pending" option index
  prevScreen:   "screen-year",

  // Scenario Cases state
  scScore:   0,
  scCorrect: 0,
  scWrong:   0,
};

let nexusTimerInterval = null;
let nexusVisible       = false;

/* ─────────────────────────────────────────────
   UTILITY HELPERS
───────────────────────────────────────────── */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pad(n) { return String(n).padStart(2, "0"); }

function getAvatarEmoji(id) {
  const all = [...WARRIORS, ...ANDROIDS, ...SPECIAL, DEV_AVATAR, DEFAULT_AVT];
  return (all.find(a => a.id === id) || DEFAULT_AVT).emoji;
}

function isEliteName(name) {
  return ELITE_NAMES.includes(name.toLowerCase().trim());
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) { el.classList.add("active"); void el.offsetWidth; }
}

function showToast(msg, type = "") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className   = `toast ${type} show`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 3500);
}

/* ─────────────────────────────────────────────
   AVATAR MODAL
───────────────────────────────────────────── */
function renderAvatarModal(isRicky) {
  function buildGrid(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    items.forEach(av => {
      const btn = document.createElement("button");
      btn.className            = "avatar-btn" + (av.dev ? " dev" : "");
      btn.setAttribute("data-id", av.id);
      btn.setAttribute("title",   av.label);
      btn.innerHTML = av.emoji + (av.dev ? '<span class="dev-label">DEV</span>' : "");
      if (state.avatar === av.id) btn.classList.add("selected");
      btn.addEventListener("click", e => { e.stopPropagation(); selectAvatar(av.id, btn); });
      container.appendChild(btn);
    });
  }

  buildGrid("grid-warriors", WARRIORS);
  buildGrid("grid-androids", ANDROIDS);

  const specialItems = isRicky ? [...SPECIAL, DEV_AVATAR] : [...SPECIAL];
  const sectionLabel = document.getElementById("section-special");
  if (sectionLabel) sectionLabel.textContent = isRicky ? "🎖 Special & Developer" : "🎖 Special";
  buildGrid("grid-special", specialItems);
}

function selectAvatar(id, btn) {
  document.querySelectorAll(".avatar-btn").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
  state.avatar = id;

  const all = [...WARRIORS, ...ANDROIDS, ...SPECIAL, DEV_AVATAR];
  const found = all.find(a => a.id === id) || DEFAULT_AVT;

  const previewIcon = document.getElementById("avatar-preview-icon");
  previewIcon.textContent = found.emoji;
  previewIcon.className   = "avatar-preview-icon" + (id === "dev" ? " dev-preview" : "");

  document.getElementById("avatar-trigger-title").textContent = found.label;
  document.getElementById("avatar-trigger-sub").textContent   = "Avatar selected ✓";

  const triggerRow = document.getElementById("avatar-trigger");
  triggerRow.classList.add("has-avatar");
  triggerRow.classList.toggle("elite-avatar", state.isElite);

  setTimeout(() => closeAvatarModal(), 280);
}

window.openAvatarModal = function () {
  renderAvatarModal(state.isRicky);
  document.getElementById("avatar-overlay").classList.add("open");
  document.body.style.overflow = "hidden";
};

window.closeAvatarModal = function () {
  document.getElementById("avatar-overlay").classList.remove("open");
  document.body.style.overflow = "";
};

window.handleOverlayClick = function (e) {
  if (e.target === document.getElementById("avatar-overlay")) closeAvatarModal();
};

/* ─────────────────────────────────────────────
   NICKNAME INPUT — Elite + Ricky detection
───────────────────────────────────────────── */
document.getElementById("nickname").addEventListener("input", function () {
  const val     = this.value.trim();
  const isRicky = val.toLowerCase() === "ricky";
  const isElite = isEliteName(val);

  state.isRicky = isRicky;
  state.isElite = isElite;

  // Visual feedback on the input itself
  this.classList.toggle("ricky-input", isRicky && !isElite);
  this.classList.toggle("elite-input", isElite);

  // Avatar modal re-render if open
  if (document.getElementById("avatar-overlay").classList.contains("open")) {
    renderAvatarModal(isRicky);
  }

  // Toasts
  if (isElite) {
    showToast(`${ELITE_EMOJI} Elite status detected — welcome, ${val}!`, "warn");
  } else if (isRicky) {
    showToast("👑 Developer avatar unlocked!", "warn");
  }

  // Update avatar trigger border if already selected
  const triggerRow = document.getElementById("avatar-trigger");
  triggerRow.classList.toggle("elite-avatar", isElite && !!state.avatar);
});

/* ─────────────────────────────────────────────
   SETUP SCREEN — Start
───────────────────────────────────────────── */
window.startSetup = function () {
  const nick = document.getElementById("nickname").value.trim();
  if (!nick) { showToast("Please enter a nickname!", "error"); return; }

  // Assign default avatar if none selected
  if (!state.avatar) {
    state.avatar = DEFAULT_AVT.id;
    showToast("👤 No avatar selected — Anon profile assigned.", "warn");
  }

  state.nickname    = nick;
  state.isElite     = isEliteName(nick);
  state.isRicky     = nick.toLowerCase() === "ricky";
  state.displayName = state.isElite ? `${nick} ${ELITE_EMOJI}` : nick;

  showScreen("screen-year");
};

/* ─────────────────────────────────────────────
   YEAR SELECT — Nexus Speed Test countdown
───────────────────────────────────────────── */
window.triggerNexusLock = function () {
  nexusVisible = !nexusVisible;
  const cd = document.getElementById("nexus-countdown");
  if (nexusVisible) {
    cd.classList.add("show");
    startCountdown();
    showToast("⏳ Nexus Speed Test is not yet available.", "warn");
  } else {
    cd.classList.remove("show");
    if (nexusTimerInterval) { clearInterval(nexusTimerInterval); nexusTimerInterval = null; }
  }
};

function startCountdown() {
  if (nexusTimerInterval) clearInterval(nexusTimerInterval);
  const TARGET = new Date("2026-05-01T12:00:00").getTime();

  function tick() {
    const diff = TARGET - Date.now();
    if (diff <= 0) {
      ["cd-days","cd-hours","cd-mins","cd-secs"].forEach(id => {
        document.getElementById(id).textContent = "00";
      });
      clearInterval(nexusTimerInterval);
      return;
    }
    document.getElementById("cd-days").textContent  = pad(Math.floor(diff / 86400000));
    document.getElementById("cd-hours").textContent = pad(Math.floor((diff % 86400000) / 3600000));
    document.getElementById("cd-mins").textContent  = pad(Math.floor((diff % 3600000)  / 60000));
    document.getElementById("cd-secs").textContent  = pad(Math.floor((diff % 60000)    / 1000));
  }
  tick();
  nexusTimerInterval = setInterval(tick, 1000);
}

/* ─────────────────────────────────────────────
   DIAGRAM / SCENARIO LOCK HANDLER
   Keeps Scenario Cases locked and shows alert/toast
───────────────────────────────────────────── */
window.triggerDiagramLock = function () {
  const el = document.getElementById("diagram-alert");
  if (!el) {
    showToast("This section is currently restricted.", "error");
    return;
  }
  el.classList.add("show");
  try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {}
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 4000);
  showToast("🚫 Scenario Cases are restricted.", "error");
};

/* ─────────────────────────────────────────────
   SCENARIO CASES — Scrollable document mode
───────────────────────────────────────────── */
window.openScenarioCases = function () {
  state.scScore = 0; state.scCorrect = 0; state.scWrong = 0;
  renderScenarioPaper();
  showScreen("screen-scenario");
  updateScenarioScoreBar();
};

function updateScenarioScoreBar() {
  const el = document.getElementById("sc-live-score");
  if (el) el.textContent = state.scScore;
  const el2 = document.getElementById("sc-live-correct");
  if (el2) el2.textContent = state.scCorrect;
  const el3 = document.getElementById("sc-live-wrong");
  if (el3) el3.textContent = state.scWrong;
}

function renderScenarioPaper() {
  const container = document.getElementById("scenario-paper-body");
  if (!container) return;
  container.innerHTML = "";

  SCENARIO_QUESTIONS.forEach((q, idx) => {
    const keys    = ["A","B","C","D","E"];
    let   pending = null;  // track single-click pending option per question

    // ── Item wrapper
    const item = document.createElement("div");
    item.className = "sc-item";

    // ── Header
    const header = document.createElement("div");
    header.className = "sc-item-header";
    header.innerHTML = `
      <span class="sc-number">Q${idx + 1}</span>
      <span class="sc-topic-badge">${q.topic}</span>
    `;
    item.appendChild(header);

    // ── Question text
    const qText = document.createElement("p");
    qText.className   = "sc-question";
    qText.textContent = q.q;
    item.appendChild(qText);

    // ── Options
    const optList = document.createElement("div");
    optList.className = "sc-options";

    const optBtns = [];

    q.opts.forEach((opt, oi) => {
      const btn = document.createElement("div");
      btn.className = "sc-opt";
      btn.setAttribute("role", "button");
      btn.setAttribute("tabindex", "0");
      btn.innerHTML = `
        <span class="sc-opt-key">${keys[oi] || oi + 1}</span>
        <span>${opt}</span>
        <span class="dbl-hint">↩ double-click to confirm</span>
      `;

      // ── SINGLE CLICK — set pending, clear other pending
      btn.addEventListener("click", () => {
        if (btn.getAttribute("data-locked")) return;

        // Clear previous pending in this question
        optBtns.forEach(b => b.classList.remove("pending"));

        if (pending === oi) {
          // Already pending, single click again — do NOT select; wait for dbl
          btn.classList.add("pending");
        } else {
          pending = oi;
          btn.classList.add("pending");
        }
      });

      // ── DOUBLE CLICK — finalise selection
      btn.addEventListener("dblclick", () => {
        if (btn.getAttribute("data-locked")) return;
        commitScenarioAnswer(oi, q, optBtns, feedback, idx);
        pending = null;
      });

      optList.appendChild(btn);
      optBtns.push(btn);
    });

    item.appendChild(optList);

    // ── Feedback
    const feedback = document.createElement("div");
    feedback.className = "sc-feedback";
    item.appendChild(feedback);

    container.appendChild(item);
  });
}

function commitScenarioAnswer(chosen, q, optBtns, feedback, idx) {
  // Lock all options in this question
  optBtns.forEach(b => {
    b.setAttribute("data-locked", "true");
    b.classList.remove("pending");
  });

  const isCorrect = chosen === q.ans;

  optBtns[chosen].classList.add(isCorrect ? "correct" : "wrong");
  if (!isCorrect && optBtns[q.ans]) optBtns[q.ans].classList.add("correct");

  if (isCorrect) { state.scScore++; state.scCorrect++; }
  else           { state.scWrong++; }

  feedback.className = `sc-feedback ${isCorrect ? "correct" : "wrong"} show`;
  feedback.innerHTML = isCorrect
    ? `✅ <strong>Correct!</strong> ${q.exp}`
    : `❌ <strong>Incorrect.</strong> Correct: <strong>${q.opts[q.ans]}</strong>. ${q.exp}`;

  updateScenarioScoreBar();
}

window.finishScenario = function () {
  showScreen("screen-year");
  const total = SCENARIO_QUESTIONS.length;
  showToast(
    `Scenario Cases complete! ${state.scCorrect}/${total} correct.`,
    state.scCorrect >= total * 0.6 ? "success" : "warn"
  );
};

window.backFromScenario = function () { showScreen("screen-year"); };

/* ─────────────────────────────────────────────
   REGULAR QUIZ — Start
───────────────────────────────────────────── */
window.startQuiz = function (year) {
  state.selectedYear = year;
  state.questions    = shuffle([...QUESTIONS[year]]);
  state.currentQ     = 0;
  state.score        = 0;
  state.correct      = 0;
  state.wrong        = 0;
  state.streak       = 0;
  state.maxStreak    = 0;
  state.answered     = false;
  state.pendingIndex = null;

  // Clean up nexus timer
  if (nexusTimerInterval) { clearInterval(nexusTimerInterval); nexusTimerInterval = null; nexusVisible = false; }
  document.getElementById("nexus-countdown").classList.remove("show");

  // Player header
  const avEmoji = getAvatarEmoji(state.avatar);
  const avSm    = document.getElementById("quiz-avatar-sm");
  avSm.textContent = avEmoji;
  avSm.className   = "quiz-avatar-sm" +
    (state.avatar === "dev"  ? " dev"   : "") +
    (state.isElite           ? " elite" : "");

  const nameEl = document.getElementById("quiz-player-name");
  nameEl.textContent = state.displayName;
  nameEl.className   = "player-name" + (state.isElite ? " elite-name" : "");

  document.getElementById("q-year-badge").textContent = year;

  showScreen("screen-quiz");
  renderQuestion();
};

/* ─────────────────────────────────────────────
   REGULAR QUIZ — Render question
───────────────────────────────────────────── */
function renderQuestion() {
  const q     = state.questions[state.currentQ];
  const total = state.questions.length;
  const idx   = state.currentQ + 1;

  document.getElementById("q-topic").textContent   = q.topic;
  document.getElementById("q-counter").textContent = `Q ${pad(idx)} / ${total}`;
  document.getElementById("q-text").textContent    = q.q;
  document.getElementById("progress-fill").style.width = ((idx - 1) / total * 100) + "%";
  document.getElementById("quiz-score").textContent  = state.score;
  document.getElementById("quiz-streak").textContent = state.streak;

  const keys = ["A","B","C","D","E"];
  const list = document.getElementById("options-list");
  list.innerHTML = "";
  state.pendingIndex = null;

  q.opts.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.innerHTML = `
      <span class="option-key">${keys[i] || i + 1}</span>
      <span>${opt}</span>
      <span class="dbl-hint">↩ double-click to confirm</span>
    `;

    // ── SINGLE CLICK — pending affordance
    btn.addEventListener("click", () => {
      if (state.answered) return;
      // Clear all pending
      list.querySelectorAll(".option-btn").forEach(b => b.classList.remove("pending"));
      state.pendingIndex = i;
      btn.classList.add("pending");
    });

    // ── DOUBLE CLICK — finalise answer
    btn.addEventListener("dblclick", () => {
      if (state.answered) return;
      selectAnswer(i);
    });

    list.appendChild(btn);
  });

  document.getElementById("feedback-bar").className = "feedback-bar";
  document.getElementById("next-wrap").classList.remove("show");
  state.answered = false;
}

/* ─────────────────────────────────────────────
   REGULAR QUIZ — Commit answer
───────────────────────────────────────────── */
function selectAnswer(chosen) {
  if (state.answered) return;
  state.answered = true;

  const q    = state.questions[state.currentQ];
  const btns = document.querySelectorAll(".option-btn");
  btns.forEach(b => { b.disabled = true; b.classList.remove("pending"); });

  const isCorrect = chosen === q.ans;
  btns[chosen].classList.add(isCorrect ? "correct" : "wrong");
  if (!isCorrect && btns[q.ans]) btns[q.ans].classList.add("correct");

  if (isCorrect) {
    state.score++; state.correct++; state.streak++;
    if (state.streak > state.maxStreak) state.maxStreak = state.streak;
    if (state.streak >= 3) triggerStreakPopup();
  } else {
    state.wrong++;
    state.streak = 0;
  }

  document.getElementById("quiz-score").textContent  = state.score;
  document.getElementById("quiz-streak").textContent = state.streak;

  const fb   = document.getElementById("feedback-bar");
  const icon = document.getElementById("feedback-icon");
  const text = document.getElementById("feedback-text");

  fb.className      = `feedback-bar ${isCorrect ? "correct" : "wrong"} show`;
  icon.textContent  = isCorrect ? "✅" : "❌";
  text.innerHTML    = isCorrect
    ? `<strong>Correct!</strong> ${q.exp}`
    : `<strong>Incorrect.</strong> Correct: ${q.opts[q.ans]}. ${q.exp}`;

  document.getElementById("next-wrap").classList.add("show");
}

/* ─────────────────────────────────────────────
   REGULAR QUIZ — Next question / End
───────────────────────────────────────────── */
window.nextQuestion = function () {
  state.currentQ++;
  if (state.currentQ >= state.questions.length) endQuiz();
  else renderQuestion();
};

function endQuiz() {
  const total = state.questions.length;
  const pct   = Math.round(state.score / total * 100);
  const grade = pct >= 80 ? "DISTINCTION 🏆"
    : pct >= 60 ? "CREDIT 🎖"
    : pct >= 50 ? "PASS ✅"
    : "KEEP STUDYING 📚";

  const avatarEl = document.getElementById("result-avatar");
  avatarEl.textContent = getAvatarEmoji(state.avatar);
  avatarEl.className   = "result-avatar" +
    (state.avatar === "dev" ? " dev"   : "") +
    (state.isElite          ? " elite" : "");

  const nameEl = document.getElementById("result-name");
  nameEl.textContent = state.displayName;
  nameEl.className   = "result-name" + (state.isElite ? " elite-name" : "");

  document.getElementById("result-grade").textContent   = grade;
  document.getElementById("res-correct").textContent    = state.correct;
  document.getElementById("res-wrong").textContent      = state.wrong;
  document.getElementById("res-streak").textContent     = state.maxStreak;
  document.getElementById("res-year").textContent       = state.selectedYear;
  document.getElementById("ring-pct").textContent       = pct + "%";

  showScreen("screen-results");

  setTimeout(() => {
    const circumference = 2 * Math.PI * 65;
    document.getElementById("ring-fill").style.strokeDashoffset =
      circumference - (pct / 100 * circumference);
  }, 300);

  saveScore(pct);
}

/* ─────────────────────────────────────────────
   FIREBASE — Save score
───────────────────────────────────────────── */
async function saveScore(pct) {
  try {
    await push(ref(db, "dcit101_scores"), {
      nickname:     state.nickname,
      displayName:  state.displayName,
      avatar:       state.avatar,
      isElite:      state.isElite,
      score:        state.score,
      total:        state.questions.length,
      percentage:   pct,
      maxStreak:    state.maxStreak,
      yearCategory: state.selectedYear,
      timestamp:    Date.now(),
    });
    showToast("✅ Score saved to leaderboard!", "success");
  } catch (e) {
    showToast("⚠️ Could not save score.", "error");
    console.error("Firebase save error:", e);
  }
}

/* ─────────────────────────────────────────────
   LEADERBOARD
───────────────────────────────────────────── */
window.showLeaderboard = function () {
  state.prevScreen = document.querySelector(".screen.active")?.id || "screen-year";
  document.getElementById("lb-back-btn").onclick = () => showScreen(state.prevScreen);
  showScreen("screen-leaderboard");

  const list = document.getElementById("lb-list");
  list.innerHTML = '<div class="lb-empty"><div class="spinner"></div><p>Loading scores…</p></div>';

  onValue(ref(db, "dcit101_scores"), snapshot => {
    const data = snapshot.val();
    if (!data) {
      list.innerHTML = '<div class="lb-empty">No scores yet. Be the first! 🚀</div>';
      return;
    }
    const entries = Object.values(data)
      .sort((a, b) => b.score - a.score || b.percentage - a.percentage);

    list.innerHTML = "";
    entries.forEach((entry, i) => {
      const rankClass  = i === 0 ? "r1" : i === 1 ? "r2" : i === 2 ? "r3" : "other";
      const rankSymbol = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
      const isEliteRow = entry.isElite;
      const row        = document.createElement("div");
      row.className    = "lb-row" + (isEliteRow ? " elite-row" : "");
      row.innerHTML    = `
        <span class="lb-rank ${rankClass}">${rankSymbol}</span>
        <span class="lb-avatar">${getAvatarEmoji(entry.avatar)}</span>
        <div class="lb-info">
          <div class="lb-name${isEliteRow ? " elite-name" : ""}">${entry.displayName || entry.nickname}</div>
          <div class="lb-detail">🔥 Streak: ${entry.maxStreak || 0}</div>
        </div>
        <span class="lb-year">${entry.yearCategory}</span>
        <span class="lb-score">${entry.score}/${entry.total || 20}</span>
      `;
      list.appendChild(row);
    });
  }, { onlyOnce: true });
};

/* ─────────────────────────────────────────────
   STREAK POPUP
───────────────────────────────────────────── */
function triggerStreakPopup() {
  const popup = document.getElementById("streak-popup");
  document.getElementById("streak-popup-num").textContent = state.streak;
  popup.style.display = "block";
  void popup.offsetWidth;
  clearTimeout(popup._t);
  popup._t = setTimeout(() => { popup.style.display = "none"; }, 2200);
}

/* ─────────────────────────────────────────────
   NAV HELPERS
───────────────────────────────────────────── */
window.quitQuiz   = function () { showScreen("screen-year"); };
window.playAgain  = function () { showScreen("screen-year"); };

/* ════════════════════════════════════════════
   QUESTION BANK
   ════════════════════════════════════════════ */

/* ── SCENARIO CASES — Scrollable, document-style ── */
const SCENARIO_QUESTIONS = [
  {
    topic: "Logic Gates",
    q: "The diagrams below (A–D) represent logic gates. Diagram A has two inputs and a shield/curved-front shape. Which gate does it represent?",
    opts: ["NOT gate","NAND gate","OR gate","AND gate"],
    ans: 2,
    exp: "The OR gate has a curved back and pointed front (shield shape)."
  },
  {
    topic: "Logic Gates",
    q: "Diagram B shows an AND-shaped body (flat back, curved front) with a small circle (bubble) at its output. Which gate does this represent?",
    opts: ["AND gate","NAND gate","NOR gate","XOR gate"],
    ans: 1,
    exp: "NAND = AND body + inversion bubble at output."
  },
  {
    topic: "Logic Gates",
    q: "Diagram C shows a triangle shape with a single input and a bubble at the output. Which gate does it represent?",
    opts: ["NOR gate","Buffer","NOT gate","XNOR gate"],
    ans: 2,
    exp: "The NOT gate (inverter) is a triangle with a bubble — single input, single inverted output."
  },
  {
    topic: "Logic Gates",
    q: "Which of the following logic gate diagrams is NOT shown in Diagrams A–D (i.e., which must be answered as 'None of the above')?",
    opts: ["OR gate","NAND gate","NOT gate","AND gate"],
    ans: 3,
    exp: "The AND gate does not appear among diagrams A–C in the paper, so the answer is 'None of the above diagrams'."
  },
  {
    topic: "Boolean Logic — Traveler Scenario",
    q: "A traveler goes by car on weekends; on weekdays takes a train (distance ≤ 200 miles) or books a flight (distance > 200 miles). Let A = weekday, B = distance ≤ 200. Which Boolean expression represents Car_travel (X)?",
    opts: ["X = A AND B","X = NOT A","X = A AND NOT B","X = NOT A AND B"],
    ans: 1,
    exp: "Car = weekend = NOT weekday. Since A represents weekday, X = NOT A."
  },
  {
    topic: "Boolean Logic — Traveler Scenario",
    q: "Using the same scenario and variables (A = weekday, B = distance ≤ 200), which expression represents Train_travel (Y)?",
    opts: ["Y = A AND B","Y = NOT A","Y = A AND NOT B","Y = NOT A AND B"],
    ans: 0,
    exp: "Train = weekday AND distance ≤ 200 = A AND B."
  },
  {
    topic: "Boolean Logic — Traveler Scenario",
    q: "Using the same variables, which expression represents Air_travel (Z)?",
    opts: ["Z = A AND B","Z = NOT A","Z = A AND NOT B","Z = NOT A AND B"],
    ans: 2,
    exp: "Air = weekday AND distance > 200 = A AND NOT B (distance NOT ≤ 200)."
  },
  {
    topic: "Boolean Logic — Water Heating System",
    q: "A water heating system outputs F1=1 (switch off) when the water level in the hot tank is too low (C=0) AND the temperature is too high (B=0). Which truth table correctly represents this condition?",
    opts: [
      "Table A: F1=1 for rows where B=0 AND C=0 (regardless of A)",
      "Table B: F1=1 for rows where A=0 AND B=1",
      "Table C: F1=1 for all rows where A=0",
      "Table D: F1=1 only when all inputs are 0"
    ],
    ans: 0,
    exp: "The fault depends only on B=0 (high temp) AND C=0 (low level). A (radiator flow) does not affect this condition."
  },
  {
    topic: "Boolean Logic — Water Heating System",
    q: "The fault condition is: water FLOW in radiators too low (A=0) AND hot water temperature too high (B=0). Which truth table represents this?",
    opts: [
      "Table A: F1=1 when B=0 AND C=0",
      "Table B: F1=1 when A=0 AND B=0 (regardless of C)",
      "Table C: F1=1 for all rows A=0, any B or C",
      "Table D: F1=1 when A=1 AND B=0"
    ],
    ans: 1,
    exp: "The fault is A=0 AND B=0. C (water level) plays no role in this particular condition."
  },
  {
    topic: "Boolean Logic — Water Heating System",
    q: "A fault circuit must output 1 when: hot water temp is WITHIN limits (B=1), water flow is too low (A=0), and water level is too low (C=0). Which circuit correctly implements this as B AND (NOT A) AND (NOT C)?",
    opts: [
      "Circuit A: NOT gate on A, then OR all three into AND",
      "Circuit B: NOT on A, NOT on C, then AND with B",
      "Circuit C: AND gate directly on A, B, C with no inversion",
      "Circuit D: NAND on A and B, then AND with C"
    ],
    ans: 1,
    exp: "The expression is B AND NOT-A AND NOT-C. Circuit B correctly inverts A and C before feeding all three into an AND gate."
  },
  {
    topic: "Assembly Language Trace",
    q: "Assembly program starts with ACC=0, mem201=10, mem202=0, mem203=204, mem204=5. Instruction: LDD 201. What is the accumulator after execution?",
    opts: ["ACC = 0","ACC = 10","ACC = 201","ACC = 5"],
    ans: 1,
    exp: "LDD 201 = direct load: ACC ← value stored at address 201 = 10."
  },
  {
    topic: "Assembly Language Trace",
    q: "After LDD 201 (ACC=10), instruction INC ACC executes. What is ACC now?",
    opts: ["ACC = 10","ACC = 9","ACC = 11","ACC = 201"],
    ans: 2,
    exp: "INC ACC increments by 1: 10 + 1 = 11."
  },
  {
    topic: "Assembly Language Trace",
    q: "After INC ACC (ACC=11), instruction STO 202 executes. Which memory location changes and to what value?",
    opts: ["mem201 becomes 11","mem202 becomes 11","mem203 becomes 11","mem204 becomes 11"],
    ans: 1,
    exp: "STO 202 stores ACC (11) into address 202. mem202 = 11."
  },
  {
    topic: "Assembly Language Trace",
    q: "After STO 202, instruction LDI 203 executes. mem203 holds 204 and mem204 holds 5. What is ACC after this instruction?",
    opts: ["ACC = 203","ACC = 204","ACC = 5","ACC = 11"],
    ans: 2,
    exp: "LDI 203 = indirect. Go to mem203 → find address 204 → load value at mem204 = 5. ACC = 5."
  },
  {
    topic: "Assembly Language Trace",
    q: "After LDI 203 (ACC=5), instruction DEC ACC executes. What is ACC?",
    opts: ["ACC = 6","ACC = 4","ACC = 5","ACC = 0"],
    ans: 1,
    exp: "DEC ACC decrements by 1: 5 - 1 = 4."
  },
  {
    topic: "Assembly Language Trace",
    q: "After DEC ACC (ACC=4), instruction STO 201 executes. What does mem201 now contain?",
    opts: ["10 (unchanged)","11","4","5"],
    ans: 2,
    exp: "STO 201 stores ACC (4) into address 201. mem201 = 4."
  },
  {
    topic: "Assembly Language Trace",
    q: "After STO 201, instruction ADD 204 executes (mem204=5, ACC=4). What is ACC after addition?",
    opts: ["ACC = 5","ACC = 9","ACC = 20","ACC = 4"],
    ans: 1,
    exp: "ADD 204: ACC ← ACC + value at mem204 = 4 + 5 = 9."
  },
  {
    topic: "Assembly Language Trace",
    q: "After ADD 204 (ACC=9), instruction STO 201 executes. What is the FINAL value of mem201?",
    opts: ["4","10","11","9"],
    ans: 3,
    exp: "STO 201 stores ACC (9) into mem201. Final state: ACC=9, mem201=9, mem202=11."
  },
  {
    topic: "Computer Block Diagram",
    q: "In the basic computer block diagram shown in the exam, Main Memory is at the top with bidirectional arrows to the central box Q13. An arrow goes from Q12 into Q13 and another from Q13 to Q14. Q15 is below Q13. What is Q12?",
    opts: ["Output device","Auxiliary Storage","CPU","Input device"],
    ans: 3,
    exp: "Q12 is the Input device — it feeds data INTO the CPU (Q13)."
  },
  {
    topic: "Computer Block Diagram",
    q: "Using the same diagram, what does Q13 (the central processing block connected to all others) represent?",
    opts: ["Output device","Auxiliary Storage","CPU","Control Unit"],
    ans: 2,
    exp: "Q13 is the CPU — the central unit that communicates with memory, input, output and storage."
  },
  {
    topic: "Computer Block Diagram",
    q: "Q14 receives a one-way arrow FROM Q13. What is Q14?",
    opts: ["Output device","Auxiliary Storage","CPU","Input device"],
    ans: 0,
    exp: "Q14 is the Output device — it receives processed results from the CPU."
  },
  {
    topic: "Computer Block Diagram",
    q: "Q15 is below Q13 with a bidirectional arrow. What is Q15?",
    opts: ["Output device","Auxiliary Storage","CPU","Control Unit"],
    ans: 1,
    exp: "Q15 is Auxiliary (secondary) Storage — bidirectional because data can be read from or written to it."
  },
  {
    topic: "Bitmap & Sound Representation",
    q: "A bitmap image has resolution 1024 × 768 and colour depth of 8 bits. A separate audio file is 5 minutes long, sampled at 100 samples/second with 16-bit resolution. What is the size of the BITMAP image file in bits?",
    opts: ["6,291,456 bits","786,432 bits","1,024 bits","60,000 bits"],
    ans: 0,
    exp: "Size = 1024 × 768 × 8 = 6,291,456 bits."
  },
  {
    topic: "Bitmap & Sound Representation",
    q: "Using the same scenario, what is the size of the 5-minute AUDIO file in bits?",
    opts: ["6,291,456 bits","48,000 bits","480,000 bits","60,000 bits"],
    ans: 2,
    exp: "Size = 5 min × 60 s × 100 samples/s × 16 bits = 480,000 bits."
  },
  {
    topic: "Number Systems — Two's Complement",
    q: "Binary pattern 10100110 is given. What is its value if it represents an 8-bit two's complement integer?",
    opts: ["-90","-38","A6","166"],
    ans: 0,
    exp: "MSB is 1 → negative. Value = -128 + 32 + 4 + 2 = -90."
  },
  {
    topic: "Number Systems — Two's Complement",
    q: "Same binary pattern 10100110. What is its value as an 8-bit sign-and-magnitude integer?",
    opts: ["A6","-90","6A","-38"],
    ans: 3,
    exp: "Sign bit = 1 (negative). Magnitude = 0100110 = 32+4+2 = 38. Value = -38."
  },
  {
    topic: "Number Systems — Hexadecimal",
    q: "Same binary pattern 10100110. What is its value as a hexadecimal number?",
    opts: ["A6","-90","6A","-38"],
    ans: 0,
    exp: "Split into nibbles: 1010 = A, 0110 = 6. Hex value = A6."
  },
  {
    topic: "Number Systems — Conversion",
    q: "Binary number 00011110101010100 needs to be converted to hexadecimal. Which process is correct?",
    opts: [
      "Group from the left in fours, convert each group",
      "Group from the right in fours, pad with leading zeros if needed, then convert each nibble",
      "Convert to denary first, then divide repeatedly by 16",
      "Count total bits and divide by 4"
    ],
    ans: 1,
    exp: "Always group from the right (LSB side) into nibbles of 4, padding the leftmost group with zeros if necessary."
  },
  {
    topic: "Disk Capacity Calculation",
    q: "A disk has: 512 bytes/sector, 300 sectors/track, 20,000 tracks/surface, 2 surfaces/platter, 5 platters. Using C = N × S × T × SP × P, what is the capacity?",
    opts: ["28.6 KB","28.6 MB","28.6 GB","28.6 TB"],
    ans: 2,
    exp: "C = 512 × 300 × 20,000 × 2 × 5 = 30,720,000,000 bytes ≈ 28.6 GB."
  },
  {
    topic: "Fibre Optic Modes",
    q: "The number of modes in a fibre is given by: modes = (πd/λ × √(n₁²−n₂²))² / 2. For d=20mm, λ=1200m (f=0.25MHz), n₁=1.5, n₂=1.48, the result is extremely small — what does this tell us?",
    opts: [
      "The fibre supports thousands of modes",
      "The fibre operates in single-mode at this frequency",
      "The calculation is invalid for low frequencies",
      "The fibre cannot carry any signal"
    ],
    ans: 1,
    exp: "At 0.25 MHz the wavelength is enormous (1200 m) relative to the 20 mm core, giving far fewer than 1 mode — meaning effectively single-mode operation at this frequency."
  },
];

/* ── REGULAR QUIZ QUESTION BANK ── */
const QUESTIONS = {
  2022: [
    { topic: "Operating Systems",       q: "A/an ___ is a signal from a device that causes the OS to stop and figure out what to do next.",             opts: ["Software","Hardware","Instruction","Interrupt"],                              ans: 3, exp: "An interrupt signals the CPU to stop and handle an event." },
    { topic: "Operating Systems",       q: "A program in a state of execution is called a/an ___",                                                        opts: ["File","Process","Software bug","Interrupt"],                                  ans: 1, exp: "A process is a program currently executing in memory." },
    { topic: "Language Translators",    q: "The ___ combines modules into one program.",                                                                   opts: ["Compiler","Linker","Translator","Assembler"],                                 ans: 1, exp: "The linker combines compiled object files into one executable." },
    { topic: "Computer History",        q: "The highest award in computing is named after which personality?",                                             opts: ["Douglas Howard","Gordon Moore","Alan Turing","Grace Hooper"],                 ans: 2, exp: "The ACM Turing Award is computing's equivalent of the Nobel Prize." },
    { topic: "Von Neumann Architecture",q: "The fundamental principle underpinning modern computers is ___",                                               opts: ["Fetch-execute cycle","Fetch-execute decode cycle","Stored program concept","None of the above"], ans: 2, exp: "The stored-program concept: instructions and data share the same memory." },
    { topic: "Software Types",          q: "___ is available under a license permitting use, change, and redistribution.",                                opts: ["Application","Operating System","Freeware","Open Source Software"],           ans: 3, exp: "Open Source Software allows viewing, modifying and redistributing source code." },
    { topic: "Computer Hardware",       q: "A computer's ___ consists of electronic devices; the parts you can see and touch.",                           opts: ["Software","Hardware","Firmware","Freeware"],                                  ans: 1, exp: "Hardware refers to all physical, tangible components of a computer." },
    { topic: "Memory",                  q: "A ___ is volatile, losing contents when power goes off.",                                                      opts: ["RAM","ROM","Hard drive","Solid State Drive"],                                 ans: 0, exp: "RAM is volatile — it requires continuous power to retain data." },
    { topic: "Programming Basics",      q: "A program is a set of ___ written in the language of the computer.",                                          opts: ["Codes","Signs","Words","Instructions"],                                       ans: 3, exp: "A program is a set of instructions that the CPU executes." },
    { topic: "Computer Hardware",       q: "The electronic and mechanical elements of the computer are known as?",                                         opts: ["Devices","Peripherals","Hardware","Software"],                                ans: 2, exp: "Hardware encompasses all physical/electronic components." },
    { topic: "Software Types",          q: "What term describes all the various programs used on a computer system?",                                      opts: ["Codes","Software","Instructions","Programs"],                                 ans: 1, exp: "Software is the collective term for all programs." },
    { topic: "Memory",                  q: "1 kilobyte is equivalent to how many bytes?",                                                                  opts: ["1000","1020","8","1024"],                                                     ans: 3, exp: "1 KB = 2¹⁰ = 1024 bytes." },
    { topic: "Memory",                  q: "Which is NOT a unit of memory measurement?",                                                                   opts: ["Fb","Gb","Mb","Tb"],                                                          ans: 0, exp: "Fb (Femtobyte) is not a standard memory measurement unit." },
    { topic: "Memory",                  q: "How many characters can be stored in 802 bytes?",                                                              opts: ["1000","1604","802","6416"],                                                   ans: 2, exp: "1 byte = 1 character (ASCII). 802 bytes = 802 characters." },
    { topic: "Memory",                  q: "A page holds 3290 chars. How many pages for 1.5 MB?",                                                         opts: ["1572864","478","26320","411"],                                                ans: 1, exp: "1.5MB = 1,572,864 bytes ÷ 3290 ≈ 478 pages." },
    { topic: "Embedded Systems",        q: "An embedded computer will perform which functions?",                                                           opts: ["Traffic lights","Temperature measure","Humidity control","All of the above"],  ans: 3, exp: "Embedded computers handle all specific control tasks." },
    { topic: "Software Types",          q: "Software may be defined as the intangible parts of the computer. TRUE or FALSE?",                             opts: ["True","False"],                                                               ans: 0, exp: "TRUE — software has no physical form." },
    { topic: "Software Types",          q: "Which may NOT be classified as systems software?",                                                             opts: ["Commercial packages","Microsoft Word","User programs","All of the above"],     ans: 3, exp: "All options are application software, not systems software." },
    { topic: "Software Types",          q: "Which is NOT systems software?",                                                                               opts: ["GUI","Operating System","System services","Microsoft Excel"],                  ans: 3, exp: "Microsoft Excel is application (productivity) software." },
    { topic: "Software Types",          q: "All are functions of system software EXCEPT ___",                                                              opts: ["Develop an algorithm","Optimise computer performance","Assist program development","Simplify computer use"], ans: 0, exp: "Algorithm development is the programmer's role, not the OS." },
    { topic: "Language Translators",    q: "After compiling a high-level language program the output is known as ___",                                    opts: ["Machine language","Object code","Assembly language","Target code"],            ans: 1, exp: "A compiler produces object code — machine code in object file format, before linking." },
    { topic: "CPU Architecture",        q: "All operations within the computer are performed in which unit?",                                              opts: ["ALU","Control unit","Register","Cache"],                                      ans: 0, exp: "The ALU performs all arithmetic and logical operations." },
    { topic: "CPU Architecture",        q: "Which actually constitutes the computer?",                                                                     opts: ["ALU","Control unit","CPU","Motherboard"],                                     ans: 2, exp: "The CPU (CU + ALU + registers) is the core computer." },
    { topic: "Number Systems",          q: "How many different codes are possible with 5 bits?",                                                           opts: ["5×2","5²","2⁵","2⁵-1"],                                                     ans: 2, exp: "With n bits, 2ⁿ unique codes are possible. 5 bits → 32 codes." },
    { topic: "Number Systems",          q: "How many bits to represent 26 lower-case and 26 upper-case letters?",                                         opts: ["52","26","8","6"],                                                            ans: 3, exp: "52 characters: 2⁶=64 ≥ 52, so 6 bits are needed." },
    { topic: "Number Systems",          q: "The extra bit per byte used for error detection is called?",                                                   opts: ["Parity bit","Error bit","Even bit","None of the above"],                      ans: 0, exp: "The parity bit detects single-bit errors." },
    { topic: "CPU Architecture",        q: "A bus is a set of ___ used to connect components within the computer.",                                       opts: ["Lines","Codes","Wires","Jumpers"],                                            ans: 2, exp: "A bus is a set of parallel wires/conductors." },
    { topic: "CPU Architecture",        q: "Which is an example of a bus?",                                                                               opts: ["Data bus","Computer bus","Memory bus","None of the above"],                   ans: 0, exp: "The data bus is a real system bus." },
    { topic: "CPU Architecture",        q: "Which bus indicates the location from which data is retrieved or written?",                                   opts: ["Control bus","Memory bus","Data bus","Address bus"],                          ans: 3, exp: "The address bus carries memory addresses." },
    { topic: "Memory",                  q: "Which is NOT a feature of cache memory?",                                                                      opts: ["It is closer to the CPU","It may use a dedicated control bus","It may use high speed components","Has large capacity relative to main memory"], ans: 3, exp: "Cache has SMALL capacity relative to main memory." },
    { topic: "Memory",                  q: "Which principle does cache memory rely upon?",                                                                 opts: ["Locality of reference","Moore's law","High speed components","None of the above"], ans: 0, exp: "Locality of reference: recently used data is likely to be used again soon." },
    { topic: "Number Systems",          q: "Which correctly shows place values in denary?",                                                                opts: ["10³|10²|10¹|10⁰","10³|10²|10¹|10","10³|10²|100|10⁰","None of the above"], ans: 0, exp: "Denary place values: 1000|100|10|1." },
    { topic: "Number Systems",          q: "Which correctly shows place values in two's complement?",                                                      opts: ["128|64|32|16|8|4|2|1","-128|64|32|16|8|4|2|1","128|64|32|16|8|4|2|0","-128|64|32|16|8|4|2|0"], ans: 1, exp: "8-bit two's complement: MSB has weight -128." },
    { topic: "Number Systems",          q: "Correct two's complement of -17?",                                                                             opts: ["1|0|0|0|1|0|0|1","0|0|0|0|1|0|0|1","1|1|1|0|1|1|1|1","1|1|1|0|1|0|0|1"], ans: 3, exp: "+17=00010001 → invert=11101110 → +1=11101111." },
    { topic: "Number Systems",          q: "How many bits needed to convert denary 373 to binary?",                                                       opts: ["2","4","9","8"],                                                              ans: 2, exp: "2⁸=256 < 373 < 2⁹=512. 9 bits required." },
    { topic: "Number Systems",          q: "How many bytes to store 373?",                                                                                 opts: ["1","2","3","4"],                                                              ans: 1, exp: "9 bits → 2 bytes needed." },
    { topic: "Number Systems",          q: "Binary 10100110 as 8-bit two's complement?",                                                                  opts: ["-90","-38","6A","A6"],                                                       ans: 0, exp: "-128+32+4+2 = -90." },
    { topic: "Number Systems",          q: "Binary 10100110 as 8-bit sign and magnitude?",                                                                opts: ["A6","-90","6A","-38"],                                                       ans: 3, exp: "Sign=1 (negative), magnitude=38. Value = -38." },
    { topic: "Number Systems",          q: "Binary 10100110 as hexadecimal?",                                                                             opts: ["A6","-90","6A","-38"],                                                       ans: 0, exp: "1010|0110 = A6." },
    { topic: "Number Systems",          q: "Which is NOT a reason to write binary in hexadecimal?",                                                       opts: ["Less likely to make mistakes","Easier to convert","Fewer digits needed","None of the above"], ans: 3, exp: "All three ARE valid reasons." },
    { topic: "Input Devices",           q: "Pressure sensor application?",                                                                                opts: ["Computer-controlled oven","Greenhouse window control","Access control / vehicle barrier","Illumination control"], ans: 2, exp: "Pressure sensors detect vehicle weight — used in barriers." },
    { topic: "Input Devices",           q: "Light sensor application?",                                                                                   opts: ["Computer-controlled oven","Greenhouse window control","Access control / vehicle barrier","Illumination control of an enclosed space"], ans: 3, exp: "Light sensors used to control automatic lighting." },
    { topic: "Input Devices",           q: "Temperature sensor application?",                                                                             opts: ["Computer-controlled oven","Greenhouse window control","Access control / vehicle barrier","Illumination control"], ans: 0, exp: "Temperature sensors used in ovens." },
    { topic: "Input Devices",           q: "Wind speed sensor application?",                                                                              opts: ["Computer-controlled oven","Greenhouse window control","Access control / vehicle barrier","Illumination control"], ans: 1, exp: "Wind sensors open/close greenhouse windows." },
    { topic: "Networks",                q: "A communication channel carrying EM signals from sender to receiver is ___",                                  opts: ["Copper cable","Transmission medium","Fibre","Wireless"],                      ans: 1, exp: "A transmission medium is the channel carrying signals." },
    { topic: "Networks",                q: "Which is NOT guided media?",                                                                                   opts: ["Fibre","Copper","Twisted pair cable","Bluetooth"],                            ans: 3, exp: "Bluetooth is unguided (wireless)." },
    { topic: "Networks",                q: "Unguided media EXCEPT ___",                                                                                    opts: ["Fibre optic","Microwave","Radio waves","Infrared"],                           ans: 0, exp: "Fibre optic is guided." },
    { topic: "Networks",                q: "Features of guided media EXCEPT ___",                                                                          opts: ["High Speed","Low data rate","Used for shorter distances","Secure"],           ans: 1, exp: "Guided media has HIGH data rate." },
    { topic: "Networks",                q: "Fibre optic supports which propagation modes?",                                                               opts: ["Single mode","Multimode","Both single and multimode","None of the above"],   ans: 2, exp: "Fibre supports both single-mode and multimode." },
    { topic: "Networks",                q: "HTTP features EXCEPT ___",                                                                                     opts: ["HTTP is connection oriented","HTTP is media independent","HTTP is stateless","None of the above"], ans: 0, exp: "HTTP is connectionless/stateless." },
    { topic: "Networks",                q: "Bit streaming definition?",                                                                                    opts: ["Continuous flow of bits over a path","Connectionless flow","Connection-oriented flow","None"], ans: 0, exp: "Bit streaming = continuous flow of bits." },
    { topic: "Networks",                q: "Real-time streaming scenario?",                                                                                opts: ["Movie playback","Music streaming (not live radio)","Video streaming sites","None"], ans: 2, exp: "Real-time streaming used for live video." },
    { topic: "Networks",                q: "Internet address types EXCEPT ___",                                                                            opts: ["Private IP","Public IP","Commercial IP","Static IP"],                         ans: 2, exp: "Commercial IP is not a real category." },
    { topic: "Assembly Language",       q: "IMMEDIATE addressing — which correctly describes it?",                                                         opts: ["Operand contains address of value","Operand IS the actual number","Address calculated using two base points","None"], ans: 1, exp: "Immediate: operand IS the data value itself." },
    { topic: "Assembly Language",       q: "INDIRECT addressing — which correctly describes it?",                                                          opts: ["Operand contains address of value","Operand IS the actual number","Address calculated using two base points","None"], ans: 0, exp: "Indirect: operand holds the ADDRESS of the data." },
    { topic: "Assembly Language",       q: "RELATIVE addressing — which correctly describes it?",                                                          opts: ["Operand contains address of value","Operand IS the actual number","Actual address calculated using two base points","None"], ans: 2, exp: "Relative: address = base + offset." },
    { topic: "Operating Systems",       q: "The operating system is classified as ___",                                                                    opts: ["Application software","Utility software","Both a and b","Systems software"],  ans: 3, exp: "The OS is systems software." },
    { topic: "Operating Systems",       q: "Which is NOT a resource managed by the OS?",                                                                  opts: ["Processor","Main memory","Secondary storage","Server"],                       ans: 3, exp: "A 'server' is not a resource type managed by the OS." },
    { topic: "Boolean Logic",           q: "Logic proposition for the traveler problem?",                                                                  opts: ["Travel at the weekend is by car","Travel at weekday is by car","Travel at weekend is NOT by car","All travel is by car"], ans: 0, exp: "Weekend → always by car." },
    { topic: "Boolean Logic",           q: "Car_travel = ___ IF day = weekend",                                                                           opts: ["TRUE","FALSE"],                                                               ans: 0, exp: "TRUE. Weekend travel is always by car." },
    { topic: "Boolean Logic",           q: "Train_travel = ___ IF day = weekday AND distance ≤ 200",                                                      opts: ["TRUE","FALSE"],                                                               ans: 0, exp: "TRUE. Weekday, short distance = train." },
    { topic: "Boolean Logic",           q: "Air_travel = ___ IF day = weekday AND distance > 200",                                                        opts: ["TRUE","FALSE"],                                                               ans: 0, exp: "TRUE. Weekday, long distance = flight." },
    { topic: "Boolean Logic",           q: "Expression for Car_travel (X)? [A=weekday, B=distance≤200]",                                                  opts: ["X = A AND B","X = NOT A","X = A AND NOT B","X = NOT A AND B"],               ans: 1, exp: "Car = NOT weekday = NOT A." },
    { topic: "Boolean Logic",           q: "Expression for Train_travel (Y)? [A=weekday, B=distance≤200]",                                                opts: ["Y = A AND B","Y = NOT A","Y = A AND NOT B","Y = NOT A AND B"],               ans: 0, exp: "Train = A AND B." },
    { topic: "Boolean Logic",           q: "Expression for Air_travel (Z)? [A=weekday, B=distance≤200]",                                                  opts: ["Z = A AND B","Z = NOT A","Z = A AND NOT B","Z = NOT A AND B"],               ans: 2, exp: "Air = A AND NOT B." },
    { topic: "Boolean Logic",           q: "Truth table: water level too low AND temperature too high → switch off?",                                     opts: ["Table A: F1=1 when B=0 AND C=0","Table B: F1=1 when A=0 AND B=1","Table C: F1=1 when A=0 AND C=0","Table D"], ans: 0, exp: "Table A: F1=1 for rows where B=0 AND C=0." },
    { topic: "Boolean Logic",           q: "Truth table: water flow too low AND temperature too high → switch off?",                                      opts: ["Table A","Table B","Table C","Table D"],                                      ans: 1, exp: "Table B: F1=1 when A=0 AND B=0." },
    { topic: "Boolean Logic",           q: "Circuit: temp OK (B=1), flow low (A=0), level low (C=0)?",                                                   opts: ["Circuit A","Circuit B","Circuit C","Circuit D"],                              ans: 1, exp: "Circuit B: NOT-A AND NOT-C AND B." },
    { topic: "Assembly Language",       q: "A register is a storage unit with limited capacity of just a few bytes. TRUE or FALSE?",                      opts: ["TRUE","FALSE"],                                                               ans: 0, exp: "TRUE. Registers hold only a few bytes." },
    { topic: "Assembly Language",       q: "A register is part of the processor. TRUE or FALSE?",                                                          opts: ["TRUE","FALSE"],                                                               ans: 0, exp: "TRUE. Registers are inside the CPU." },
    { topic: "Assembly Language",       q: "A register has a very short access time. TRUE or FALSE?",                                                      opts: ["TRUE","FALSE"],                                                               ans: 0, exp: "TRUE. Registers accessed in one clock cycle." },
    { topic: "Assembly Language",       q: "A register may be special purpose or general purpose. TRUE or FALSE?",                                        opts: ["TRUE","FALSE"],                                                               ans: 0, exp: "TRUE. Special: PC, MAR, MDR. General: R0-R7." },
    { topic: "Assembly Language",       q: "An assembly program can access an individual register. TRUE or FALSE?",                                       opts: ["TRUE","FALSE"],                                                               ans: 0, exp: "TRUE. Assembly explicitly names registers." },
    { topic: "Assembly Language",       q: "Trace: LDD 201 (mem201=10). ACC after execution? [Initial ACC=0]",                                           opts: ["ACC=0, mem202=11","ACC=10, mem202=10","ACC=10, mem201=10, mem202=0","ACC=0, mem201=10"], ans: 2, exp: "LDD 201: ACC ← 10." },
    { topic: "Assembly Language",       q: "Trace: INC ACC (ACC=10). ACC value?",                                                                         opts: ["ACC=0","ACC=11","ACC=10","ACC=11, mem201=10"],                                ans: 3, exp: "INC ACC: 10+1=11." },
    { topic: "Assembly Language",       q: "Trace: STO 202 (ACC=11). What changes?",                                                                      opts: ["ACC=11, mem201=10, mem202=11","ACC=10, mem202=10","ACC=10, mem201=0","ACC=0"], ans: 0, exp: "STO 202: mem202 ← 11." },
    { topic: "Assembly Language",       q: "Trace: LDI 203 (mem203=204, mem204=5). ACC?",                                                                opts: ["ACC=5, mem201=10, mem202=11","ACC=10, mem201=5","ACC=10","ACC=0"],            ans: 0, exp: "LDI 203 indirect: ACC ← mem[mem203] = mem[204] = 5." },
    { topic: "Assembly Language",       q: "Trace: DEC ACC (ACC=5). ACC?",                                                                                opts: ["ACC=5","ACC=4, mem201=10, mem202=11","ACC=10","ACC=4, mem202=10"],            ans: 1, exp: "DEC ACC: 5-1=4." },
    { topic: "Assembly Language",       q: "Trace: STO 201 (ACC=4). What changes?",                                                                       opts: ["ACC=4, mem201=0","ACC=10, mem201=0","ACC=4, mem201=10","ACC=4, mem201=4, mem202=11"], ans: 3, exp: "STO 201: mem201 ← 4." },
    { topic: "Assembly Language",       q: "Trace: ADD 204 (ACC=4, mem204=5). ACC?",                                                                      opts: ["ACC=0","ACC=10","ACC=10, mem201=10","ACC=9, mem201=4, mem202=11"],            ans: 3, exp: "ADD 204: 4+5=9." },
    { topic: "Assembly Language",       q: "Trace: STO 201 (ACC=9). Final state?",                                                                        opts: ["ACC=9, mem201=9, mem202=11","ACC=10, mem201=9","ACC=10, mem201=0","ACC=0"],   ans: 0, exp: "STO 201: mem201 ← 9. Final: ACC=9, mem201=9, mem202=11." },
    { topic: "File Management",         q: "File management system facilities?",                                                                           opts: ["Delete a file","Copy a file","Save a file","All of the above"],               ans: 3, exp: "Delete, copy, save — all of the above." },
    { topic: "Utility Programs",        q: "Utility programs for hard disk usage?",                                                                        opts: ["Disk formatting","Partition creation","Disk recovery","None of the above"],   ans: 3, exp: "Formatting, partition, recovery — all of the above." },
    { topic: "Data Protection",         q: "Data protection laws are primarily about data ___",                                                            opts: ["Living individual","Securely","Integrity","Privacy"],                         ans: 3, exp: "Data protection laws focus on Privacy." },
    { topic: "Data Protection",         q: "Laws concern data about a ___",                                                                                opts: ["Living individual","Securely","Integrity","Privacy"],                         ans: 0, exp: "Data laws apply to living individuals." },
    { topic: "Data Protection",         q: "Data is held by a ___",                                                                                        opts: ["Living individual","Securely","Integrity","Data controller in an organisation"], ans: 3, exp: "A data controller determines how data is processed." },
    { topic: "Data Protection",         q: "Measures to ensure data has ___",                                                                              opts: ["Living individual","Securely","Integrity","Privacy"],                         ans: 2, exp: "Integrity ensures accuracy and completeness." },
    { topic: "Databases",               q: "___ — something about which data is recorded",                                                                opts: ["Attribute","Relationship","Tuple","Table","Entity"],                          ans: 4, exp: "Entity — a thing about which data is recorded." },
    { topic: "Databases",               q: "___ — data for one row in the table",                                                                         opts: ["Attribute","Relationship","Tuple","Table","Entity"],                          ans: 2, exp: "Tuple — one row in a relational table." },
    { topic: "Databases",               q: "___ — one data item for an object (e.g. customer name)",                                                      opts: ["Attribute","Relationship","Tuple","Table","Entity"],                          ans: 0, exp: "Attribute — a single data item (column)." },
    { topic: "Sorting Algorithms",      q: "Algorithm comparing and swapping adjacent pairs is ___",                                                       opts: ["Quicksort","Insertion sort","Selection sort","Bubble sort"],                  ans: 3, exp: "Bubble sort compares adjacent elements and swaps." },
    { topic: "Sorting Algorithms",      q: "After first pass of bubble sort, which is in correct position?",                                              opts: ["Smallest value","Middle value","Largest value","No value"],                   ans: 2, exp: "Largest element bubbles to last position after pass 1." },
  ],
  2021: [
    { topic: "Computer History",        q: "Abacus is an early form of a mechanical computer. TRUE or FALSE?",                                            opts: ["TRUE","FALSE"],                                                              ans: 0, exp: "TRUE — the abacus is one of the earliest computing devices." },
    { topic: "Computer History",        q: "Which is an early form of a mechanical computer?",                                                            opts: ["Napier Bones","Abacus","Jacquards Loom","All of the above"],                 ans: 3, exp: "All three are early mechanical computers." },
    { topic: "Computer History",        q: "Which is NOT an example of a mechanical computer?",                                                           opts: ["Napier Engine","Analytical Engine","Difference Engine","Census Machine"],    ans: 0, exp: "Napier Engine is not a real device." },
    { topic: "Computer History",        q: "The highest award in computing is named after?",                                                               opts: ["Douglas Howard","Gordon Moore","Alan Turing","Grace Hooper"],                ans: 2, exp: "The ACM Turing Award." },
    { topic: "Von Neumann Architecture",q: "The fundamental principle underpinning modern computers?",                                                    opts: ["Fetch-execute cycle","Fetch-execute decode cycle","Stored program concept","None"], ans: 2, exp: "Stored-program concept." },
    { topic: "Computer Definition",     q: "A ___ processes data under stored program control to produce information.",                                   opts: ["Data","Machine","Information","Computer"],                                    ans: 3, exp: "A computer processes data into information." },
    { topic: "Computer Definition",     q: "A computer stores and processes ___.",                                                                         opts: ["Data","Machine","Information","Computer"],                                    ans: 0, exp: "Computers process data." },
    { topic: "Computer Definition",     q: "A computer produces ___ as output.",                                                                           opts: ["Data","Machine","Information","Computer"],                                    ans: 2, exp: "Output = information." },
    { topic: "Programming Basics",      q: "A program is a set of ___ written in computer language.",                                                     opts: ["Codes","Signs","Words","Instructions"],                                       ans: 3, exp: "A program is a set of instructions." },
    { topic: "Computer Hardware",       q: "Electronic and mechanical elements of the computer?",                                                          opts: ["Devices","Peripherals","Hardware","Software"],                                ans: 2, exp: "Hardware: all physical/electronic components." },
    { topic: "Software Types",          q: "Term for all programs used on a computer system?",                                                             opts: ["Codes","Software","Instructions","Programs"],                                 ans: 1, exp: "Software is the collective name for all programs." },
    { topic: "Memory",                  q: "1 kilobyte = how many bytes?",                                                                                opts: ["1000","1020","8","1024"],                                                     ans: 3, exp: "1 KB = 1024 bytes." },
    { topic: "Memory",                  q: "Which is NOT a unit of memory?",                                                                              opts: ["Fb","Gb","Mb","Tb"],                                                          ans: 0, exp: "Fb is not standard." },
    { topic: "Memory",                  q: "Characters in 802 bytes?",                                                                                    opts: ["1000","1604","802","6416"],                                                   ans: 2, exp: "802 bytes = 802 ASCII characters." },
    { topic: "Memory",                  q: "Pages for 1.5 MB at 3290 chars/page?",                                                                        opts: ["1572864","478","26320","411"],                                                ans: 1, exp: "≈ 478 pages." },
    { topic: "Computer Classification", q: "Which is NOT a recognised classification of a computer?",                                                     opts: ["Minicomputer","Supercomputer","Microprocessor","Mainframe"],                  ans: 2, exp: "Microprocessor is a chip, not a computer class." },
    { topic: "Embedded Systems",        q: "Embedded computer functions?",                                                                                opts: ["Traffic lights","Temperature measure","Humidity control","All of the above"], ans: 3, exp: "All of the above." },
    { topic: "Software Types",          q: "Software = intangible parts of computer?",                                                                    opts: ["True","False"],                                                               ans: 0, exp: "TRUE." },
    { topic: "Software Types",          q: "Which may NOT be systems software?",                                                                          opts: ["Commercial packages","Microsoft Word","User programs","All of the above"],    ans: 3, exp: "All are application software." },
    { topic: "Software Types",          q: "Which is NOT systems software?",                                                                              opts: ["GUI","Operating System","System services","Microsoft Excel"],                  ans: 3, exp: "Microsoft Excel is application software." },
    { topic: "Software Types",          q: "Functions of system software EXCEPT?",                                                                        opts: ["Develop an algorithm","Optimise performance","Assist development","Simplify use"], ans: 0, exp: "Algorithm development is a programmer's task." },
    { topic: "Language Translators",    q: "Output of compiling a high-level program?",                                                                   opts: ["Machine language","Object code","Assembly language","Target code"],            ans: 1, exp: "Object code." },
    { topic: "CPU Architecture",        q: "All operations performed in which unit?",                                                                      opts: ["ALU","Control unit","Register","Cache"],                                      ans: 0, exp: "ALU." },
    { topic: "CPU Architecture",        q: "Which constitutes the computer?",                                                                              opts: ["ALU","Control unit","CPU","Motherboard"],                                     ans: 2, exp: "CPU." },
    { topic: "Number Systems",          q: "Codes possible with 5 bits?",                                                                                  opts: ["10","25","32","31"],                                                          ans: 2, exp: "2⁵ = 32." },
    { topic: "Number Systems",          q: "Bits to represent 52 letters (26 lower + 26 upper)?",                                                         opts: ["52","26","8","6"],                                                            ans: 3, exp: "6 bits." },
    { topic: "Number Systems",          q: "Extra bit for error detection?",                                                                               opts: ["Parity bit","Error bit","Even bit","None"],                                   ans: 0, exp: "Parity bit." },
    { topic: "CPU Architecture",        q: "A bus is a set of ___ connecting components.",                                                                opts: ["Lines","Codes","Wires","Jumpers"],                                            ans: 2, exp: "Wires." },
    { topic: "CPU Architecture",        q: "Example of a bus?",                                                                                            opts: ["Data bus","Computer bus","Memory bus","None of the above"],                   ans: 0, exp: "Data bus." },
    { topic: "CPU Architecture",        q: "Bus indicating data location?",                                                                                opts: ["Control bus","Memory bus","Data bus","Address bus"],                          ans: 3, exp: "Address bus." },
    { topic: "Memory",                  q: "NOT a feature of cache?",                                                                                      opts: ["Closer to CPU","Dedicated control bus","High-speed components","Large capacity relative to RAM"], ans: 3, exp: "Cache is SMALL." },
    { topic: "Memory",                  q: "Principle cache relies on?",                                                                                   opts: ["Locality of reference","Moore's law","High-speed components","None"],         ans: 0, exp: "Locality of reference." },
    { topic: "Memory",                  q: "Type of locality used by cache?",                                                                              opts: ["Data locality","Spatial locality","High-speed components","None"],            ans: 1, exp: "Spatial locality." },
    { topic: "Number Systems",          q: "Place values in denary?",                                                                                      opts: ["10³|10²|10¹|10⁰","10³|10²|10¹|10","10³|10²|10⁰|10⁰","None"],              ans: 0, exp: "10³|10²|10¹|10⁰." },
    { topic: "Number Systems",          q: "Bits needed for denary 373?",                                                                                  opts: ["2","4","9","8"],                                                              ans: 2, exp: "9 bits." },
    { topic: "Number Systems",          q: "Bytes to store 373?",                                                                                          opts: ["1","2","3","4"],                                                              ans: 1, exp: "2 bytes." },
    { topic: "Number Systems",          q: "Which is lossless compression example?",                                                                       opts: ["Text document","Sound","Video","Image"],                                      ans: 0, exp: "Text — lossless is essential to avoid corruption." },
    { topic: "Number Systems",          q: "NOT true about bitmapped graphics?",                                                                           opts: ["Scanned images","Photographs","Object-oriented class diagrams","None"],       ans: 2, exp: "Class diagrams use vector graphics, not bitmaps." },
    { topic: "Number Systems",          q: "10100110 as sign and magnitude?",                                                                              opts: ["A6","-90","6A","-38"],                                                       ans: 3, exp: "Sign=1, magnitude=38. Value=-38." },
    { topic: "Number Systems",          q: "Why write binary in hexadecimal?",                                                                             opts: ["Fewer mistakes","Easy to convert","Fewer digits","None of the above"],        ans: 3, exp: "All three ARE valid reasons." },
    { topic: "Input Devices",           q: "Light sensor best suited for?",                                                                                opts: ["Controlling an oven","Opening greenhouse windows","Vehicle barriers","Room illumination control"], ans: 3, exp: "Light sensors for automatic lighting." },
    { topic: "Input Devices",           q: "Temperature sensor best suited for?",                                                                          opts: ["Controlling an oven","Opening greenhouse windows","Vehicle barriers","Illumination"], ans: 0, exp: "Temperature sensors for ovens." },
    { topic: "Networks",                q: "Channel carrying EM signals is?",                                                                              opts: ["Copper cable","Transmission medium","Fibre","Wireless"],                      ans: 1, exp: "Transmission medium." },
    { topic: "Networks",                q: "NOT guided media?",                                                                                            opts: ["Fibre","Copper","Twisted pair","Bluetooth"],                                  ans: 3, exp: "Bluetooth is wireless." },
    { topic: "Networks",                q: "Feature of guided media (NOT)?",                                                                               opts: ["High speed","Low data rate","Shorter distances","Secure"],                    ans: 1, exp: "Guided media has HIGH data rate." },
    { topic: "Networks",                q: "Fibre optic propagation modes?",                                                                               opts: ["Single mode","Multimode","Both","None"],                                      ans: 2, exp: "Both single-mode and multimode." },
    { topic: "Networks",                q: "HTTP features EXCEPT?",                                                                                        opts: ["Connection oriented","Media independent","Stateless","None"],                 ans: 0, exp: "HTTP is stateless." },
    { topic: "Networks",                q: "Class A IP — bits for host?",                                                                                  opts: ["8","16","24","32"],                                                           ans: 2, exp: "Class A: 24 bits for host." },
    { topic: "Networks",                q: "Class C IP — bits for host?",                                                                                  opts: ["8","16","24","128"],                                                          ans: 0, exp: "Class C: 8 bits for host." },
    { topic: "Assembly Language",       q: "IMMEDIATE addressing — operand contains?",                                                                    opts: ["Memory address","The actual value","Two base points","None"],                 ans: 1, exp: "Immediate: value is directly in the instruction." },
    { topic: "Assembly Language",       q: "INDIRECT addressing — operand contains?",                                                                     opts: ["Memory address","Actual value","Pointer to an address","None"],               ans: 2, exp: "Indirect: points to an address that holds the data." },
    { topic: "Assembly Language",       q: "Register is part of the processor. TRUE/FALSE?",                                                              opts: ["True","False"],                                                               ans: 0, exp: "TRUE." },
    { topic: "Assembly Language",       q: "Register has very short access time. TRUE/FALSE?",                                                             opts: ["True","False"],                                                               ans: 0, exp: "TRUE." },
    { topic: "File Management",         q: "File management system facilities?",                                                                           opts: ["Delete a file","Copy a file","Save a file","All of the above"],               ans: 3, exp: "All of the above." },
    { topic: "Databases",               q: "Link between two tables is?",                                                                                  opts: ["Attribute","Relationship","Tuple","Entity"],                                  ans: 1, exp: "Relationship." },
    { topic: "Databases",               q: "Process to lower data redundancy?",                                                                            opts: ["Normalization","Rationalization","Abnormality elimination","Reduction"],      ans: 0, exp: "Normalization." },
  ],
  2023: [
    { topic: "Databases",               q: "A collection of data designed to be used by different people?",                                               opts: ["Organization","Database","Relationship","Schema"],                            ans: 1, exp: "Database — structured, shared data collection." },
    { topic: "Databases",               q: "What does SQL stand for?",                                                                                    opts: ["Structured Query Language","Structural Querying Language","Standard Query Language","Secondary Query Language"], ans: 0, exp: "Structured Query Language." },
    { topic: "Number Systems",          q: "Binary 10101 in decimal?",                                                                                    opts: ["19","12","27","21"],                                                          ans: 3, exp: "16+4+1=21." },
    { topic: "Logic Gates",             q: "The universal gate is ___",                                                                                   opts: ["NAND gate","OR gate","NOT gate","None"],                                      ans: 0, exp: "NAND is the universal gate." },
    { topic: "Logic Gates",             q: "The inverter is ___",                                                                                         opts: ["NOT gate","OR gate","AND gate","None"],                                       ans: 0, exp: "NOT gate inverts: 0→1, 1→0." },
    { topic: "Logic Gates",             q: "NAND gate inputs connected together gives?",                                                                  opts: ["OR gate","AND gate","NOT gate","None"],                                       ans: 2, exp: "Creates a NOT gate." },
    { topic: "Logic Gates",             q: "NOR gate = OR gate followed by ___",                                                                          opts: ["AND gate","NAND gate","NOT gate","None"],                                     ans: 2, exp: "NOR = OR + NOT." },
    { topic: "Logic Gates",             q: "NAND gate = AND gate followed by ___",                                                                        opts: ["NOT gate","OR gate","AND gate","None"],                                       ans: 0, exp: "NAND = AND + NOT." },
    { topic: "Logic Gates",             q: "Any digital circuit can be built with ___",                                                                   opts: ["OR gates","NOT gates","NAND gates","None"],                                   ans: 2, exp: "NAND is universal." },
    { topic: "Logic Gates",             q: "The only function of NOT gate is to ___",                                                                     opts: ["Stop signal","Invert input","Act as universal gate","None"],                  ans: 1, exp: "NOT inverts the signal." },
    { topic: "Logic Gates",             q: "Input 1 to NOT gate gives?",                                                                                  opts: ["0","1","Either","None"],                                                      ans: 0, exp: "NOT(1)=0." },
    { topic: "Logic Gates",             q: "Bar sign (¯) in Boolean algebra indicates?",                                                                  opts: ["OR","AND","NOT","None"],                                                      ans: 2, exp: "Ā = NOT A." },
    { topic: "CPU Architecture",        q: "Machine cycle refers to?",                                                                                    opts: ["Fetching","Clock speed","Fetch, decode and execute","Executing"],             ans: 2, exp: "Complete FDE cycle." },
    { topic: "Memory",                  q: "Boot code is stored in ___",                                                                                  opts: ["RAM","ROM","PROM","EPROM"],                                                   ans: 1, exp: "ROM is non-volatile." },
    { topic: "Storage",                 q: "Longest delay when accessing a disk block?",                                                                  opts: ["Rotation time","Seek time","Transfer time","Access time"],                    ans: 1, exp: "Seek time is the longest." },
    { topic: "CPU Architecture",        q: "NOT part of the CPU?",                                                                                        opts: ["ALU","Control unit","Registers","System bus"],                                ans: 3, exp: "System bus is outside the CPU." },
    { topic: "Number Systems",          q: "Hex equivalent of decimal 973?",                                                                              opts: ["4BC","CB4","6D","3CD"],                                                       ans: 3, exp: "3×256+12×16+13 = 973 = 3CD." },
    { topic: "CPU Architecture",        q: "NOT a type of processor?",                                                                                    opts: ["PowerPC 601","Motorola 8086","Motorola 68000","Intel Pentium"],               ans: 1, exp: "8086 is Intel, not Motorola." },
    { topic: "Number Systems",          q: "Minimum bits to store hex FF?",                                                                               opts: ["2","4","6","16"],                                                             ans: 3, exp: "FF=8 bits; stored in 16-bit word." },
    { topic: "Number Systems",          q: "What is a parity bit?",                                                                                       opts: ["Indicates uppercase","Used to detect errors","First bit in byte","Last bit in byte"], ans: 1, exp: "Parity bit detects errors." },
    { topic: "CPU Architecture",        q: "Word size of 8086 processor?",                                                                                opts: ["8 bits","16 bits","32 bits","64 bits"],                                       ans: 1, exp: "8086 is 16-bit." },
    { topic: "Number Systems",          q: "Sum of -6 and -13 in 8-bit two's complement?",                                                               opts: ["11101101","11110011","11001100","11101100"],                                  ans: 0, exp: "-19 = 11101101 in 8-bit two's complement." },
    { topic: "CPU Architecture",        q: "Which register holds address of next instruction?",                                                           opts: ["MAR","MBR","Accumulator","Program Counter"],                                  ans: 3, exp: "Program Counter (PC)." },
    { topic: "CPU Architecture",        q: "Major components of a CPU?",                                                                                  opts: ["CU, Registers, ALU","CU, Memory, ALU","Memory, ALU, Auxiliary","Registers, CU, Memory"], ans: 0, exp: "CU + Registers + ALU." },
    { topic: "Number Systems",          q: "Denary = decimal system. TRUE/FALSE?",                                                                        opts: ["TRUE","FALSE"],                                                               ans: 0, exp: "Both are base-10." },
    { topic: "Number Systems",          q: "Total digits in denary system?",                                                                              opts: ["2","8","16","10"],                                                            ans: 3, exp: "Digits 0–9 = 10 total." },
    { topic: "Number Systems",          q: "Possible digits in hexadecimal?",                                                                             opts: ["2","8","16","10"],                                                            ans: 2, exp: "Hex is base-16." },
    { topic: "Number Systems",          q: "Correct way to convert binary to hex?",                                                                       opts: ["Groups of 4 from left","Groups of 4 from right","Any of above","None"],       ans: 1, exp: "Group from the right (LSB)." },
    { topic: "Number Systems",          q: "Bits needed for denary 373?",                                                                                  opts: ["2","4","9","8"],                                                              ans: 2, exp: "9 bits." },
    { topic: "Memory",                  q: "Bytes to store 373?",                                                                                          opts: ["1","2","3","4"],                                                              ans: 1, exp: "2 bytes." },
    { topic: "Operating Systems",       q: "OS classified as?",                                                                                            opts: ["Application software","Utility software","Both","Systems software"],          ans: 3, exp: "Systems software." },
    { topic: "Operating Systems",       q: "NOT managed by OS?",                                                                                           opts: ["Processor","Main memory","Secondary storage","Server"],                       ans: 3, exp: "Server is not an OS-managed resource." },
    { topic: "Networks",                q: "Why are network cables twisted?",                                                                              opts: ["Increase speed","Decrease heat","Reduce data","Reduce EM interference"],      ans: 3, exp: "Twisting reduces EM interference." },
    { topic: "Networks",                q: "Repeaters ___ signal quality.",                                                                                opts: ["Cancel","Regenerate","Delay","Reduce"],                                       ans: 1, exp: "Repeaters regenerate signals." },
    { topic: "Memory",                  q: "NOT primary memory?",                                                                                          opts: ["Hard drive","Register","Cache","Main memory"],                                ans: 0, exp: "Hard drives are secondary storage." },
    { topic: "Memory",                  q: "RAM is usually described as?",                                                                                opts: ["ROM","Hard drive","Volatile memory","Non-volatile"],                          ans: 2, exp: "RAM is volatile." },
    { topic: "Memory",                  q: "Compared to SRAM, DRAM is NOT?",                                                                              opts: ["Cheap to make","More capacity/chip","Made from flip flops","Uses less power"], ans: 2, exp: "DRAM uses capacitors; SRAM uses flip-flops." },
    { topic: "Security",                q: "Program infecting computer without user knowledge?",                                                           opts: ["Worm","Rootkit","Computer virus","Trojan Horse"],                             ans: 2, exp: "A virus alters work without permission." },
    { topic: "Databases",               q: "Attribute in one table referencing another table's primary key?",                                             opts: ["Primary key","Foreign key","Security key","Privacy key"],                     ans: 1, exp: "Foreign key." },
    { topic: "Databases",               q: "Normalisation is the process of?",                                                                            opts: ["Relationship","Arranging attributes into sensible groupings","Data Modelling","Data redundancy"], ans: 1, exp: "Normalisation arranges attributes to reduce redundancy." },
    { topic: "Networks",                q: "Unguided transmissions more secure than guided. TRUE/FALSE?",                                                 opts: ["True","False"],                                                               ans: 1, exp: "Guided (wired) media is more secure." },
    { topic: "Networks",                q: "Main types of transmission media?",                                                                            opts: ["Guided and Unguided","Physical and Automatic","Longer and wide","Used in physical links"], ans: 0, exp: "Guided and Unguided media." },
    { topic: "Networks",                q: "Features of guided media EXCEPT?",                                                                            opts: ["Secure","Low cost","Flexible and lightweight","High cost"],                   ans: 3, exp: "High cost is not a defining feature of guided media." },
    { topic: "Networks",                q: "Layer with lower refractive index covering fibre core?",                                                      opts: ["Coaxial","Optic","Cladding","Twist"],                                         ans: 2, exp: "Cladding causes total internal reflection." },
    { topic: "Memory",                  q: "NOT primary memory?",                                                                                          opts: ["Hard drive","Register","Cache","Main memory"],                                ans: 0, exp: "Hard drives are secondary storage." },
    { topic: "Memory",                  q: "Which is considered main memory?",                                                                             opts: ["Hard drive","Auxiliary storage","Register","None of the above"],              ans: 3, exp: "RAM is main memory, but not listed here." },
    { topic: "Memory",                  q: "Computer memory organised into a hierarchy. TRUE/FALSE?",                                                     opts: ["True","False","Depends on make","All of the above"],                          ans: 0, exp: "TRUE — memory hierarchy exists." },
    { topic: "Memory",                  q: "Fastest memory furthest from CPU. TRUE/FALSE?",                                                               opts: ["True","False","Depends on make","None"],                                      ans: 1, exp: "FALSE — fastest memory is CLOSEST to CPU." },
    { topic: "Storage",                 q: "NOT true about hard drive?",                                                                                   opts: ["Large storage","Slow","Fast access time","Cheap"],                            ans: 2, exp: "Hard drives have SLOW access times." },
    { topic: "CPU Architecture",        q: "Processor has direct access to?",                                                                             opts: ["Register","Hard drive","Auxiliary storage","All"],                            ans: 0, exp: "CPU directly accesses registers." },
    { topic: "Memory",                  q: "Usually described as volatile memory?",                                                                        opts: ["ROM","Hard drive","RAM","None"],                                              ans: 2, exp: "RAM is volatile." },
    { topic: "Memory",                  q: "Memory is volatile because?",                                                                                  opts: ["May explode","Power on loses data","Loses data if power off","None"],         ans: 2, exp: "Volatility = data loss when powered off." },
    { topic: "Memory",                  q: "Best describes ROM?",                                                                                          opts: ["Non-volatile","Volatile","Read only once","Options a and c"],                 ans: 0, exp: "ROM is non-volatile." },
    { topic: "Memory",                  q: "NOT true about DRAM compared to SRAM?",                                                                       opts: ["Cheap to make","More capacity/chip","Made from flip flops","Less power"],     ans: 2, exp: "DRAM uses capacitors, SRAM uses flip-flops." },
    { topic: "Logic",                   q: "A logic proposition is a statement that is?",                                                                 opts: ["True","False","Either True or False","Always true"],                          ans: 2, exp: "A proposition has exactly one truth value." },
    { topic: "Logic",                   q: "Basic Boolean operators?",                                                                                     opts: ["AND","OR","NOT","All of the above"],                                          ans: 3, exp: "AND, OR, NOT are the three fundamentals." },
    { topic: "Logic",                   q: "NOT A is True if?",                                                                                            opts: ["A is false","A True and B True","A True or B True","All"],                   ans: 0, exp: "NOT inverts." },
    { topic: "Logic",                   q: "A NAND B is True if?",                                                                                        opts: ["A False and B False","A False or B False","A True or B True but not both","None"], ans: 1, exp: "NAND is false only when both are true." },
    { topic: "Logic Gates",             q: "Truth table: 0,0→0; 0,1→0; 1,0→0; 1,1→1 describes?",                                                       opts: ["OR gate","XOR gate","NAND gate","AND gate"],                                  ans: 3, exp: "AND gate." },
    { topic: "Logic Gates",             q: "Truth table: 0,0→0; 0,1→1; 1,0→1; 1,1→1 describes?",                                                       opts: ["OR gate","NOR gate","NAND gate","AND gate"],                                  ans: 0, exp: "OR gate." },
    { topic: "Logic Gates",             q: "Truth table: 0,0→1; 0,1→1; 1,0→1; 1,1→0 describes?",                                                       opts: ["OR gate","XOR gate","NAND gate","AND gate"],                                  ans: 2, exp: "NAND gate." },
    { topic: "Logic Gates",             q: "Truth table: 0,0→0; 0,1→1; 1,0→1; 1,1→0 describes?",                                                       opts: ["OR gate","XOR gate","NAND gate","AND gate"],                                  ans: 1, exp: "XOR gate." },
    { topic: "Memory",                  q: "NOT true about SRAM?",                                                                                         opts: ["Maintains power while on","Made from capacitors","Shorter access times","Used for cache"], ans: 1, exp: "SRAM uses flip-flops, not capacitors." },
    { topic: "Memory",                  q: "Principle of locality of reference?",                                                                          opts: ["Recently used items likely reused","Nearby addresses referenced together","Both a and b","None"], ans: 2, exp: "Temporal + spatial locality." },
    { topic: "Software",                q: "A device driver is a piece of?",                                                                               opts: ["Software","Hardware","Both","None"],                                          ans: 0, exp: "Device drivers are software." },
    { topic: "Software",                q: "Every device requires a device driver. TRUE/FALSE?",                                                           opts: ["True","False","Only motherboard devices","Options a and c"],                 ans: 0, exp: "TRUE." },
    { topic: "Storage",                 q: "TRUE about hard disk?",                                                                                        opts: ["Has rigid platters","Ferrous oxide surface","Platters on central spindle","All of the above"], ans: 3, exp: "All are correct." },
    { topic: "Storage",                 q: "TRUE about hard disk tracks?",                                                                                 opts: ["R/W head per platter","Concentric tracks","512-byte blocks","All of the above"], ans: 3, exp: "All correct." },
    { topic: "Storage",                 q: "Recording density determines disk capacity. TRUE/FALSE?",                                                     opts: ["True","False","Not always","None"],                                           ans: 0, exp: "TRUE." },
    { topic: "Storage",                 q: "Areal density determines disk capacity. TRUE/FALSE?",                                                          opts: ["True","False","Not always","None"],                                           ans: 0, exp: "TRUE." },
    { topic: "Storage",                 q: "Disk capacity: 512B/sector, 300 sectors/track, 20k tracks, 2 surfaces, 5 platters?",                        opts: ["28.6 KB","28.6 MB","28.6 GB","28.6 TB"],                                     ans: 2, exp: "≈ 28.6 GB." },
    { topic: "Storage",                 q: "Correct disk access time formula?",                                                                            opts: ["Seek+latency+transfer","Seek+transfer","Latency+transfer","Settle+transfer"], ans: 0, exp: "Seek + rotational latency + transfer." },
    { topic: "Storage",                 q: "Data transfer time is time to transfer between?",                                                             opts: ["Register and cache","HDD and auxiliary","System and the disk","All"],         ans: 2, exp: "System and the disk." },
    { topic: "Storage",                 q: "TRUE about data transfer time?",                                                                               opts: ["Internal rate only","External rate only","Both","None"],                      ans: 2, exp: "Both internal and external rates." },
    { topic: "Assembly Language",       q: "Code telling computer which operation to perform?",                                                            opts: ["Machine code","Operation code","Language code","Software"],                   ans: 1, exp: "Operation code (opcode)." },
    { topic: "Assembly Language",       q: "Features of assembly language EXCEPT?",                                                                       opts: ["Macros","System calls","Directives","None of the above"],                     ans: 3, exp: "All three ARE assembly features." },
    { topic: "Assembly Language",       q: "Binary code with opcode + operand is?",                                                                       opts: ["Machine instruction code","Machine code","Operation code","Language code"],  ans: 0, exp: "Machine instruction code." },
    { topic: "Assembly Language",       q: "Immediate, direct, indirect, indexed are addressing modes. TRUE/FALSE?",                                      opts: ["True","False"],                                                               ans: 0, exp: "TRUE." },
    { topic: "Assembly Language",       q: "INC <register> means?",                                                                                       opts: ["Increase by 1","Increase by 2","Increase by 3","Increase by 5"],              ans: 0, exp: "INC adds 1." },
    { topic: "Software",                q: "System software is smaller and less interactive than app software. TRUE/FALSE?",                              opts: ["True","False"],                                                               ans: 0, exp: "Generally TRUE — system software runs in background." },
    { topic: "Software",                q: "What provides the visual interface for the user?",                                                             opts: ["Operating System","Opcode Instructions","Edsim 51","None"],                  ans: 0, exp: "The Operating System provides the UI." },
    { topic: "Software",                q: "Program for specific system resource tasks?",                                                                  opts: ["Application software","Operating system","Utility program","A program"],      ans: 2, exp: "Utility program." },
    { topic: "Software",                q: "Virus checker and Backup are utility programs. TRUE/FALSE?",                                                  opts: ["True","False"],                                                               ans: 0, exp: "TRUE." },
    { topic: "Security",                q: "Protecting computer against unwanted access?",                                                                 opts: ["Data security","Data protection","Ownership protection","Computer security"],  ans: 3, exp: "Computer security." },
    { topic: "Security",                q: "Computer security threats include?",                                                                           opts: ["Network attacks","Hardware theft","Software theft","All of the above"],       ans: 3, exp: "All of the above." },
    { topic: "Security",                q: "Person hired to break into an organisation's computer is?",                                                   opts: ["Script kiddie","Unethical employee","Corporate spy","Cyberterrorist"],        ans: 2, exp: "Corporate spy." },
    { topic: "Security",                q: "Program infecting computer without user knowledge?",                                                           opts: ["Worm","Rootkit","Computer virus","Trojan Horse"],                             ans: 2, exp: "Computer virus." },
    { topic: "Security",                q: "Compromised computer controlled remotely?",                                                                    opts: ["Bot","Botnet","Zombie","Virus"],                                              ans: 2, exp: "Zombie." },
    { topic: "Security",                q: "Group of compromised computers attacking networks?",                                                           opts: ["Bot","Botnet","Zombie","Virus"],                                              ans: 1, exp: "Botnet." },
    { topic: "Databases",               q: "Attribute referencing another table's primary key?",                                                          opts: ["Primary key","Foreign key","Security key","Privacy key"],                     ans: 1, exp: "Foreign key." },
    { topic: "Databases",               q: "Attribute is a column in relational table. TRUE/FALSE?",                                                      opts: ["False","True"],                                                               ans: 1, exp: "TRUE." },
    { topic: "Databases",               q: "DBA uses DBMS to customise database. TRUE/FALSE?",                                                            opts: ["True","False"],                                                               ans: 0, exp: "TRUE." },
    { topic: "Databases",               q: "Attribute with unique value in each tuple?",                                                                   opts: ["Security key","Foreign key","Primary key","Privacy key"],                     ans: 2, exp: "Primary key." },
    { topic: "Databases",               q: "Member(MemID, MemGivenName, BandName) — 'Member' is?",                                                       opts: ["Attribute","Table name","Primary key","Foreign key"],                         ans: 1, exp: "Table name." },
    { topic: "Databases",               q: "Member(MemID, MemGivenName, BandName) — 'BandName' is?",                                                     opts: ["Attribute","Table name","Primary key","Foreign key"],                         ans: 0, exp: "Attribute." },
    { topic: "Databases",               q: "Database allows multiple primary key entries. TRUE/FALSE?",                                                   opts: ["True","False"],                                                               ans: 1, exp: "FALSE — primary keys must be UNIQUE." },
    { topic: "Databases",               q: "Primary key ensures entity integrity; ___ ensures referential integrity.",                                    opts: ["Security key","Database key","Foreign key","Primary key"],                    ans: 2, exp: "Foreign key." },
    { topic: "Databases",               q: "50 students assigned to 1 tutor — Student to Tutor relationship?",                                           opts: ["One to one","Many to many","Many to one","One and only one"],                 ans: 2, exp: "Many students to one tutor." },
    { topic: "Databases",               q: "10 buses transport 50 people — Buses to Individuals relationship?",                                          opts: ["One to one","Many to many","Many to one","One and only one"],                 ans: 1, exp: "Many-to-many." },
    { topic: "Databases",               q: "Process of arranging attributes into sensible groupings for relational tables?",                              opts: ["Relationship","Normalisation","Data Modelling","Data redundancy"],             ans: 1, exp: "Normalisation." },
  ],
};
