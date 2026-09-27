import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import fastifyStatic from "@fastify/static";
import path from "path";
import { fileURLToPath } from "url";
import { initializeSdk, login, db, Storage } from "swiftbase-admin-sdk";

import { registerPageRoutes } from "./controllers/page.controller.js";
import { registerBlogRoutes, rebuildBlogSite } from "./controllers/blog.controller.js";
import { registerStoreRoutes, rebuildStoreSite, renderCheckoutSuccessHtml } from "./controllers/store.controller.js";
import { registerAnalyticsRoutes } from "./controllers/analytics.controller.js";
import { registerAIRoutes } from "./controllers/ai.controller.js";
import { registerAssetRoutes } from "./controllers/assets.controller.js";
import { registerSearchRoutes } from "./controllers/search.controller.js";
import { registerCommentRoutes } from "./controllers/comments.controller.js";
import { registerExtensionRoutes } from "./controllers/extension.controller.js";
import { registerEbookRoutes } from "./controllers/ebook.controller.js";


const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = Fastify({ logger: true, bodyLimit: 52428800 });

async function start() {
  // 1. Initialize Swiftbase Admin SDK
  const cleanEnvVar = (val?: string) => (val || "").replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1").trim();
  const projectId = cleanEnvVar(process.env.SWIFTBASE_PROJECT_ID);
  if (!projectId) {
    console.error("CRITICAL CONFIGURATION ERROR: SWIFTBASE_PROJECT_ID environment variable is required to start SBCMS.");
    process.exit(1);
  }
  const baseUrl = cleanEnvVar(process.env.SWIFTBASE_BASE_URL) || "https://api.swiftbase.io";
  const serviceId = cleanEnvVar(process.env.SWIFTBASE_SERVICE_ID);
  const serviceKey = cleanEnvVar(process.env.SWIFTBASE_SERVICE_KEY);

  if (serviceId && serviceKey) {
    initializeSdk(projectId, {
      baseUrl,
      serviceId,
      serviceKey,
    });
    // Log in the service client
    try {
      await login(serviceId, serviceKey);
      app.log.info("Swiftbase SDK successfully logged in as Service");

      // Auto-initialize databases and tables
      const dbName = cleanEnvVar(process.env.SWIFTBASE_DATABASE_NAME) || "cms";
      const schemaName = dbName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      app.log.info(`Initializing database ${dbName} schemas...`);

      const tables = [
        {
          dbname: 'cms_settings',
          name: 'CMS Settings',
          ddl: `CREATE TABLE IF NOT EXISTS "cms_settings" (
            "id" VARCHAR(255) PRIMARY KEY,
            "projectId" VARCHAR(255),
            "siteTitle" VARCHAR(255),
            "siteDomain" VARCHAR(255),
            "isBlogEnabled" BOOLEAN DEFAULT false,
            "isStoreEnabled" BOOLEAN DEFAULT false,
            "stripePublishableKey" VARCHAR(255),
            "stripeWebhookSecret" VARCHAR(255),
            "postmarkApiToken" VARCHAR(255),
            "postmarkFromEmail" VARCHAR(255),
            "postmarkNotifyOnOrder" BOOLEAN DEFAULT true,
            "postmarkNotifyStaffOnOrder" BOOLEAN DEFAULT true,
            "adminNotificationEmails" TEXT,
            "navbarLogo" VARCHAR(255),
            "navbarLinks" JSONB,
            "footerText" VARCHAR(255),
            "footerLinks" JSONB,
            "faviconUrl" VARCHAR(255),
            "globalStyles" TEXT,
            "navbarHtml" TEXT,
            "navbarCss" TEXT,
            "navbarComponents" JSONB,
            "navbarStyles" JSONB,
            "footerHtml" TEXT,
            "footerCss" TEXT,
            "footerComponents" JSONB,
            "footerStyles" JSONB,
            "areCommentsEnabledGlobally" BOOLEAN DEFAULT true,
            "createdAt" VARCHAR(255),
            "updatedAt" VARCHAR(255)
          )`
        },
        {
          dbname: 'cms_pages',
          name: 'CMS Pages',
          ddl: `CREATE TABLE IF NOT EXISTS "cms_pages" (
            "id" VARCHAR(255) PRIMARY KEY,
            "projectId" VARCHAR(255),
            "slug" VARCHAR(255),
            "title" VARCHAR(255),
            "layoutHtml" TEXT,
            "layoutCss" TEXT,
            "layoutComponents" JSONB,
            "layoutStyles" JSONB,
            "seoMetadata" JSONB,
            "isPublished" BOOLEAN DEFAULT false,
            "hasUnpublishedChanges" BOOLEAN DEFAULT false,
            "createdAt" VARCHAR(255),
            "updatedAt" VARCHAR(255)
          )`
        },
        {
          dbname: 'cms_posts',
          name: 'CMS Posts',
          ddl: `CREATE TABLE IF NOT EXISTS "cms_posts" (
            "id" VARCHAR(255) PRIMARY KEY,
            "projectId" VARCHAR(255),
            "slug" VARCHAR(255),
            "title" VARCHAR(255),
            "content" TEXT,
            "excerpt" TEXT,
            "tags" TEXT,
            "featureImage" TEXT,
            "status" VARCHAR(50),
            "seoMetadata" JSONB,
            "hasUnpublishedChanges" BOOLEAN DEFAULT false,
            "isPublished" BOOLEAN DEFAULT false,
            "publishedAt" VARCHAR(255),
            "createdAt" VARCHAR(255),
            "updatedAt" VARCHAR(255)
          )`
        },
        {
          dbname: 'cms_products',
          name: 'CMS Products',
          ddl: `CREATE TABLE IF NOT EXISTS "cms_products" (
            "id" VARCHAR(255) PRIMARY KEY,
            "projectId" VARCHAR(255),
            "slug" VARCHAR(255),
            "name" VARCHAR(255),
            "description" TEXT,
            "priceCents" INTEGER,
            "currency" VARCHAR(10) DEFAULT 'usd',
            "fileUrl" VARCHAR(255),
            "imageUrl" VARCHAR(255),
            "stripePriceId" VARCHAR(255),
            "stripeProductId" VARCHAR(255),
            "images" JSONB,
            "affiliateLinks" JSONB,
            "category" VARCHAR(255),
            "sku" VARCHAR(255),
            "inStock" BOOLEAN DEFAULT true,
            "stockQuantity" INTEGER,
            "limitPerOrder" INTEGER,
            "customOrderFields" JSONB,
            "isPhysical" BOOLEAN DEFAULT true,
            "shippingDetails" JSONB,
            "addOnProductIds" JSONB,
            "createdAt" VARCHAR(255),
            "updatedAt" VARCHAR(255)
          )`
        },
        {
          dbname: 'cms_purchases',
          name: 'CMS Purchases',
          ddl: `CREATE TABLE IF NOT EXISTS "cms_purchases" (
            "id" VARCHAR(255) PRIMARY KEY,
            "projectId" VARCHAR(255),
            "productId" VARCHAR(255),
            "stripeSessionId" VARCHAR(255),
            "customerEmail" VARCHAR(255),
            "customerName" VARCHAR(255),
            "amountTotalCents" INTEGER,
            "status" VARCHAR(50),
            "fulfillmentStatus" VARCHAR(50) DEFAULT 'unfulfilled',
            "trackingNumber" VARCHAR(255),
            "carrier" VARCHAR(100),
            "trackingUrl" TEXT,
            "shippingAddress" JSONB,
            "items" JSONB,
            "notes" TEXT,
            "shippedAt" VARCHAR(255),
            "createdAt" VARCHAR(255),
            "updatedAt" VARCHAR(255)
          )`
        },
        {
          dbname: 'cms_analytics_events',
          name: 'CMS Analytics Events',
          ddl: `CREATE TABLE IF NOT EXISTS "cms_analytics_events" (
            "id" VARCHAR(255) PRIMARY KEY,
            "path" VARCHAR(255),
            "referrer" VARCHAR(255),
            "browser" VARCHAR(255),
            "operatingSystem" VARCHAR(255),
            "deviceType" VARCHAR(255),
            "countryCode" VARCHAR(255),
            "conversionName" VARCHAR(255),
            "timestamp" VARCHAR(255),
            "createdAt" VARCHAR(255)
          )`
        },
        {
          dbname: 'cms_comments',
          name: 'CMS Comments',
          ddl: `CREATE TABLE IF NOT EXISTS "cms_comments" (
            "id" VARCHAR(255) PRIMARY KEY,
            "projectId" VARCHAR(255),
            "postSlug" VARCHAR(255),
            "authorName" VARCHAR(255),
            "authorEmail" VARCHAR(255),
            "content" TEXT,
            "status" VARCHAR(50) DEFAULT 'approved',
            "ipAddress" VARCHAR(100),
            "userAgent" VARCHAR(255),
            "createdAt" VARCHAR(255),
            "updatedAt" VARCHAR(255)
          )`
        },
        {
          dbname: 'cms_extensions',
          name: 'CMS Extensions',
          ddl: `CREATE TABLE IF NOT EXISTS "cms_extensions" (
            "id" VARCHAR(255) PRIMARY KEY,
            "name" VARCHAR(255),
            "version" VARCHAR(50),
            "description" TEXT,
            "author" VARCHAR(255),
            "gitUrl" VARCHAR(500),
            "commitHash" VARCHAR(100),
            "enabled" BOOLEAN DEFAULT true,
            "permissions" JSONB,
            "manifest" JSONB,
            "settings" JSONB,
            "createdAt" VARCHAR(255),
            "updatedAt" VARCHAR(255)
          )`
        },
        {
          dbname: 'cms_ebook_files',
          name: 'CMS Ebook Files',
          ddl: `CREATE TABLE IF NOT EXISTS "cms_ebook_files" (
            "id" VARCHAR(255) PRIMARY KEY,
            "productId" VARCHAR(255),
            "format" VARCHAR(50),
            "fileUrl" VARCHAR(500),
            "fileName" VARCHAR(255),
            "fileSizeBytes" INTEGER,
            "createdAt" VARCHAR(255)
          )`
        },
        {
          dbname: 'cms_ebook_distributions',
          name: 'CMS Ebook Distributions',
          ddl: `CREATE TABLE IF NOT EXISTS "cms_ebook_distributions" (
            "id" VARCHAR(255) PRIMARY KEY,
            "token" VARCHAR(255) UNIQUE,
            "type" VARCHAR(50),
            "code" VARCHAR(100),
            "productId" VARCHAR(255),
            "productTitle" VARCHAR(255),
            "recipientName" VARCHAR(255),
            "recipientEmail" VARCHAR(255),
            "message" TEXT,
            "maxDownloads" INTEGER DEFAULT 5,
            "downloadCount" INTEGER DEFAULT 0,
            "isRedeemed" BOOLEAN DEFAULT false,
            "redeemedAt" VARCHAR(255),
            "expiresAt" VARCHAR(255),
            "createdAt" VARCHAR(255)
          )`
        }
      ];


      const database = db(dbName);
      if (typeof (database as any).initializeDatabase === "function") {
        let retries = 3;
        while (retries > 0) {
          try {
            await (database as any).initializeDatabase(tables);
            break;
          } catch (initErr: any) {
            retries--;
            if (retries === 0) throw initErr;
            app.log.warn(`Database initialization failed (${initErr.message}). Retrying in 5 seconds... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
        
        // Ensure siteDomain and appearance columns are present in pre-existing tables
        try {
          if (typeof (database as any).executeSQL === "function") {
            const safeAddColumn = async (table: string, column: string, typeDef: string) => {
              try {
                await (database as any).executeSQL(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${typeDef}`);
              } catch (colErr: any) {
                // Ignore "duplicate column name" error in SQLite
                if (!colErr.message?.includes("duplicate column name")) {
                  app.log.warn(`Column migration warning for ${table}.${column}: ${colErr.message}`);
                }
              }
            };

            await safeAddColumn("cms_settings", "siteDomain", "VARCHAR(255)");
            await safeAddColumn("cms_settings", "navbarLogo", "VARCHAR(255)");
            await safeAddColumn("cms_settings", "navbarLinks", "JSONB");
            await safeAddColumn("cms_settings", "footerText", "VARCHAR(255)");
            await safeAddColumn("cms_settings", "footerLinks", "JSONB");
            await safeAddColumn("cms_settings", "faviconUrl", "VARCHAR(255)");
            await safeAddColumn("cms_settings", "globalStyles", "TEXT");
            await safeAddColumn("cms_settings", "navbarHtml", "TEXT");
            await safeAddColumn("cms_settings", "navbarCss", "TEXT");
            await safeAddColumn("cms_settings", "navbarComponents", "JSONB");
            await safeAddColumn("cms_settings", "navbarStyles", "JSONB");
            await safeAddColumn("cms_settings", "footerHtml", "TEXT");
            await safeAddColumn("cms_settings", "footerCss", "TEXT");
            await safeAddColumn("cms_settings", "footerComponents", "JSONB");
            await safeAddColumn("cms_settings", "footerStyles", "JSONB");
            await safeAddColumn("cms_settings", "areCommentsEnabledGlobally", "BOOLEAN DEFAULT true");
            await safeAddColumn("cms_settings", "postmarkApiToken", "VARCHAR(255)");
            await safeAddColumn("cms_settings", "postmarkFromEmail", "VARCHAR(255)");
            await safeAddColumn("cms_settings", "postmarkNotifyOnOrder", "BOOLEAN DEFAULT true");
            await safeAddColumn("cms_settings", "postmarkNotifyStaffOnOrder", "BOOLEAN DEFAULT true");
            await safeAddColumn("cms_settings", "adminNotificationEmails", "TEXT");
            app.log.info("Migrated cms_settings to include siteDomain, appearance, global layout, comments, and Postmark columns.");
            
            // Migrate cms_analytics_events fields if table already existed without new parameters
            try {
              await safeAddColumn("cms_analytics_events", "countryCode", "VARCHAR(255)");
              await safeAddColumn("cms_analytics_events", "conversionName", "VARCHAR(255)");
              await safeAddColumn("cms_analytics_events", "timestamp", "VARCHAR(255)");
              app.log.info("Migrated cms_analytics_events schema to include countryCode, conversionName, and timestamp columns.");
            } catch (aErr: any) {
              app.log.warn(`Analytics table migration warning: ${aErr.message}`);
            }

            // Rename/add columns to support replacement of GrapesJS & ensure full schema
            try {
              await safeAddColumn("cms_pages", "projectId", "VARCHAR(255)");
              await safeAddColumn("cms_pages", "slug", "VARCHAR(255)");
              await safeAddColumn("cms_pages", "title", "VARCHAR(255)");
              await safeAddColumn("cms_pages", "layoutHtml", "TEXT");
              await safeAddColumn("cms_pages", "layoutCss", "TEXT");
              await safeAddColumn("cms_pages", "layoutComponents", "JSONB");
              await safeAddColumn("cms_pages", "layoutStyles", "JSONB");
              await safeAddColumn("cms_pages", "seoMetadata", "JSONB");
              await safeAddColumn("cms_pages", "isPublished", "BOOLEAN DEFAULT false");
              await safeAddColumn("cms_pages", "hasUnpublishedChanges", "BOOLEAN DEFAULT false");
              await safeAddColumn("cms_pages", "createdAt", "VARCHAR(255)");
              await safeAddColumn("cms_pages", "updatedAt", "VARCHAR(255)");

              // Migrate existing legacy data securely if present
              await (database as any).executeSQL(`
                UPDATE "cms_pages"
                SET 
                  "layoutHtml" = COALESCE("layoutHtml", "grapesHtml"),
                  "layoutCss" = COALESCE("layoutCss", "grapesCss"),
                  "layoutComponents" = COALESCE("layoutComponents", "grapesComponents"),
                  "layoutStyles" = COALESCE("layoutStyles", "grapesStyles")
                WHERE "layoutHtml" IS NULL AND "grapesHtml" IS NOT NULL
              `);
              app.log.info("Migrated cms_pages to include custom layout and components columns.");
            } catch (pErr: any) {
              app.log.warn(`Pages table column migration warning: ${pErr.message}`);
            }
            // Migrate cms_posts to include tags TEXT column if table already existed
            try {
              await safeAddColumn("cms_posts", "tags", "TEXT");
              await safeAddColumn("cms_posts", "hasUnpublishedChanges", "BOOLEAN DEFAULT false");
              await safeAddColumn("cms_posts", "publishedTitle", "VARCHAR(255)");
              await safeAddColumn("cms_posts", "publishedContent", "TEXT");
              await safeAddColumn("cms_posts", "publishedExcerpt", "TEXT");
              await safeAddColumn("cms_posts", "publishedTags", "TEXT");
              await safeAddColumn("cms_posts", "publishedFeatureImage", "TEXT");
              await safeAddColumn("cms_posts", "publishedSeoMetadata", "JSONB");
              await safeAddColumn("cms_posts", "areCommentsEnabled", "BOOLEAN DEFAULT true");
              await safeAddColumn("cms_posts", "author", "VARCHAR(255)");
              await safeAddColumn("cms_posts", "publishedAuthor", "VARCHAR(255)");
              app.log.info("Migrated cms_posts schema to include tags, draft/published copy, comments, and author columns.");
            } catch (postErr: any) {
              app.log.warn(`Posts table column migration warning: ${postErr.message}`);
            }

            // Migrate cms_products columns if table already existed
            try {
              await safeAddColumn("cms_products", "projectId", "VARCHAR(255)");
              await safeAddColumn("cms_products", "slug", "VARCHAR(255)");
              await safeAddColumn("cms_products", "name", "VARCHAR(255)");
              await safeAddColumn("cms_products", "description", "TEXT");
              await safeAddColumn("cms_products", "priceCents", "INTEGER");
              await safeAddColumn("cms_products", "stripePriceId", "VARCHAR(255)");
              await safeAddColumn("cms_products", "stripeProductId", "VARCHAR(255)");
              await safeAddColumn("cms_products", "images", "JSONB");
              await safeAddColumn("cms_products", "affiliateLinks", "JSONB");
              await safeAddColumn("cms_products", "category", "VARCHAR(255)");
              await safeAddColumn("cms_products", "sku", "VARCHAR(255)");
              await safeAddColumn("cms_products", "inStock", "BOOLEAN DEFAULT true");
              await safeAddColumn("cms_products", "stockQuantity", "INTEGER");
              await safeAddColumn("cms_products", "limitPerOrder", "INTEGER");
              await safeAddColumn("cms_products", "customOrderFields", "JSONB");
              await safeAddColumn("cms_products", "isPhysical", "BOOLEAN DEFAULT true");
              await safeAddColumn("cms_products", "shippingDetails", "JSONB");
              await safeAddColumn("cms_products", "addOnProductIds", "JSONB");
              await safeAddColumn("cms_products", "createdAt", "VARCHAR(255)");
              await safeAddColumn("cms_products", "updatedAt", "VARCHAR(255)");
              app.log.info("Migrated cms_products schema to include extended product catalog fields.");
            } catch (prodErr: any) {
              app.log.warn(`Products table column migration warning: ${prodErr.message}`);
            }

            // Migrate cms_purchases columns for order fulfillment and tracking
            try {
              await safeAddColumn("cms_purchases", "projectId", "VARCHAR(255)");
              await safeAddColumn("cms_purchases", "productId", "VARCHAR(255)");
              await safeAddColumn("cms_purchases", "stripeSessionId", "VARCHAR(255)");
              await safeAddColumn("cms_purchases", "customerEmail", "VARCHAR(255)");
              await safeAddColumn("cms_purchases", "customerName", "VARCHAR(255)");
              await safeAddColumn("cms_purchases", "amountTotalCents", "INTEGER");
              await safeAddColumn("cms_purchases", "status", "VARCHAR(50)");
              await safeAddColumn("cms_purchases", "fulfillmentStatus", "VARCHAR(50) DEFAULT 'unfulfilled'");
              await safeAddColumn("cms_purchases", "trackingNumber", "VARCHAR(255)");
              await safeAddColumn("cms_purchases", "carrier", "VARCHAR(100)");
              await safeAddColumn("cms_purchases", "trackingUrl", "TEXT");
              await safeAddColumn("cms_purchases", "shippingAddress", "JSONB");
              await safeAddColumn("cms_purchases", "items", "JSONB");
              await safeAddColumn("cms_purchases", "notes", "TEXT");
              await safeAddColumn("cms_purchases", "shippedAt", "VARCHAR(255)");
              await safeAddColumn("cms_purchases", "createdAt", "VARCHAR(255)");
              await safeAddColumn("cms_purchases", "updatedAt", "VARCHAR(255)");
              app.log.info("Migrated cms_purchases schema to include shipping address, tracking, and order items.");
            } catch (purchErr: any) {
              app.log.warn(`Purchases table column migration warning: ${purchErr.message}`);
            }
          }
        } catch (mErr: any) {
          app.log.warn(`Appearance column migration warning: ${mErr.message}`);
        }

        app.log.info("Database and tables successfully initialized.");
        await rebuildBlogSite().catch((err: any) => {
          app.log.error(err, "Failed to rebuild blog site on startup");
        });
      } else {
        app.log.warn("Database initialization helper not available on SDK.");
      }
    } catch (err: any) {
      app.log.error(err, "Swiftbase SDK Service Login or Database Init failed");
    }
  } else {
    app.log.warn("Missing SWIFTBASE_SERVICE_ID or SWIFTBASE_SERVICE_KEY. Running in unauthenticated fallback mode.");
    initializeSdk(projectId, { baseUrl });
  }

  // 2. Register Middleware Plugins
  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  });
  await app.register(cookie, { secret: process.env.COOKIE_SECRET || "cms-cookie-secret" });
  await app.register(formbody);

  // Allow empty or blank JSON bodies gracefully without failing with FST_ERR_CTP_EMPTY_JSON_BODY
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body: string, defaultDone) => {
    if (!body || body.trim() === "") {
      defaultDone(null, {});
      return;
    }
    try {
      defaultDone(null, JSON.parse(body));
    } catch (err: any) {
      defaultDone(err, undefined);
    }
  });

  // 3. Register Static Frontend Admin portal
  const frontendDist = path.join(__dirname, "../../frontend/dist");
  await app.register(fastifyStatic, {
    root: frontendDist,
    prefix: "/admin",
    wildcard: true,
  });

  // Helper function to serve public pages
  async function servePage(request: any, reply: any, slug: string) {
    try {
      const dbName = process.env.SWIFTBASE_DATABASE_NAME || "cms";
      const database = db(dbName);
      
      const res = await database("cms_pages").where("slug", slug).execute();
      const page = res.data[0];
      
      if (!page || !page.isPublished) {
        if (slug === "home") {
          reply.header("Content-Type", "text/html");
          return reply.send(getPlaceholderHtml());
        } else {
          return reply.code(404).send("Page Not Found");
        }
      }
      
      // Fetch the compiled page directly from the storage bucket!
      const endpoint = `${(process.env.SWIFTBASE_URL || process.env.SWIFTBASE_API_URL || "https://api.swiftbase.io").replace(/\/$/, "")}/storage`;
      const storage = new Storage({ bucket: process.env.SWIFTBASE_STORAGE_BUCKET!, endpoint });
      const targetKey = slug === "home" ? "index.html" : `${slug}/index.html`;
      
      try {
        const compiledHtml = await storage.getObjectAsText(targetKey);
        reply.header("Content-Type", "text/html");
        return reply.send(compiledHtml);
      } catch (s3Err: any) {
        request.log.error(s3Err, `Failed to fetch page from storage for key ${targetKey}`);
        return reply.code(404).send("Page content not found in storage");
      }
    } catch (err: any) {
      request.log.error(err);
      return reply.code(500).send("Internal Server Error");
    }
  }

  function getPlaceholderHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to SBCMS</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800;900&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Outfit', sans-serif;
    }
  </style>
