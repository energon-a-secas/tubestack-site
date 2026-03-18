import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const addChannel = mutation({
  args: {
    youtubeChannelId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    subscriberCount: v.optional(v.string()),
    videoCount: v.optional(v.string()),
    youtubeCategory: v.optional(v.string()),
    addedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("channels")
      .withIndex("by_youtube_id", (q) => q.eq("youtubeChannelId", args.youtubeChannelId))
      .first();
    if (existing) return { ok: true, id: existing._id, existed: true };
    const id = await ctx.db.insert("channels", {
      youtubeChannelId: args.youtubeChannelId,
      name: args.name,
      description: args.description || "",
      thumbnailUrl: args.thumbnailUrl || "",
      subscriberCount: args.subscriberCount || "0",
      videoCount: args.videoCount || "0",
      youtubeCategory: args.youtubeCategory || "",
      addedBy: args.addedBy,
      createdAt: Date.now(),
    });
    return { ok: true, id, existed: false };
  },
});

export const refreshThumbnail = mutation({
  args: {
    id: v.id("channels"),
    thumbnailUrl: v.string(),
    subscriberCount: v.optional(v.string()),
    videoCount: v.optional(v.string()),
    youtubeCategory: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ch = await ctx.db.get(args.id);
    if (!ch) return { ok: false, error: "Channel not found" };
    const patch: Record<string, unknown> = { thumbnailUrl: args.thumbnailUrl };
    if (args.subscriberCount) patch.subscriberCount = args.subscriberCount;
    if (args.videoCount) patch.videoCount = args.videoCount;
    if (args.youtubeCategory) patch.youtubeCategory = args.youtubeCategory;
    await ctx.db.patch(args.id, patch);
    return { ok: true };
  },
});

export const getByYoutubeId = query({
  args: { youtubeChannelId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("channels")
      .withIndex("by_youtube_id", (q) => q.eq("youtubeChannelId", args.youtubeChannelId))
      .first();
  },
});

export const get = query({
  args: { id: v.id("channels") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
