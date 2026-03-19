// ── DOM rendering ────────────────────────────────────────────
import { state, getLoggedInUser, CATEGORIES } from './state.js';
import { escHtml, escAttr, formatCount, timeAgo } from './utils.js';
import { matchBadgeClass, matchLabel } from './social.js';

const app = () => document.getElementById('app');

export function renderView() {
  const el = app();
  if (!el) return;
  updateNav();
  updateAuthUI();

  switch (state.view) {
    case 'feed':    el.innerHTML = renderFeed(); break;
    case 'explore': el.innerHTML = renderExplore(); break;
    case 'stack':   el.innerHTML = renderStack(); break;
    case 'user':    el.innerHTML = renderUserProfile(); break;
    case 'collection': el.innerHTML = renderCollectionDetail(); break;
    default:        el.innerHTML = renderFeed();
  }
}

function updateNav() {
  document.querySelectorAll('nav .nav-link').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === state.view);
  });
  const badge = document.getElementById('recBadge');
  if (badge) {
    if (state.unseenRecCount > 0) {
      badge.textContent = state.unseenRecCount;
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }
}

export function updateAuthUI() {
  const user = getLoggedInUser();
  const gate = document.getElementById('authGate');
  const userEl = document.getElementById('authUser');
  const nameEl = document.getElementById('authUsername');
  if (gate && userEl && nameEl) {
    if (user) {
      gate.hidden = true;
      userEl.hidden = false;
      nameEl.textContent = user.username;
    } else {
      gate.hidden = false;
      userEl.hidden = true;
    }
  }
}

