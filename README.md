# TubeStack

YouTube channel discovery platform for engineers. Curate your favorite channels, browse what peers watch, and find new content through match scores and recommendations.

**Live:** [tubestack.neorgon.com](https://tubestack.neorgon.com/)

## Quick Start

```bash
npm install                    # Install Convex dependency
npx convex dev                 # Terminal 1: start Convex backend
make serve                     # Terminal 2: serve on http://localhost:8827
```

The Cloudflare Worker (YouTube API proxy) requires a separate setup — see `worker/` directory.

## Architecture

- **Frontend:** Modular ES modules (`js/*.js`) — no build step, served via `python3 -m http.server`
- **Backend:** Convex serverless — 6 tables (users, channels, userChannels, collections, follows, recommendations)
- **Proxy:** Cloudflare Worker — keeps YouTube API key secret, POST-only endpoints

## Features

- Search YouTube and add channels to your stack with category tags
- Browse other engineers' stacks and see match scores (Jaccard similarity)
- Follow users and get a personalized feed
- Create named collections of channels
- Send channel recommendations to other users
- Trending and recently added discovery feeds

## Project Structure

```
tubestack-site/
├── index.html          # HTML shell, Pattern C header (nav + auth)
├── css/style.css       # All styles, cyan-300 accent
├── js/
│   ├── app.js          # Entry point
│   ├── state.js        # Convex client, auth, mutable state
│   ├── data.js         # Convex query/mutation wrappers
│   ├── render.js       # DOM rendering for all views
│   ├── events.js       # Event handlers, hash router
│   ├── utils.js        # escHtml, toast, debounce, timeAgo, formatCount
│   ├── youtube.js      # Worker proxy calls
│   └── social.js       # Jaccard match, category stats
├── convex/             # Convex backend (schema, auth, channels, etc.)
├── worker/             # Cloudflare Worker (YouTube API proxy)
└── docs/               # Architecture diagrams
```

## Part of [Neorgon](https://neorgon.com/)
