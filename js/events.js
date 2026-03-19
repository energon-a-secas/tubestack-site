// ── Event handlers ───────────────────────────────────────────
import { state, getLoggedInUser } from './state.js';
import { renderView, updateAuthUI, renderSearchResults, renderCategoryPicker, renderTagEditor, renderCollectionPicker, renderCreateCollectionModal, renderEditCollectionModal, renderHighlightsModal, renderHighlightCard } from './render.js';
import { doRegister, doLogin, doLogout, addChannelToStack, removeFromStack, updateChannelTags, createCollection, updateCollection, deleteCollection, addChannelToCollection, removeChannelFromCollection, refreshChannelImage, followUser, unfollowUser, sendRecommendation, markRecSeen, loadMyStack, loadFeed, loadExplore, loadUserProfile, loadCollection, checkFollowing, getMatchScore, loadChannelHighlights, voteOnHighlight, getUserHighlightVote, addHighlightToChannel, getFollowerCounts, lookupChannelByYoutubeId, updateProfile } from './data.js';
import { searchChannels } from './youtube.js';
import { $, showToast, debounce, escAttr } from './utils.js';

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
    // Load real follower count
    if (state.profileUser) {
      const counts = await getFollowerCounts(state.profileUser.id);
      const countEl = document.getElementById('profileFollowerCount');
      if (countEl) countEl.textContent = counts?.followers ?? 0;
    }
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

  // Auth toggle — navigate to own profile if logged in, else open auth panel
  const authToggle = $('authToggle');
  const authPanel = $('authPanel');
  if (authToggle && authPanel) {
    authToggle.addEventListener('click', () => {
      const user = getLoggedInUser();
      if (user) {
        authPanel.classList.remove('open');
        location.hash = `#user=${user.username}`;
      } else {
        authPanel.classList.toggle('open');
      }
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

  // Collection image file input
  document.addEventListener('change', (e) => {
    if (e.target.id === 'collectionImageFile') {
      const file = e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        showToast('Please select an image file');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        showToast('Image must be smaller than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = async (ev) => {
        const resized = await resizeImageToDataUrl(ev.target.result, 600, 300, 0.8);
        const preview = document.querySelector('.upload-preview');
        const img = preview?.querySelector('img');
        if (img && resized) {
          img.src = resized;
          preview.style.display = 'block';
          document.querySelector('.upload-prompt').style.display = 'none';
          const urlInput = document.getElementById('collectionImageUrl');
          if (urlInput) urlInput.value = '';
        }
      };
      reader.readAsDataURL(file);
    }
  });

  // Collection image drop zone click
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-drop-zone]') && !e.target.closest('button')) {
      const fileInput = document.getElementById('collectionImageFile');
      if (fileInput) fileInput.click();
    }
  });

  // Collection image URL input
  const imageUrlInput = document.getElementById('collectionImageUrl');
  if (imageUrlInput) {
    imageUrlInput.addEventListener('input', (e) => {
      const url = e.target.value.trim();
      if (url) {
        // Clear the file preview if URL is entered
        const preview = document.querySelector('.upload-preview');
        const prompt = document.querySelector('.upload-prompt');
        const fileInput = document.getElementById('collectionImageFile');
        if (preview) preview.style.display = 'none';
        if (prompt) prompt.style.display = 'block';
        if (fileInput) fileInput.value = '';
      }
    });
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

  // Keyboard navigation
  document.addEventListener('keydown', handleKeyboard);

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

  // Overflow menu toggle
  const overflowToggle = target.closest('[data-overflow-toggle]');
  if (overflowToggle) {
    e.stopPropagation();
    const wrapper = overflowToggle.closest('.overflow-menu-wrapper');
    const menu = wrapper?.querySelector('.overflow-menu');
    const wasOpen = menu?.classList.contains('open');
    closeAllOverflowMenus();
    if (!wasOpen && menu) {
      menu.classList.add('open');
      overflowToggle.setAttribute('aria-expanded', 'true');
    }
    return;
  }

  // Close overflow menus on any other click
  if (!target.closest('.overflow-menu')) {
    closeAllOverflowMenus();
  }

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

  // Confirm create collection (with image support)
  if (target.id === 'confirmCreateCol' || target.closest('#confirmCreateCol')) {
    const name = document.getElementById('newColName')?.value?.trim();
    if (!name) return showToast('Enter a name');

    const desc = document.getElementById('newColDesc')?.value?.trim() || '';

    // Get image data
    let imageUrl = '';
    const previewImg = document.querySelector('.upload-preview img');
    if (previewImg && previewImg.src) {
      imageUrl = previewImg.src; // Base64 data URL from drag & drop
    } else {
      // Try URL input
      imageUrl = document.getElementById('collectionImageUrl')?.value?.trim() || '';
    }

    document.querySelector('[data-create-collection-modal]')?.remove();
    const res = await createCollection(name, desc, [], imageUrl);
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

  // Handle collection image file selection
  if (target.id === 'collectionImageFile') {
    // File input change - will be handled by change event
    return;
  }

  // Handle image URL input
  const imageUrlInput = target.closest('#collectionImageUrl');
  if (imageUrlInput) {
    // Just let the user type, no immediate action
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
    document.body.insertAdjacentHTML('beforeend', renderEditCollectionModal(id, name, desc, ''));
    document.getElementById('editColName')?.focus();

    // Handle image file upload
    const fileInput = document.getElementById('editColImgFile');
    const urlInput = document.getElementById('editColImg');
    const previewContainer = document.getElementById('collectionImagePreviewContainer');
    const clearBtn = document.getElementById('clearCollectionImg');

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const resized = await resizeImageToDataUrl(event.target.result, 600, 300, 0.8);
            if (!resized) { showToast('Could not process image'); return; }
            // Update the URL input with resized data
            urlInput.value = resized;

            // Show preview
            let previewImg = document.getElementById('collectionImgPreview');
            if (!previewImg) {
              previewImg = document.createElement('img');
              previewImg.id = 'collectionImgPreview';
              previewImg.style.width = '100%';
              previewImg.style.maxHeight = '120px';
              previewImg.style.objectFit = 'cover';
              previewImg.style.borderRadius = '6px';
              previewImg.style.marginTop = '8px';
              previewImg.setAttribute('referrerpolicy', 'no-referrer');
              previewContainer.appendChild(previewImg);
            }
            previewImg.src = resized;

            // Show clear button if not already there
            let clearButton = document.getElementById('clearCollectionImg');
            if (!clearButton) {
              clearButton = document.createElement('button');
              clearButton.id = 'clearCollectionImg';
              clearButton.type = 'button';
              clearButton.className = 'btn btn-sm btn-ghost';
              clearButton.style.marginTop = '4px';
              clearButton.style.fontSize = '0.8rem';
              clearButton.textContent = 'Remove Image';
              clearButton.addEventListener('click', () => {
                urlInput.value = '';
                fileInput.value = '';
                if (previewImg) previewImg.remove();
                if (clearButton) clearButton.remove();
              });
              previewContainer.appendChild(clearButton);
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Handle clear image button click
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        urlInput.value = '';
        fileInput.value = '';
        const previewImg = document.getElementById('collectionImgPreview');
        if (previewImg) previewImg.remove();
        if (clearBtn) clearBtn.remove();
      });
    }

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

  // Save profile settings
  const saveProfile = target.closest('[data-save-profile]');
  if (saveProfile) {
    const displayName = document.getElementById('profileDisplayName')?.value?.trim() || '';
    const bio = document.getElementById('profileBio')?.value?.trim() || '';
    const isPublic = document.getElementById('profileIsPublic')?.checked ?? true;
    const res = await updateProfile(bio, displayName, isPublic);
    if (res?.ok) {
      showToast('Profile updated');
      await loadUserProfile(state.viewParam);
      renderView();
      // Re-load follower count
      if (state.profileUser) {
        const counts = await getFollowerCounts(state.profileUser.id);
        const countEl = document.getElementById('profileFollowerCount');
        if (countEl) countEl.textContent = counts?.followers ?? 0;
      }
    } else {
      showToast(res?.error || 'Failed to update');
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

  // Sort channels
  const sortBy = target.closest('#sortBy');
  if (sortBy) {
    state.sortBy = sortBy.value;
    renderView();
    return;
  }

  // Open highlights modal
  const highlightsBtn = target.closest('[data-highlights-modal]');
  if (highlightsBtn) {
    const channel = JSON.parse(highlightsBtn.dataset.highlightsModal);
    await showHighlightsModal(channel);
    return;
  }

  // Highlight vote
  const voteBtn = target.closest('[data-highlight-vote]');
  if (voteBtn) {
    const highlightId = voteBtn.dataset.highlightVote;
    const direction = parseInt(voteBtn.dataset.voteDir);
    const result = await voteOnHighlight(highlightId, direction);
    if (result?.success) {
      showToast('Vote recorded!');
      // Reload highlights to update UI
      const listEl = document.querySelector('[data-highlights-list]');
      if (listEl) {
        const channelId = listEl.dataset.channelId;
        loadChannelHighlights(channelId);
      }
    } else {
      showToast(result?.error || 'Failed to vote');
    }
    return;
  }

  // Close highlights modal — only the close button (backdrop handled by its own listener)
  if (target.closest('[data-highlights-close]')) {
    closeHighlightsModal();
    return;
  }

  // Stop global handler from interfering with highlights modal content
  if (target.closest('.highlights-modal')) {
    return;
  }

  // Open channel from card click (but not if clicking buttons/links/action bar)
  const card = target.closest('.channel-card');
  if (card && !target.closest('button, a, input, select, textarea, .channel-card-top a, .channel-actions-bar')) {
    const channelData = card.dataset.openChannel ? JSON.parse(card.dataset.openChannel) : null;
    if (channelData && channelData.youtubeChannelId) {
      window.open(`https://www.youtube.com/channel/${encodeURIComponent(channelData.youtubeChannelId)}`, '_blank');
    }
    return;
  }
}

// Explore filter input
document.addEventListener('input', (e) => {
  if (e.target.id === 'exploreSearch') {
    const val = e.target.value.toLowerCase();
    document.querySelectorAll('.user-card').forEach(card => {
      const username = card.dataset.username?.toLowerCase() || '';
      const displayName = card.querySelector('.user-name')?.textContent?.toLowerCase() || '';
      card.style.display = (username.includes(val) || displayName.includes(val)) ? '' : 'none';
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

// ── Overflow menus ────────────────────────────────────────────
function closeAllOverflowMenus() {
  document.querySelectorAll('.overflow-menu.open').forEach(m => {
    m.classList.remove('open');
    m.closest('.overflow-menu-wrapper')?.querySelector('[data-overflow-toggle]')?.setAttribute('aria-expanded', 'false');
  });
}

// ── Keyboard navigation ──────────────────────────────────────
const NAV_VIEWS = ['feed', 'explore', 'stack'];

function handleKeyboard(e) {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  // Number keys to jump to tabs
  if (e.key === '1') { location.hash = 'feed'; return; }
  if (e.key === '2') { location.hash = 'explore'; return; }
  if (e.key === '3') { location.hash = 'stack'; return; }

  // Arrow keys to cycle tabs
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const idx = NAV_VIEWS.indexOf(state.view);
    if (idx === -1) return;
    const next = e.key === 'ArrowRight'
      ? NAV_VIEWS[(idx + 1) % NAV_VIEWS.length]
      : NAV_VIEWS[(idx - 1 + NAV_VIEWS.length) % NAV_VIEWS.length];
    location.hash = next;
    return;
  }

  // Escape — close overlays in priority order
  if (e.key === 'Escape') {
    if (document.querySelector('[data-highlights-overlay]')) { closeHighlightsModal(); return; }
    if (document.querySelector('[data-tag-editor]')) { document.querySelector('[data-tag-editor]')?.remove(); return; }
    if (!$('searchOverlay')?.hidden) { closeSearch(); return; }
    if (!$('recommendOverlay')?.hidden) { $('recommendOverlay').hidden = true; return; }
    const authPanel = $('authPanel');
    if (authPanel?.classList.contains('open')) { authPanel.classList.remove('open'); return; }
    closeAllOverflowMenus();
  }
}

// ── Image resize helper ──────────────────────────────────────
function resizeImageToDataUrl(dataUrl, maxWidth = 320, maxHeight = 180, quality = 0.6) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      let result = canvas.toDataURL('image/jpeg', quality);
      // If still over 100KB, compress harder
      if (result.length > 100_000) {
        result = canvas.toDataURL('image/jpeg', 0.3);
      }
      // If STILL over 200KB, reject — too large for DB storage
      if (result.length > 200_000) {
        resolve(null);
        return;
      }
      resolve(result);
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

// ── Highlight Sharing ────────────────────────────────────────
function closeHighlightsModal() {
  const overlay = document.querySelector('[data-highlights-overlay]');
  if (overlay) {
    // Remove the wrapper div parent if it's a bare container
    const parent = overlay.parentElement;
    overlay.remove();
    if (parent && parent !== document.body && parent.children.length === 0) {
      parent.remove();
    }
  }
}

async function showHighlightsModal(channel) {
  const overlay = document.createElement('div');
  overlay.innerHTML = renderHighlightsModal(channel);
  document.body.appendChild(overlay);

  // Load highlights — resolve Convex doc ID if needed
  let channelId = channel._id || channel.channelId || channel.id;
  if (!channelId && channel.youtubeChannelId) {
    const doc = await lookupChannelByYoutubeId(channel.youtubeChannelId);
    if (doc) channelId = doc._id;
    else { showToast('Channel not found in database'); return; }
  }
  const highlights = await loadChannelHighlights(channelId);
  const user = getLoggedInUser();

  const listEl = document.querySelector('[data-highlights-list]');
  if (listEl) {
    if (highlights.length === 0) {
      const addButton = user ?
        '<button class="btn btn-accent" id="addFirstHighlightBtn">+ Add First Highlight</button>' :
        '<p class="text-muted">Log in to add highlights.</p>';
      listEl.innerHTML = `
        <div style="text-align: center; padding: 40px;">
          <p class="text-muted" style="margin-bottom: 16px;">No highlights yet. Be the first to share one!</p>
          ${addButton}
        </div>`;

      // Handle add first highlight
      const addBtn = document.getElementById('addFirstHighlightBtn');
      if (addBtn) {
        addBtn.addEventListener('click', () => {
          showAddHighlightForm(channel);
        });
      }
    } else {
      // Get user's votes and render highlights
      const highlightsHtml = await Promise.all(
        highlights.map(async (highlight) => {
          const vote = user ? await getUserHighlightVote(highlight._id) : 0;
          return renderHighlightCard(highlight, vote);
        })
      );
      listEl.innerHTML = highlightsHtml.join('');
    }
  }

  // Handle close
  const closeBtn = overlay.querySelector('[data-highlights-close]');
  if (closeBtn) closeBtn.addEventListener('click', closeHighlightsModal);

  // Handle backdrop click (click on the overlay background, not the modal content)
  const overlayBg = overlay.querySelector('.highlights-modal-overlay');
  if (overlayBg) {
    overlayBg.addEventListener('click', (e) => {
      if (e.target === overlayBg) closeHighlightsModal();
    });
  }

  // Handle add highlight button in footer
  const addHighlightBtn = document.getElementById('addHighlightBtn');
  if (addHighlightBtn) {
    addHighlightBtn.addEventListener('click', () => {
      showAddHighlightForm(channel);
    });
  }
}

async function showAddHighlightForm(channel) {
  const modalBody = document.querySelector('[data-highlights-list]');
  const footer = document.querySelector('.highlights-modal-footer');
  if (!modalBody || !footer) return;

  // Hide the Add Highlight button in footer while form is open
  const addBtn = document.getElementById('addHighlightBtn');
  if (addBtn) addBtn.style.display = 'none';

  const formHtml = `
    <div class="add-highlight-form" style="background: var(--surface-1); padding: 20px; border-radius: 8px; margin-bottom: 16px;">
      <h4 style="margin-bottom: 12px;">Add New Highlight</h4>
      <input type="text" id="highlightVideoId" placeholder="YouTube Video ID or URL" style="width: 100%; padding: 10px; margin-bottom: 12px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); color: var(--text-primary);">
      <input type="text" id="highlightTitle" placeholder="Title (optional)" style="width: 100%; padding: 10px; margin-bottom: 12px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); color: var(--text-primary);">
      <div style="margin-bottom: 12px;">
        <label style="display: block; margin-bottom: 6px; font-size: var(--text-xs); color: var(--text-muted);">Custom Image (optional):</label>
        <input type="file" id="highlightImageInput" accept="image/*" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); color: var(--text-primary);">
        <img id="highlightImagePreview" style="display: none; max-width: 200px; max-height: 120px; margin-top: 8px; border-radius: 4px;">
        <button type="button" id="clearHighlightImage" style="display: none; margin-top: 4px; font-size: var(--text-xs);" class="btn btn-sm btn-ghost">Remove Image</button>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-accent" id="submitHighlightBtn">Add Highlight</button>
        <button class="btn btn-ghost" id="cancelHighlightBtn">Cancel</button>
      </div>
    </div>`;

  modalBody.insertAdjacentHTML('afterbegin', formHtml);

  // Handle image upload and preview
  const imageInput = document.getElementById('highlightImageInput');
  const imagePreview = document.getElementById('highlightImagePreview');
  const clearImageBtn = document.getElementById('clearHighlightImage');

  if (imageInput) {
    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          showToast('Image must be under 5MB');
          return;
        }
        const reader = new FileReader();
        reader.onload = async (event) => {
          const resized = await resizeImageToDataUrl(event.target.result);
          if (resized) {
            imagePreview.src = resized;
            imagePreview.style.display = 'block';
            clearImageBtn.style.display = 'inline-block';
          } else {
            showToast('Could not process image');
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (clearImageBtn) {
    clearImageBtn.addEventListener('click', () => {
      imageInput.value = '';
      imagePreview.style.display = 'none';
      clearImageBtn.style.display = 'none';
    });
  }

  document.getElementById('highlightVideoId').focus();

  // Handle form submission
  document.getElementById('submitHighlightBtn').addEventListener('click', async () => {
    const videoIdInput = document.getElementById('highlightVideoId');
    const titleInput = document.getElementById('highlightTitle');

    const videoUrl = videoIdInput.value.trim();
    const title = titleInput.value.trim();

    if (!videoUrl) {
      showToast('Please enter a YouTube video ID or URL');
      return;
    }

    // Extract video ID from URL if needed
    let videoId = videoUrl;
    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
      try {
        const url = new URL(videoUrl);
        if (url.hostname.includes('youtube.com')) {
          videoId = url.searchParams.get('v') || url.pathname.split('/').pop() || videoUrl;
        } else if (url.hostname.includes('youtu.be')) {
          videoId = url.pathname.substring(1);
        }
      } catch (e) {
        // If URL parsing fails, assume it's already a video ID
      }
    }

    // Auto-fetch video title from YouTube oEmbed if title is empty
    let resolvedTitle = title;
    if (!resolvedTitle) {
      try {
        const oembed = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`);
        if (oembed.ok) {
          const data = await oembed.json();
          resolvedTitle = data.title || '';
        }
      } catch { /* fall through */ }
    }
    if (!resolvedTitle) resolvedTitle = 'Untitled Highlight';

    const user = getLoggedInUser();
    if (!user) {
      showToast('Please log in to add highlights');
      return;
    }

    // Add highlight — resolve Convex doc ID if needed
    let resolvedChannelId = channel._id || channel.channelId || channel.id;
    if (!resolvedChannelId && channel.youtubeChannelId) {
      const doc = await lookupChannelByYoutubeId(channel.youtubeChannelId);
      if (doc) resolvedChannelId = doc._id;
    }
    if (!resolvedChannelId) { showToast('Channel not found'); return; }
    let customImage = null;
    if (imagePreview.style.display !== 'none' && imagePreview.src) {
      customImage = await resizeImageToDataUrl(imagePreview.src);
    }
    const result = await addHighlightToChannel(resolvedChannelId, videoId, resolvedTitle, customImage);

    if (result?.ok) {
      showToast('Highlight added!');
      // Close the form
      document.querySelector('.add-highlight-form')?.remove();

      // Show the Add Highlight button again
      const addBtn = document.getElementById('addHighlightBtn');
      if (addBtn) addBtn.style.display = '';

      // Just refresh highlights list - never close modal automatically
      const highlights = await loadChannelHighlights(resolvedChannelId);

      // Re-render highlights in current modal
      const listEl = document.querySelector('[data-highlights-list]');
      if (listEl) {
        const user = getLoggedInUser();
        const highlightsHtml = await Promise.all(
          highlights.map(async (highlight) => {
            const vote = user ? await getUserHighlightVote(highlight._id) : 0;
            return renderHighlightCard(highlight, vote);
          })
        );
        listEl.innerHTML = highlightsHtml.join('');
      }
    } else {
      showToast(result?.error || 'Failed to add highlight');
    }
  });

  // Handle cancel
  document.getElementById('cancelHighlightBtn').addEventListener('click', () => {
    document.querySelector('.add-highlight-form')?.remove();
    // Show the Add Highlight button again
    const addBtn = document.getElementById('addHighlightBtn');
    if (addBtn) addBtn.style.display = '';
  });
}

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