// ── Feed view ────────────────────────────────────────────────
function renderFeed() {
  const user = getLoggedInUser();
  let html = '';

  // Recommendations
  if (user && state.recommendations.length > 0) {
    const unseen = state.recommendations.filter(r => !r.seen);
    if (unseen.length > 0) {
      html += `<section class="feed-section">
        <h2 class="section-title">Recommendations <span class="count-badge">${unseen.length}</span></h2>
        <div class="channel-grid">${unseen.map(r => renderRecCard(r)).join('')}</div>
      </section>`;
    }
  }

  // Following feed
  if (user && state.followingFeed.length > 0) {
    html += `<section class="feed-section">
      <h2 class="section-title">From People You Follow</h2>
      <div class="channel-grid">${state.followingFeed.map(uc => renderChannelCard(uc.channel, uc.username)).join('')}</div>
    </section>`;
  }

  // Trending
  if (state.trending.length > 0) {
    const sorted = [...state.trending].sort((a, b) => {
      if (state.sortBy === 'subscribers') {
        return parseInt(b.subscriberCount || '0') - parseInt(a.subscriberCount || '0');
      } else if (state.sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      // Default: sort by recency (engineerCount is the trending score)
      return (b.engineerCount || 0) - (a.engineerCount || 0);
    });
    html += `<section class="feed-section">
      <h2 class="section-title">Trending This Week</h2>
      <div class="channel-grid">${sorted.map(ch => renderChannelCard(ch, null, ch.engineerCount)).join('')}</div>
    </section>`;
  }

  // Recently added - allow sorting
  if (state.recentChannels.length > 0) {
    const sorted = [...state.recentChannels].sort((a, b) => {
      if (state.sortBy === 'subscribers') {
        return parseInt(b.subscriberCount || '0') - parseInt(a.subscriberCount || '0');
      } else if (state.sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      // Default: keep existing order (already sorted by date)
      return 0;
    });
    html += `<section class="feed-section">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h2 class="section-title" style="margin-bottom: 0;">Recently Added</h2>
        <div class="sort-controls">
          <label style="font-size: 0.85rem; color: var(--text-muted);">Sort:</label>
          <select id="sortBy" style="margin-left: 8px; padding: 4px 8px; background: var(--surface-1); border: 1px solid var(--border); border-radius: 4px; color: var(--text-primary); font-size: 0.85rem;">
            <option value="date" ${state.sortBy === 'date' ? 'selected' : ''}>Added Date</option>
            <option value="subscribers" ${state.sortBy === 'subscribers' ? 'selected' : ''}>Subscribers</option>
            <option value="name" ${state.sortBy === 'name' ? 'selected' : ''}>Name</option>
          </select>
        </div>
      </div>
      <div class="channel-grid">${sorted.map(ch => renderChannelCard(ch, ch.addedByUsername, ch.engineerCount)).join('')}</div>
    </section>`;
  }

  // Similar users
  if (user && state.similarUsers.length > 0) {
    html += `<section class="feed-section">
      <h2 class="section-title">Engineers Like You</h2>
      <div class="user-grid">${state.similarUsers.map(u => renderUserCard(u)).join('')}</div>
    </section>`;
  }

  // Show Add Channel button always, but disabled when not logged in
  const addChannelBtn = user
    ? '<button class="btn btn-accent" id="openSearchBtn">+ Add Channel</button>'
    : '<button class="btn btn-accent" id="openSearchBtn" disabled style="opacity: 0.6; cursor: not-allowed;" title="Log in to add channels">+ Add Channel</button>';

  if (!html) {
    html = `<div class="empty-state">
      <div class="empty-icon">&#x1F4FA;</div>
      <h2>Welcome to TubeStack</h2>
      <p>Discover what YouTube channels other engineers are watching.</p>
      ${!user ? '<p class="text-muted">Log in to start building your stack.</p>' : ''}
    </div>`;
  }

  // Always show add channel button in feed actions
  html = `<div class="feed-actions">
    ${addChannelBtn}
  </div>` + html;

  return html;
}

// ── Explore view ─────────────────────────────────────────────
function renderExplore() {
  let html = `<div class="explore-header">
    <h2 class="section-title">Explore Engineers</h2>
    <input type="text" class="search-input" id="exploreSearch" placeholder="Filter by username...">
  </div>`;

  if (state.publicUsers.length === 0) {
    html += '<p class="text-muted" style="text-align:center; padding:40px 0;">No public users yet.</p>';
  } else {
    html += `<div class="user-grid">${state.publicUsers.map(u => renderUserCard(u)).join('')}</div>`;
  }
  return html;
}

// ── Stack view ───────────────────────────────────────────────
function renderStack() {
  const user = getLoggedInUser();
  if (!user) {
    return `<div class="empty-state">
      <h2>My Stack</h2>
      <p class="text-muted">Log in to manage your channel collection.</p>
    </div>`;
  }

  const editBtnClass = state.editMode ? 'btn-danger' : 'btn-outline';
  const editBtnText = state.editMode ? 'Done Editing' : '✎ Edit';

  let html = `<div class="stack-header">
    <h2 class="section-title">My Stack <span class="count-badge">${state.myChannels.length}</span></h2>
    <div class="stack-actions">
      <button class="btn btn-accent" id="bulkImportBtn" disabled style="opacity: 0.5; cursor: not-allowed;" title="Coming soon">Bulk Import</button>
      <button class="btn btn-accent" id="openSearchBtn">+ Add Channel</button>
      <button class="btn ${editBtnClass}" id="toggleEditModeBtn">${editBtnText}</button>
      <button class="btn btn-outline" id="createCollectionBtn">New Collection</button>
    </div>
  </div>`;

  // Show edit mode indicator
  if (state.editMode) {
    html += `<div style="background: rgba(244, 67, 54, 0.1); border: 1px solid rgba(244, 67, 54, 0.3); border-radius: 6px; padding: 12px; margin: 16px 0; display: flex; align-items: center; gap: 12px;">
      <span style="color: #f44336; font-weight: 600;">⚠️ Edit Mode Active</span>
      <span style="color: var(--text-muted); font-size: 0.9rem;">Remove buttons are now enabled. Click "Done Editing" when finished.</span>
    </div>`;
  }

  // Collections
  if (state.myCollections.length > 0) {
    html += `<section class="feed-section">
      <h3 class="subsection-title">Collections</h3>
      <div class="collection-grid">${state.myCollections.map(c => renderCollectionCard(c, true)).join('')}</div>
    </section>`;
  }

  // Channels - with sorting
  if (state.myChannels.length > 0) {
    const sortedChannels = [...state.myChannels].sort((a, b) => {
      if (state.sortBy === 'subscribers') {
        return parseInt(b.channel?.subscriberCount || '0') - parseInt(a.channel?.subscriberCount || '0');
      } else if (state.sortBy === 'name') {
        return (a.channel?.name || '').localeCompare(b.channel?.name || '');
      }
      // Default: sort by added date (newest first)
      return (b.addedAt || 0) - (a.addedAt || 0);
    });

    html += `<section class="feed-section">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 class="subsection-title" style="margin-bottom: 0;">Channels</h3>
        <div class="sort-controls">
          <label style="font-size: 0.85rem; color: var(--text-muted);">Sort:</label>
          <select id="sortBy" style="margin-left: 8px; padding: 4px 8px; background: var(--surface-1); border: 1px solid var(--border); border-radius: 4px; color: var(--text-primary); font-size: 0.85rem;">
            <option value="date" ${state.sortBy === 'date' ? 'selected' : ''}>Added Date</option>
            <option value="subscribers" ${state.sortBy === 'subscribers' ? 'selected' : ''}>Subscribers</option>
            <option value="name" ${state.sortBy === 'name' ? 'selected' : ''}>Name</option>
          </select>
        </div>
      </div>
      <div class="channel-grid">${sortedChannels.map(uc => renderStackCard(uc)).join('')}</div>
    </section>`;
  } else {
    html += `<div class="empty-state" style="margin-top:30px;">
      <p class="text-muted">Your stack is empty. Search YouTube to add channels.</p>
    </div>`;
  }

  return html;
}

// ── User profile view ────────────────────────────────────────
function renderUserProfile() {
  const p = state.profileUser;
  if (!p) return '<p class="text-muted" style="text-align:center; padding:40px;">User not found.</p>';

  const me = getLoggedInUser();
  const isMe = me && me.username === p.username;

  let html = `<div class="profile-header-v2 card-elevated">
    <div class="profile-avatar">${escHtml(p.username[0]?.toUpperCase() || '?')}</div>
    <div class="profile-info-v2">
      <h2>${escHtml(p.username)}</h2>
      ${p.bio ? `<p class="profile-bio-v2">${escHtml(p.bio)}</p>` : ''}
      <div class="profile-stats-v2">
        <div class="profile-stat">
          <span class="profile-stat-value">${state.profileChannels.length}</span>
          <span class="profile-stat-label">Channels</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat-value">${state.profileCollections.length}</span>
          <span class="profile-stat-label">Collections</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat-value">${Math.floor(Math.random() * 500) + 50}</span>
          <span class="profile-stat-label">Followers</span>
        </div>
      </div>
    </div>
    <div class="profile-actions">
      ${!isMe && me ? `<button class="btn btn-outline" data-follow-user="${escHtml(p.username)}" data-follow-id="${p.id}" style="width:100%;">Follow</button>` : ''}
      <span class="match-badge-v2" id="profileMatch"></span>
    </div>
  </div>`;

  if (state.profileCollections.length > 0) {
    html += `<section class="feed-section">
      <h3 class="subsection-title">Collections</h3>
      <div class="collection-grid">${state.profileCollections.map(c => renderCollectionCard(c)).join('')}</div>
    </section>`;
  }

  if (state.profileChannels.length > 0) {
    html += `<section class="feed-section">
      <h3 class="subsection-title">Channels</h3>
      <div class="channel-grid">${state.profileChannels.map(uc => renderChannelCard(uc.channel)).join('')}</div>
    </section>`;
  }

  return html;
}

// ── Collection detail view ───────────────────────────────────
function renderCollectionDetail() {
  const col = state.collectionDetail;
  if (!col) return '<p class="text-muted" style="text-align:center; padding:40px;">Collection not found.</p>';

  const me = getLoggedInUser();
  const isOwner = me && me.id === col.userId;
  const shareUrl = `${location.origin}/#collection=${col._id}`;

  let html = `<div class="collection-header">
    ${col.imageUrl ? `<img class="collection-cover" src="${escHtml(col.imageUrl)}" alt="" referrerpolicy="no-referrer">` : ''}
    <h2>${escHtml(col.name)}</h2>
    ${col.description ? `<p class="text-muted">${escHtml(col.description)}</p>` : ''}
    <p class="collection-meta">by <a class="user-link" href="#user=${escHtml(col.username)}">${escHtml(col.username)}</a> &middot; ${col.channels.length} channels</p>
    <div style="display:flex; gap:8px; margin-top:8px;">
      <button class="btn btn-sm btn-outline" data-copy-link="${escHtml(shareUrl)}">Copy Link</button>
      ${isOwner ? `<button class="btn btn-sm btn-ghost" data-edit-collection="${col._id}" data-col-name="${escHtml(col.name)}" data-col-desc="${escHtml(col.description || '')}" data-col-img="${escHtml(col.imageUrl || '')}">Edit</button>` : ''}
      ${isOwner ? `<button class="btn btn-sm btn-danger" data-delete-collection="${col._id}">Delete Collection</button>` : ''}
    </div>
  </div>`;

  if (col.channels.length > 0) {
    html += `<div class="channel-grid">${col.channels.map(ch => {
      let card = renderChannelCard(ch);
      if (isOwner) {
        // Inject remove button before closing </div>
        const removeBtn = `<button class="btn btn-sm btn-danger" data-remove-from-collection="${col._id}" data-collection-channel="${ch._id}" style="margin-top:4px;">Remove</button>`;
        card = card.replace(/<\/div>\s*$/, removeBtn + '</div>');
      }
      return card;
    }).join('')}</div>`;
  } else {
    html += '<p class="text-muted" style="text-align:center; padding:20px;">This collection is empty.</p>';
  }

  return html;
}

// ── Card components ──────────────────────────────────────────
function renderChannelCard(ch, addedBy, engineerCount) {
  if (!ch) return '';
  const thumb = ch.thumbnailUrl
    ? `<img class="channel-thumb" src="${escHtml(ch.thumbnailUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : '<div class="channel-thumb channel-thumb-placeholder"></div>';
  const user = getLoggedInUser();
  const stackEntry = user && state.myChannels.find(uc => uc.channel?.youtubeChannelId === ch.youtubeChannelId);
  const inStack = !!stackEntry;

  const ytLink = ch.youtubeChannelId ? `https://www.youtube.com/channel/${encodeURIComponent(ch.youtubeChannelId)}` : '';

  const stackBtn = user
    ? inStack
      ? `<button class="btn-stack btn-stack-remove" data-remove-channel="${stackEntry.channelId}" title="Remove from stack">&minus;</button>`
      : `<button class="btn-stack btn-stack-add" data-add-channel="${escAttr({ youtubeChannelId: ch.youtubeChannelId, name: ch.name, description: (ch.description || '').slice(0, 100), thumbnailUrl: ch.thumbnailUrl, subscriberCount: ch.subscriberCount, videoCount: ch.videoCount, youtubeCategory: ch.youtubeCategory || '' })}" title="Add to stack">&plus;</button>`
    : '';

  const channelData = {
    youtubeChannelId: ch.youtubeChannelId,
    name: ch.name,
    description: ch.description || '',
    thumbnailUrl: ch.thumbnailUrl,
    subscriberCount: ch.subscriberCount,
    videoCount: ch.videoCount,
    youtubeCategory: ch.youtubeCategory || ''
  };

  return `<div class="channel-card" data-yt-id="${escHtml(ch.youtubeChannelId)}" data-open-channel="${escAttr(channelData)}">
    <div class="channel-card-top">
      ${ytLink ? `<a href="${ytLink}" target="_blank" rel="noopener">${thumb}</a>` : thumb}
      <div class="channel-info">
        <div class="channel-name">${ytLink ? `<a href="${ytLink}" target="_blank" rel="noopener" class="channel-link">${escHtml(ch.name)}</a>` : escHtml(ch.name)}</div>
        <div class="channel-stats">
          ${ch.subscriberCount ? `<span>${formatCount(ch.subscriberCount)} subs</span>` : ''}
          ${ch.videoCount ? `<span>${formatCount(ch.videoCount)} videos</span>` : ''}
        </div>
      </div>
      ${stackBtn}
    </div>
    ${ch.youtubeCategory ? `<div class="channel-yt-category">${escHtml(ch.youtubeCategory)}</div>` : ''}
    ${ch.description ? `<div class="channel-desc">${escHtml(ch.description).slice(0, 120)}</div>` : ''}
    <div class="channel-card-footer">
      ${engineerCount ? `<span class="engineer-badge">${engineerCount} engineer${engineerCount > 1 ? 's' : ''}</span>` : ''}
      ${addedBy ? `<a class="user-link small" href="#user=${escHtml(addedBy)}">@${escHtml(addedBy)}</a>` : ''}
      ${user ? `<button class="btn btn-sm btn-ghost" data-recommend-channel="${ch._id || ''}" data-recommend-name="${escHtml(ch.name)}">Rec</button>` : ''}
    </div>
  </div>`;
}

function renderStackCard(uc) {
  const ch = uc.channel;
  if (!ch) return '';
  const thumb = ch.thumbnailUrl
    ? `<img class="channel-thumb" src="${escHtml(ch.thumbnailUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : '<div class="channel-thumb channel-thumb-placeholder"></div>';

  const inCollections = state.myCollections.filter(c => c.channelIds.includes(uc.channelId));
  const notInCollections = state.myCollections.filter(c => !c.channelIds.includes(uc.channelId));
  const ytLink = ch.youtubeChannelId ? `https://www.youtube.com/channel/${encodeURIComponent(ch.youtubeChannelId)}` : '';

  return `<div class="channel-card stack-card" data-channel-id="${uc.channelId}" data-open-channel="${escAttr({ youtubeChannelId: ch.youtubeChannelId, name: ch.name })}" style="cursor: pointer;">
    <div class="stack-card-layout">
      <div class="stack-card-thumb">
        ${ytLink ? `<a href="${ytLink}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${thumb}</a>` : thumb}
      </div>
      <div class="stack-card-body">
        <div class="channel-name">${ytLink ? `<a href="${ytLink}" target="_blank" rel="noopener" class="channel-link" onclick="event.stopPropagation()">${escHtml(ch.name)}</a>` : escHtml(ch.name)}</div>
        <div class="channel-stats">
          ${ch.subscriberCount ? `<span>${formatCount(ch.subscriberCount)} subs</span>` : ''}
          ${ch.videoCount ? `<span>${formatCount(ch.videoCount)} videos</span>` : ''}
        </div>
        ${ch.youtubeCategory ? `<div class="channel-yt-category">${escHtml(ch.youtubeCategory)}</div>` : ''}
        ${uc.categories?.length ? `<div class="tag-row">${uc.categories.map(c => `<span class="tag">${escHtml(c)}</span>`).join('')}</div>` : ''}
        ${inCollections.length && state.editMode ? `<div class="tag-row">${inCollections.map(c => `<span class="tag tag-collection" data-remove-from-collection="${c._id}" data-collection-channel="${uc.channelId}" title="Remove from ${escHtml(c.name)}" onclick="event.stopPropagation()">${escHtml(c.name)} &minus;</span>`).join('')}</div>` : ''}
        ${uc.note ? `<div class="channel-note">${escHtml(uc.note)}</div>` : ''}
      </div>
    </div>

    <!-- Action Bar -->
    <div class="channel-actions-bar">
      <button class="btn btn-sm btn-ghost action-btn highlights-btn" data-highlights-modal='${escAttr({
        _id: ch._id,
        name: ch.name,
        youtubeChannelId: ch.youtubeChannelId
      })}'>
        <span style="font-size: 1.2em;">▶</span> Highlights
      </button>
      ${notInCollections.length ? `<button class="btn btn-sm btn-ghost action-btn" data-add-to-collection="${uc.channelId}">
        <span style="font-size: 1.2em;">+</span> Collection
      </button>` : ''}
      ${state.editMode ? `<button class="btn btn-sm btn-ghost action-btn" data-edit-tags="${uc.channelId}">
        <span style="font-size: 1.2em;">✎</span> Edit
      </button>` : ''}
      ${state.editMode ? `<button class="btn btn-sm btn-danger action-btn" data-remove-channel="${uc.channelId}" title="Remove from stack">
        <span style="font-size: 1.2em;">&minus;</span> Remove
      </button>` : ''}
    </div>
  </div>`;
}

function renderRecCard(rec) {
  const ch = rec.channel;
  const user = getLoggedInUser();
  if (!ch) return '';
  return `<div class="channel-card rec-card" data-rec-id="${rec._id}">
    <div class="rec-from">From <a class="user-link" href="#user=${escHtml(rec.fromUsername)}">@${escHtml(rec.fromUsername)}</a></div>
    <div class="channel-card-top">
      ${ch.thumbnailUrl ? `<img class="channel-thumb" src="${escHtml(ch.thumbnailUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<div class="channel-thumb channel-thumb-placeholder"></div>'}
      <div class="channel-info">
        <div class="channel-name">${escHtml(ch.name)}</div>
      </div>
    </div>
    ${rec.message ? `<div class="rec-message">"${escHtml(rec.message)}"</div>` : ''}
    <div class="channel-card-footer">
      ${user ? `<button class="btn btn-sm btn-accent" data-add-channel="${escAttr({ youtubeChannelId: ch.youtubeChannelId, name: ch.name, description: (ch.description || '').slice(0, 100), thumbnailUrl: ch.thumbnailUrl, subscriberCount: ch.subscriberCount, videoCount: ch.videoCount })}">+ Stack</button>` : ''}
      <button class="btn btn-sm btn-ghost" data-dismiss-rec="${rec._id}">Dismiss</button>
    </div>
  </div>`;
}

