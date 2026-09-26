import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Channel names are written into every visitor's page. The client escapes
// them; this refuses markup where it is stored, so one missed sink cannot
// run it. In HTML a tag opens only at "<" followed by a letter, "/", "!" or
// "?", so "<3", "a < b" and & " ' > are all still accepted.
const TAG_OPEN = /<[A-Za-z!\/?]/;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;
const MAX_NAME = 200;

function cleanChannelName(raw: string): string | null {
  const name = raw.replace(CONTROL_CHARS, " ").trim();
  if (name.length > MAX_NAME || TAG_OPEN.test(name)) return null;
  return name;
}

// Channel thumbnails are shown on every visitor's cards, and refreshThumbnail
// takes no proof of who is calling. So only https images on YouTube's own
// image hosts are stored: anything else (another scheme, or a server that
// logs every visitor's IP) is refused. YouTube's API hands the Worker channel
// thumbnails on yt3.ggpht.com or yt3.googleusercontent.com.
// The authority may hold only host characters and must end at "/", so no
// "user@", port or backslash can make a browser read a different host.
const YOUTUBE_THUMB = /^https:\/\/([a-z0-9-]+\.)*(ggpht|googleusercontent|ytimg)\.com\/[^\s"'<>]*$/i;
const MAX_THUMB = 2048;

function isYoutubeThumb(raw: string): boolean {
  return raw.length <= MAX_THUMB && YOUTUBE_THUMB.test(raw);
}

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
    const name = cleanChannelName(args.name);
    if (name === null) return { ok: false, error: "Invalid channel name" };
    // A bad thumbnail does not block the channel: it is stored without one and
    // needsRefresh reports it for the next refresh.
    const thumbnailUrl = args.thumbnailUrl && isYoutubeThumb(args.thumbnailUrl) ? args.thumbnailUrl : "";
    const id = await ctx.db.insert("channels", {
      youtubeChannelId: args.youtubeChannelId,
      name,
      description: args.description || "",
      thumbnailUrl,
      subscriberCount: args.subscriberCount || "0",
      videoCount: args.videoCount || "0",
      youtubeCategory: args.youtubeCategory || "",
      addedBy: args.addedBy,
      createdAt: Date.now(),
      lastRefreshed: thumbnailUrl ? Date.now() : undefined,
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
    if (!isYoutubeThumb(args.thumbnailUrl)) return { ok: false, error: "Invalid thumbnail URL" };
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
          const name = cleanChannelName(ch.name || 'Unknown Channel');
          if (name === null) {
            results.errors.push(`Invalid channel name for ${ch.youtubeChannelId}`);
            continue;
          }
          // Create new channel with minimal data
          const channelId = await ctx.db.insert("channels", {
            youtubeChannelId: ch.youtubeChannelId,
            name: name || 'Unknown Channel',
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
