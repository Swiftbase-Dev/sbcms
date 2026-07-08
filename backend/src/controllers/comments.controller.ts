import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "swiftbase-admin-sdk";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const database = db(process.env.SWIFTBASE_DATABASE_NAME || "cms");

let VULGAR_WORDS: string[] = [];
try {
  const list = require("@dsojevic/profanity-list/src/en.json");
  VULGAR_WORDS = list
    .map((item: any) => typeof item === "string" ? item : (item.text || item.word || ""))
    .filter(Boolean);
} catch (err) {
  console.warn("Failed to load @dsojevic/profanity-list via require, using fallback:", err);
  VULGAR_WORDS = ["fuck", "shit", "asshole", "bitch", "bastard", "cunt", "dick", "pussy", "prick", "wanker"];
}

export interface Comment {
  id: string;
  projectId: string;
  postSlug: string;
  authorName: string;
  authorEmail: string;
  content: string;
  status: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  updatedAt: string;
}

export function registerCommentRoutes(app: FastifyInstance) {
  // 1. PUBLIC: GET /blog/posts/:slug/comments
  // Returns all approved comments for a post
  app.get("/blog/posts/:slug/comments", async (
    request: FastifyRequest<{ Params: { slug: string } }>,
    reply
  ) => {
    try {
      const { slug } = request.params;
      
      // Check if comments are enabled globally and post-specifically
      const settingsRes = await database("cms_settings").execute();
      const settings = settingsRes.data[0];
      const areCommentsEnabledGlobally = settings?.areCommentsEnabledGlobally !== false;

      const postRes = await database("cms_posts").where("slug", slug).execute();
      const post = postRes.data[0];
      const areCommentsEnabledOnPost = post?.areCommentsEnabled !== false;

      if (!areCommentsEnabledGlobally || !areCommentsEnabledOnPost) {
        return reply.send({ comments: [], commentsEnabled: false });
      }

      const res = await database("cms_comments")
        .where("postSlug", slug)
        .where("status", "approved")
        .execute();

      // Sort by createdAt ascending in JS for cross-db uniformity
      const comments = (res.data || []).sort((a: any, b: any) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      return reply.send({ comments, commentsEnabled: true });
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  // 2. PUBLIC: POST /blog/posts/:slug/comments
  // Submits a comment (with honeypot, rate limiting, and spam filtering)
  app.post("/blog/posts/:slug/comments", async (
    request: FastifyRequest<{
      Params: { slug: string };
      Body: { authorName: string; authorEmail: string; content: string; website?: string };
    }>,
    reply
  ) => {
    try {
      const { slug } = request.params;
      const { authorName, authorEmail, content, website } = request.body;

      if (!authorName || !authorEmail || !content) {
        return reply.status(400).send({ message: "Name, email, and comment are required." });
      }

      // Check if comments are enabled
      const settingsRes = await database("cms_settings").execute();
      const settings = settingsRes.data[0];
      const areCommentsEnabledGlobally = settings?.areCommentsEnabledGlobally !== false;

      const postRes = await database("cms_posts").where("slug", slug).execute();
      const post = postRes.data[0];
      const areCommentsEnabledOnPost = post?.areCommentsEnabled !== false;

      if (!areCommentsEnabledGlobally || !areCommentsEnabledOnPost) {
        return reply.status(403).send({ message: "Comments are disabled on this post." });
      }

      const ipAddress = request.ip || "127.0.0.1";
      const userAgent = request.headers["user-agent"] || "unknown";

      // 1. Honeypot check
      if (website && website.trim() !== "") {
        // Silent block - return successful response but mark as spam
        const fakeComment: Comment = {
          id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          projectId: "swiftbase",
          postSlug: slug,
          authorName,
          authorEmail,
          content,
          status: "spam",
          ipAddress,
          userAgent,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await database("cms_comments").insert(fakeComment).execute();
        return reply.send({ success: true, message: "Comment submitted for review." });
      }

      // 2. Rate limiting check (1 comment per 15 seconds per IP)
      const ipCommentsRes = await database("cms_comments")
        .where("ipAddress", ipAddress)
        .execute();
      
      const now = Date.now();
      const recentComment = (ipCommentsRes.data || []).find((c: any) => {
        const diff = now - new Date(c.createdAt).getTime();
        return diff < 15 * 1000;
      });

      if (recentComment) {
        return reply.status(429).send({ message: "You are posting comments too quickly. Please wait 15 seconds." });
      }

      // 2.5 Vulgarity check
      const hasVulgarity = VULGAR_WORDS.some((word) => {
        const regex = new RegExp(`\\b${word}\\b`, "i");
        return regex.test(content) || regex.test(authorName);
      });

      if (hasVulgarity) {
        return reply.status(400).send({ message: "Comment blocked: Offensive or vulgar language is not permitted." });
      }

      // 3. Spam filtering
      let status = "approved";
      const spamWords = ["viagra", "cialis", "casino", "poker", "slot-machine", "slots", "buy-now", "discount", "free-money"];
      const lowercaseContent = content.toLowerCase();
      const hasSpamWord = spamWords.some(word => lowercaseContent.includes(word));
      const linkCount = (content.match(/https?:\/\//g) || []).length;

      if (hasSpamWord || linkCount > 2) {
        status = "spam";
      }

      const newComment: Comment = {
        id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        projectId: "swiftbase",
        postSlug: slug,
        authorName,
        authorEmail,
        content,
        status,
        ipAddress,
        userAgent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await database("cms_comments").insert(newComment).execute();

      return reply.send({
        success: true,
        message: status === "approved" ? "Comment published." : "Comment submitted for review.",
        comment: status === "approved" ? newComment : null
      });
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  // 3. ADMIN: GET /comments
  // Lists all comments for moderation
  app.get("/comments", async (request, reply) => {
    try {
      const res = await database("cms_comments").execute();
      const comments = (res.data || []).sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return reply.send(comments);
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  // 4. ADMIN: PUT /comments/:id
  // Updates a comment status (approve, spam)
  app.put("/comments/:id", async (
    request: FastifyRequest<{ Params: { id: string }; Body: { status: "approved" | "spam" } }>,
    reply
  ) => {
    try {
      const { id } = request.params;
      const { status } = request.body;

      if (status !== "approved" && status !== "spam") {
        return reply.status(400).send({ message: "Invalid status" });
      }

      const checkRes = await database("cms_comments").where("id", id).execute();
      const existing = checkRes.data[0];
      if (!existing) {
        return reply.status(404).send({ message: "Comment not found" });
      }

      const updated = {
        ...existing,
        status,
        updatedAt: new Date().toISOString()
      };

      await database("cms_comments").where("id", id).update(updated).execute();
      return reply.send({ success: true, comment: updated });
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  // 5. ADMIN: DELETE /comments/:id
  // Deletes a comment
  app.delete("/comments/:id", async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply
  ) => {
    try {
      const { id } = request.params;
      const checkRes = await database("cms_comments").where("id", id).execute();
      if (!checkRes.data[0]) {
        return reply.status(404).send({ message: "Comment not found" });
      }

      await database("cms_comments").where("id", id).delete().execute();
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });
}
