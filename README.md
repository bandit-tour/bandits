# Banditour

> **Unique local tourist attractions based on indie human recommendations**  
> The ones you wouldn't find in Google or AI chats.

---

##  Tech Stack

Built with:
- **React Native** + **Expo**
- **Supabase**
- A lot of vibe coding ✨

---

## Demo

**Currently running in Athens:**  
🔗 https://bandits-app.netlify.app/bandits

---

## Production web (Vercel)

This repo is **Expo web** (`expo export` → **`dist/`**), not Next.js. If Vercel shows **Next.js** or **`X-Powered-By: Next.js`** on the live URL, the **wrong project** or **wrong framework** is connected.

**Fix (whoever has Vercel access):**

1. **Option A (preferred)** — Open the existing Vercel project → **Settings → General**:
   - **Framework Preset**: **Other** (or leave unset; this repo also sets `"framework": null` in `vercel.json`).
   - **Root Directory**: repository root (where `package.json` and `vercel.json` live).
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install` or `npm ci` (avoid `npm install --legacy-peer-deps` — the lockfile now resolves React Navigation + react-leaflet peers; see `package.json` `overrides`).
   - **Git** → confirm the repo is **`bandit-tour/bandits`** and the right branch (e.g. `main`).
   - Redeploy **Production**.

2. **Option B (faster)** — **Add New Project** → import **`bandit-tour/bandits`**, use the same build/output as above, then point **`bandit-tours.vercel.app`** at this project (**Domains**).

**Verify after deploy:** `GET /` should **not** be a random Next app; `GET /hotel/play-theatrou` should return **200** (SPA + `dist/hotel/play-theatrou/index.html` from the build).

---
