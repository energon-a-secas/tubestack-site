import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Add a highlight to a channel
export const addHighlight = mutation({
  args: {
    channelId: v.id("channels"),
    youtubeVideoId: v.string(),
    title: v.string(),
    thumbnailUrl: v.string(),
    sharedBy: v.id("users"),
    sharedByUsername: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify channel exists
    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    // Check if highlight already exists for this channel
    const existing = await ctx.db
      .query("highlights")
      .withIndex("by_channel_video", (q) =>
        q.eq("channelId", args.channelId).eq("youtubeVideoId", args.youtubeVideoId)
      )
      .first();

    if (existing) {
      throw new Error("Highlight already exists for this channel");
    }

    const now = Date.now();
    return await ctx.db.insert("highlights", {
      channelId: args.channelId,
      youtubeVideoId: args.youtubeVideoId,
      title: args.title,
      thumbnailUrl: args.thumbnailUrl,
      sharedBy: args.sharedBy,
      sharedByUsername: args.sharedByUsername,
      createdAt: now,
    });
  },
});

// Get highlights for a channel with vote counts
export const getByChannel = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const highlights = await ctx.db
      .query("highlights")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect();

    // Get vote counts for each highlight
    const highlightsWithVotes = await Promise.all(
      highlights.map(async (highlight) => {
        const votes = await ctx.db
          .query("highlightVotes")
          .withIndex("by_highlight", (q) => q.eq("highlightId", highlight._id))
          .collect();

        const upvotes = votes.filter(v => v.direction === 1).length;
        const downvotes = votes.filter(v => v.direction === -1).length;
        const score = upvotes - downvotes;

        return {
          ...highlight,
          upvotes,
          downvotes,
          score,
        };
      })
    );

    // Sort by score (descending) then by date (newest first)
    return highlightsWithVotes.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.createdAt - a.createdAt;
    });
  },
});

// Cast a vote on a highlight
export const vote = mutation({
  args: {
    highlightId: v.id("highlights"),
    userId: v.id("users"),
    direction: v.number(),
  },
  handler: async (ctx, args) => {
    // Verify highlight exists
    const highlight = await ctx.db.get(args.highlightId);
    if (!highlight) {
      throw new Error("Highlight not found");
    }

    // Check existing vote
    const existing = await ctx.db
      .query("highlightVotes")
      .withIndex("by_highlight_user", (q) =>
        q.eq("highlightId", args.highlightId).eq("userId", args.userId)
      )
      .first();

    if (existing) {
      if (existing.direction === args.direction) {
        // Remove vote if same direction (toggle off)
        await ctx.db.delete(existing._id);
      } else {
        // Update existing vote
        await ctx.db.patch(existing._id, { direction: args.direction });
      }
    } else {
      // Create new vote
      await ctx.db.insert("highlightVotes", {
        highlightId: args.highlightId,
        userId: args.userId,
        direction: args.direction,
        createdAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// Get user's vote on a highlight
export const getUserVote = query({
  args: {
    highlightId: v.id("highlights"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const vote = await ctx.db
      .query("highlightVotes")
      .withIndex("by_highlight_user", (q) =>
        q.eq("highlightId", args.highlightId).eq("userId", args.userId)
      )
      .first();

    return vote?.direction || 0;
  },
});

// Remove a highlight (only by sharer)
export const removeHighlight = mutation({
  args: {
    highlightId: v.id("highlights"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const highlight = await ctx.db.get(args.highlightId);
    if (!highlight) {
      throw new Error("Highlight not found");
    }

    if (highlight.sharedBy !== args.userId) {
      throw new Error("Only the sharer can remove this highlight");
    }

    // Remove all votes
    const votes = await ctx.db
      .query("highlightVotes")
      .withIndex("by_highlight", (q) => q.eq("highlightId", args.highlightId))
      .collect();

    for (const vote of votes) {
      await ctx.db.delete(vote._id);
    }

    // Remove highlight
    await ctx.db.delete(args.highlightId);
    return { success: true };
  },
});
