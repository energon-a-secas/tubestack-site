const YT_BASE = 'https://www.googleapis.com/youtube/v3';

const ALLOWED_ORIGINS = [
  'https://tubestack.neorgon.com',
  'http://localhost:8827',
];

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405, headers: corsHeaders(request),
      });
    }

    const origin = request.headers.get('Origin') || '';
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
          status: 400, headers: corsHeaders(request),
        });
      }

      if (path === '/search') {
        const results = await searchChannels(body.q, env);
        return new Response(JSON.stringify(results), { headers: corsHeaders(request) });
      }

      if (path === '/channel') {
        const result = await getChannel(body.id, env);
        return new Response(JSON.stringify(result), { headers: corsHeaders(request) });
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404, headers: corsHeaders(request),
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Upstream error' }), {
        status: 502, headers: corsHeaders(request),
      });
    }
  },
};

function normalizeThumb(url) {
  if (!url) return '';
  if (url.includes('ggpht.com')) return url.replace(/=s\d+/, '=s240');
  return url;
}

async function searchChannels(query, env) {
  if (!query || query.length < 2) return [];
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'channel',
    q: query,
    maxResults: '5',
    key: env.YOUTUBE_API_KEY,
  });
  const res = await fetch(`${YT_BASE}/search?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map((item) => {
    // Get best available thumbnail and upscale if possible
    let thumb = item.snippet?.thumbnails?.high?.url
      || item.snippet?.thumbnails?.medium?.url
      || item.snippet?.thumbnails?.default?.url || '';
    thumb = normalizeThumb(thumb);
    return {
      youtubeChannelId: item.id?.channelId || item.snippet?.channelId || '',
      name: item.snippet?.title || item.snippet?.channelTitle || '',
      description: item.snippet?.description || '',
      thumbnailUrl: thumb,
    };
  });
}

// YouTube category IDs → human-readable labels
const YT_CATEGORIES = {
  '1': 'Film & Animation', '2': 'Autos & Vehicles', '10': 'Music',
  '15': 'Pets & Animals', '17': 'Sports', '18': 'Short Movies',
  '19': 'Travel & Events', '20': 'Gaming', '21': 'Videoblogging',
  '22': 'People & Blogs', '23': 'Comedy', '24': 'Entertainment',
  '25': 'News & Politics', '26': 'Howto & Style', '27': 'Education',
  '28': 'Science & Technology', '29': 'Nonprofits & Activism',
  '30': 'Movies', '43': 'Shows',
};

async function getChannel(channelId, env) {
  if (!channelId) return null;
  const params = new URLSearchParams({
    part: 'snippet,statistics,topicDetails',
    id: channelId,
    key: env.YOUTUBE_API_KEY,
  });
  const res = await fetch(`${YT_BASE}/channels?${params}`);
  if (!res.ok) return null;
  const data = await res.json();
  const ch = data.items?.[0];
  if (!ch) return null;

  // Derive category from topic categories or fall back to snippet
  let category = '';
  const topics = ch.topicDetails?.topicCategories || [];
  if (topics.length > 0) {
    // Wikipedia URLs like "https://en.wikipedia.org/wiki/Technology"
    category = topics.map(t => t.split('/').pop().replace(/_/g, ' ')).join(', ');
  }

  return {
    youtubeChannelId: ch.id,
    name: ch.snippet.title,
    description: ch.snippet.description,
    thumbnailUrl: normalizeThumb(ch.snippet.thumbnails?.high?.url || ch.snippet.thumbnails?.medium?.url || ch.snippet.thumbnails?.default?.url || ''),
    subscriberCount: ch.statistics.subscriberCount || '0',
    videoCount: ch.statistics.videoCount || '0',
    youtubeCategory: category,
  };
}
