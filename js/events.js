// ── Event handlers ───────────────────────────────────────────
import { state, getLoggedInUser } from './state.js';
import { renderView, updateAuthUI, renderSearchResults, renderCategoryPicker, renderTagEditor, renderCollectionPicker, renderCreateCollectionModal, renderEditCollectionModal } from './render.js';
import { doRegister, doLogin, doLogout, addChannelToStack, removeFromStack, updateChannelTags, createCollection, updateCollection, deleteCollection, addChannelToCollection, removeChannelFromCollection, refreshChannelImage, followUser, unfollowUser, sendRecommendation, markRecSeen, loadMyStack, loadFeed, loadExplore, loadUserProfile, loadCollection, checkFollowing, getMatchScore } from './data.js';
import { searchChannels } from './youtube.js';
import { $, showToast, debounce } from './utils.js';

// ── Hash router ──────────────────────────────────────────────
function parseHash() {
  const hash = location.hash.slice(1) || 'feed';
  if (hash.startsWith('user=')) {
    state.view = 'user';
    state.viewParam = hash.slice(5);
  } else if (hash.startsWith('collection=')) {
    state.view = 'collection';
    state.viewParam = hash.slice(11);
  } else if (['feed', 'explore', 'stack'].includes(hash)) {
    state.view = hash;
    state.viewParam = null;
  } else {
    state.view = 'feed';
    state.viewParam = null;
  }
}

async function navigate() {
  parseHash();
  renderView();
  if (state.view === 'feed') await loadFeed().then(renderView);
  if (state.view === 'explore') await loadExplore().then(renderView);
  if (state.view === 'stack') await loadMyStack().then(renderView);
  if (state.view === 'user') {
    await loadUserProfile(state.viewParam);
    renderView();
    const user = getLoggedInUser();
    if (user && state.profileUser && user.id !== state.profileUser.id) {
      const score = await getMatchScore(state.profileUser.id);
      const el = document.getElementById('profileMatch');
      if (el && score > 0) {
        const { matchBadgeClass } = await import('./social.js');
        el.textContent = score + '% match';
        el.className = 'match-badge ' + matchBadgeClass(score);
      }
      const isFollow = await checkFollowing(state.profileUser.id);
      const btn = document.querySelector('[data-follow-user]');
      if (btn && isFollow) {
        btn.textContent = 'Unfollow';
        btn.dataset.following = 'true';
      }
    }
  }
  if (state.view === 'collection') {
    await loadCollection(state.viewParam);
    renderView();
  }
}

// ── Initial data load ────────────────────────────────────────
export async function loadInitialData() {
  parseHash();
  await navigate();
}

// ── Bind events ──────────────────────────────────────────────
export function bindEvents() {
  window.addEventListener('hashchange', navigate);

  // Nav buttons
  document.querySelectorAll('nav .nav-link').forEach(btn => {
    btn.addEventListener('click', () => {
      location.hash = btn.dataset.view;
    });
  });

  // Auth toggle
  const authToggle = $('authToggle');
  const authPanel = $('authPanel');
  if (authToggle && authPanel) {
    authToggle.addEventListener('click', () => {
      authPanel.classList.toggle('open');
    });
  }

  // Auth tabs
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isLogin = tab.dataset.tab === 'login';
      const loginForm = $('authLoginForm');
      const regForm = $('authRegisterForm');
      if (loginForm) loginForm.hidden = !isLogin;
      if (regForm) regForm.hidden = isLogin;
    });
  });

  // Login
  const loginBtn = $('authLoginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const u = $('authLoginUser')?.value;
      const p = $('authLoginPass')?.value;
      if (!u || !p) return showToast('Enter username and password');
      const res = await doLogin(u, p);
      if (res?.ok) {
        authPanel?.classList.remove('open');
        showToast('Logged in as ' + res.username);
        navigate();
      } else {
        showToast(res?.error || 'Login failed');
      }
    });
  }

  // Register
  const regBtn = $('authRegBtn');
  if (regBtn) {
    regBtn.addEventListener('click', async () => {
      const u = $('authRegUser')?.value;
      const p = $('authRegPass')?.value;
      const b = $('authRegBio')?.value;
      if (!u || !p) return showToast('Enter username and password');
      const res = await doRegister(u, p, b);
      if (res?.ok) {
        authPanel?.classList.remove('open');
        showToast('Welcome, ' + res.username + '!');
        navigate();
      } else {
        showToast(res?.error || 'Registration failed');
      }
    });
  }

  // Logout
  const logoutBtn = $('authLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      doLogout();
      authPanel?.classList.remove('open');
      updateAuthUI();
      showToast('Logged out');
      location.hash = 'feed';
    });
  }

  // Search overlay
  const searchClose = $('searchClose');
  const searchOverlay = $('searchOverlay');
  if (searchClose) searchClose.addEventListener('click', closeSearch);
  if (searchOverlay) searchOverlay.addEventListener('click', (e) => {
    if (e.target === searchOverlay) closeSearch();
  });

  // Search input
  const searchInput = $('searchInput');
  if (searchInput) {
    const doSearch = debounce(async (val) => {
      if (val.length < 2) return;
      const results = await searchChannels(val);
      state.searchResults = results;
      renderSearchResults(results);
    }, 350);
    searchInput.addEventListener('input', (e) => doSearch(e.target.value));
  }

  // Recommend overlay
  const recClose = $('recommendClose');
  const recOverlay = $('recommendOverlay');
  if (recClose) recClose.addEventListener('click', () => recOverlay.hidden = true);
  if (recOverlay) recOverlay.addEventListener('click', (e) => {
    if (e.target === recOverlay) recOverlay.hidden = true;
  });

  // Global click delegation
  document.addEventListener('click', handleGlobalClick);

  // Enter key in auth forms
  $('authLoginPass')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') loginBtn?.click(); });
  $('authRegBio')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') regBtn?.click(); });
}

