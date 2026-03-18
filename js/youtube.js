// ── YouTube Worker proxy calls ───────────────────────────────

const WORKER_URL = 'https://tubestack-api.neorgon.workers.dev';

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
  try {
    const res = await fetch(`${WORKER_URL}/channel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: channelId }),
    });
    if (!res.ok) return null;
    return await res.json();
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
