/* ---------- Firebase init ---------- */
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const moviesRef = db.collection("movies");

/* ---------- Local state ---------- */
let allMovies = [];
let currentFilter = "upcoming";
let currentSort = "votes";
let editingReviewId = null;
const VOTED_KEY = "firstwatch_voted_ids";

function getVotedIds() {
  try { return new Set(JSON.parse(localStorage.getItem(VOTED_KEY) || "[]")); }
  catch { return new Set(); }
}
function rememberVote(id) {
  const s = getVotedIds();
  s.add(id);
  localStorage.setItem(VOTED_KEY, JSON.stringify([...s]));
}

/* ---------- DOM refs ---------- */
const grid = document.getElementById("grid");
const loadingMsg = document.getElementById("loadingMsg");
const emptyState = document.getElementById("emptyState");
const addForm = document.getElementById("addForm");
const addHint = document.getElementById("addHint");
const statTotal = document.getElementById("statTotal");
const statWatched = document.getElementById("statWatched");
const statVotes = document.getElementById("statVotes");
const sortSelect = document.getElementById("sortSelect");

const addTitle = document.getElementById("addTitle");
const addYear = document.getElementById("addYear");
const addTmdbId = document.getElementById("addTmdbId");
const addPoster = document.getElementById("addPoster");
const titleResults = document.getElementById("titleResults");

/* ---------- TMDb search-as-you-type ---------- */
let searchDebounce = null;
let searchAbort = null;

addTitle.addEventListener("input", () => {
  // any manual edit invalidates a previous TMDb selection
  addTmdbId.value = "";
  addPoster.value = "";

  const query = addTitle.value.trim();
  clearTimeout(searchDebounce);

  if (query.length < 2) {
    titleResults.hidden = true;
    titleResults.innerHTML = "";
    return;
  }

  searchDebounce = setTimeout(() => runTmdbSearch(query), 350);
});

document.addEventListener("click", (e) => {
  if (!document.getElementById("titleAutocomplete").contains(e.target)) {
    titleResults.hidden = true;
  }
});

async function runTmdbSearch(query) {
  if (!TMDB_READ_TOKEN || TMDB_READ_TOKEN.startsWith("PASTE_")) {
    titleResults.hidden = true;
    return;
  }

  if (searchAbort) searchAbort.abort();
  searchAbort = new AbortController();

  titleResults.hidden = false;
  titleResults.innerHTML = `<div class="autocomplete__status">Searching TMDb…</div>`;

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}&include_adult=false`,
      {
        headers: { Authorization: `Bearer ${TMDB_READ_TOKEN}` },
        signal: searchAbort.signal
      }
    );
    if (!res.ok) throw new Error(`TMDb responded ${res.status}`);
    const data = await res.json();
    renderResults(data.results ? data.results.slice(0, 6) : [], query);
  } catch (err) {
    if (err.name === "AbortError") return;
    console.error(err);
    titleResults.innerHTML = `<div class="autocomplete__status">Couldn't reach TMDb — you can still type the title manually.</div>`;
  }
}

function renderResults(results, query) {
  if (results.length === 0) {
    titleResults.innerHTML = `<div class="autocomplete__status">No TMDb matches — you can still add "${escapeHtml(query)}" manually.</div>`;
    return;
  }

  titleResults.innerHTML = results
    .map((r) => {
      const year = (r.release_date || "").slice(0, 4);
      const poster = r.poster_path ? `https://image.tmdb.org/t/p/w92${r.poster_path}` : "";
      const already = findExistingByTmdbId(r.id);
      return `
        <button type="button" class="autocomplete__item" data-tmdb-id="${r.id}" data-poster="${r.poster_path || ""}" data-title="${escapeHtml(r.title)}" data-year="${year}">
          ${poster ? `<img class="autocomplete__poster" src="${poster}" alt="">` : `<div class="autocomplete__poster"></div>`}
          <span class="autocomplete__meta">
            ${escapeHtml(r.title)}
            <small>${year || "Unknown year"}${already ? " · Already on the list" : ""}</small>
          </span>
        </button>
      `;
    })
    .join("");

  titleResults.querySelectorAll(".autocomplete__item").forEach((btn) => {
    btn.addEventListener("click", () => {
      addTitle.value = btn.dataset.title;
      addYear.value = btn.dataset.year;
      addTmdbId.value = btn.dataset.tmdbId;
      addPoster.value = btn.dataset.poster;
      titleResults.hidden = true;
    });
  });
}

