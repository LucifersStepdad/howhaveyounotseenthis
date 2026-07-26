# First Watch

A free ticket-themed site for voting on, adding to, and tracking your movie list. No accounts, no login — anyone with the link can vote, add a film, or write a review.

**Stack:** static HTML/CSS/JS on GitHub Pages + a free Firebase Firestore database for the shared data (votes, watched status, reviews).

Total cost: **$0**, no credit card needed.

---

## 1. Create your Firebase project (~5 min)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and sign in with a Google account.
2. Click **Add project**, give it a name (e.g. `first-watch`), skip Google Analytics (not needed).
3. Once created, click the **web icon (`</>`)** to register a web app. Name it anything.
4. Firebase will show you a `firebaseConfig` object. Copy it.
5. Open `firebase-config.js` in this folder and paste your values in, replacing the placeholders.

## 2. Turn on Firestore (~2 min)

1. In the left sidebar: **Build → Firestore Database → Create database**.
2. Choose **production mode** (we'll set our own rules next) and pick any region close to you.
3. Once it's created, go to the **Rules** tab.
4. Delete what's there and paste in the contents of `firestore.rules` from this folder.
5. Click **Publish**.

These rules let anyone read everything and add/vote/review, but stop people from doing things like setting a vote count to a million in one go or deleting entries.

## 3. Test it locally (optional but recommended)

Just open `index.html` in a browser (or run `npx serve` in this folder). Try adding a movie and voting — it should show up instantly in the Firebase console under **Firestore Database → Data**.

## 4. Load your ~100 films in one go

Typing 100 movies into the form one at a time would be miserable, so there's a shortcut:

1. Open `seed.html` in your browser (locally, or after deploying).
2. Paste your list, one per line, optionally as `Title | Year`.
3. Click **Import all**. Done in a few seconds.
4. You never need to link to this page from your site — it's just a one-time tool. You can delete `seed.html` afterward if you want to tidy up.

## 5. Connect TMDb (movie search + duplicate checking)

1. Create a free account at [themoviedb.org](https://www.themoviedb.org), then go to **Settings → API** and request a free "Developer" API key (approved instantly, no working app required).
2. Copy the **API Read Access Token** (the long one starting with `eyJ`).
3. Open `tmdb-config.js` and paste it in place of `PASTE_YOUR_READ_ACCESS_TOKEN`.

With this connected, typing a title in "Add to the reel" live-searches TMDb, shows posters/years to pick from, and blocks adding something already on the list.

## 6. Deploy to GitHub Pages (~5 min)

1. Create a new GitHub repo (public or private both work with Pages).
2. Push all the files in this folder to it (`index.html`, `style.css`, `app.js`, `firebase-config.js`, `tmdb-config.js`, `firestore.rules`, `seed.html`).
3. In the repo: **Settings → Pages → Source → Deploy from a branch → main → / (root)**.
4. Wait a minute, then your site will be live at `https://yourusername.github.io/repo-name/`.

Send that link to whoever you want voting.

## How it works

- **Voting**: each browser can vote once per movie (tracked via `localStorage`, no login). Votes update live for everyone watching the page.
- **Watched tracker**: "We watched this" flips a movie into the Watched tab.
- **Reviews**: once a movie is marked watched, a review box appears. Anyone can write one, and it's visible to everyone.
- **Sorting**: by votes, newest, or A–Z.

## Notes / things you might want to tweak later

- Right now anyone can edit anyone's review (no accounts = no ownership). Fine for a small group of friends/family; if it ever gets abused, the fix is adding Firebase Auth, which is a bigger change.
- The free Firestore tier gives you 50,000 reads and 20,000 writes a day — for a movie-night list with friends, you will not come close.
- Want to change the color scheme, header text, or add movie posters? Everything's in plain `style.css` / `index.html`, no build step required.
