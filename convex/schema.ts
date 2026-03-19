import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    username: v.string(),
    passwordHash: v.string(),
    role: v.optional(v.string()),
    bio: v.optional(v.string()),
    displayName: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    createdAt: v.number(),
  }).index("by_username", ["username"]),

  channels: defineTable({
    youtubeChannelId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    subscriberCount: v.optional(v.string()),
    videoCount: v.optional(v.string()),
    youtubeCategory: v.optional(v.string()),
    addedBy: v.string(),
    createdAt: v.number(),
    lastRefreshed: v.optional(v.number()),
  }).index("by_youtube_id", ["youtubeChannelId"]),

  userChannels: defineTable({
    userId: v.id("users"),
    channelId: v.id("channels"),
    username: v.string(),
    categories: v.array(v.string()),
    note: v.optional(v.string()),
    addedAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_channel", ["channelId"])
    .index("by_user_channel", ["userId", "channelId"])
    .index("by_username", ["username"]),

  collections: defineTable({
    userId: v.id("users"),
    username: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    channelIds: v.array(v.id("channels")),
    createdAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_username", ["username"]),

  follows: defineTable({
    followerId: v.id("users"),
    followingId: v.id("users"),
    followerUsername: v.string(),
    followingUsername: v.string(),
    createdAt: v.number(),
  }).index("by_follower", ["followerId"])
    .index("by_following", ["followingId"])
    .index("by_pair", ["followerId", "followingId"]),

  recommendations: defineTable({
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    channelId: v.id("channels"),
    fromUsername: v.string(),
    toUsername: v.string(),
    message: v.optional(v.string()),
    seen: v.boolean(),
    createdAt: v.number(),
  }).index("by_recipient", ["toUserId"])
    .index("by_sender", ["fromUserId"]),

  highlights: defineTable({
    channelId: v.id("channels"),
    youtubeVideoId: v.string(),
    title: v.string(),
    thumbnailUrl: v.string(),
    sharedBy: v.id("users"),
    sharedByUsername: v.string(),
    createdAt: v.number(),
  }).index("by_channel", ["channelId"])
    .index("by_user", ["sharedBy"])
    .index("by_channel_video", ["channelId", "youtubeVideoId"]),

  highlightVotes: defineTable({
    highlightId: v.id("highlights"),
    userId: v.id("users"),
    direction: v.number(), // +1 for upvote, -1 for downvote
    createdAt: v.number(),
  }).index("by_highlight", ["highlightId"])
    .index("by_user", ["userId"])
    .index("by_highlight_user", ["highlightId", "userId"]),
});