function openSearch() {
  const overlay = $('searchOverlay');
  if (overlay) {
    overlay.hidden = false;
    $('searchInput')?.focus();
  }
}

function closeSearch() {
  const overlay = $('searchOverlay');
  if (overlay) overlay.hidden = true;
  const results = $('searchResults');
  if (results) results.innerHTML = '';
  const input = $('searchInput');
  if (input) input.value = '';
}

async function handleGlobalClick(e) {
  const target = e.target;

  // Open search
  if (target.id === 'openSearchBtn' || target.closest('#openSearchBtn')) {
    openSearch();
    return;
  }

  // Add channel — show category picker
  const addBtn = target.closest('[data-add-channel]');
  if (addBtn) {
    const user = getLoggedInUser();
    if (!user) return showToast('Log in to add channels');
    const channelData = JSON.parse(addBtn.dataset.addChannel);
    document.body.insertAdjacentHTML('beforeend', renderCategoryPicker(channelData));
    return;
  }

  // Confirm add with categories
  const confirmBtn = target.closest('[data-confirm-add]');
  if (confirmBtn) {
    const channelData = JSON.parse(confirmBtn.dataset.confirmAdd);
    const overlay = document.querySelector('[data-category-picker]');
    const checks = overlay?.querySelectorAll('.tag-options input:checked') || [];
    const categories = [...checks].map(c => c.value);
    const note = document.getElementById('addChannelNote')?.value || '';
    overlay?.remove();
    closeSearch();
    showToast('Adding...');
    const res = await addChannelToStack(channelData, categories, note);
    if (res?.ok) {
      showToast('Added to stack!');
      await loadMyStack();
      renderView();
    } else {
      showToast(res?.error || 'Failed to add');
    }
    return;
  }

  // Cancel any overlay
  if (target.closest('[data-cancel-tags]')) {
    document.querySelector('[data-category-picker]')?.remove();
    document.querySelector('[data-tag-editor]')?.remove();
    document.querySelector('[data-collection-picker]')?.remove();
    document.querySelector('[data-create-collection-modal]')?.remove();
    document.querySelector('[data-edit-collection-modal]')?.remove();
    return;
  }

  // Remove from stack
  const removeBtn = target.closest('[data-remove-channel]');
  if (removeBtn) {
    await removeFromStack(removeBtn.dataset.removeChannel);
    showToast('Removed');
    await loadMyStack();
    renderView();
    // Re-render search results if overlay is open
    if (state.searchResults.length && !$('searchOverlay')?.hidden) {
      renderSearchResults(state.searchResults);
    }
    return;
  }

  // Edit tags
  const editBtn = target.closest('[data-edit-tags]');
  if (editBtn) {
    const channelId = editBtn.dataset.editTags;
    const uc = state.myChannels.find(u => u.channelId === channelId);
    if (uc) {
      document.body.insertAdjacentHTML('beforeend', renderTagEditor(channelId, uc.categories, uc.note));
    }
    return;
  }

  // Save tags
  const saveBtn = target.closest('[data-save-tags]');
  if (saveBtn) {
    const channelId = saveBtn.dataset.saveTags;
    const overlay = document.querySelector(`[data-tag-editor="${channelId}"]`);
    const checks = overlay?.querySelectorAll('.tag-options input:checked') || [];
    const categories = [...checks].map(c => c.value);
    const note = overlay?.querySelector('.tag-note-input')?.value || '';
    overlay?.remove();
    await updateChannelTags(channelId, categories, note);
    showToast('Updated');
    await loadMyStack();
    renderView();
    return;
  }

  // Create collection (open modal)
  if (target.id === 'createCollectionBtn' || target.closest('#createCollectionBtn')) {
    document.body.insertAdjacentHTML('beforeend', renderCreateCollectionModal());
    document.getElementById('newColName')?.focus();
    return;
  }

  // Confirm create collection
  if (target.id === 'confirmCreateCol' || target.closest('#confirmCreateCol')) {
    const name = document.getElementById('newColName')?.value?.trim();
    if (!name) return showToast('Enter a name');
    const desc = document.getElementById('newColDesc')?.value?.trim() || '';
    document.querySelector('[data-create-collection-modal]')?.remove();
    const res = await createCollection(name, desc, []);
    if (res?.ok) {
      showToast('Collection created');
      await loadMyStack();
      renderView();
    } else {
      showToast(res?.error || 'Failed');
    }
    return;
  }

  // Add to collection (open picker)
  const addToCol = target.closest('[data-add-to-collection]');
  if (addToCol) {
    const channelId = addToCol.dataset.addToCollection;
    const html = renderCollectionPicker(channelId);
    if (!html) return showToast('No collections available');
    document.body.insertAdjacentHTML('beforeend', html);
    return;
  }

  // Pick collection from picker
  const pickCol = target.closest('[data-pick-collection]');
  if (pickCol) {
    const colId = pickCol.dataset.pickCollection;
    const chId = pickCol.dataset.pickChannel;
    document.querySelector('[data-collection-picker]')?.remove();
    const res = await addChannelToCollection(colId, chId);
    if (res?.ok) {
      showToast('Added to collection');
      await loadMyStack();
      renderView();
    } else {
      showToast(res?.error || 'Failed');
    }
    return;
  }

  // Remove from collection
  const removeFromCol = target.closest('[data-remove-from-collection]');
  if (removeFromCol) {
    const colId = removeFromCol.dataset.removeFromCollection;
    const chId = removeFromCol.dataset.collectionChannel;
    const res = await removeChannelFromCollection(colId, chId);
    if (res?.ok) {
      showToast('Removed from collection');
      await loadMyStack();
      if (state.view === 'collection') await loadCollection(state.viewParam);
      renderView();
    } else {
      showToast(res?.error || 'Failed');
    }
    return;
  }

  // Refresh channel image
  const refreshBtn = target.closest('[data-refresh-image]');
  if (refreshBtn) {
    const chId = refreshBtn.dataset.refreshImage;
    const ytId = refreshBtn.dataset.ytId;
    refreshBtn.disabled = true;
    refreshBtn.textContent = '...';
    const res = await refreshChannelImage(chId, ytId);
    if (res?.ok) {
      showToast('Updated');
      await loadMyStack();
      renderView();
    } else {
      showToast(res?.error || 'Could not refresh');
      refreshBtn.disabled = false;
      refreshBtn.textContent = '\u21bb';
    }
    return;
  }

  // Copy link
  const copyLink = target.closest('[data-copy-link]');
  if (copyLink) {
    try {
      await navigator.clipboard.writeText(copyLink.dataset.copyLink);
      showToast('Link copied!');
    } catch {
      showToast('Could not copy');
    }
    return;
  }

  // Edit collection (open modal)
  const editCol = target.closest('[data-edit-collection]');
  if (editCol) {
    const id = editCol.dataset.editCollection;
    const name = editCol.dataset.colName || '';
    const desc = editCol.dataset.colDesc || '';
    const img = editCol.dataset.colImg || '';
    document.body.insertAdjacentHTML('beforeend', renderEditCollectionModal(id, name, desc, img));
    document.getElementById('editColName')?.focus();
    return;
  }

  // Confirm edit collection
  const confirmEdit = target.closest('[data-confirm-edit-collection]');
  if (confirmEdit) {
    const id = confirmEdit.dataset.confirmEditCollection;
    const name = document.getElementById('editColName')?.value?.trim();
    const desc = document.getElementById('editColDesc')?.value?.trim() || '';
    const img = document.getElementById('editColImg')?.value?.trim() || '';
    if (!name) return showToast('Enter a name');
    document.querySelector('[data-edit-collection-modal]')?.remove();
    const res = await updateCollection(id, name, desc, img);
    if (res?.ok) {
      showToast('Updated');
      await loadMyStack();
      if (state.view === 'collection') await loadCollection(state.viewParam);
      renderView();
    } else {
      showToast(res?.error || 'Failed');
    }
    return;
  }

  // Delete collection
  const delCol = target.closest('[data-delete-collection]');
  if (delCol) {
    if (!confirm('Delete this collection?')) return;
    await deleteCollection(delCol.dataset.deleteCollection);
    showToast('Deleted');
    await loadMyStack();
    if (state.view === 'collection') location.hash = 'stack';
    else renderView();
    return;
  }

  // Follow/unfollow
  const followBtn = target.closest('[data-follow-user]');
  if (followBtn) {
    const followingId = followBtn.dataset.followId;
    const followingUsername = followBtn.dataset.followUser;
    if (followBtn.dataset.following === 'true') {
      await unfollowUser(followingId);
      followBtn.textContent = 'Follow';
      followBtn.dataset.following = 'false';
      showToast('Unfollowed');
    } else {
      await followUser(followingId, followingUsername);
      followBtn.textContent = 'Unfollow';
      followBtn.dataset.following = 'true';
      showToast('Following!');
    }
    return;
  }

  // Recommend
  const recBtn = target.closest('[data-recommend-channel]');
  if (recBtn) {
    const channelId = recBtn.dataset.recommendChannel;
    const channelName = recBtn.dataset.recommendName;
    if (!channelId) return;
    showRecommendOverlay(channelId, channelName);
    return;
  }

  // Dismiss recommendation
  const dismissBtn = target.closest('[data-dismiss-rec]');
  if (dismissBtn) {
    await markRecSeen(dismissBtn.dataset.dismissRec);
    showToast('Dismissed');
    await loadFeed();
    renderView();
    return;
  }

  // Explore filter
  const exploreSearch = $('exploreSearch');
  if (exploreSearch && target === exploreSearch) return;
}

