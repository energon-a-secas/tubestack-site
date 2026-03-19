# CLAUDE.md

## Quick Start

```bash
npm install                          # Install Convex dependency
npx convex dev                       # Terminal 1: Convex backend (watches for changes)
make serve                           # Terminal 2: http://localhost:8827
cd worker && npx wrangler dev        # Terminal 3 (optional): Worker on localhost:8787
```

Push backend changes: `npx convex dev --once`
Deploy: `npx convex deploy` (production), `cd worker && npx wrangler deploy` (Worker)

## Architecture

Static frontend (ES modules, no build step) + Convex serverless backend + Cloudflare Worker (YouTube API proxy).

```
Browser --[ES modules]--> Convex Cloud (queries/mutations)
   └---[fetch POST]-----> CF Worker (tubestack-api.neorgon.workers.dev) --> YouTube Data API v3
```

### Frontend (`js/`)

| File | Role |
|------|------|
| `app.js` | Entry: init Convex, bind events, first render |
| `state.js` | `ConvexHttpClient` (esm.sh CDN), `api` string map, auth (localStorage), mutable `state` object |
| `data.js` | All Convex wrappers. `q(fn, args)` = query, `m(fn, args)` = mutation |
| `render.js` | Pure HTML string rendering. `renderView()` is the only function that writes to DOM |
| `events.js` | Hash router (`#feed`, `#explore`, `#stack`, `#user=x`, `#collection=x`), click delegation, auth |
| `youtube.js` | Worker proxy. Falls back to demo data when `WORKER_URL` starts with `REPLACE` |
| `social.js` | Jaccard similarity, match badge CSS classes |
| `utils.js` | `escHtml`, `escAttr`, `showToast`, `debounce`, `timeAgo`, `formatCount` |
| `collection-svg.js` | Returns first channel thumbnail URL as collection cover (no SVG generation) |

**Data flow:** `events.js` -> `data.js` -> Convex via `state.js` client -> updates `state` -> `render.js` re-renders.

**Adding a Convex function:** Write it in `convex/*.ts`, then add the string reference to `state.js` -> `api` object. Function names are strings like `"auth:login"`, not imports.

### Backend (`convex/`)

8 tables in `schema.ts`. No joins — usernames denormalized into junction tables.

| File | Key points |
|------|------------|
| `auth.ts` | register (first user = admin), login, getUser, updateProfile (displayName, bio, isPublic) |
| `channels.ts` | `addChannel` (dedup by youtubeChannelId), `refreshThumbnail`, `needsRefresh`, `bulkImport` |
| `userChannels.ts` | User-channel links with categories/notes. `listByUser` joins channel data |
| `collections.ts` | Channel lists. `listByUser`/`listByUsername` use `withCoverFallback()` to fix broken imageUrls |
| `discovery.ts` | `trending`, `recent`, `matchScore` (Jaccard), `similarUsers`, `feedFromFollowing`, `allPublicUsers` |
| `follows.ts` | Follow/unfollow, `getCounts` |
| `recommendations.ts` | Send recs (max 10 unseen per recipient), `markSeen` |
| `highlights.ts` | Video highlights per channel, upvote/downvote |

### Worker (`worker/`)

YouTube Data API v3 proxy. `YOUTUBE_API_KEY` as Wrangler secret. POST-only, CORS restricted.

- `POST /search {"q":"..."}` — 100 quota units, 5 results
- `POST /channel {"id":"UC..."}` — 1 quota unit

Daily quota: 10,000 units.

## Critical Gotchas (read these first)

### Convex query results are immutable
Documents returned by `.collect()` or `.get()` cannot be mutated in place — changes are silently dropped during serialization. Always spread into new objects: `results.push({ ...doc, newField })`. This cost hours of debugging.

### Collection imageUrl was historically corrupted
Old collections have broken `data:image/svg` or truncated `data:image/jpeg` (exactly 500 chars) from a since-removed `slice(0, 500)`. The `withCoverFallback()` function in `collections.ts` detects these and replaces with the first channel's YouTube thumbnail. Frontend `isValidImageUrl()` in `render.js` also filters: rejects all SVG data URLs, requires >1000 chars for other data URLs.

### ConvexHttpClient caches query results
After deploying backend changes via `npx convex dev --once`, the browser's existing `ConvexHttpClient` instance may serve stale data. A full page reload (`location.reload()`) is needed to see changes. Creating a fresh `ConvexHttpClient` in the console will show the latest data.

### External images need `referrerpolicy="no-referrer"`
YouTube `yt3.ggpht.com` blocks images when Referer is localhost. Page has `<meta name="referrer" content="no-referrer">` globally, but add `referrerpolicy="no-referrer"` to any new `<img>` tags.

### HTML attribute encoding
Channel data lives in `data-*` attributes. Always use `escAttr()` (JSON-safe) not raw `JSON.stringify` — descriptions with quotes/newlines break parsing.

### `maxlength` on inputs truncates programmatic `.value` too
Never use `maxlength` on hidden inputs or inputs that receive long programmatic values (base64, URLs). Use validation in JS instead.

### CSS `display` vs `hidden` attribute
Overlays use `display: flex` which overrides `hidden`. Every overlay needs `[hidden] { display: none; }`.

### YouTube API cost
Search = 100 units (regardless of maxResults). Channel detail = 1 unit. Frontend checks Convex first via `getByYoutubeId` before calling the Worker.

## UI Patterns

### Views and routing
Hash-based: `#feed`, `#explore`, `#stack`, `#user=username`, `#collection=id`

### Card types
- **Channel card** (`renderChannelCard`) — used in Feed, profile views. Shows thumbnail, name, stats, categories
- **Stack card** (`renderStackCard`) — used in My Stack. Adds Highlights button + overflow menu (Edit Tags, Add to Collection, Remove)
- **User card** (`renderUserCard`) — `<a>` element, clickable. Avatar initial, display name, @handle, channel/collection counts
- **Collection card** (`renderCollectionCard`) — cover image via `getCollectionCoverUrl()`, overflow menu for owner

### Overflow menus
`.overflow-menu-wrapper` with `[data-overflow-toggle]` trigger. Click toggles `.open`. Document click closes all.

### Profile
Own profile (`#user=myname`) shows Settings section: Display Name, Bio, Public Profile toggle. Save calls `updateProfile()`. Other users see Follow button + match score.

### Explore
"Members" directory sorted by channel count. User cards are `<a>` links. Search filters by username and display name.

## Design Tokens

- Background: `#040714`
- Accent: `#67e8f9` (cyan-300)
- Header gradient: `135deg, #B015B0 0%, #3D0080 50%, #040714 100%`
- Font: Avenir Next system stack
- Pattern C header: nav + auth toggle + home icon. Title wrapped in `<a class="header-title-link" href="#feed">`

## Deployment

- **Frontend:** GitHub Pages, CNAME `tubestack.neorgon.com`
- **Backend:** Convex Cloud (`brave-lion-580`), config in `.env.local`
- **Worker:** Cloudflare Workers (`tubestack-api.neorgon.workers.dev`), secret: `YOUTUBE_API_KEY`