function findExistingByTmdbId(tmdbId) {
  return allMovies.find((m) => m.tmdbId && String(m.tmdbId) === String(tmdbId));
}

function findExistingByTitle(title) {
  const norm = title.trim().toLowerCase();
  return allMovies.find((m) => m.title.trim().toLowerCase() === norm);
}

/* ---------- Live listener ---------- */
moviesRef.onSnapshot(
  (snapshot) => {
    allMovies = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    loadingMsg.remove?.();
    render();
  },
  (err) => {
    loadingMsg.textContent = "Couldn't reach the projector booth — check firebase-config.js and your Firestore rules.";
    console.error(err);
  }
);

/* ---------- Add movie ---------- */
addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = addTitle.value.trim();
  const year = addYear.value.trim();
  const addedBy = document.getElementById("addBy").value.trim() || "Anonymous";
  const tmdbId = addTmdbId.value || null;
  const poster = addPoster.value || null;
  if (!title) return;

  const dupe = tmdbId ? findExistingByTmdbId(tmdbId) : findExistingByTitle(title);
  if (dupe) {
    addHint.textContent = `"${dupe.title}" is already on the list — go vote for it instead!`;
    return;
  }

  addHint.textContent = "Printing ticket...";
  try {
    await moviesRef.add({
      title,
      year: year || null,
      tmdbId,
      poster,
      addedBy,
      votes: 0,
      watched: false,
      review: "",
      reviewedBy: "",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    addForm.reset();
    addTmdbId.value = "";
    addPoster.value = "";
    titleResults.hidden = true;
    addHint.textContent = `"${title}" is on the list.`;
    setTimeout(() => (addHint.textContent = ""), 2500);
  } catch (err) {
    addHint.textContent = "Couldn't add that one — try again.";
    console.error(err);
  }
});

/* ---------- Tabs ---------- */
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => {
      b.classList.remove("is-active");
      b.setAttribute("aria-selected", "false");
    });
    btn.classList.add("is-active");
    btn.setAttribute("aria-selected", "true");
    currentFilter = btn.dataset.filter;
    render();
  });
});

/* ---------- Sort ---------- */
sortSelect.addEventListener("change", () => {
  currentSort = sortSelect.value;
  render();
});

/* ---------- Voting ---------- */
async function vote(id) {
  const voted = getVotedIds();
  if (voted.has(id)) return;
  rememberVote(id);
  try {
    await moviesRef.doc(id).update({
      votes: firebase.firestore.FieldValue.increment(1)
    });
  } catch (err) {
    console.error(err);
  }
  render();
}

/* ---------- Watched toggle ---------- */
async function toggleWatched(id, nextState) {
  try {
    await moviesRef.doc(id).update({
      watched: nextState,
      watchedAt: nextState ? firebase.firestore.FieldValue.serverTimestamp() : null
    });
  } catch (err) {
    console.error(err);
  }
}

/* ---------- Review ---------- */
async function saveReview(id, review, reviewedBy) {
  try {
    await moviesRef.doc(id).update({
      review: review.trim(),
      reviewedBy: reviewedBy.trim() || "Anonymous"
    });
  } catch (err) {
    console.error(err);
  }
}

