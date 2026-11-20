# 🎬 MoodFlix

Movie suggestions based on **your taste + how you feel right now**, and a **Watch Party** that plays the same video in sync on several devices (play, pause and skip happen for everyone at once, with a chat on the side).

## Features

**Discover (recommender)**
- Pick favourite genres and add movies you love (search powered by TMDB).
- Choose your current mood (Happy, Low, Want a good cry, Pumped, Want a scare, Curious, Romantic, Chill, Surprise me).
- Filters: length, era, language (incl. Urdu, Hindi, Punjabi, Korean…), minimum rating.
- Each suggestion explains *why* ("Fits your mood: Comedy", "Because you liked Interstellar").
- 👍 / 👎 / ✓ Seen teach it your taste; it never re-suggests movies you've marked.
- Click a poster to see the plot and which streaming services carry it in your country.

**Watch Party (sync)**
- Create a room → share the 6-letter code or invite link → friends join from any phone/laptop.
- Load a YouTube link, a direct `.mp4/.webm` URL, or send a movie's trailer straight from Discover ("▶ Together").
- Play / pause / skip ±10s / scrub are mirrored to everyone. People who join late jump to the current position.
- The first person in the room (⭐) sends a heartbeat every 4s that corrects anyone drifting more than 1.5s.
- Live member list and chat.

**Reactions & ratings**
- Tap 😂 😱 😍 😢 🔥 👏 🤯 💀 under the player: the emoji floats up over the video for everyone (with your name), also in fullscreen.
- When a movie's video ends, everyone gets a **Did you like it?** prompt (👍 / 👎 / Skip) and sees the room's tally and verdict. Anyone can also press **⭐ Rate** on the player to ask the room at any time.
- Your answer goes into your own taste profile, so it changes your next Discover and Group mood suggestions. Rating is available when the video came from a movie (Discover "▶ Together" or a Group mood pick), not for pasted links.

**Group mood**
- In a room, everyone taps their own mood; the member list shows each person's mood emoji.
- Anyone presses **✨ Find a movie for all of us**. The app:
  - searches the genres most people want, and skips genres at least half the group wants to avoid,
  - scores movies by how many moods they fit minus how many they clash with, plus everyone's shared favourite genres and liked-movie taste,
  - leaves out movies anyone in the room has already seen, liked or disliked.
- The 6 picks appear for everyone. Each person gets one vote and the leader is highlighted. Press **▶ Trailer for everyone** to watch it in sync.

**Accounts, guest mode & history**
- First visit shows a welcome screen: **Sign up**, **Log in**, or **Try as a guest**.
- Guests get 3 free mood suggestions and can join a friend's room. Creating rooms, Group mood and History ask them to sign up.
- On sign-up/login, everything the guest liked/disliked/marked seen is moved into the account.
- For logged-in users, likes, dislikes, seen movies and favourite genres are saved in Supabase (available on every device), and every video played in a Watch Party is logged (title, trailer/video, room, how many people, time).
- The **History** tab shows stats, top genres, the watch log and the liked / not-for-me / seen lists, with remove buttons.

## How it works

| Part | Tech |
|---|---|
| UI | React 18 + Vite |
| Movie data | [TMDB API](https://developer.themoviedb.org/) (`/discover/movie` with mood → genre mapping) |
| Scoring | `src/lib/recommender.js` — mood genre match + favourite genres + learned taste from likes/dislikes + rating |
| Taste profile | `localStorage` (no login needed) |
| Real-time sync | [Supabase Realtime](https://supabase.com/docs/guides/realtime) Broadcast + Presence (no database tables needed) |
| Player | YouTube IFrame API or HTML5 `<video>`, wrapped in `SyncedPlayer.jsx` with custom controls |

Why Supabase and not my own WebSocket server? Vercel's serverless functions can't hold WebSocket connections open, so a hosted real-time service is the simplest way to keep the whole app on Vercel.

## Setup

1. **TMDB key (free):** sign up at themoviedb.org → Settings → API → copy the *API Key (v3 auth)*.
2. **Supabase (free):** create a project at supabase.com → Project Settings → API → copy the *Project URL* and the *anon public* key.
3. Copy `.env.example` to `.env` and fill in the values.
4. **Create the database tables:** Supabase → **SQL Editor** → **New query** → paste everything from `supabase/schema.sql` → **Run**.
5. **Auth settings:** Supabase → **Authentication → URL Configuration** → set **Site URL** to your Vercel URL, and add `http://localhost:5173` under **Redirect URLs**. (For quick testing you can turn off **Confirm email** under Authentication → Sign In / Providers → Email, so new accounts can log in immediately.)
6. Run:
   ```bash
   npm install
   npm run dev
   ```
7. To test sync, open the app in two browser windows (or on your phone using your PC's LAN IP: `npm run dev -- --host`).

## Deploy to Vercel

Push to GitHub → import in Vercel (framework: Vite) → add the same four `VITE_…` variables under *Environment Variables* → deploy.

## Important limitations

- **What can be played:** you can't embed Netflix, Prime, etc. — their players block it. Watch Party works with YouTube videos (trailers, free full movies on official channels) and video files you have the rights to, hosted at a direct URL (e.g. Supabase Storage, Cloudflare R2). The "Stream on" info tells you where to watch the full movie legally.
- **Autoplay:** some browsers (especially iPhone Safari) block playback started by someone else until you tap once. The player shows a "Tap to join playback" button when that happens.
- **Accuracy:** sync is usually within ~0.5–1.5s. Device clocks that are far off are capped so they can't cause big jumps.
- **API key exposure:** the TMDB key is visible in the browser bundle. That's normal for a student project; for production, move TMDB calls into a Vercel serverless function.

## Ideas for next steps

- "Forgot password" flow and Google sign-in.
- Emoji reactions that float over the video.
- Voice/video chat with WebRTC.