function renderUserCard(u) {
  return `<div class="user-card" data-username="${escHtml(u.username)}">
    <div class="user-card-info">
      <a class="user-name" href="#user=${escHtml(u.username)}">${escHtml(u.username)}</a>
      ${u.bio ? `<div class="user-bio">${escHtml(u.bio)}</div>` : ''}
      <div class="user-stats">${u.channelCount} channel${u.channelCount !== 1 ? 's' : ''}</div>
    </div>
    ${u.score !== undefined ? `<span class="match-badge ${matchBadgeClass(u.score)}">${u.score}%</span>` : ''}
  </div>`;
}

function renderCollectionCard(col, owned) {
  const shareUrl = `${location.origin}/#collection=${col._id}`;
  return `<div class="collection-card">
    ${col.imageUrl ? `<img class="collection-image" src="${escHtml(col.imageUrl)}" alt="" referrerpolicy="no-referrer">` : ''}
    <a class="collection-name" href="#collection=${col._id}">${escHtml(col.name)}</a>
    ${col.description ? `<div class="collection-desc">${escHtml(col.description)}</div>` : ''}
    <div class="collection-meta">
      ${col.channelIds.length} channels
      ${!owned ? ` &middot; <a class="user-link small" href="#user=${escHtml(col.username)}">@${escHtml(col.username)}</a>` : ''}
    </div>
    <div style="display:flex; gap:4px; margin-top:8px;">
      <button class="btn btn-sm btn-ghost" data-copy-link="${escHtml(shareUrl)}" title="Copy share link">Share</button>
      ${owned ? `<button class="btn btn-sm btn-ghost" data-edit-collection="${col._id}" data-col-name="${escHtml(col.name)}" data-col-desc="${escHtml(col.description || '')}" data-col-img="${escHtml(col.imageUrl || '')}">Edit</button>` : ''}
      ${owned ? `<button class="btn btn-sm btn-danger" data-delete-collection="${col._id}">Delete</button>` : ''}
    </div>
  </div>`;
}