// Explore filter input
document.addEventListener('input', (e) => {
  if (e.target.id === 'exploreSearch') {
    const val = e.target.value.toLowerCase();
    document.querySelectorAll('.user-card').forEach(card => {
      const name = card.dataset.username?.toLowerCase() || '';
      card.style.display = name.includes(val) ? '' : 'none';
    });
  }
  // Category filter in tag editor/picker
  if (e.target.classList.contains('tag-filter')) {
    const val = e.target.value.toLowerCase();
    const options = e.target.closest('.tag-editor')?.querySelectorAll('.tag-option') || [];
    options.forEach(opt => {
      const text = opt.textContent.toLowerCase();
      opt.style.display = text.includes(val) ? '' : 'none';
    });
  }
});

async function showRecommendOverlay(channelId, channelName) {
  const user = getLoggedInUser();
  if (!user) return showToast('Log in to recommend');
  const overlay = $('recommendOverlay');
  const body = $('recommendBody');
  if (!overlay || !body) return;

  body.innerHTML = `<p style="margin-bottom:12px;">Recommend <strong>${channelName}</strong> to:</p>
    <input type="text" id="recToUser" placeholder="Username" style="width:100%; margin-bottom:8px;" maxlength="20">
    <input type="text" id="recMessage" placeholder="Message (optional)" style="width:100%; margin-bottom:12px;" maxlength="200">
    <button class="btn btn-accent" id="sendRecBtn" style="width:100%;">Send</button>`;
  overlay.hidden = false;

  document.getElementById('sendRecBtn')?.addEventListener('click', async () => {
    const toUsername = document.getElementById('recToUser')?.value?.trim();
    if (!toUsername) return showToast('Enter a username');
    const message = document.getElementById('recMessage')?.value || '';

    // Look up user
    const { convex, api: apiRef } = await import('./state.js');
    if (!convex) return showToast('Not connected');
    const toUser = await convex.query(apiRef.auth.getUser, { username: toUsername });
    if (!toUser) return showToast('User not found');

    const res = await sendRecommendation(toUser.id, toUsername, channelId, message);
    overlay.hidden = true;
    if (res?.ok) showToast('Sent!');
    else showToast(res?.error || 'Failed to send');
  }, { once: true });
}
