// ── Convex mutation/query wrappers ───────────────────────────
import { convex, api, state, getLoggedInUser, setLoggedInUser, setUserRole } from './state.js';

async function q(fn, args = {}) {
  if (!convex) return null;
  try { return await convex.query(fn, args); }
  catch (e) { console.error(fn, e); return null; }
}

async function m(fn, args = {}) {
  if (!convex) return null;
  try { return await convex.mutation(fn, args); }
  catch (e) { console.error(fn, e); return null; }
}

// ── Auth ─────────────────────────────────────────────────────
export async function doRegister(username, password, bio) {
  const res = await m(api.auth.register, { username, password, bio });
  if (res?.ok) {
    setLoggedInUser({ id: res.id, username: res.username });
    setUserRole(res.role);
  }
  return res;
}

export async function doLogin(username, password) {
  const res = await m(api.auth.login, { username, password });
  if (res?.ok) {
    setLoggedInUser({ id: res.id, username: res.username });
    setUserRole(res.role);
  }
  return res;
}

export function doLogout() {
  setLoggedInUser(null);
  setUserRole('user');
  state.myChannels = [];
  state.myCollections = [];
  state.recommendations = [];
  state.unseenRecCount = 0;
  state.followingFeed = [];
  state.similarUsers = [];
}

// ── Channel operations ───────────────────────────────────────
export async function addChannelToStack(channelData) {
  const user = getLoggedInUser();
  if (!user) return { ok: false, error: 'Login required' };

  // Check if channel needs refresh from YouTube API
  let details = channelData;
  const refreshCheck = await q(api.channels.needsRefresh, { youtubeChannelId: channelData.youtubeChannelId });

  // Only fetch from YouTube if:
  // 1. No stats/subscriberCount provided, AND
  // 2. Either channel doesn't exist OR needs refresh (stale/no thumbnail)
  const needsFetch = !channelData.subscriberCount && (!refreshCheck || refreshCheck.needsRefresh);

  if (needsFetch) {
    const { getChannelDetails } = await import('./youtube.js');
    const full = await getChannelDetails(channelData.youtubeChannelId);
    if (full) details = { ...channelData, ...full };
  }

  // Add or get channel in DB
  const chRes = await m(api.channels.addChannel, {
    youtubeChannelId: details.youtubeChannelId,
    name: details.name,
    description: details.description,
    thumbnailUrl: details.thumbnailUrl,
    subscriberCount: details.subscriberCount,
    videoCount: details.videoCount,
    youtubeCategory: details.youtubeCategory || '',
    addedBy: user.username,
  });
  if (!chRes?.ok) return { ok: false, error: 'Failed to save channel' };

  // Link to user (no categories/note - add them separately if needed)
  const ucRes = await m(api.userChannels.add, {
    userId: user.id,
    channelId: chRes.id,
    username: user.username,
    categories: [],
    note: '',
  });
  return ucRes || { ok: false, error: 'Failed to add to stack' };
}

export async function removeFromStack(channelId) {
  const user = getLoggedInUser();
  if (!user) return;
  await m(api.userChannels.remove, { userId: user.id, channelId });
}

export async function updateChannelTags(channelId, categories, note) {
  const user = getLoggedInUser();
  if (!user) return;
  await m(api.userChannels.update, { userId: user.id, channelId, categories, note });
}

// ── Collections ─────────────────────────────
export async function createCollection(name, description, channelIds) {
  const user = getLoggedInUser();
  if (!user) return null;

  // Generate collection image from channel thumbnails
  let imageUrl = '';
  if (channelIds && channelIds.length > 0) {
    const { generateCollectionSVG } = await import('./collection-svg.js');

    // Fetch channel data to get thumbnail URLs
    const channels = await Promise.all(
      channelIds.map(async (channelId) => {
        return await q(api.channels.get, { id: channelId });
      })
    );

    // Filter out null channels and extract thumbnail URLs
    const thumbnailUrls = channels
      .filter(ch => ch && ch.thumbnailUrl)
      .map(ch => ch.thumbnailUrl);

    // Generate SVG image
    imageUrl = generateCollectionSVG(thumbnailUrls, name);
  }

  return await m(api.collections.create, {
    userId: user.id,
    username: user.username,
    name,
    description,
    imageUrl,
    channelIds,
  });
}

// Helper to regenerate collection image when channels change
export async function regenerateCollectionImage(collectionId) {
  const user = getLoggedInUser();
  if (!user) return null;

  const collection = await q(api.collections.get, { id: collectionId });
  if (!collection) return null;

  const { generateCollectionSVG } = await import('./collection-svg.js');

  // Fetch channel data
  const channels = await Promise.all(
    collection.channelIds.map(async (channelId) => {
      return await q(api.channels.get, { id: channelId });
    })
  );

  const thumbnailUrls = channels
    .filter(ch => ch && ch.thumbnailUrl)
    .map(ch => ch.thumbnailUrl);

  const imageUrl = generateCollectionSVG(thumbnailUrls, collection.name);

  return await updateCollection(collectionId, collection.name, collection.description, imageUrl);
}

