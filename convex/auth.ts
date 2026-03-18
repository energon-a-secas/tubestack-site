import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  hash = ((hash >>> 0) * 2654435761) >>> 0;
  return hash.toString(36);
}

export const register = mutation({
  args: { username: v.string(), password: v.string(), bio: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const username = args.username.trim().toLowerCase();
    if (username.length < 2 || username.length > 20) {
      return { ok: false, error: "Username must be 2-20 characters" };
    }
    if (!/^[a-z0-9_-]+$/.test(username)) {
      return { ok: false, error: "Username: letters, numbers, hyphens, underscores only" };
    }
    if (args.password.length < 4) {
      return { ok: false, error: "Password must be at least 4 characters" };
    }
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();
    if (existing) {
      return { ok: false, error: "Username already taken" };
    }
    const userCount = await ctx.db.query("users").collect();
    const role = userCount.length === 0 ? "admin" : "user";
    const id = await ctx.db.insert("users", {
      username,
      passwordHash: simpleHash(args.password),
      role,
      bio: args.bio?.trim() || "",
      isPublic: true,
      createdAt: Date.now(),
    });
    return { ok: true, id, username, role };
  },
});

export const login = mutation({
  args: { username: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const username = args.username.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();
    if (!user || user.passwordHash !== simpleHash(args.password)) {
      return { ok: false, error: "Invalid username or password" };
    }
    return { ok: true, id: user._id, username: user.username, role: user.role || "user" };
  },
});

export const getRole = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username.trim().toLowerCase()))
      .first();
    return user?.role || "user";
  },
});

export const setRole = mutation({
  args: { adminUsername: v.string(), targetUsername: v.string(), role: v.string() },
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.adminUsername.trim().toLowerCase()))
      .first();
    if (!admin || admin.role !== "admin") {
      return { ok: false, error: "Not authorized" };
    }
    const target = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.targetUsername.trim().toLowerCase()))
      .first();
    if (!target) {
      return { ok: false, error: "User not found" };
    }
    await ctx.db.patch(target._id, { role: args.role });
    return { ok: true };
  },
});

export const updateProfile = mutation({
  args: { username: v.string(), bio: v.optional(v.string()), isPublic: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username.trim().toLowerCase()))
      .first();
    if (!user) return { ok: false, error: "User not found" };
    const patch: Record<string, unknown> = {};
    if (args.bio !== undefined) patch.bio = args.bio.trim().slice(0, 100);
    if (args.isPublic !== undefined) patch.isPublic = args.isPublic;
    await ctx.db.patch(user._id, patch);
    return { ok: true };
  },
});

export const getUser = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username.trim().toLowerCase()))
      .first();
    if (!user) return null;
    return {
      id: user._id,
      username: user.username,
      bio: user.bio || "",
      isPublic: user.isPublic !== false,
      role: user.role || "user",
      createdAt: user.createdAt,
    };
  },
});
