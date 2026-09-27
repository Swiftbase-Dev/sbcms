import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import crypto from "crypto";
import { db, Storage } from "swiftbase-admin-sdk";
import type { EbookFile, EbookDistribution, EbookFormat } from "swiftbase-cms-shared";
import { sendPostmarkEmail, formatFreeEbookNotificationEmail } from "./email.helper.js";

function getDb() {
  const dbName = process.env.SWIFTBASE_DATABASE_NAME || "cms";
  return db(dbName);
}

function getStorageInstance() {
  const bucket = process.env.SWIFTBASE_STORAGE_BUCKET || "swiftbase-cms-storage";
  const endpoint = `${(process.env.SWIFTBASE_URL || process.env.SWIFTBASE_API_URL || "https://api.swiftbase.io").replace(/\/$/, "")}/storage`;
  return new Storage({ bucket, endpoint });
}


function generateRandomCode(prefix = "READ"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let part1 = "";
  let part2 = "";
  for (let i = 0; i < 4; i++) {
    part1 += chars.charAt(Math.floor(Math.random() * chars.length));
    part2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${part1}-${part2}`;
}

export function registerEbookRoutes(app: FastifyInstance) {
  // ==========================================
  // 1. E-BOOK FILES MANAGEMENT
  // ==========================================

  // List files for a specific product
  app.get("/ebooks/files/:productId", async (
    request: FastifyRequest<{ Params: { productId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { productId } = request.params;
      const database = getDb();
      const res = await database("cms_ebook_files").where({ productId }).execute();
      return reply.send(res.data || []);
    } catch (err: any) {
      request.log.error(err, "Failed to list ebook files");
      return reply.status(500).send({ message: err.message || "Failed to list ebook files" });
    }
  });

  // Upload a format file (EPUB, PDF, MOBI, etc.)
  app.post("/ebooks/files/:productId", async (
    request: FastifyRequest<{
      Params: { productId: string };
      Body: {
        format: EbookFormat;
        fileName: string;
        base64: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { productId } = request.params;
      const { format, fileName, base64 } = request.body || {};

      if (!format || !fileName || !base64) {
        return reply.status(400).send({ message: "format, fileName, and base64 content are required" });
      }

      const validFormats: EbookFormat[] = ["epub", "pdf", "mobi", "azw3"];
      if (!validFormats.includes(format)) {
        return reply.status(400).send({ message: `Invalid format. Supported: ${validFormats.join(", ")}` });
      }

      const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const storageKey = `ebooks/${productId}/${format}/${safeName}`;
      const buffer = Buffer.from(base64, "base64");

      const contentType =
        format === "epub" ? "application/epub+zip" :
        format === "pdf" ? "application/pdf" :
        format === "mobi" ? "application/x-mobipocket-ebook" :
        "application/octet-stream";

      const storage = getStorageInstance();
      await storage.putObject(storageKey, buffer, { contentType });

      const fileId = `ebf-${crypto.randomUUID()}`;
      const database = getDb();
      const fileRecord = {
        id: fileId,
        productId,
        format,
        fileUrl: storageKey,
        fileName: safeName,
        fileSizeBytes: buffer.length,
        createdAt: new Date().toISOString(),
      };

      await database("cms_ebook_files").insert(fileRecord).execute();

      return reply.send({ success: true, file: fileRecord });
    } catch (err: any) {
      request.log.error(err, "Failed to upload ebook file");
      return reply.status(500).send({ message: err.message || "Failed to upload ebook file" });
    }
  });

  // Delete an e-book file
  app.delete("/ebooks/files/:fileId", async (
    request: FastifyRequest<{ Params: { fileId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { fileId } = request.params;
      const database = getDb();
      const existingRes = await database("cms_ebook_files").where({ id: fileId }).execute();
      const file = existingRes.data && existingRes.data[0];

      if (!file) {
        return reply.status(404).send({ message: "File not found" });
      }

      const storage = getStorageInstance();
      await storage.deleteObject(file.fileUrl).catch(() => {});
      await database("cms_ebook_files").where({ id: fileId }).delete().execute();

      return reply.send({ success: true, fileId });
    } catch (err: any) {
      request.log.error(err, "Failed to delete ebook file");
      return reply.status(500).send({ message: err.message || "Failed to delete ebook file" });
    }
  });

  // ==========================================
  // 2. FREE COPIES DISPATCHER
  // ==========================================

  app.post("/ebooks/free-copy", async (
    request: FastifyRequest<{
      Body: {
        productId: string;
        recipientName: string;
        recipientEmail: string;
        message?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { productId, recipientName, recipientEmail, message } = request.body || {};
      if (!productId || !recipientEmail) {
        return reply.status(400).send({ message: "productId and recipientEmail are required" });
      }

      const database = getDb();
      const prodRes = await database("cms_products").where({ id: productId }).execute();
      const product = prodRes.data && prodRes.data[0];
      const bookTitle = product ? product.name : "Your E-book";

      const token = `sb-free-${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      const distRecord = {
        id: `dist-${crypto.randomUUID()}`,
        token,
        type: "free_copy",
        productId,
        productTitle: bookTitle,
        recipientName: recipientName || "Reader",
        recipientEmail: recipientEmail.trim(),
        message: message || "",
        maxDownloads: 5,
        downloadCount: 0,
        isRedeemed: true,
        redeemedAt: now,
        createdAt: now,
      };

      await database("cms_ebook_distributions").insert(distRecord).execute();

      // Retrieve settings for site title & Postmark credentials
      const setRes = await database("cms_settings").execute();
      const settings = setRes.data && setRes.data[0] ? setRes.data[0] : {};
      const siteTitle = settings.siteTitle || "SBCMS Store";

      const origin = request.headers.origin || `https://${request.hostname}`;
      const downloadUrl = `${origin}/download/${token}`;

      let emailResult: any = { success: false, note: "Postmark not configured" };
      if (settings.postmarkApiToken && settings.postmarkFromEmail) {
        const { subject, htmlBody } = formatFreeEbookNotificationEmail({
          siteTitle,
          recipientName,
          bookTitle,
          downloadUrl,
          message,
        });

        emailResult = await sendPostmarkEmail({
          apiToken: settings.postmarkApiToken,
          from: settings.postmarkFromEmail,
          to: recipientEmail,
          subject,
          htmlBody,
        });
      }

      return reply.send({
        success: true,
        distribution: distRecord,
        downloadUrl,
        emailSent: emailResult.success,
        emailMessage: emailResult.error || undefined,
      });
    } catch (err: any) {
      request.log.error(err, "Failed to send free copy");
      return reply.status(500).send({ message: err.message || "Failed to send free copy" });
    }
  });

  app.get("/ebooks/free-copies", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const database = getDb();
      const res = await database("cms_ebook_distributions").where({ type: "free_copy" }).execute();
      const list = (res.data || []).sort((a: any, b: any) => {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
      return reply.send(list);
    } catch (err: any) {
      request.log.error(err, "Failed to list free copies");
      return reply.status(500).send({ message: err.message || "Failed to list free copies" });
    }
  });

  // ==========================================
  // 3. SINGLE-USE OFFLINE HANDOUT CARDS
  // ==========================================

  app.post("/ebooks/cards/generate", async (
    request: FastifyRequest<{
      Body: {
        productId: string;
        count?: number;
        prefix?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { productId, count = 1, prefix = "BOOK" } = request.body || {};
      if (!productId) {
        return reply.status(400).send({ message: "productId is required" });
      }

      const database = getDb();
      const prodRes = await database("cms_products").where({ id: productId }).execute();
      const product = prodRes.data && prodRes.data[0];
      const productTitle = product ? product.name : "Exclusive E-book";

      const cards: any[] = [];
      const now = new Date().toISOString();
      const cardCount = Math.min(Math.max(1, count), 100);

      for (let i = 0; i < cardCount; i++) {
        const code = generateRandomCode(prefix.toUpperCase());
        const token = `sb-card-${crypto.randomUUID()}`;
        const cardRecord = {
          id: `dist-card-${crypto.randomUUID()}`,
          token,
          type: "offline_card",
          code,
          productId,
          productTitle,
          maxDownloads: 1, // Single-use!
          downloadCount: 0,
          isRedeemed: false,
          createdAt: now,
        };
        await database("cms_ebook_distributions").insert(cardRecord).execute();
        cards.push(cardRecord);
      }

      return reply.send({ success: true, count: cards.length, cards });
    } catch (err: any) {
      request.log.error(err, "Failed to generate download cards");
      return reply.status(500).send({ message: err.message || "Failed to generate download cards" });
    }
  });

  app.get("/ebooks/cards", async (
    request: FastifyRequest<{ Querystring: { productId?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { productId } = request.query || {};
      const database = getDb();
      let query = database("cms_ebook_distributions").where({ type: "offline_card" });
      if (productId) {
        query = query.where({ productId });
      }
      const res = await query.execute();
      const list = (res.data || []).sort((a: any, b: any) => {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
      return reply.send(list);
    } catch (err: any) {
      request.log.error(err, "Failed to list cards");
      return reply.status(500).send({ message: err.message || "Failed to list cards" });
    }
  });

  app.post("/ebooks/cards/redeem", async (
    request: FastifyRequest<{ Body: { code: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { code } = request.body || {};
      if (!code || typeof code !== "string") {
        return reply.status(400).send({ message: "Download code is required" });
      }

      const formattedCode = code.trim().toUpperCase();
      const database = getDb();
      const res = await database("cms_ebook_distributions").where({ code: formattedCode }).execute();
      const card = res.data && res.data[0];

      if (!card) {
        return reply.status(404).send({ message: "Invalid download code. Please check the code and try again." });
      }

      if (card.isRedeemed && card.downloadCount >= card.maxDownloads) {
        return reply.status(410).send({ message: "This download code has already been redeemed and reached its download limit." });
      }

      const now = new Date().toISOString();
      await database("cms_ebook_distributions").where({ id: card.id }).update({
        isRedeemed: true,
        redeemedAt: card.redeemedAt || now,
      }).execute();

      return reply.send({
        success: true,
        token: card.token,
        productId: card.productId,
        productTitle: card.productTitle,
      });
    } catch (err: any) {
      request.log.error(err, "Failed to redeem card code");
      return reply.status(500).send({ message: err.message || "Failed to redeem code" });
    }
  });

  // ==========================================
  // 4. CUSTOMER DOWNLOAD HUB & FILE STREAMING
  // ==========================================

  app.get("/ebooks/download/:token", async (
    request: FastifyRequest<{ Params: { token: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { token } = request.params;
      const database = getDb();
      const distRes = await database("cms_ebook_distributions").where({ token }).execute();
      const dist = distRes.data && distRes.data[0];

      if (!dist) {
        return reply.status(404).send({ message: "Download link not found or invalid." });
      }

      if (dist.downloadCount >= dist.maxDownloads) {
        return reply.status(410).send({
          message: "Download limit exceeded. You have already reached the maximum downloads allowed for this link.",
          downloadCount: dist.downloadCount,
          maxDownloads: dist.maxDownloads,
        });
      }

      // Fetch product and available formats
      const prodRes = await database("cms_products").where({ id: dist.productId }).execute();
      const product = prodRes.data && prodRes.data[0];

      const filesRes = await database("cms_ebook_files").where({ productId: dist.productId }).execute();
      const files = filesRes.data || [];

      return reply.send({
        distribution: {
          id: dist.id,
          token: dist.token,
          type: dist.type,
          recipientName: dist.recipientName,
          productTitle: dist.productTitle || (product ? product.name : "Your E-book"),
          downloadCount: dist.downloadCount,
          maxDownloads: dist.maxDownloads,
        },
        product: product ? {
          id: product.id,
          name: product.name,
          description: product.description,
          images: typeof product.images === "string" ? JSON.parse(product.images || "[]") : (product.images || []),
        } : null,
        files: files.map((f: any) => ({
          id: f.id,
          format: f.format,
          fileName: f.fileName,
          fileSizeBytes: f.fileSizeBytes,
        })),
        deviceGuides: [
          {
            id: "kindle",
            title: "Amazon Kindle",
            icon: "tablet-screen-button",
            format: "EPUB / MOBI",
            steps: [
              "Send to Kindle via Web: Visit amazon.com/sendtokindle and drag & drop the EPUB file directly into your browser.",
              "Send to Kindle via Email: Email the file as an attachment to your unique @kindle.com email address.",
              "Kindle App: Open the downloaded file using the Kindle app on iOS or Android.",
            ],
          },
          {
            id: "apple",
            title: "Apple Books (iPhone / iPad / Mac)",
            icon: "book-open",
            format: "EPUB",
            steps: [
              "Download the EPUB file on your iPhone, iPad, or Mac.",
              "Tap the downloaded file and choose 'Open in Books'.",
              "The e-book will automatically sync across all your Apple devices via iCloud.",
            ],
          },
          {
            id: "kobo-android",
            title: "Kobo, Nook & Android",
            icon: "mobile-screen",
            format: "EPUB",
            steps: [
              "Android: Open with Google Play Books, Moon+ Reader, or your preferred e-reader app.",
              "Kobo / Nook: Connect your e-reader to your computer via USB and copy the EPUB file to the device root or 'books' directory.",
            ],
          },
          {
            id: "pdf",
            title: "PDF / PC & Print",
            icon: "file-pdf",
            format: "PDF",
            steps: [
              "Download the PDF format.",
              "Open in Adobe Acrobat, Apple Preview, or any web browser for reading or printing.",
            ],
          },
        ],
      });
    } catch (err: any) {
      request.log.error(err, "Failed to load download hub");
      return reply.status(500).send({ message: err.message || "Failed to load download details" });
    }
  });

  // Download specific file by fileId using the valid download token
  app.get("/ebooks/download/:token/file/:fileId", async (
    request: FastifyRequest<{ Params: { token: string; fileId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { token, fileId } = request.params;
      const database = getDb();

      // Check distribution validity
      const distRes = await database("cms_ebook_distributions").where({ token }).execute();
      const dist = distRes.data && distRes.data[0];

      if (!dist) {
        return reply.status(404).send({ message: "Invalid download link." });
      }

      if (dist.downloadCount >= dist.maxDownloads) {
        return reply.status(410).send({ message: "Download limit reached." });
      }

      // Check file exists
      const fileRes = await database("cms_ebook_files").where({ id: fileId, productId: dist.productId }).execute();
      const file = fileRes.data && fileRes.data[0];

      if (!file) {
        return reply.status(404).send({ message: "Requested file not found for this book." });
      }

      // Increment download counter
      await database("cms_ebook_distributions").where({ id: dist.id }).update({
        downloadCount: (dist.downloadCount || 0) + 1,
      }).execute();

      // Fetch file from storage
      const storage = getStorageInstance();
      const objRes = await storage.getObject(file.fileUrl);
      const arrayBuffer = await objRes.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      const mimeType =
        file.format === "epub" ? "application/epub+zip" :
        file.format === "pdf" ? "application/pdf" :
        file.format === "mobi" ? "application/x-mobipocket-ebook" :
        "application/octet-stream";

      reply.header("Content-Type", mimeType);
      reply.header("Content-Disposition", `attachment; filename="${file.fileName}"`);
      return reply.send(fileBuffer);
    } catch (err: any) {
      request.log.error(err, "File download failed");
      return reply.status(500).send({ message: err.message || "Failed to download file" });
    }
  });
}
