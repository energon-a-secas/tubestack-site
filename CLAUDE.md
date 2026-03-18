# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

```bash
npm install                          # Install Convex dependency
npx convex dev                       # Terminal 1: Convex backend (watches for changes)
make serve                           # Terminal 2: http://localhost:8827
cd worker && npx wrangler dev        # Terminal 3 (optional): Worker on localhost:8787
```

Push backend changes without watching: `npx convex dev --once`

Deploy: `npx convex deploy` (production), `cd worker && npx wrangler deploy` (Worker)

## Architecture

Three-tier app: static frontend (ES modules) + Convex serverless backend + Cloudflare Worker (YouTube API proxy).

```
Browser ──[ES modules]──> Convex Cloud (queries/mutations)
   └───[fetch POST]────> CF Worker (tubestack-api.neorgon.workers.dev) ──> YouTube Data API v3
```

**No build step.** Frontend served via `python3 -m http.server`. ES modules require HTTP server, not `file://`.

### Frontend (`js/`)

| File | Role |
|------|------|
| `app.js` | Entry point — init Convex, bind events, first render |
| `state.js` | Convex client (`ConvexHttpClient` via esm.sh CDN), API function name map, auth helpers (localStorage), mutable state object, category list |
| `data.js` | All Convex query/mutation wrappers. `q()` and `m()` are internal shorthands |
| `render.js` | Pure HTML rendering — returns strings, never touches DOM directly except through `renderView()` |
| `events.js` | Hash router (`#feed`, `#explore`, `#stack`, `#user=x`, `#collection=x`), click delegation, auth forms |
| `youtube.js` | Worker proxy calls. Falls back to demo data when `WORKER_URL` starts with `REPLACE` |
| `social.js` | Client-side Jaccard similarity, match badge CSS class mapping |
| `utils.js` | `escHtml`, `escAttr` (JSON-safe for HTML attributes), `showToast`, `debounce`, `timeAgo`, `formatCount` |

**Data flow:** `events.js` calls `data.js` wrappers → `data.js` calls Convex via `state.js` client → updates `state` object → calls `render.js` to re-render DOM.

**Convex client is no-build:** Uses `ConvexHttpClient` from `https://esm.sh/convex@1.21.0/browser`. Function references are plain strings like `"auth:login"`, not imported from generated code. The `api` object in `state.js` maps all function names.

### Backend (`convex/`)

6 tables — see `schema.ts`. Convex has no joins, so usernames are denormalized into junction tables.

| File | Key functions |
|------|--------------|
| `auth.ts` | register (first user = admin), login, getUser. Uses `simpleHash` (non-cryptographic) |
| `channels.ts` | `addChannel` (dedup by youtubeChannelId), `refreshThumbnail` (update image + stats from YouTube) |
| `userChannels.ts` | Link users to channels with categories/notes. `listByUser` joins channel data |
| `collections.ts` | Named channel lists. `addChannel`/`removeChannel` for individual management |
| `discovery.ts` | `trending` (top 20 in 7 days), `recent`, `matchScore` (Jaccard), `similarUsers` (reverse index), `feedFromFollowing`, `allPublicUsers` |
| `follows.ts` | Follow/unfollow with self-follow prevention |
| `recommendations.ts` | Send channel recommendations (max 10 unseen per recipient) |

### Worker (`worker/`)

YouTube Data API v3 proxy. Keeps `YOUTUBE_API_KEY` as Wrangler secret. POST-only endpoints, CORS restricted.

- `POST /search {"q":"..."}` — `search.list?type=channel` (100 quota units, returns 5 results)
- `POST /channel {"id":"UC..."}` — `channels.list?part=snippet,statistics,topicDetails` (1 quota unit)

Daily quota: 10,000 units. Thumbnails normalized to `s240` via `ggpht.com` URL rewriting.

## Key Gotchas

**External images require `referrerpolicy="no-referrer"`:** YouTube `yt3.ggpht.com` blocks images when `Referer` is localhost. The page has `<meta name="referrer" content="no-referrer">` globally, but any new `<img>` for external URLs should also have `referrerpolicy="no-referrer"`.

**JSON in HTML attributes:** Channel data is embedded in `data-*` attributes. Always use `escAttr()` (from `utils.js`) instead of raw `JSON.stringify` — descriptions with quotes/newlines break attribute parsing.

**CSS `display` vs `hidden` attribute:** Overlays use `display: flex` which overrides the `hidden` attribute. Every overlay class needs a `[hidden] { display: none; }` rule.

**Convex no-build pattern:** Function names are strings, not imports. When adding a new Convex function, also add its string reference to `state.js` → `api` object.

**YouTube API cost awareness:** Search costs 100 units regardless of `maxResults`. Channel detail costs 1 unit. The frontend checks Convex first (via `getByYoutubeId`) before calling the Worker to avoid redundant API calls.

## Design Tokens

- Background: `#040714`
- Accent: `#67e8f9` (cyan-300)
- Header gradient: `135deg, #B015B0 0%, #3D0080 50%, #040714 100%`
- Font: Avenir Next system stack
- Pattern C header: nav links + auth toggle + home icon

## Deployment

- **Frontend:** GitHub Pages with CNAME `tubestack.neorgon.com`
- **Backend:** Convex Cloud (`brave-lion-580`). Config in `.env.local`
- **Worker:** Cloudflare Workers (`tubestack-api.neorgon.workers.dev`). Secret: `YOUTUBE_API_KEY`
