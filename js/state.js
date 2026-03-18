// ── Shared mutable state + Convex client ─────────────────────────────
import { ConvexHttpClient } from "https://esm.sh/convex@1.21.0/browser";

// ── Convex client ────────────────────────────────────────────────────
const CONVEX_URL = "https://brave-lion-580.convex.cloud";
export let convex = null;

export function initConvex() {
  if (CONVEX_URL.startsWith("REPLACE")) return;
  convex = new ConvexHttpClient(CONVEX_URL);
}

// Function references (strings — no build step needed)
export const api = {
  auth: {
    register: "auth:register",
    login: "auth:login",
    getRole: "auth:getRole",
    setRole: "auth:setRole",
    updateProfile: "auth:updateProfile",
    getUser: "auth:getUser",
  },
  channels: {
    addChannel: "channels:addChannel",
    getByYoutubeId: "channels:getByYoutubeId",
    get: "channels:get",
    refreshThumbnail: "channels:refreshThumbnail",
  },
  userChannels: {
    add: "userChannels:add",
    remove: "userChannels:remove",
    update: "userChannels:update",
    listByUser: "userChannels:listByUser",
    listByChannel: "userChannels:listByChannel",
    listByUsername: "userChannels:listByUsername",
  },
  collections: {
    create: "collections:create",
    update: "collections:update",
    remove: "collections:remove",
    addChannel: "collections:addChannel",
    removeChannel: "collections:removeChannel",
    listByUser: "collections:listByUser",
    listByUsername: "collections:listByUsername",
    get: "collections:get",
  },
  follows: {
    follow: "follows:follow",
    unfollow: "follows:unfollow",
    getFollowers: "follows:getFollowers",
    getFollowing: "follows:getFollowing",
    isFollowing: "follows:isFollowing",
    getCounts: "follows:getCounts",
  },
  recommendations: {
    send: "recommendations:send",
    listForUser: "recommendations:listForUser",
    markSeen: "recommendations:markSeen",
    unseenCount: "recommendations:unseenCount",
  },
  discovery: {
    trending: "discovery:trending",
    recent: "discovery:recent",
    matchScore: "discovery:matchScore",
    similarUsers: "discovery:similarUsers",
    feedFromFollowing: "discovery:feedFromFollowing",
    allPublicUsers: "discovery:allPublicUsers",
  },
};

// ── Visitor ID ───────────────────────────────────────────────────────
function getVisitorId() {
  let id = localStorage.getItem('tubestack-visitor');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('tubestack-visitor', id);
  }
  return id;
}
export const visitorId = getVisitorId();

// ── Auth state (persisted in localStorage) ───────────────────────────
export function getLoggedInUser() {
  try {
    const raw = localStorage.getItem('tubestack-user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function setLoggedInUser(user) {
  if (user) localStorage.setItem('tubestack-user', JSON.stringify(user));
  else localStorage.removeItem('tubestack-user');
}
export function getUserRole() {
  return localStorage.getItem('tubestack-role') || 'user';
}
export function setUserRole(role) {
  if (role && role !== 'user') localStorage.setItem('tubestack-role', role);
  else localStorage.removeItem('tubestack-role');
}

// ── Mutable application state ────────────────────────────────────────
export const state = {
  view: 'feed',           // 'feed' | 'explore' | 'stack' | 'user' | 'collection'
  viewParam: null,        // username or collection id
  myChannels: [],         // userChannels with channel data
  myCollections: [],
  trending: [],
  recentChannels: [],
  similarUsers: [],
  followingFeed: [],
  recommendations: [],
  unseenRecCount: 0,
  publicUsers: [],
  profileUser: null,
  profileChannels: [],
  profileCollections: [],
  collectionDetail: null,
  searchResults: [],
  loading: false,
};

// ── Categories ───────────────────────────────────────────────────────
export const CATEGORIES = [
  'Programming', 'Web Dev', 'Mobile', 'DevOps', 'Cloud',
  'AI/ML', 'Data Science', 'Security', 'System Design', 'Databases',
  'Linux', 'Open Source', 'Networking', 'Embedded', 'Game Dev',
  'Career', 'Tech News', 'Tutorials', 'Live Coding', 'Code Review',
  'Interviews', 'Productivity', 'Design', 'Gaming', 'Science',
  'Math', 'Hardware', 'Startups', 'Finance', 'Music', 'Humor', 'Other',
];