/* ---------- Render ---------- */
function render() {
  let list = [...allMovies];

  if (currentFilter === "upcoming") list = list.filter((m) => !m.watched);
  if (currentFilter === "watched") list = list.filter((m) => m.watched);

  if (currentSort === "votes") list.sort((a, b) => (b.votes || 0) - (a.votes || 0));
  if (currentSort === "alpha") list.sort((a, b) => a.title.localeCompare(b.title));
  if (currentSort === "newest") list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  statTotal.textContent = allMovies.length;
  statWatched.textContent = allMovies.filter((m) => m.watched).length;
  statVotes.textContent = allMovies.reduce((sum, m) => sum + (m.votes || 0), 0);

  grid.innerHTML = "";
  emptyState.hidden = list.length !== 0;

  const votedIds = getVotedIds();

  list.forEach((movie) => {
    const card = document.createElement("article");
    card.className = "ticket" + (movie.watched ? " is-watched" : "");

    const alreadyVoted = votedIds.has(movie.id);

    card.innerHTML = `
      <div class="ticket__stub">
        <button class="vote-btn" data-id="${movie.id}" ${alreadyVoted ? "disabled" : ""} aria-label="Vote for ${escapeHtml(movie.title)}">▲</button>
        <span class="vote-count">${movie.votes || 0}</span>
        <span class="vote-label">votes</span>
      </div>
      <div class="ticket__body">
        ${movie.watched ? `<span class="watched-badge">Watched</span>` : ""}
        <div style="display:flex; gap:0.7rem;">
          ${movie.poster ? `<img src="https://image.tmdb.org/t/p/w92${movie.poster}" alt="" style="width:2.6rem;height:3.9rem;object-fit:cover;border-radius:4px;flex-shrink:0;">` : ""}
          <div>
            <h3 class="ticket__title">${escapeHtml(movie.title)}</h3>
            <p class="ticket__meta">${movie.year ? escapeHtml(movie.year) + " · " : ""}added by ${escapeHtml(movie.addedBy || "Anonymous")}</p>
          </div>
        </div>
        <div class="ticket__actions">
          <button class="btn ${movie.watched ? "btn--ghost" : "btn--red"}" data-watch-toggle="${movie.id}" data-next="${!movie.watched}">
            ${movie.watched ? "Mark unwatched" : "We watched this"}
          </button>
        </div>
        ${movie.watched ? renderReviewSection(movie) : ""}
      </div>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll(".vote-btn").forEach((btn) => {
    btn.addEventListener("click", () => vote(btn.dataset.id));
  });

  grid.querySelectorAll("[data-watch-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleWatched(btn.dataset.watchToggle, btn.dataset.next === "true");
    });
  });

  grid.querySelectorAll("[data-review-save]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.reviewSave;
      const textarea = grid.querySelector(`[data-review-text="${id}"]`);
      const nameInput = grid.querySelector(`[data-review-name="${id}"]`);
      await saveReview(id, textarea.value, nameInput.value);
      editingReviewId = null;
    });
  });

  grid.querySelectorAll("[data-edit-review]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      editingReviewId = link.dataset.editReview;
      render();
    });
  });
}

function renderReviewSection(movie) {
  if (movie.review && editingReviewId !== movie.id) {
    return `
      <div class="review-box">
        <p class="review-text">"${escapeHtml(movie.review)}"</p>
        <p class="review-meta">— ${escapeHtml(movie.reviewedBy || "Anonymous")}. <a href="#" data-edit-review="${movie.id}" style="color:var(--gold)">Edit</a></p>
      </div>
    `;
  }
  return `
    <div class="review-box">
      <textarea data-review-text="${movie.id}" placeholder="Leave a review...">${escapeHtml(movie.review || "")}</textarea>
      <div class="ticket__actions" style="margin-top:0.4rem">
        <input data-review-name="${movie.id}" placeholder="Your name" value="${escapeHtml(movie.reviewedBy || "")}" style="flex:1;background:var(--bg-deep);border:1px solid var(--card-edge);border-radius:6px;color:var(--ivory);padding:0.4rem 0.6rem;font-size:0.78rem;">
        <button class="btn btn--gold" data-review-save="${movie.id}">Save review</button>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
