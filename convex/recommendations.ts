import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const send = mutation({
  args: {
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    channelId: v.id("channels"),
    fromUsername: v.string(),
    toUsername: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const unseen = await ctx.db
      .query("recommendations")
      .withIndex("by_recipient", (q) => q.eq("toUserId", args.toUserId))
      .filter((q) => q.eq(q.field("seen"), false))
      .collect();
    if (unseen.length >= 10) {
      return { ok: false, error: "Recipient has too many unseen recommendations" };
    }
    await ctx.db.insert("recommendations", {
      fromUserId: args.fromUserId,
      toUserId: args.toUserId,
      channelId: args.channelId,
      fromUsername: args.fromUsername,
      toUsername: args.toUsername,
      message: args.message?.trim().slice(0, 200) || "",
      seen: false,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const listForUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const recs = await ctx.db
      .query("recommendations")
      .withIndex("by_recipient", (q) => q.eq("toUserId", args.userId))
      .order("desc")
      .collect();
    const results = [];
    for (const rec of recs) {
      const ch = await ctx.db.get(rec.channelId);
      if (ch) results.push({ ...rec, channel: ch });
    }
    return results;
  },
});

export const markSeen = mutation({
  args: { id: v.id("recommendations"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const rec = await ctx.db.get(args.id);
    if (!rec || rec.toUserId !== args.userId) return { ok: false };
    await ctx.db.patch(args.id, { seen: true });
    return { ok: true };
  },
});

export const unseenCount = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const unseen = await ctx.db
      .query("recommendations")
      .withIndex("by_recipient", (q) => q.eq("toUserId", args.userId))
      .filter((q) => q.eq(q.field("seen"), false))
      .collect();
    return unseen.length;
  },
});
