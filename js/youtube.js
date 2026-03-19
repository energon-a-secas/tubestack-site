// ── YouTube Worker proxy calls ───────────────────────────────

const WORKER_URL = 'https://tubestack-api.neorgon.workers.dev';

// Memory cache for channel details (5 minute TTL)
const CHANNEL_CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getFromCache(key) {
  const entry = CHANNEL_CACHE.get(key);
  if (!entry) return null;
  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL) {
    CHANNEL_CACHE.delete(key);
    return null;
  }
  return entry.data;
}

function setInCache(key, data) {
  CHANNEL_CACHE.set(key, { data, timestamp: Date.now() });
}

export async function searchChannels(query) {
  if (!query || query.length < 2) return [];
  if (WORKER_URL.startsWith('REPLACE')) return demoResults(query);
  try {
    const res = await fetch(`${WORKER_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query }),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function getChannelDetails(channelId) {
  if (!channelId) return null;
  if (WORKER_URL.startsWith('REPLACE')) return demoChannel(channelId);

  // Check cache first
  const cacheKey = `channel:${channelId}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`${WORKER_URL}/channel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: channelId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    setInCache(cacheKey, data);
    return data;
  } catch {
    return null;
  }
}

// Demo fallbacks when Worker URL is not configured
function demoResults(q) {
  const lower = q.toLowerCase();
  const demos = [
    { youtubeChannelId: 'UCsBjURrPoezykLs9EqgamOA', name: 'Fireship', description: 'High-intensity code tutorials', thumbnailUrl: '' },
    { youtubeChannelId: 'UCvjgXvBlCQM8Dg3PZ2Nmfag', name: 'Theo - t3.gg', description: 'Web development opinions and tutorials', thumbnailUrl: '' },
    { youtubeChannelId: 'UC8butISFwT-Wl7EV0hUK0BQ', name: 'freeCodeCamp.org', description: 'Learn to code for free', thumbnailUrl: '' },
    { youtubeChannelId: 'UCW5YeuERMmlnqo4oq8vwUpg', name: 'The Net Ninja', description: 'Web development tutorials', thumbnailUrl: '' },
    { youtubeChannelId: 'UCWN3xxRkmTPphZ07gSwWEaA', name: 'Ben Awad', description: 'Software engineering and startups', thumbnailUrl: '' },
  ];
  return demos.filter(d => d.name.toLowerCase().includes(lower));
}

// Search for channels by handle/username
export async function searchChannelsByHandle(handle) {
  if (!handle) return null;
  if (WORKER_URL.startsWith('REPLACE')) return demoChannelByHandle(handle);

  try {
    // For demo, just use search
    const results = await searchChannels(handle);
    return results.length > 0 ? results[0] : null;
  } catch {
    return null;
  }
}

function demoChannelByHandle(handle) {
  return {
    youtubeChannelId: `UC${handle.slice(0, 10)}`,
    name: handle,
    description: 'Demo channel from handle',
    thumbnailUrl: '',
    subscriberCount: '1000',
    videoCount: '100',
  };
}

function demoChannel(id) {
  return {
    youtubeChannelId: id,
    name: 'Demo Channel',
    description: 'Worker URL not configured — using demo data',
    thumbnailUrl: '',
    subscriberCount: '100000',
    videoCount: '500',
  };
}
