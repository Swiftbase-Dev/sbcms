import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import crypto from "crypto";
import zlib from "zlib";
import { db, Storage } from "swiftbase-admin-sdk";
import type { EbookFile, EbookDistribution, EbookFormat, EbookPreview } from "swiftbase-cms-shared";
import { sendPostmarkEmail, formatFreeEbookNotificationEmail } from "./email.helper.js";

function getDb() {
  const dbName = process.env.SWIFTBASE_DATABASE_NAME || "cms";
  return db(dbName);
}

function getStorageInstance() {
  const bucket = process.env.SWIFTBASE_STORAGE_BUCKET || "swiftbase-cms-storage";
  const endpoint = `${(process.env.SWIFTBASE_URL || process.env.SWIFTBASE_BASE_URL || process.env.SWIFTBASE_API_URL || "https://api.swiftbase.io").replace(/\/$/, "")}/storage`;
  return new Storage({ bucket, endpoint });
}

/**
 * Basic zip reader to extract files from an EPUB buffer without heavy external binaries.
 */
function extractFilesFromZip(buffer: Buffer): Record<string, string> {
  const files: Record<string, string> = {};
  let offset = 0;

  while (offset < buffer.length - 4) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) break; // Local file header signature

    const compMethod = buffer.readUInt16LE(offset + 8);
    const compSize = buffer.readUInt32LE(offset + 18);
    const uncompSize = buffer.readUInt32LE(offset + 22);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);

    const nameOffset = offset + 30;
    const fileName = buffer.toString("utf8", nameOffset, nameOffset + nameLen);
    const dataOffset = nameOffset + nameLen + extraLen;

    try {
      const compData = buffer.subarray(dataOffset, dataOffset + compSize);
      let contentBuffer: Buffer;
      if (compMethod === 0) {
        contentBuffer = compData;
      } else if (compMethod === 8) {
        contentBuffer = zlib.inflateRawSync(compData);
      } else {
        contentBuffer = Buffer.from("");
      }

      if (fileName.match(/\.(html|xhtml|xml|txt|opf|ncx)$/i)) {
        files[fileName] = contentBuffer.toString("utf8");
      }
    } catch {}

    offset = dataOffset + compSize;
  }

  return files;
}

/**
 * Extract clean HTML/text chapters from an EPUB buffer.
 */
export function extractEpubChapters(epubBuffer: Buffer, maxChapters = 2): string[] {
  try {
    const files = extractFilesFromZip(epubBuffer);
    const htmlFiles = Object.entries(files)
      .filter(([name]) => name.match(/\.(html|xhtml)$/i) && !name.toLowerCase().includes("cover") && !name.toLowerCase().includes("nav"))
      .sort((a, b) => a[0].localeCompare(b[0]));

    if (htmlFiles.length === 0) {
      // Fallback: extract plain text from all XML/HTML
      const allText = Object.values(files)
        .map(c => c.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
        .filter(t => t.length > 50);
      return allText.slice(0, maxChapters);
    }

    const chapters: string[] = [];
    for (const [, rawContent] of htmlFiles.slice(0, maxChapters)) {
      // Strip styles and scripts, extract body content
      let cleaned = rawContent
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<link\b[^>]*>/gi, "");

      const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) {
        cleaned = bodyMatch[1];
      }

      cleaned = cleaned.trim();
      if (cleaned.length > 0) {
        chapters.push(cleaned);
      }
    }

    return chapters;
  } catch (err: any) {
    return [];
  }
}

/**
 * Split text/HTML content into page spreads (~350 words per page).
 */
export function paginateContent(content: string, wordsPerPage = 320): string[] {
  // Strip heavy HTML markup to paragraphs
  const cleanParagraphs = content
    .replace(/<\/?(div|section|article|main|header)[^>]*>/gi, "")
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, "\n\n### $1\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);

  const pages: string[] = [];
  let currentPage: string[] = [];
  let currentWordCount = 0;

  for (const para of cleanParagraphs) {
    const wordCount = para.split(/\s+/).length;
    if (currentWordCount + wordCount > wordsPerPage && currentPage.length > 0) {
      pages.push(currentPage.join("\n\n"));
      currentPage = [para];
      currentWordCount = wordCount;
    } else {
      currentPage.push(para);
      currentWordCount += wordCount;
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage.join("\n\n"));
  }

  // Ensure even page count (for two-page spread: Page 1 & 2, 3 & 4, etc.)
  if (pages.length % 2 !== 0) {
    pages.push("*(End of Excerpt)*");
  }

  return pages.length > 0 ? pages : ["Welcome to this preview sample. Full content available in the store!"];
}

