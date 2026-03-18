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
    html += `<section class="feed-section">
      <h2 class="section-title">Trending This Week</h2>
      <div class="channel-grid">${state.trending.map(ch => renderChannelCard(ch, null, ch.engineerCount)).join('')}</div>
    </section>`;
  }

  // Recently added
  if (state.recentChannels.length > 0) {
    html += `<section class="feed-section">
      <h2 class="section-title">Recently Added</h2>
      <div class="channel-grid">${state.recentChannels.map(ch => renderChannelCard(ch, ch.addedByUsername, ch.engineerCount)).join('')}</div>
    </section>`;
  }

  // Similar users
  if (user && state.similarUsers.length > 0) {
    html += `<section class="feed-section">
      <h2 class="section-title">Engineers Like You</h2>
      <div class="user-grid">${state.similarUsers.map(u => renderUserCard(u)).join('')}</div>
    </section>`;
  }

  if (!html) {
    html = `<div class="empty-state">
      <div class="empty-icon">&#x1F4FA;</div>
      <h2>Welcome to TubeStack</h2>
      <p>Discover what YouTube channels other engineers are watching.</p>
      ${user
        ? '<button class="btn btn-accent" id="openSearchBtn">Search & Add Channels</button>'
        : '<p class="text-muted">Log in to start building your stack.</p>'}
    </div>`;
  } else if (user) {
    html = `<div class="feed-actions">
      <button class="btn btn-accent" id="openSearchBtn">+ Add Channel</button>
    </div>` + html;
  }

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

  let html = `<div class="stack-header">
    <h2 class="section-title">My Stack <span class="count-badge">${state.myChannels.length}</span></h2>
    <div class="stack-actions">
      <button class="btn btn-accent" id="openSearchBtn">+ Add Channel</button>
      <button class="btn btn-outline" id="createCollectionBtn">New Collection</button>
    </div>
  </div>`;

  // Collections
  if (state.myCollections.length > 0) {
    html += `<section class="feed-section">
      <h3 class="subsection-title">Collections</h3>
      <div class="collection-grid">${state.myCollections.map(c => renderCollectionCard(c, true)).join('')}</div>
    </section>`;
  }

  // Channels
  if (state.myChannels.length > 0) {
    html += `<section class="feed-section">
      <h3 class="subsection-title">Channels</h3>
      <div class="channel-grid">${state.myChannels.map(uc => renderStackCard(uc)).join('')}</div>
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

  let html = `<div class="profile-header">
    <div class="profile-info">
      <h2>${escHtml(p.username)}</h2>
      ${p.bio ? `<p class="profile-bio">${escHtml(p.bio)}</p>` : ''}
      <div class="profile-stats">
        <span>${state.profileChannels.length} channels</span>
        <span>${state.profileCollections.length} collections</span>
      </div>
    </div>
    <div class="profile-actions">
      ${!isMe && me ? `<button class="btn btn-outline" data-follow-user="${escHtml(p.username)}" data-follow-id="${p.id}">Follow</button>` : ''}
      <span class="match-badge" id="profileMatch"></span>
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

  return `<div class="channel-card" data-yt-id="${escHtml(ch.youtubeChannelId)}">
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

  return `<div class="channel-card stack-card" data-channel-id="${uc.channelId}">
    <div class="stack-card-layout">
      <div class="stack-card-thumb">
        ${ytLink ? `<a href="${ytLink}" target="_blank" rel="noopener">${thumb}</a>` : thumb}
        <button class="btn-icon" data-refresh-image="${ch._id}" data-yt-id="${escHtml(ch.youtubeChannelId)}" title="Refresh image &amp; stats">&#x21bb;</button>
      </div>
      <div class="stack-card-body">
        <div class="channel-name">${ytLink ? `<a href="${ytLink}" target="_blank" rel="noopener" class="channel-link">${escHtml(ch.name)}</a>` : escHtml(ch.name)}</div>
        <div class="channel-stats">
          ${ch.subscriberCount ? `<span>${formatCount(ch.subscriberCount)} subs</span>` : ''}
          ${ch.videoCount ? `<span>${formatCount(ch.videoCount)} videos</span>` : ''}
        </div>
        ${ch.youtubeCategory ? `<div class="channel-yt-category">${escHtml(ch.youtubeCategory)}</div>` : ''}
        ${uc.categories?.length ? `<div class="tag-row">${uc.categories.map(c => `<span class="tag">${escHtml(c)}</span>`).join('')}</div>` : ''}
        ${inCollections.length ? `<div class="tag-row">${inCollections.map(c => `<span class="tag tag-collection" data-remove-from-collection="${c._id}" data-collection-channel="${uc.channelId}" title="Remove from ${escHtml(c.name)}">${escHtml(c.name)} &times;</span>`).join('')}</div>` : ''}
        ${uc.note ? `<div class="channel-note">${escHtml(uc.note)}</div>` : ''}
        <div class="stack-card-actions">
          ${notInCollections.length ? `<button class="btn btn-sm btn-ghost" data-add-to-collection="${uc.channelId}">+ Collection</button>` : ''}
          <button class="btn btn-sm btn-ghost" data-edit-tags="${uc.channelId}">Edit</button>
          <button class="btn btn-sm btn-ghost" data-recommend-channel="${ch._id}" data-recommend-name="${escHtml(ch.name)}">Rec</button>
          <button class="btn btn-sm btn-danger" data-remove-channel="${uc.channelId}">Remove</button>
        </div>
      </div>
    </div>
  </div>`;
}

function renderRecCard(rec) {
  const ch = rec.channel;
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
      <button class="btn btn-sm btn-accent" data-add-channel="${escAttr({ youtubeChannelId: ch.youtubeChannelId, name: ch.name, description: (ch.description || '').slice(0, 100), thumbnailUrl: ch.thumbnailUrl, subscriberCount: ch.subscriberCount, videoCount: ch.videoCount })}">+ Stack</button>
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
    const btn = inStack
      ? `<button class="btn-stack btn-stack-remove" data-remove-channel="${stackEntry.channelId}" title="Remove from stack">&minus;</button>`
      : `<button class="btn-stack btn-stack-add" data-add-channel="${escAttr({ youtubeChannelId: ch.youtubeChannelId, name: ch.name, description: (ch.description || '').slice(0, 100), thumbnailUrl: ch.thumbnailUrl })}" title="Add to stack">&plus;</button>`;
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
  const collections = state.myCollections.filter(c => !c.channelIds.includes(channelId));
  if (!collections.length) return '';
  return `<div class="tag-editor-overlay" data-collection-picker>
    <div class="tag-editor">
      <h3>Add to Collection</h3>
      <div class="collection-picker-list">
        ${collections.map(c => `<button class="btn btn-outline collection-pick-btn" data-pick-collection="${c._id}" data-pick-channel="${channelId}" style="width:100%; margin-bottom:6px; justify-content:flex-start;">
          ${escHtml(c.name)} <span class="text-muted" style="margin-left:auto; font-size:.8em;">${c.channelIds.length} ch</span>
        </button>`).join('')}
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
      <input type="text" class="tag-note-input" id="editColImg" placeholder="Cover image URL (optional)" value="${escHtml(imageUrl)}" maxlength="500">
      ${imageUrl ? `<img src="${escHtml(imageUrl)}" style="width:100%; max-height:120px; object-fit:cover; border-radius:6px; margin-top:8px;" referrerpolicy="no-referrer">` : ''}
      <div class="tag-editor-actions" style="margin-top:12px;">
        <button class="btn btn-accent" data-confirm-edit-collection="${id}">Save</button>
        <button class="btn btn-ghost" data-cancel-tags>Cancel</button>
      </div>
    </div>
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
