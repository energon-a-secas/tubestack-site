import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const follow = mutation({
  args: {
    followerId: v.id("users"),
    followingId: v.id("users"),
    followerUsername: v.string(),
    followingUsername: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.followerId === args.followingId) {
      return { ok: false, error: "Cannot follow yourself" };
    }
    const existing = await ctx.db
      .query("follows")
      .withIndex("by_pair", (q) => q.eq("followerId", args.followerId).eq("followingId", args.followingId))
      .first();
    if (existing) return { ok: false, error: "Already following" };
    await ctx.db.insert("follows", {
      followerId: args.followerId,
      followingId: args.followingId,
      followerUsername: args.followerUsername,
      followingUsername: args.followingUsername,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const unfollow = mutation({
  args: { followerId: v.id("users"), followingId: v.id("users") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("follows")
      .withIndex("by_pair", (q) => q.eq("followerId", args.followerId).eq("followingId", args.followingId))
      .first();
    if (!existing) return { ok: false, error: "Not following" };
    await ctx.db.delete(existing._id);
    return { ok: true };
  },
});

export const getFollowers = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("follows")
      .withIndex("by_following", (q) => q.eq("followingId", args.userId))
      .collect();
  },
});

export const getFollowing = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", args.userId))
      .collect();
  },
});

export const isFollowing = query({
  args: { followerId: v.id("users"), followingId: v.id("users") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("follows")
      .withIndex("by_pair", (q) => q.eq("followerId", args.followerId).eq("followingId", args.followingId))
      .first();
    return !!existing;
  },
});

export const getCounts = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const followers = await ctx.db
      .query("follows")
      .withIndex("by_following", (q) => q.eq("followingId", args.userId))
      .collect();
    const following = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", args.userId))
      .collect();
    return { followers: followers.length, following: following.length };
  },
});
