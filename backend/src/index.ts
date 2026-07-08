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
import { registerStoreRoutes } from "./controllers/store.controller.js";
import { registerAnalyticsRoutes } from "./controllers/analytics.controller.js";
import { registerAIRoutes } from "./controllers/ai.controller.js";
import { registerAssetRoutes } from "./controllers/assets.controller.js";
import { registerSearchRoutes } from "./controllers/search.controller.js";
import { registerCommentRoutes } from "./controllers/comments.controller.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = Fastify({ logger: true });

async function start() {
  // 1. Initialize Swiftbase Admin SDK
  const projectId = process.env.SWIFTBASE_PROJECT_ID;
  if (!projectId) {
    console.error("CRITICAL CONFIGURATION ERROR: SWIFTBASE_PROJECT_ID environment variable is required to start SBCMS.");
    process.exit(1);
  }
  const baseUrl = process.env.SWIFTBASE_BASE_URL || "https://api.swiftbase.io";
  const serviceId = process.env.SWIFTBASE_SERVICE_ID;
  const serviceKey = process.env.SWIFTBASE_SERVICE_KEY;

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
      const dbName = process.env.SWIFTBASE_DATABASE_NAME || "cms";
      const schemaName = dbName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      app.log.info(`Initializing database ${dbName} schemas...`);

      const tables = [
        {
          dbname: 'cms_settings',
          name: 'CMS Settings',
          ddl: `CREATE TABLE IF NOT EXISTS "${schemaName}"."cms_settings" (
            "id" VARCHAR(255) PRIMARY KEY,
            "projectId" VARCHAR(255),
            "siteTitle" VARCHAR(255),
            "siteDomain" VARCHAR(255),
            "isBlogEnabled" BOOLEAN DEFAULT false,
            "isStoreEnabled" BOOLEAN DEFAULT false,
            "stripePublishableKey" VARCHAR(255),
            "stripeWebhookSecret" VARCHAR(255),
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
            "createdAt" VARCHAR(255),
            "updatedAt" VARCHAR(255)
          )`
        },
        {
          dbname: 'cms_pages',
          name: 'CMS Pages',
          ddl: `CREATE TABLE IF NOT EXISTS "${schemaName}"."cms_pages" (
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
          ddl: `CREATE TABLE IF NOT EXISTS "${schemaName}"."cms_posts" (
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
            "publishedTitle" VARCHAR(255),
            "publishedContent" TEXT,
            "publishedExcerpt" TEXT,
            "publishedTags" TEXT,
            "publishedFeatureImage" TEXT,
            "publishedSeoMetadata" JSONB,
            "publishedAt" VARCHAR(255),
            "author" VARCHAR(255),
            "publishedAuthor" VARCHAR(255),
            "createdAt" VARCHAR(255),
            "updatedAt" VARCHAR(255)
          )`
        },
        {
          dbname: 'cms_products',
          name: 'CMS Products',
          ddl: `CREATE TABLE IF NOT EXISTS "${schemaName}"."cms_products" (
            "id" VARCHAR(255) PRIMARY KEY,
            "projectId" VARCHAR(255),
            "slug" VARCHAR(255),
            "name" VARCHAR(255),
            "description" TEXT,
            "priceCents" INTEGER,
            "stripePriceId" VARCHAR(255),
            "stripeProductId" VARCHAR(255),
            "images" JSONB,
            "affiliateLinks" JSONB,
            "createdAt" VARCHAR(255),
            "updatedAt" VARCHAR(255)
          )`
        },
        {
          dbname: 'cms_purchases',
          name: 'CMS Purchases',
          ddl: `CREATE TABLE IF NOT EXISTS "${schemaName}"."cms_purchases" (
            "id" VARCHAR(255) PRIMARY KEY,
            "projectId" VARCHAR(255),
            "productId" VARCHAR(255),
            "stripeSessionId" VARCHAR(255),
            "customerEmail" VARCHAR(255),
            "amountTotalCents" INTEGER,
            "status" VARCHAR(50),
            "createdAt" VARCHAR(255),
            "updatedAt" VARCHAR(255)
          )`
        },
        {
          dbname: 'cms_analytics_events',
          name: 'CMS Analytics Events',
          ddl: `CREATE TABLE IF NOT EXISTS "${schemaName}"."cms_analytics_events" (
            "id" VARCHAR(255) PRIMARY KEY,
            "projectId" VARCHAR(255),
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
          ddl: `CREATE TABLE IF NOT EXISTS "${schemaName}"."cms_comments" (
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
        }
      ];

      const database = db(dbName);
      if (typeof (database as any).initializeDatabase === "function") {
        await (database as any).initializeDatabase(tables);
        
        // Ensure siteDomain and appearance columns are present in pre-existing tables
        try {
          if (typeof (database as any).executeSQL === "function") {
            await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_settings" ADD COLUMN IF NOT EXISTS "siteDomain" VARCHAR(255)`);
            await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_settings" ADD COLUMN IF NOT EXISTS "navbarLogo" VARCHAR(255)`);
            await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_settings" ADD COLUMN IF NOT EXISTS "navbarLinks" JSONB`);
            await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_settings" ADD COLUMN IF NOT EXISTS "footerText" VARCHAR(255)`);
            await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_settings" ADD COLUMN IF NOT EXISTS "footerLinks" JSONB`);
            await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_settings" ADD COLUMN IF NOT EXISTS "faviconUrl" VARCHAR(255)`);
            await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_settings" ADD COLUMN IF NOT EXISTS "globalStyles" TEXT`);
            await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_settings" ADD COLUMN IF NOT EXISTS "navbarHtml" TEXT`);
            await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_settings" ADD COLUMN IF NOT EXISTS "navbarCss" TEXT`);
            await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_settings" ADD COLUMN IF NOT EXISTS "navbarComponents" JSONB`);
            await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_settings" ADD COLUMN IF NOT EXISTS "navbarStyles" JSONB`);
            await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_settings" ADD COLUMN IF NOT EXISTS "footerHtml" TEXT`);
            await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_settings" ADD COLUMN IF NOT EXISTS "footerCss" TEXT`);
            await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_settings" ADD COLUMN IF NOT EXISTS "footerComponents" JSONB`);
            await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_settings" ADD COLUMN IF NOT EXISTS "footerStyles" JSONB`);
            await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_settings" ADD COLUMN IF NOT EXISTS "areCommentsEnabledGlobally" BOOLEAN DEFAULT true`);
            app.log.info("Migrated cms_settings to include siteDomain, appearance, global layout, and comments columns.");
            
            // Migrate cms_analytics_events fields if table already existed without new parameters
            try {
              await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_analytics_events" ADD COLUMN IF NOT EXISTS "countryCode" VARCHAR(255)`);
              await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_analytics_events" ADD COLUMN IF NOT EXISTS "conversionName" VARCHAR(255)`);
              await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_analytics_events" ADD COLUMN IF NOT EXISTS "timestamp" VARCHAR(255)`);
              app.log.info("Migrated cms_analytics_events schema to include countryCode, conversionName, and timestamp columns.");
            } catch (aErr: any) {
              app.log.warn(`Analytics table migration warning: ${aErr.message}`);
            }

            // Rename/add columns to support replacement of GrapesJS
            try {
              await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_pages" ADD COLUMN IF NOT EXISTS "layoutHtml" TEXT`);
              await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_pages" ADD COLUMN IF NOT EXISTS "layoutCss" TEXT`);
              await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_pages" ADD COLUMN IF NOT EXISTS "layoutComponents" JSONB`);
              await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_pages" ADD COLUMN IF NOT EXISTS "layoutStyles" JSONB`);
              
              // Migrate existing legacy data securely if present
              await (database as any).executeSQL(`
                UPDATE "${schemaName}"."cms_pages"
                SET 
                  "layoutHtml" = COALESCE("layoutHtml", "grapesHtml"),
                  "layoutCss" = COALESCE("layoutCss", "grapesCss"),
                  "layoutComponents" = COALESCE("layoutComponents", "grapesComponents"),
                  "layoutStyles" = COALESCE("layoutStyles", "grapesStyles")
                WHERE "layoutHtml" IS NULL AND "grapesHtml" IS NOT NULL
              `);
              await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_pages" ADD COLUMN IF NOT EXISTS "hasUnpublishedChanges" BOOLEAN DEFAULT false`);
              app.log.info("Migrated cms_pages to include custom layout and components columns.");
            } catch (pErr: any) {
              app.log.warn(`Pages table column migration warning: ${pErr.message}`);
            }
            // Migrate cms_posts to include tags TEXT column if table already existed
            try {
              await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_posts" ADD COLUMN IF NOT EXISTS "tags" TEXT`);
              await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_posts" ADD COLUMN IF NOT EXISTS "hasUnpublishedChanges" BOOLEAN DEFAULT false`);
              await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_posts" ADD COLUMN IF NOT EXISTS "publishedTitle" VARCHAR(255)`);
              await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_posts" ADD COLUMN IF NOT EXISTS "publishedContent" TEXT`);
              await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_posts" ADD COLUMN IF NOT EXISTS "publishedExcerpt" TEXT`);
              await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_posts" ADD COLUMN IF NOT EXISTS "publishedTags" TEXT`);
              await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_posts" ADD COLUMN IF NOT EXISTS "publishedFeatureImage" TEXT`);
              await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_posts" ADD COLUMN IF NOT EXISTS "publishedSeoMetadata" JSONB`);
              await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_posts" ADD COLUMN IF NOT EXISTS "areCommentsEnabled" BOOLEAN DEFAULT true`);
              await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_posts" ADD COLUMN IF NOT EXISTS "author" VARCHAR(255)`);
              await (database as any).executeSQL(`ALTER TABLE "${schemaName}"."cms_posts" ADD COLUMN IF NOT EXISTS "publishedAuthor" VARCHAR(255)`);
              app.log.info("Migrated cms_posts schema to include tags, draft/published copy, comments, and author columns.");
            } catch (postErr: any) {
              app.log.warn(`Posts table column migration warning: ${postErr.message}`);
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
      const storage = new Storage({ bucket: process.env.SWIFTBASE_STORAGE_BUCKET || "cms-site-assets" });
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
      const storage = new Storage({ bucket: process.env.SWIFTBASE_STORAGE_BUCKET || "cms-site-assets" });
      const s3Res = await storage.getObject(`assets/${key}`);
      
      const contentType = s3Res.headers.get("Content-Type") || "application/octet-stream";
      reply.header("Content-Type", contentType);
      
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

      const storage = new Storage({ bucket: process.env.SWIFTBASE_STORAGE_BUCKET || "cms-site-assets" });
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

      const storage = new Storage({ bucket: process.env.SWIFTBASE_STORAGE_BUCKET || "cms-site-assets" });
      const postHtml = await storage.getObjectAsText(`blog/${postSlug}/index.html`);
      reply.header("Content-Type", "text/html");
      return reply.send(postHtml);
    } catch (err) {
      return reply.code(404).send("Blog post not found in storage");
    }
  });

  app.get("/:slug", async (request: any, reply) => {
    const { slug } = request.params;
    if (slug === "api" || slug === "admin" || slug === "blog") {
      return reply.code(404).send({ error: "Not Found" });
    }
    return servePage(request, reply, slug);
  });

  // Fallback route to serve SPA frontend
  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith("/api")) {
      return reply.code(404).send({ error: "API Route Not Found" });
    }
    if (request.url.startsWith("/admin")) {
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
  }, { prefix: "/api" });

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