</head>
<body class="bg-slate-950 text-white flex items-center justify-center min-h-screen overflow-hidden relative">
  <!-- Background Glows -->
  <div class="absolute w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px] top-[-10%] left-[-10%]"></div>
  <div class="absolute w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[150px] bottom-[-20%] right-[-10%]"></div>

  <div class="max-w-2xl px-6 text-center z-10">
    <div class="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-violet-600 to-blue-500 shadow-lg shadow-violet-500/20 mb-8">
      <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
      </svg>
    </div>
    
    <h1 class="text-5xl md:text-6xl font-black tracking-tight mb-6 bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
      Your Website is Ready
    </h1>
    
    <p class="text-lg md:text-xl text-slate-400 font-light mb-10 max-w-lg mx-auto leading-relaxed">
      SBCMS has been successfully initialized. Log in to the admin panel to build and publish your home page.
    </p>

    <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
      <a href="/admin" class="px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold text-sm tracking-wide shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all">
        Go to Admin Portal
      </a>
    </div>
  </div>
</body>
</html>`;
  }

  // Public visitor page routes
  app.get("/favicon.ico", async (request, reply) => {
    try {
      const dbName = process.env.SWIFTBASE_DATABASE_NAME || "cms";
      const database = db(dbName);
      const res = await database("cms_settings").execute();
      const rawSettings = res.data[0];
      if (rawSettings && (rawSettings.faviconUrl || rawSettings.faviconurl)) {
        return reply.redirect(rawSettings.faviconUrl || rawSettings.faviconurl);
      }
    } catch (err) {
      // ignore
    }
    return reply.code(404).send("Not Found");
  });

  app.get("/", async (request, reply) => {
    return servePage(request, reply, "home");
  });

  app.get("/assets/:key", async (request: any, reply) => {
    try {
      const { key } = request.params;
      const endpoint = `${(process.env.SWIFTBASE_URL || process.env.SWIFTBASE_API_URL || "https://api.swiftbase.io").replace(/\/$/, "")}/storage`;
      const storage = new Storage({ bucket: process.env.SWIFTBASE_STORAGE_BUCKET!, endpoint });
      const s3Res = await storage.getObject(`assets/${key}`);
      
      let contentType = "";
      if (key.endsWith(".jpg") || key.endsWith(".jpeg")) contentType = "image/jpeg";
      else if (key.endsWith(".png")) contentType = "image/png";
      else if (key.endsWith(".svg")) contentType = "image/svg+xml";
      else if (key.endsWith(".gif")) contentType = "image/gif";
      else if (key.endsWith(".webp")) contentType = "image/webp";
      else if (key.endsWith(".ico")) contentType = "image/x-icon";
      else contentType = s3Res.headers.get("Content-Type") || "application/octet-stream";

      reply.raw.setHeader("Content-Type", contentType);
      reply.raw.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      reply.raw.setHeader("Pragma", "no-cache");
      reply.raw.setHeader("Expires", "0");
      
      const buffer = await s3Res.arrayBuffer();
      return reply.send(Buffer.from(buffer));
    } catch (err: any) {
      return reply.code(404).send("Asset Not Found");
    }
  });

  // Public blog routes
  app.get("/blog", async (request, reply) => {
    try {
      const dbName = process.env.SWIFTBASE_DATABASE_NAME || "cms";
      const database = db(dbName);
      const res = await database("cms_settings").execute();
      const rawSettings = res.data[0];
      if (!rawSettings || !rawSettings.isBlogEnabled) {
        return reply.code(404).send("Blog module is disabled");
      }

      const storage = new Storage({ bucket: process.env.SWIFTBASE_STORAGE_BUCKET! });
      let indexHtml: string;
      try {
        indexHtml = await storage.getObjectAsText("blog/index.html");
      } catch (err) {
        request.log.info("Blog index not found in storage, rebuilding...");
        await rebuildBlogSite();
        indexHtml = await storage.getObjectAsText("blog/index.html");
      }
      
      reply.header("Content-Type", "text/html");
      return reply.send(indexHtml);
    } catch (err: any) {
      return reply.code(404).send("Blog index not found in storage");
    }
  });

  app.get("/blog/:postSlug", async (request: any, reply) => {
    try {
      const { postSlug } = request.params;
      const dbName = process.env.SWIFTBASE_DATABASE_NAME || "cms";
      const database = db(dbName);
      const res = await database("cms_settings").execute();
      const rawSettings = res.data[0];
      if (!rawSettings || !rawSettings.isBlogEnabled) {
        return reply.code(404).send("Blog module is disabled");
      }

      const storage = new Storage({ bucket: process.env.SWIFTBASE_STORAGE_BUCKET! });
      const postHtml = await storage.getObjectAsText(`blog/${postSlug}/index.html`);
      reply.header("Content-Type", "text/html");
      return reply.send(postHtml);
    } catch (err) {
      return reply.code(404).send("Blog post not found in storage");
    }
  });

  // Public store routes
  app.get("/store", async (request, reply) => {
    try {
      const dbName = process.env.SWIFTBASE_DATABASE_NAME || "cms";
      const database = db(dbName);
      const res = await database("cms_settings").execute();
      const rawSettings = res.data[0];
      if (!rawSettings || !rawSettings.isStoreEnabled) {
        return reply.code(404).send("Store module is disabled");
      }

      const storage = new Storage({ bucket: process.env.SWIFTBASE_STORAGE_BUCKET! });
      let indexHtml: string;
      try {
        indexHtml = await storage.getObjectAsText("store/index.html");
      } catch (err) {
        request.log.info("Store index not found in storage, rebuilding...");
        await rebuildStoreSite();
        indexHtml = await storage.getObjectAsText("store/index.html");
      }
      
      reply.header("Content-Type", "text/html");
      return reply.send(indexHtml);
    } catch (err: any) {
      return reply.code(404).send("Store index not found in storage");
    }
  });

  app.get("/store/:productSlug", async (request: any, reply) => {
    try {
      const { productSlug } = request.params;
      const dbName = process.env.SWIFTBASE_DATABASE_NAME || "cms";
      const database = db(dbName);
      const res = await database("cms_settings").execute();
      const rawSettings = res.data[0];
      if (!rawSettings || !rawSettings.isStoreEnabled) {
        return reply.code(404).send("Store module is disabled");
      }

      const storage = new Storage({ bucket: process.env.SWIFTBASE_STORAGE_BUCKET! });
      const productHtml = await storage.getObjectAsText(`store/${productSlug}/index.html`);
      reply.header("Content-Type", "text/html");
      return reply.send(productHtml);
    } catch (err) {
      return reply.code(404).send("Product not found in storage");
    }
  });

  app.get("/checkout/success", async (request: any, reply) => {
    try {
      const { session_id } = request.query || {};
      const html = await renderCheckoutSuccessHtml(session_id);
      reply.header("Content-Type", "text/html");
      return reply.send(html);
    } catch (err: any) {
      request.log.error(`Checkout success page render error: ${err.message}`);
      return reply.code(500).send("Unable to render checkout confirmation.");
    }
  });

  app.get("/download/:token", async (request, reply) => {
    return reply.sendFile("index.html");
  });

  app.get("/redeem", async (request, reply) => {
    return reply.sendFile("index.html");
  });

  app.get("/admin", async (request, reply) => {
    return reply.redirect("/admin/");
  });

  app.get("/:slug", async (request: any, reply) => {
    const { slug } = request.params;
    if (slug === "admin") {
      return reply.redirect("/admin/");
    }
    if (slug === "api" || slug === "blog" || slug === "store" || slug === "checkout" || slug === "download" || slug === "redeem") {
      return reply.code(404).send({ error: "Not Found" });
    }
    return servePage(request, reply, slug);
  });

  // Fallback route to serve SPA frontend
  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith("/api")) {
      return reply.code(404).send({ error: "API Route Not Found" });
    }
    if (request.url.startsWith("/admin") || request.url.startsWith("/download") || request.url.startsWith("/redeem")) {
      return reply.sendFile("index.html");
    }
    return reply.code(404).send({ error: "Not Found" });
  });

  // 4. Register REST API Routes
  app.register(async (api) => {
    registerPageRoutes(api);
    registerBlogRoutes(api);
    registerStoreRoutes(api);
    registerAnalyticsRoutes(api);
    registerAIRoutes(api);
    registerAssetRoutes(api);
    registerSearchRoutes(api);
    registerCommentRoutes(api);
    registerExtensionRoutes(api);
    registerEbookRoutes(api);
  }, { prefix: "/api", bodyLimit: 52428800 });


  // 5. Start Listening
  const port = parseInt(process.env.PORT || "3000", 10);
  try {
    await app.listen({ port, host: "0.0.0.0" });
    console.log(`SBCMS Backend running on http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