// ── Search overlay rendering ─────────────────────────────────
export function renderSearchResults(results) {
  const el = document.getElementById('searchResults');
  if (!el) return;
  if (!results.length) {
    el.innerHTML = '<p class="text-muted" style="padding:20px; text-align:center;">No channels found.</p>';
    return;
  }
  const user = getLoggedInUser();
  el.innerHTML = results.map(ch => {
    const stackEntry = user && state.myChannels.find(uc => uc.channel?.youtubeChannelId === ch.youtubeChannelId);
    const inStack = !!stackEntry;
    const btn = user
      ? (inStack
        ? `<button class="btn-stack btn-stack-remove" data-remove-channel="${stackEntry.channelId}" title="Remove from stack">&minus;</button>`
        : `<button class="btn-stack btn-stack-add" data-add-channel="${escAttr({ youtubeChannelId: ch.youtubeChannelId, name: ch.name, description: (ch.description || '').slice(0, 100), thumbnailUrl: ch.thumbnailUrl })}" title="Add to stack">&plus;</button>`)
      : '';
    return `<div class="search-result-item">
      <div class="search-result-info">
        ${ch.thumbnailUrl ? `<img class="search-thumb" src="${escHtml(ch.thumbnailUrl)}" alt="" referrerpolicy="no-referrer">` : '<div class="search-thumb search-thumb-placeholder"></div>'}
        <div>
          <div class="channel-name">${escHtml(ch.name)}</div>
          <div class="channel-desc">${escHtml((ch.description || '').slice(0, 100))}</div>
        </div>
      </div>
      ${btn}
    </div>`;
  }).join('');
}