export async function updateCollection(id, name, description, imageUrl) {
  const user = getLoggedInUser();
  if (!user) return null;
  return await m(api.collections.update, { id, userId: user.id, name, description, imageUrl });
}

export async function deleteCollection(id) {
  const user = getLoggedInUser();
  if (!user) return null;
  return await m(api.collections.remove, { id, userId: user.id });
}

export async function addChannelToCollection(collectionId, channelId) {
  const user = getLoggedInUser();
  if (!user) return null;
  const result = await m(api.collections.addChannel, { id: collectionId, userId: user.id, channelId });

  // Regenerate collection image after adding channel
  if (result?.ok) {
    await regenerateCollectionImage(collectionId);
  }

  return result;
}

export async function removeChannelFromCollection(collectionId, channelId) {
  const user = getLoggedInUser();
  if (!user) return null;
  const result = await m(api.collections.removeChannel, { id: collectionId, userId: user.id, channelId });

  // Regenerate collection image after removing channel
  if (result?.ok) {
    await regenerateCollectionImage(collectionId);
  }

  return result;
}

export async function refreshChannelImage(channelId, youtubeChannelId) {
  // Always allow manual refresh - user controls when to update
  const { getChannelDetails } = await import('./youtube.js');
  const details = await getChannelDetails(youtubeChannelId);
  if (!details || !details.thumbnailUrl) return { ok: false, error: 'Could not fetch channel data' };
  return await m(api.channels.refreshThumbnail, {
    id: channelId,
    thumbnailUrl: details.thumbnailUrl,
    subscriberCount: details.subscriberCount,
    videoCount: details.videoCount,
    youtubeCategory: details.youtubeCategory,
  });
}

// ── Follows ──────────────────────────────────────────────────
export async function followUser(followingId, followingUsername) {
  const user = getLoggedInUser();
  if (!user) return null;
  return await m(api.follows.follow, {
    followerId: user.id,
    followingId,
    followerUsername: user.username,
    followingUsername,
  });
}

export async function unfollowUser(followingId) {
  const user = getLoggedInUser();
  if (!user) return null;
  return await m(api.follows.unfollow, { followerId: user.id, followingId });
}

// ── Recommendations ──────────────────────────────────────────
export async function sendRecommendation(toUserId, toUsername, channelId, message) {
  const user = getLoggedInUser();
  if (!user) return null;
  return await m(api.recommendations.send, {
    fromUserId: user.id,
    toUserId,
    channelId,
    fromUsername: user.username,
    toUsername,
    message,
  });
}

export async function markRecSeen(id) {
  const user = getLoggedInUser();
  if (!user) return;
  await m(api.recommendations.markSeen, { id, userId: user.id });
}

// ── Data loading ─────────────────────────────────────────────
export async function loadMyStack() {
  const user = getLoggedInUser();
  if (!user) return;
  const channels = await q(api.userChannels.listByUser, { userId: user.id });
  if (channels) state.myChannels = channels;
  const cols = await q(api.collections.listByUser, { userId: user.id });
  if (cols) state.myCollections = cols;
}

export async function loadFeed() {
  const [trending, recent] = await Promise.all([
    q(api.discovery.trending),
    q(api.discovery.recent),
  ]);
  if (trending) state.trending = trending;
  if (recent) state.recentChannels = recent;

  const user = getLoggedInUser();
  if (user) {
    const [similar, feed, recs, unseen] = await Promise.all([
      q(api.discovery.similarUsers, { userId: user.id }),
      q(api.discovery.feedFromFollowing, { userId: user.id }),
      q(api.recommendations.listForUser, { userId: user.id }),
      q(api.recommendations.unseenCount, { userId: user.id }),
    ]);
    if (similar) state.similarUsers = similar;
    if (feed) state.followingFeed = feed;
    if (recs) state.recommendations = recs;
    if (unseen !== null) state.unseenRecCount = unseen;
  }
}

export async function loadExplore() {
  const users = await q(api.discovery.allPublicUsers);
  if (users) state.publicUsers = users;
}

export async function loadUserProfile(username) {
  const [user, channels, collections] = await Promise.all([
    q(api.auth.getUser, { username }),
    q(api.userChannels.listByUsername, { username }),
    q(api.collections.listByUsername, { username }),
  ]);
  state.profileUser = user;
  state.profileChannels = channels || [];
  state.profileCollections = collections || [];
}

export async function loadCollection(id) {
  const col = await q(api.collections.get, { id });
  state.collectionDetail = col;
}

