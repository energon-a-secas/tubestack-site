import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const add = mutation({
  args: {
    userId: v.id("users"),
    channelId: v.id("channels"),
    username: v.string(),
    categories: v.array(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userChannels")
      .withIndex("by_user_channel", (q) => q.eq("userId", args.userId).eq("channelId", args.channelId))
      .first();
    if (existing) return { ok: false, error: "Channel already in your stack" };
    await ctx.db.insert("userChannels", {
      userId: args.userId,
      channelId: args.channelId,
      username: args.username,
      categories: args.categories,
      note: args.note || "",
      addedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const remove = mutation({
  args: { userId: v.id("users"), channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const uc = await ctx.db
      .query("userChannels")
      .withIndex("by_user_channel", (q) => q.eq("userId", args.userId).eq("channelId", args.channelId))
      .first();
    if (!uc) return { ok: false, error: "Not in your stack" };
    await ctx.db.delete(uc._id);
    return { ok: true };
  },
});

export const update = mutation({
  args: {
    userId: v.id("users"),
    channelId: v.id("channels"),
    categories: v.optional(v.array(v.string())),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const uc = await ctx.db
      .query("userChannels")
      .withIndex("by_user_channel", (q) => q.eq("userId", args.userId).eq("channelId", args.channelId))
      .first();
    if (!uc) return { ok: false, error: "Not in your stack" };
    const patch: Record<string, unknown> = {};
    if (args.categories !== undefined) patch.categories = args.categories;
    if (args.note !== undefined) patch.note = args.note;
    await ctx.db.patch(uc._id, patch);
    return { ok: true };
  },
});

export const listByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const ucs = await ctx.db
      .query("userChannels")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const results = [];
    for (const uc of ucs) {
      const ch = await ctx.db.get(uc.channelId);
      if (ch) results.push({ ...uc, channel: ch });
    }
    return results;
  },
});

export const listByChannel = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userChannels")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect();
  },
});

export const listByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const ucs = await ctx.db
      .query("userChannels")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .collect();
    const results = [];
    for (const uc of ucs) {
      const ch = await ctx.db.get(uc.channelId);
      if (ch) results.push({ ...uc, channel: ch });
    }
    return results;
  },
});