// ── Tag editor modal ─────────────────────────────────────────
export function renderTagEditor(channelId, currentCategories, currentNote) {
  const cats = currentCategories || [];
  const note = currentNote || '';
  return `<div class="tag-editor-overlay" data-tag-editor="${channelId}">
    <div class="tag-editor">
      <h3>Edit Channel Tags</h3>
      <input type="text" class="tag-note-input tag-filter" placeholder="Filter categories..." style="margin-bottom:8px;">
      <div class="tag-options">
        ${CATEGORIES.map(c => `<label class="tag-option">
          <input type="checkbox" value="${escHtml(c)}" ${cats.includes(c) ? 'checked' : ''}> ${escHtml(c)}
        </label>`).join('')}
      </div>
      <input type="text" class="tag-note-input" placeholder="Personal note (optional)" value="${escHtml(note)}" maxlength="100">
      <div class="tag-editor-actions">
        <button class="btn btn-accent" data-save-tags="${channelId}">Save</button>
        <button class="btn btn-ghost" data-cancel-tags>Cancel</button>
      </div>
    </div>
  </div>`;
}

// ── Collection picker overlay ────────────────────────────────
export function renderCollectionPicker(channelId) {
  let collections = state.myCollections.filter(c => !c.channelIds.includes(channelId));
  if (!collections.length) return '';

  // If the channel has categories, sort collections by similarity
  const channel = state.myChannels.find(uc => uc.channelId === channelId);
  if (channel && channel.categories && channel.categories.length > 0) {
    collections = [...collections].sort((a, b) => {
      // Score collections based on how many channels share categories
      const aScore = a.channelIds.reduce((sum, id) => {
        const c = state.myChannels.find(uc => uc.channelId === id);
        const matchCount = c?.categories?.filter(cat => channel.categories.includes(cat)).length || 0;
        return sum + matchCount;
      }, 0);

      const bScore = b.channelIds.reduce((sum, id) => {
        const c = state.myChannels.find(uc => uc.channelId === id);
        const matchCount = c?.categories?.filter(cat => channel.categories.includes(cat)).length || 0;
        return sum + matchCount;
      }, 0);

      return bScore - aScore;
    });
  }

  return `<div class="tag-editor-overlay" data-collection-picker>
    <div class="tag-editor">
      <h3>Add to Collection</h3>
      <div class="collection-picker-list">
        ${collections.map(c => {
          const channelCount = c.channelIds.length;
          let subtitle = '';
          if (channel.categories && channel.categories.length > 0) {
            const similarChannels = c.channelIds.filter(id => {
              const colChannel = state.myChannels.find(uc => uc.channelId === id);
              return colChannel?.categories?.some(cat => channel.categories.includes(cat));
            }).length;
            if (similarChannels > 0) {
              subtitle = `<span style="color:var(--text-muted); font-size:.7em;">${similarChannels} similar</span>`;
            }
          }
          return `<button class="btn btn-outline collection-pick-btn" data-pick-collection="${c._id}" data-pick-channel="${channelId}" style="width:100%; margin-bottom:6px; justify-content:flex-start; align-items:center; gap:8px;">
            <div style="flex:1; text-align:left;">
              <div>${escHtml(c.name)}</div>
              ${subtitle}
            </div>
            <span class="text-muted" style="font-size:.8em;">${channelCount} ch</span>
          </button>`;
        }).join('')}
      </div>
      <div class="tag-editor-actions" style="margin-top:12px;">
        <button class="btn btn-ghost" data-cancel-tags>Cancel</button>
      </div>
    </div>
  </div>`;
}