export async function checkFollowing(followingId) {
  const user = getLoggedInUser();
  if (!user) return false;
  return await q(api.follows.isFollowing, { followerId: user.id, followingId });
}

export async function getMatchScore(otherUserId) {
  const user = getLoggedInUser();
  if (!user) return 0;
  return await q(api.discovery.matchScore, { userIdA: user.id, userIdB: otherUserId }) || 0;
}

// ── Bulk Import ────────────────────────────────────────────
export async function bulkImportChannels(channelUrls) {
  const user = getLoggedInUser();
  if (!user) return { ok: false, error: 'Login required' };

  // Parse channel URLs and extract channel IDs
  const channels = [];
  for (const url of channelUrls) {
    try {
      const channelData = await extractChannelFromUrl(url.trim());
      if (channelData) {
        channels.push(channelData);
      }
    } catch (e) {
      console.error('Error parsing URL:', url, e);
    }
  }

  if (channels.length === 0) {
    return { ok: false, error: 'No valid channel URLs found' };
  }

  return await m(api.channels.bulkImport, {
    userId: user.id,
    username: user.username,
    channels,
  });
}

// Helper to extract channel data from URL
export async function extractChannelFromUrl(url) {
  if (!url || !url.trim()) return null;

  // Clean the URL - remove whitespace
  url = url.trim();

  try {
    // Add https:// if no protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const urlObj = new URL(url);
    let pathname = urlObj.pathname;

    // Handle /channel/UCxxx format (direct channel ID)
    if (pathname.includes('/channel/')) {
      const parts = pathname.split('/channel/');
      if (parts.length > 1) {
        const channelId = parts[1].split('/')[0].split('?')[0].split('#')[0];
        return { youtubeChannelId: channelId, name: channelId };
      }
    }

    // Handle /@handle format (YouTube handle)
    // Extract the handle and use it as the channel name
    if (pathname.includes('/@')) {
      const handleMatch = pathname.match(/\/(@[^\/]+)/);
      if (handleMatch) {
        const handle = handleMatch[1]; // Includes the @ symbol
        // For @handles, we can't directly get the channel ID without API call
        // For now, use the handle as the name and skip
        throw new Error(`YouTube handles like ${handle} are not supported. Please use the channel ID URL (youtube.com/channel/UC...)`);
      }
    }

    // Handle /c/CHANNEL_NAME format
    if (pathname.includes('/c/')) {
      const parts = pathname.split('/c/');
      if (parts.length > 1) {
        const channelName = parts[1].split('/')[0].split('?')[0].split('#')[0];
        // Try to search for it
        const results = await searchChannels(channelName);
        if (results && results.length > 0) {
          return { youtubeChannelId: results[0].youtubeChannelId, name: results[0].name };
        }
      }
    }

    // Handle /user/USERNAME format
    if (pathname.includes('/user/')) {
      const parts = pathname.split('/user/');
      if (parts.length > 1) {
        const username = parts[1].split('/')[0].split('?')[0].split('#')[0];
        const results = await searchChannels(username);
        if (results && results.length > 0) {
          return { youtubeChannelId: results[0].youtubeChannelId, name: results[0].name };
        }
      }
    }
  } catch (e) {
    // Re-throw user-friendly errors
    if (e.message && e.message.includes('not supported')) {
      throw e;
    }
    console.error('URL parsing error:', e);
  }

  return null;
}

// ── Highlights ────────────────────────────────────────────
export async function addHighlightToChannel(channelId, youtubeVideoId, title, customThumbnailUrl) {
  const user = getLoggedInUser();
  if (!user) return { ok: false, error: 'Login required' };

  // Use custom thumbnail if provided, otherwise use YouTube's default
  const thumbnailUrl = customThumbnailUrl || `https://img.youtube.com/vi/${youtubeVideoId}/mqdefault.jpg`;

  return await m(api.highlights.addHighlight, {
    channelId,
    youtubeVideoId,
    title,
    thumbnailUrl,
    sharedBy: user.id,
    sharedByUsername: user.username,
  });
}

export async function loadChannelHighlights(channelId) {
  const highlights = await q(api.highlights.getByChannel, { channelId });
  if (highlights) {
    state.highlights[channelId] = highlights;
  }
  return highlights || [];
}

export async function voteOnHighlight(highlightId, direction) {
  const user = getLoggedInUser();
  if (!user) return { ok: false, error: 'Login required' };
  return await m(api.highlights.vote, { highlightId, userId: user.id, direction });
}

export async function getUserHighlightVote(highlightId) {
  const user = getLoggedInUser();
  if (!user) return 0;
  return await q(api.highlights.getUserVote, { highlightId, userId: user.id }) || 0;
}

export async function removeSharedVideo(videoId) {
  const user = getLoggedInUser();
  if (!user) return { ok: false, error: 'Login required' };
  return await m(api.videos.removeVideo, { videoId, userId: user.id });
}
