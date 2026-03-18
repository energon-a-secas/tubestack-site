import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    userId: v.id("users"),
    username: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    channelIds: v.array(v.id("channels")),
  },
  handler: async (ctx, args) => {
    if (args.channelIds.length > 50) {
      return { ok: false, error: "Collections limited to 50 channels" };
    }
    const id = await ctx.db.insert("collections", {
      userId: args.userId,
      username: args.username,
      name: args.name.trim().slice(0, 60),
      description: args.description?.trim().slice(0, 200) || "",
      imageUrl: args.imageUrl?.trim().slice(0, 500) || "",
      channelIds: args.channelIds,
      createdAt: Date.now(),
    });
    return { ok: true, id };
  },
});

export const update = mutation({
  args: {
    id: v.id("collections"),
    userId: v.id("users"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    channelIds: v.optional(v.array(v.id("channels"))),
  },
  handler: async (ctx, args) => {
    const col = await ctx.db.get(args.id);
    if (!col || col.userId !== args.userId) return { ok: false, error: "Not authorized" };
    if (args.channelIds && args.channelIds.length > 50) {
      return { ok: false, error: "Collections limited to 50 channels" };
    }
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name.trim().slice(0, 60);
    if (args.description !== undefined) patch.description = args.description.trim().slice(0, 200);
    if (args.imageUrl !== undefined) patch.imageUrl = args.imageUrl.trim().slice(0, 500);
    if (args.channelIds !== undefined) patch.channelIds = args.channelIds;
    await ctx.db.patch(args.id, patch);
    return { ok: true };
  },
});

export const remove = mutation({
  args: { id: v.id("collections"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const col = await ctx.db.get(args.id);
    if (!col || col.userId !== args.userId) return { ok: false, error: "Not authorized" };
    await ctx.db.delete(args.id);
    return { ok: true };
  },
});

export const addChannel = mutation({
  args: { id: v.id("collections"), userId: v.id("users"), channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const col = await ctx.db.get(args.id);
    if (!col || col.userId !== args.userId) return { ok: false, error: "Not authorized" };
    if (col.channelIds.includes(args.channelId)) return { ok: false, error: "Already in collection" };
    if (col.channelIds.length >= 50) return { ok: false, error: "Collection limited to 50 channels" };
    await ctx.db.patch(args.id, { channelIds: [...col.channelIds, args.channelId] });
    return { ok: true };
  },
});

export const removeChannel = mutation({
  args: { id: v.id("collections"), userId: v.id("users"), channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const col = await ctx.db.get(args.id);
    if (!col || col.userId !== args.userId) return { ok: false, error: "Not authorized" };
    await ctx.db.patch(args.id, { channelIds: col.channelIds.filter((id) => id !== args.channelId) });
    return { ok: true };
  },
});

export const listByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("collections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const listByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("collections")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("collections") },
  handler: async (ctx, args) => {
    const col = await ctx.db.get(args.id);
    if (!col) return null;
    const channels = [];
    for (const cid of col.channelIds) {
      const ch = await ctx.db.get(cid);
      if (ch) channels.push(ch);
    }
    return { ...col, channels };
  },
});