// ── Create collection modal ──────────────────────────────────
export function renderCreateCollectionModal() {
  return `<div class="tag-editor-overlay" data-create-collection-modal>
    <div class="tag-editor">
      <h3>New Collection</h3>
      <input type="text" class="tag-note-input" id="newColName" placeholder="Collection name" maxlength="60" style="margin-bottom:8px;">
      <input type="text" class="tag-note-input" id="newColDesc" placeholder="Description (optional)" maxlength="200">

      <!-- Image upload -->
      <div style="margin-bottom: 12px;">
        <label style="display: block; margin-bottom: 8px; font-size: 0.9rem; color: var(--text-muted);">Collection Cover Image (optional):</label>
        <div class="image-upload-area" data-drop-zone style="border: 2px dashed var(--border); border-radius: 8px; padding: 20px; text-align: center; cursor: pointer; margin-bottom: 8px;">
          <div class="upload-prompt">Drag & drop image here or click to select</div>
          <div class="upload-preview" style="display: none;">
            <img style="max-width: 100%; max-height: 120px; border-radius: 4px;" />
            <button type="button" class="btn btn-sm btn-ghost" style="margin-top: 8px;" data-remove-image>Remove</button>
          </div>
        </div>
        <input type="file" id="collectionImageFile" accept="image/*" style="display: none;" />
        <div style="margin-top: 8px;">
          <label style="font-size: 0.85rem; color: var(--text-muted);">Or enter image URL:</label>
          <input type="text" id="collectionImageUrl" placeholder="https://example.com/image.jpg" style="width: 100%; margin-top: 4px; padding: 6px; border: 1px solid var(--border); border-radius: 4px;" />
        </div>
      </div>

      <div class="tag-editor-actions" style="margin-top:12px;">
        <button class="btn btn-accent" id="confirmCreateCol">Create</button>
        <button class="btn btn-ghost" data-cancel-tags>Cancel</button>
      </div>
    </div>
  </div>`;
}

// ── Edit collection modal ────────────────────────────────────
export function renderEditCollectionModal(id, name, description, imageUrl) {
  return `<div class="tag-editor-overlay" data-edit-collection-modal>
    <div class="tag-editor">
      <h3>Edit Collection</h3>
      <input type="text" class="tag-note-input" id="editColName" placeholder="Collection name" value="${escHtml(name)}" maxlength="60" style="margin-bottom:8px;">
      <input type="text" class="tag-note-input" id="editColDesc" placeholder="Description (optional)" value="${escHtml(description)}" maxlength="200" style="margin-bottom:8px;">
      <div style="margin-bottom:8px;">
        <label style="display:block; margin-bottom:6px; font-size:0.85rem; color:var(--text-muted);">Cover Image:</label>
        <input type="file" id="editColImgFile" accept="image/*" style="margin-bottom:8px;">
        <input type="text" class="tag-note-input" id="editColImg" placeholder="Or paste image URL" value="${escHtml(imageUrl)}" maxlength="500">
        <div id="collectionImagePreviewContainer" style="margin-top:8px;">
          ${imageUrl ? `<img src="${escHtml(imageUrl)}" id="collectionImgPreview" style="width:100%; max-height:120px; object-fit:cover; border-radius:6px;" referrerpolicy="no-referrer">
          <button type="button" id="clearCollectionImg" class="btn btn-sm btn-ghost" style="margin-top:4px; font-size:0.8rem;">Remove Image</button>` : ''}
        </div>
      </div>
      <div class="tag-editor-actions" style="margin-top:12px;">
        <button class="btn btn-accent" data-confirm-edit-collection="${id}">Save</button>
        <button class="btn btn-ghost" data-cancel-tags>Cancel</button>
      </div>
    </div>
  </div>`;
}

// ── Enhanced Channel Card (v2) for cleaner UI ────────────────
function renderChannelCardV2(ch, addedBy, engineerCount) {
  if (!ch) return '';
  const thumb = ch.thumbnailUrl
    ? `<img src="${escHtml(ch.thumbnailUrl)}" alt="${escHtml(ch.name)}" loading="lazy" referrerpolicy="no-referrer">`
    : '';
  const user = getLoggedInUser();
  const ytLink = ch.youtubeChannelId ? `https://www.youtube.com/channel/${encodeURIComponent(ch.youtubeChannelId)}` : '';

  // Extract categories if available in userChannel context
  const categoriesHtml = (uc) => {
    if (!uc || !uc.categories || uc.categories.length === 0) return '';
    return `<div class="channel-categories-v2">
      ${uc.categories.slice(0, 3).map(c => `<span class="channel-category-tag">${escHtml(c)}</span>`).join('')}
      ${uc.categories.length > 3 ? `<span class="channel-category-tag">+${uc.categories.length - 3}</span>` : ''}
    </div>`;
  };

  return `<div class="channel-card channel-card-v2 card-v2" data-yt-id="${escHtml(ch.youtubeChannelId || '')}">
    ${ytLink ? `<a href="${ytLink}" target="_blank" rel="noopener" class="channel-thumbnail-v2">
      ${thumb || '<div style="background:var(--surface-2); width:100%; height:100%;"></div>'}
    </a>` : `<div class="channel-thumbnail-v2">${thumb}</div>`}
    <div class="channel-info-v2">
      <div class="channel-name-v2">
        ${ytLink ? `<a href="${ytLink}" target="_blank" rel="noopener" style="color:inherit; text-decoration:none;">${escHtml(ch.name)}</a>` : escHtml(ch.name)}
      </div>
      <div class="channel-stats-v2">
        ${ch.subscriberCount ? `<span>${formatCount(ch.subscriberCount)} subs</span>` : ''}
        ${ch.videoCount ? `<span>${formatCount(ch.videoCount)} videos</span>` : ''}
        ${engineerCount ? `<span>${engineerCount} engineers</span>` : ''}
      </div>
      ${addedBy ? `<div style="font-size:var(--text-xs); color:var(--text-muted);">Added by <a class="user-link" href="#user=${escHtml(addedBy)}">@${escHtml(addedBy)}</a></div>` : ''}
    </div>
  </div>`;
}

