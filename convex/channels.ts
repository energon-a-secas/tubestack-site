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
      lastRefreshed: args.thumbnailUrl ? Date.now() : undefined,
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
    const patch: Record<string, unknown> = {
      thumbnailUrl: args.thumbnailUrl,
      lastRefreshed: Date.now()
    };
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

export const needsRefresh = query({
  args: { youtubeChannelId: v.string() },
  handler: async (ctx, args) => {
    const channel = await ctx.db
      .query("channels")
      .withIndex("by_youtube_id", (q) => q.eq("youtubeChannelId", args.youtubeChannelId))
      .first();

    if (!channel) return { needsRefresh: true, reason: "not_found" };
    if (!channel.lastRefreshed) return { needsRefresh: true, reason: "never_refreshed" };
    if (!channel.thumbnailUrl) return { needsRefresh: true, reason: "no_thumbnail" };

    const daysSinceRefresh = (Date.now() - channel.lastRefreshed) / (24 * 60 * 60 * 1000);
    const isStale = daysSinceRefresh > 7;

    return {
      needsRefresh: isStale,
      reason: isStale ? "stale" : "fresh",
      daysSinceRefresh: Math.floor(daysSinceRefresh),
      lastRefreshed: channel.lastRefreshed,
    };
  },
});

// Bulk import channels for a user
export const bulkImport = mutation({
  args: {
    userId: v.id("users"),
    username: v.string(),
    channels: v.array(v.object({
      youtubeChannelId: v.string(),
      name: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const ch of args.channels) {
      try {
        // Check if channel exists
        let channel = await ctx.db
          .query("channels")
          .withIndex("by_youtube_id", (q) =>
            q.eq("youtubeChannelId", ch.youtubeChannelId))
          .first();

        if (!channel) {
          // Create new channel with minimal data
          const channelId = await ctx.db.insert("channels", {
            youtubeChannelId: ch.youtubeChannelId,
            name: ch.name || 'Unknown Channel',
            description: '',
            thumbnailUrl: '',
            subscriberCount: '0',
            videoCount: '0',
            youtubeCategory: '',
            addedBy: args.username,
            createdAt: Date.now(),
            lastRefreshed: undefined,
          });
          channel = await ctx.db.get(channelId);
        }

        if (!channel) {
          results.errors.push(`Failed to create channel: ${ch.name}`);
          continue;
        }

        // Check if user already has this channel
        const existingLink = await ctx.db
          .query("userChannels")
          .withIndex("by_user_channel", (q) =>
            q.eq("userId", args.userId).eq("channelId", channel._id)
          )
          .first();

        if (existingLink) {
          results.skipped++;
          continue;
        }

        // Add to user's stack
        await ctx.db.insert("userChannels", {
          userId: args.userId,
          channelId: channel._id,
          username: args.username,
          categories: [],
          note: '',
          addedAt: Date.now(),
        });

        results.imported++;
      } catch (error: any) {
        results.errors.push(`Error importing ${ch.name}: ${error.message}`);
      }
    }

    return results;
  },
});