export function generateRandomCode(prefix = "READ"): string {
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

  // ==========================================
  // 5. E-BOOK PREVIEWS & READER TRACKING
  // ==========================================

  // List all previews
  app.get("/ebooks/previews", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const database = getDb();
      const res = await database("cms_ebook_previews").execute();
      const list = (res.data || []).map((row: any) => ({
        ...row,
        extractionConfig: row.extractionConfig ? JSON.parse(row.extractionConfig) : undefined,
        pages: row.pages ? JSON.parse(row.pages) : [],
        viewsCount: Number(row.viewsCount) || 0,
        readsCount: Number(row.readsCount) || 0,
        clicksCount: Number(row.clicksCount) || 0,
      }));
      return reply.send(list);
    } catch (err: any) {
      request.log.error(err, "Failed to list ebook previews");
      return reply.status(500).send({ message: err.message || "Failed to list ebook previews" });
    }
  });

  // Auto-extract preview pages from an uploaded product e-book file
  app.post("/ebooks/previews/extract", async (
    request: FastifyRequest<{
      Body: {
        productId: string;
        mode?: "chapters" | "pages";
        count?: number;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { productId, mode = "chapters", count = 2 } = request.body || {};
      if (!productId) {
        return reply.status(400).send({ message: "productId is required" });
      }

      const database = getDb();
      // Look for an EPUB or PDF file for this product
      const filesRes = await database("cms_ebook_files").where({ productId }).execute();
      const files = filesRes.data || [];
      const epubFile = files.find((f: any) => f.format === "epub");
      const anyFile = epubFile || files[0];

      if (!anyFile) {
        return reply.status(404).send({ message: "No uploaded e-book file found for this product. Please upload an EPUB file in Book Formats first." });
      }

      // Download file from storage
      const storage = getStorageInstance();
      const objRes = await storage.getObject(anyFile.fileUrl);
      const arrayBuffer = await objRes.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      let extractedPages: string[] = [];

      if (anyFile.format === "epub") {
        const chapters = extractEpubChapters(fileBuffer, count || 2);
        const combined = chapters.join("\n\n---\n\n");
        extractedPages = paginateContent(combined);
      } else {
        // Fallback text sample
        extractedPages = [
          `Sample Excerpt from ${anyFile.fileName}\n\nChapter 1\n\nThe story unfolds across the pages of this book...`,
          `Chapter 1 (Continued)\n\nDiscover the rest of this journey by getting the complete edition in the store.`
        ];
      }

      return reply.send({
        success: true,
        sourceFormat: anyFile.format,
        sourceFileName: anyFile.fileName,
        sourceFileUrl: anyFile.fileUrl,
        pageCount: extractedPages.length,
        pages: extractedPages,
      });
    } catch (err: any) {
      request.log.error(err, "Failed to extract ebook preview");
      return reply.status(500).send({ message: err.message || "Failed to extract ebook sample content" });
    }
  });

  // Create or update a preview
  app.post("/ebooks/previews", async (
    request: FastifyRequest<{
      Body: Partial<EbookPreview>;
    }>,
    reply: FastifyReply
  ) => {
    try {
      const body = request.body || {};
      const { productId, title, author, coverImage, pages, ctaText, ctaUrl, extractionConfig } = body;

      if (!productId || !title) {
        return reply.status(400).send({ message: "productId and title are required" });
      }

      const database = getDb();
      const id = body.id || `ebp-${crypto.randomUUID()}`;
      const now = new Date().toISOString();

      const previewRecord = {
        id,
        productId,
        title,
        author: author || "Author",
        coverImage: coverImage || "",
        sourceFormat: body.sourceFormat || "manual",
        sourceFileUrl: body.sourceFileUrl || "",
        extractionConfig: extractionConfig ? JSON.stringify(extractionConfig) : JSON.stringify({ mode: "chapters", count: 2 }),
        pages: Array.isArray(pages) ? JSON.stringify(pages) : JSON.stringify([]),
        ctaText: ctaText || "Buy Full Book",
        ctaUrl: ctaUrl || `/store`,
        updatedAt: now,
      };

      const existingRes = await database("cms_ebook_previews").where({ id }).execute();
      if (existingRes.data && existingRes.data.length > 0) {
        await database("cms_ebook_previews").where({ id }).update(previewRecord).execute();
      } else {
        await database("cms_ebook_previews").insert({
          ...previewRecord,
          viewsCount: 0,
          readsCount: 0,
          clicksCount: 0,
          createdAt: now,
        }).execute();
      }

      return reply.send({
        success: true,
        preview: {
          ...previewRecord,
          extractionConfig: JSON.parse(previewRecord.extractionConfig),
          pages: JSON.parse(previewRecord.pages),
        },
      });
    } catch (err: any) {
      request.log.error(err, "Failed to save ebook preview");
      return reply.status(500).send({ message: err.message || "Failed to save preview" });
    }
  });

  // Get single preview
  app.get("/ebooks/previews/:id", async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const database = getDb();
      const res = await database("cms_ebook_previews").where({ id }).execute();
      const preview = res.data && res.data[0];

      if (!preview) {
        return reply.status(404).send({ message: "E-book preview not found" });
      }

      return reply.send({
        ...preview,
        extractionConfig: preview.extractionConfig ? JSON.parse(preview.extractionConfig) : undefined,
        pages: preview.pages ? JSON.parse(preview.pages) : [],
        viewsCount: Number(preview.viewsCount) || 0,
        readsCount: Number(preview.readsCount) || 0,
        clicksCount: Number(preview.clicksCount) || 0,
      });
    } catch (err: any) {
      request.log.error(err, `Failed to get ebook preview ${request.params.id}`);
      return reply.status(500).send({ message: err.message || "Failed to get preview" });
    }
  });

  // Delete preview
  app.delete("/ebooks/previews/:id", async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const database = getDb();
      await database("cms_ebook_previews").where({ id }).delete().execute();
      await database("cms_ebook_preview_events").where({ previewId: id }).delete().execute();
      return reply.send({ success: true, id });
    } catch (err: any) {
      request.log.error(err, `Failed to delete ebook preview ${request.params.id}`);
      return reply.status(500).send({ message: err.message || "Failed to delete preview" });
    }
  });

  // Public Telemetry & Tracking endpoint
  app.post("/ebooks/previews/:id/track", async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        eventType: "view" | "page_turn" | "cta_click";
        pageNumber?: number;
        sessionId?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const { eventType, pageNumber = 1, sessionId } = request.body || {};
      const database = getDb();

      const res = await database("cms_ebook_previews").where({ id }).execute();
      const preview = res.data && res.data[0];
      if (!preview) {
        return reply.status(404).send({ message: "Preview not found" });
      }

      const now = new Date().toISOString();
      await database("cms_ebook_preview_events").insert({
        id: `ev-${crypto.randomUUID()}`,
        previewId: id,
        eventType,
        pageNumber: Number(pageNumber) || 1,
        sessionId: sessionId || "anonymous",
        createdAt: now,
      }).execute();

      const updates: any = {};
      if (eventType === "view") {
        updates.viewsCount = (Number(preview.viewsCount) || 0) + 1;
      } else if (eventType === "page_turn") {
        updates.readsCount = (Number(preview.readsCount) || 0) + 1;
      } else if (eventType === "cta_click") {
        updates.clicksCount = (Number(preview.clicksCount) || 0) + 1;
      }

      if (Object.keys(updates).length > 0) {
        await database("cms_ebook_previews").where({ id }).update(updates).execute();
      }

      return reply.send({ success: true });
    } catch (err: any) {
      request.log.error(err, "Failed to track preview event");
      return reply.status(200).send({ success: false }); // Soft fail for telemetry
    }
  });

  // Aggregated analytics report for a preview
  app.get("/ebooks/previews/:id/analytics", async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const database = getDb();

      const prevRes = await database("cms_ebook_previews").where({ id }).execute();
      const preview = prevRes.data && prevRes.data[0];
      if (!preview) return reply.status(404).send({ message: "Preview not found" });

      const eventsRes = await database("cms_ebook_preview_events").where({ previewId: id }).execute();
      const events = eventsRes.data || [];

      // Calculate pages drop-off
      const pagesDropOff: Record<number, number> = {};
      for (const ev of events) {
        if (ev.eventType === "page_turn" && ev.pageNumber) {
          pagesDropOff[ev.pageNumber] = (pagesDropOff[ev.pageNumber] || 0) + 1;
        }
      }

      const totalViews = Number(preview.viewsCount) || 0;
      const totalClicks = Number(preview.clicksCount) || 0;
      const totalPageFlips = Number(preview.readsCount) || 0;
      const ctr = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : "0.0";

      return reply.send({
        previewId: id,
        title: preview.title,
        totalViews,
        totalPageFlips,
        totalClicks,
        clickThroughRate: `${ctr}%`,
        pagesDropOff,
      });
    } catch (err: any) {
      request.log.error(err, "Failed to get preview analytics");
      return reply.status(500).send({ message: err.message || "Failed to load analytics" });
    }
  });
}