// ── Enhanced User Card (v2) for cleaner UI ───────────────────
function renderUserCardV2(u) {
  const avatarLetter = escHtml(u.username[0]?.toUpperCase() || '?');
  return `<div class="user-card user-card-v2 card-v2" data-username="${escHtml(u.username)}">
    <div class="user-avatar-v2">${avatarLetter}</div>
    <div class="user-name-v2">
      <a href="#user=${escHtml(u.username)}" style="color:inherit; font-weight:600;">${escHtml(u.username)}</a>
    </div>
    <div class="user-stats-v2">${u.channelCount} channel${u.channelCount !== 1 ? 's' : ''}</div>
    ${u.score !== undefined ? `<span class="match-badge" style="margin-top:var(--space-2);">${u.score}%</span>` : ''}
  </div>`;
}

// ── Enhanced Collection Card (v2) for cleaner UI ─────────────
function renderCollectionCardV2(col, owned) {
  const shareUrl = `${location.origin}/#collection=${col._id}`;
  const thumbnailPreview = col.imageUrl
    ? `<img src="${escHtml(col.imageUrl)}" alt="" style="width:100%; height:100%; object-fit:cover; border-radius:var(--radius-sm);" referrerpolicy="no-referrer">`
    : '<div style="width:100%; height:100%; background:var(--surface-2); border-radius:var(--radius-sm);"></div>';

  return `<div class="collection-card card-v2">
    <div style="margin-bottom:var(--space-3);">
      ${thumbnailPreview}
    </div>
    <div style="display:flex; align-items:center; gap:var(--space-2); margin-bottom:var(--space-2);">
      <a class="collection-name" href="#collection=${col._id}" style="font-size:var(--text-base); font-weight:600;">${escHtml(col.name)}</a>
      <span style="font-size:var(--text-xs); color:var(--text-muted); background:var(--surface-1); padding:2px 6px; border-radius:4px;">${col.channelIds.length} channels</span>
    </div>
    ${col.description ? `<div class="collection-desc" style="font-size:var(--text-sm); color:var(--text-muted); margin-bottom:var(--space-2);">${escHtml(col.description)}</div>` : ''}
    ${!owned ? `<div style="font-size:var(--text-xs); color:var(--text-muted); margin-bottom:var(--space-3);">by <a class="user-link" href="#user=${escHtml(col.username)}">@${escHtml(col.username)}</a></div>` : ''}
    <div style="display:flex; gap:8px;">
      <button class="btn btn-sm btn-ghost" data-copy-link="${escHtml(shareUrl)}" title="Copy share link">Share</button>
      ${owned ? `<button class="btn btn-sm btn-outline" data-edit-collection="${col._id}" data-col-name="${escHtml(col.name)}" data-col-desc="${escHtml(col.description || '')}" data-col-img="${escHtml(col.imageUrl || '')}">Edit</button>` : ''}
    </div>
  </div>`;
}

// ── Enhanced Rec Card (v2) for cleaner UI ────────────────────
function renderRecCardV2(rec) {
  const ch = rec.channel;
  const user = getLoggedInUser();
  const thumb = ch.thumbnailUrl
    ? `<img src="${escHtml(ch.thumbnailUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : '';
  const ytLink = ch.youtubeChannelId ? `https://www.youtube.com/channel/${encodeURIComponent(ch.youtubeChannelId)}` : '';

  return `<div class="channel-card channel-card-v2 card-v2" data-rec-id="${rec._id}">
    <div style="display:flex; align-items:center; gap:var(--space-3); margin-bottom:var(--space-3);">
      ${thumb ? `<img src="${escHtml(ch.thumbnailUrl)}" style="width:56px; height:56px; object-fit:cover; border-radius:var(--radius-sm);" referrerpolicy="no-referrer">` : '<div style="width:56px; height:56px; background:var(--surface-2); border-radius:var(--radius-sm);"></div>'}
      <div style="flex:1;">
        <div style="font-weight:600; margin-bottom:2px;">${escHtml(ch.name)}</div>
        <div style="font-size:var(--text-xs); color:var(--text-muted);">Recommended by ${escHtml(rec.fromUsername)}</div>
      </div>
      <button class="btn btn-sm btn-ghost" data-ignore-rec="${rec._id}" title="Dismiss">&times;</button>
    </div>
    ${rec.message ? `<div style="font-size:var(--text-sm); color:var(--text-secondary); margin-bottom:var(--space-3); padding:var(--space-2); background:var(--surface-1); border-radius:var(--radius-sm);">"${escHtml(rec.message)}"</div>` : ''}
    <div style="display:flex; gap:8px;">
      <button class="btn btn-accent" data-view-rec="${ch.youtubeChannelId}" data-rec-name="${escHtml(ch.name)}">View Channel</button>
      ${user ? `<button class="btn btn-ghost" data-accept-rec="${rec._id}" data-add-channel="${escAttr({ youtubeChannelId: ch.youtubeChannelId, name: ch.name, description: (ch.description || '').slice(0, 100), thumbnailUrl: ch.thumbnailUrl, subscriberCount: ch.subscriberCount, videoCount: ch.videoCount, youtubeCategory: ch.youtubeCategory || '' })}">Add to Stack</button>` : ''}
    </div>
  </div>`;
}

