import { query } from "./_generated/server";
import { v } from "convex/values";

export const trending = query({
  handler: async (ctx) => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    // Only scan recent entries instead of entire table
    const recentUCs = await ctx.db.query("userChannels").order("desc").take(200);
    const recent = recentUCs.filter((uc) => uc.addedAt >= sevenDaysAgo);

    const counts: Record<string, number> = {};
    for (const uc of recent) {
      const key = uc.channelId as string;
      counts[key] = (counts[key] || 0) + 1;
    }

    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    const results = [];
    for (const [channelId, count] of sorted) {
      const ch = await ctx.db.get(channelId as any);
      if (ch) {
        results.push({ ...ch, engineerCount: count, recentAdds: count });
      }
    }
    return results;
  },
});

export const recent = query({
  handler: async (ctx) => {
    const recentUCs = await ctx.db.query("userChannels").order("desc").take(40);
    const seen = new Set<string>();
    const results = [];
    for (const uc of recentUCs) {
      const key = uc.channelId as string;
      if (seen.has(key)) continue;
      seen.add(key);
      const ch = await ctx.db.get(uc.channelId);
      if (ch) {
        results.push({ ...ch, addedByUsername: uc.username });
      }
      if (results.length >= 20) break;
    }
    return results;
  },
});

export const matchScore = query({
  args: { userIdA: v.id("users"), userIdB: v.id("users") },
  handler: async (ctx, args) => {
    const [aChannels, bChannels] = await Promise.all([
      ctx.db.query("userChannels").withIndex("by_user", (q) => q.eq("userId", args.userIdA)).collect(),
      ctx.db.query("userChannels").withIndex("by_user", (q) => q.eq("userId", args.userIdB)).collect(),
    ]);
    const aSet = new Set(aChannels.map((uc) => uc.channelId as string));
    const bSet = new Set(bChannels.map((uc) => uc.channelId as string));
    const intersection = [...aSet].filter((id) => bSet.has(id)).length;
    const union = new Set([...aSet, ...bSet]).size;
    return union === 0 ? 0 : Math.round((intersection / union) * 100);
  },
});

export const similarUsers = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const myChannels = await ctx.db
      .query("userChannels")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const mySet = new Set(myChannels.map((uc) => uc.channelId as string));
    if (mySet.size === 0) return [];

    // Build reverse index: channelId -> list of userIds who have it
    // This avoids scanning all users — only look at users who share at least one channel
    const candidateUsers = new Map<string, Set<string>>();
    for (const channelId of mySet) {
      const ucs = await ctx.db
        .query("userChannels")
        .withIndex("by_channel", (q) => q.eq("channelId", channelId as any))
        .collect();
      for (const uc of ucs) {
        if (uc.userId === args.userId) continue;
        const uid = uc.userId as string;
        if (!candidateUsers.has(uid)) candidateUsers.set(uid, new Set());
        candidateUsers.get(uid)!.add(uc.channelId as string);
      }
    }

    const scores: Array<{ userId: string; username: string; bio: string; score: number; channelCount: number }> = [];
    for (const [userId, sharedChannels] of candidateUsers) {
      const user = await ctx.db.get(userId as any);
      if (!user || user.isPublic === false) continue;
      const theirAll = await ctx.db
        .query("userChannels")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      const theirSet = new Set(theirAll.map((uc) => uc.channelId as string));
      const intersection = sharedChannels.size;
      const union = new Set([...mySet, ...theirSet]).size;
      const score = union === 0 ? 0 : Math.round((intersection / union) * 100);
      if (score > 0) {
        scores.push({
          userId: user._id,
          username: user.username,
          bio: user.bio || "",
          score,
          channelCount: theirAll.length,
        });
      }
    }
    return scores.sort((a, b) => b.score - a.score).slice(0, 10);
  },
});

export const feedFromFollowing = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const following = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", args.userId))
      .collect();
    if (following.length === 0) return [];

    // Fetch recent channels per followed user (bounded reads)
    const results = [];
    for (const f of following) {
      const ucs = await ctx.db
        .query("userChannels")
        .withIndex("by_user", (q) => q.eq("userId", f.followingId))
        .order("desc")
        .take(10);
      for (const uc of ucs) {
        const ch = await ctx.db.get(uc.channelId);
        if (ch) results.push({ ...uc, channel: ch });
      }
    }
    // Sort by addedAt descending, limit to 30
    results.sort((a, b) => b.addedAt - a.addedAt);
    return results.slice(0, 30);
  },
});

export const allPublicUsers = query({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const allUCs = await ctx.db.query("userChannels").collect();
    const countByUser: Record<string, number> = {};
    for (const uc of allUCs) {
      const uid = uc.userId as string;
      countByUser[uid] = (countByUser[uid] || 0) + 1;
    }

    const allCols = await ctx.db.query("collections").collect();
    const colCountByUser: Record<string, number> = {};
    for (const col of allCols) {
      const uid = col.userId as string;
      colCountByUser[uid] = (colCountByUser[uid] || 0) + 1;
    }

    return users
      .filter((u) => u.isPublic !== false)
      .map((u) => ({
        id: u._id,
        username: u.username,
        displayName: u.displayName || "",
        bio: u.bio || "",
        channelCount: countByUser[u._id as string] || 0,
        collectionCount: colCountByUser[u._id as string] || 0,
        createdAt: u.createdAt,
      }));
  },
});