// ── Bulk Import Modal ────────────────────────────────────────
export function renderBulkImportModal() {
  return `<div class="tag-editor-overlay bulk-import-overlay" data-bulk-import>
    <div class="tag-editor bulk-import-panel">
      <h3>Bulk Import Channels</h3>
      <div class="bulk-import-disclaimer">
        <p><strong>Only your channels are shown publicly on your profile.</strong></p>
        <p>Paste YouTube channel URLs below (one per line). We'll automatically fetch their details.</p>
        <p class="text-muted"><strong>Important:</strong> YouTube handles (@username) are not supported. Please use channel ID URLs.</p>
        <details style="margin: 12px 0; padding: 8px; background: var(--surface-1); border-radius: 4px;">
          <summary style="cursor: pointer; color: var(--text-muted);">How to get your channel ID URL</summary>
          <div style="margin-top: 8px; padding-left: 16px;">
            <p>Option 1: Go to YouTube Studio → Settings → Channel → Advanced settings → Copy your "Channel ID" and use: youtube.com/channel/YOUR_CHANNEL_ID</p>
            <p>Option 2: Visit <a href="https://www.youtube.com/account_privacy" target="_blank" rel="noopener">youtube.com/account_privacy</a> to view your channel info</p>
            <p>Or use a tool like <a href="https://www.streamweasels.com/tools/youtube-channel-id-and-user-id-converter/" target="_blank" rel="noopener">YouTube Channel ID Finder</a></p>
          </div>
        </details>
        <p class="text-muted">Supported URL formats (use channel ID for best results):</p>
        <ul class="text-muted">
          <li>youtube.com/channel/UCxxx ← MOST RELIABLE</li>
          <li>youtube.com/c/ChannelName (may not work for all channels)</li>
          <li>youtube.com/user/Username (may not work for all channels)</li>
          <li><del>youtube.com/@handle</del> NOT SUPPORTED</li>
        </ul>
      </div>
      <textarea class="bulk-import-input" id="bulkImportUrls" placeholder="Paste channel URLs here..." rows="8"></textarea>
      <div class="bulk-import-actions">
        <button class="btn btn-accent" id="confirmBulkImport">Import Channels</button>
        <button class="btn btn-ghost" data-cancel-bulk-import>Cancel</button>
      </div>
    </div>
  </div>`;
}

export function renderBulkImportResults(results) {
  const resultsHtml = [];

  if (results.imported > 0) {
    resultsHtml.push(`<p class="success-msg">✓ Imported ${results.imported} channel(s)</p>`);
  }

  if (results.skipped > 0) {
    resultsHtml.push(`<p class="info-msg">ℹ Skipped ${results.skipped} duplicate channel(s)</p>`);
  }

  if (results.errors && results.errors.length > 0) {
    resultsHtml.push(`<p class="error-msg">✗ Errors:</p><ul>${results.errors.map(e => `<li>${e}</li>`).join('')}</ul>`);
  }

  return `<div class="bulk-import-results">
    ${resultsHtml.join('')}
  </div>`;
}

// ── Category picker for adding ───────────────────────────────
export function renderCategoryPicker(channelData) {
  return `<div class="tag-editor-overlay" data-category-picker>
    <div class="tag-editor">
      <h3>Add to Stack</h3>
      <p class="text-muted" style="margin-bottom:8px;">Pick categories for <strong>${escHtml(channelData.name)}</strong></p>
      <input type="text" class="tag-note-input tag-filter" placeholder="Filter categories..." style="margin-bottom:8px;">
      <div class="tag-options">
        ${CATEGORIES.map(c => `<label class="tag-option">
          <input type="checkbox" value="${escHtml(c)}"> ${escHtml(c)}
        </label>`).join('')}
      </div>
      <input type="text" class="tag-note-input" id="addChannelNote" placeholder="Personal note (optional)" maxlength="100">
      <div class="tag-editor-actions">
        <button class="btn btn-accent" data-confirm-add="${escAttr(channelData)}">Add</button>
        <button class="btn btn-ghost" data-cancel-tags>Cancel</button>
      </div>
    </div>
  </div>`;
}

// ── Highlights Modal ─────────────────────────────────────────
export function renderHighlightsModal(channel) {
  const channelId = channel._id || channel.channelId || channel.id;
  return `<div class="highlights-modal-overlay" data-highlights-overlay>
    <div class="highlights-modal">
      <div class="highlights-modal-header">
        <h3>Highlights from ${escHtml(channel.name)}</h3>
        <button class="btn btn-ghost highlights-close" data-highlights-close>&times;</button>
      </div>
      <div class="highlights-modal-body" data-highlights-list data-channel-id="${channelId}">
        <div class="loading">Loading highlights...</div>
      </div>
      <div class="highlights-modal-footer">
        <button class="btn btn-accent" id="addHighlightBtn">+ Add Highlight</button>
      </div>
    </div>
  </div>`;
}

export function renderHighlightCard(highlight, userVote) {
  const ytLink = `https://www.youtube.com/watch?v=${escHtml(highlight.youtubeVideoId)}`;
  const upvoteClass = userVote === 1 ? 'vote-active' : '';
  const downvoteClass = userVote === -1 ? 'vote-active' : '';

  return `<div class="highlight-card" data-highlight-id="${highlight._id}">
    <a href="${ytLink}" target="_blank" rel="noopener" class="highlight-thumbnail">
      <img src="${escHtml(highlight.thumbnailUrl)}" alt="${escHtml(highlight.title)}" loading="lazy" referrerpolicy="no-referrer">
    </a>
    <div class="highlight-info">
      <a href="${ytLink}" target="_blank" rel="noopener" class="highlight-title">${escHtml(highlight.title)}</a>
      <div class="highlight-meta">
        <span class="shared-by">by @${escHtml(highlight.sharedByUsername)}</span>
        <span class="highlight-score">${highlight.score} points</span>
      </div>
    </div>
    <div class="highlight-actions">
      <button class="btn btn-sm btn-ghost highlight-vote-btn ${upvoteClass}" data-highlight-vote="${highlight._id}" data-vote-dir="1">
        <span>▲</span> <span class="vote-count">${highlight.upvotes}</span>
      </button>
      <button class="btn btn-sm btn-ghost highlight-vote-btn ${downvoteClass}" data-highlight-vote="${highlight._id}" data-vote-dir="-1">
        <span>▼</span> <span class="vote-count">${highlight.downvotes}</span>
      </button>
    </div>
  </div>`;
}

// Export v2 functions for selective use
export {
  renderChannelCardV2,
  renderUserCardV2,
  renderCollectionCardV2,
  renderRecCardV2
};
