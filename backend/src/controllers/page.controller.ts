import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, Storage, getProfile } from "swiftbase-admin-sdk";
import type { CMSPage, CMSSettings, CMSProduct } from "swiftbase-cms-shared";
import { getCartDrawerAndScriptHtml } from "./cart.helper.js";

const database = db(process.env.SWIFTBASE_DATABASE_NAME || "cms");

function normalizePage(rawPage: any): CMSPage {
  if (!rawPage) return rawPage;
  return {
    id: rawPage.id,
    projectId: rawPage.projectId ?? rawPage.projectid,
    slug: rawPage.slug,
    title: rawPage.title,
    layoutHtml: rawPage.layoutHtml ?? rawPage.layouthtml ?? rawPage.grapesHtml ?? rawPage.grapeshtml,
    layoutCss: rawPage.layoutCss ?? rawPage.layoutcss ?? rawPage.grapesCss ?? rawPage.grapescss,
    layoutComponents: typeof (rawPage.layoutComponents ?? rawPage.layoutcomponents ?? rawPage.grapesComponents ?? rawPage.grapescomponents) === "string"
      ? JSON.parse(rawPage.layoutComponents ?? rawPage.layoutcomponents ?? rawPage.grapesComponents ?? rawPage.grapescomponents)
      : (rawPage.layoutComponents ?? rawPage.layoutcomponents ?? rawPage.grapesComponents ?? rawPage.grapescomponents),
    layoutStyles: typeof (rawPage.layoutStyles ?? rawPage.layoutstyles ?? rawPage.grapesStyles ?? rawPage.grapesstyles) === "string"
      ? JSON.parse(rawPage.layoutStyles ?? rawPage.layoutstyles ?? rawPage.grapesStyles ?? rawPage.grapesstyles)
      : (rawPage.layoutStyles ?? rawPage.layoutstyles ?? rawPage.grapesStyles ?? rawPage.grapesstyles),
    seoMetadata: typeof (rawPage.seoMetadata ?? rawPage.seometadata) === "string"
      ? JSON.parse(rawPage.seoMetadata ?? rawPage.seometadata)
      : (rawPage.seoMetadata ?? rawPage.seometadata),
    isPublished: rawPage.isPublished ?? rawPage.ispublished,
    hasUnpublishedChanges: rawPage.hasUnpublishedChanges ?? rawPage.hasunpublishedchanges ?? false,
    createdAt: rawPage.createdAt ?? rawPage.createdat,
    updatedAt: rawPage.updatedAt ?? rawPage.updatedat,
  };
}

function normalizeSettings(rawSettings: any): CMSSettings {
  if (!rawSettings) return rawSettings;
  return {
    id: rawSettings.id,
    projectId: rawSettings.projectId ?? rawSettings.projectid,
    siteTitle: rawSettings.siteTitle ?? rawSettings.sitetitle,
    siteDomain: rawSettings.siteDomain ?? rawSettings.sitedomain,
    isBlogEnabled: Boolean(rawSettings.isBlogEnabled ?? rawSettings.isblogenabled ?? false),
    isStoreEnabled: Boolean(rawSettings.isStoreEnabled ?? rawSettings.isstoreenabled ?? false),
    stripePublishableKey: rawSettings.stripePublishableKey ?? rawSettings.stripepublishablekey,
    stripeWebhookSecret: rawSettings.stripeWebhookSecret ?? rawSettings.stripewebhooksecret,
    postmarkApiToken: rawSettings.postmarkApiToken ?? rawSettings.postmarkapitoken,
    postmarkFromEmail: rawSettings.postmarkFromEmail ?? rawSettings.postmarkfromemail,
    postmarkNotifyOnOrder: rawSettings.postmarkNotifyOnOrder !== undefined ? Boolean(rawSettings.postmarkNotifyOnOrder) : (rawSettings.postmarknotifyonorder !== undefined ? Boolean(rawSettings.postmarknotifyonorder) : true),
    navbarLogo: rawSettings.navbarLogo ?? rawSettings.navbarlogo,
    navbarLinks: typeof (rawSettings.navbarLinks ?? rawSettings.navbarlinks) === "string" 
      ? JSON.parse(rawSettings.navbarLinks ?? rawSettings.navbarlinks) 
      : (rawSettings.navbarLinks ?? rawSettings.navbarlinks),
    footerText: rawSettings.footerText ?? rawSettings.footertext,
    footerLinks: typeof (rawSettings.footerLinks ?? rawSettings.footerlinks) === "string" 
      ? JSON.parse(rawSettings.footerLinks ?? rawSettings.footerlinks) 
      : (rawSettings.footerLinks ?? rawSettings.footerlinks),
    faviconUrl: rawSettings.faviconUrl ?? rawSettings.faviconurl,
    globalStyles: rawSettings.globalStyles ?? rawSettings.globalstyles,
    navbarHtml: rawSettings.navbarHtml ?? rawSettings.navbarhtml,
    navbarCss: rawSettings.navbarCss ?? rawSettings.navbarcss,
    navbarComponents: typeof (rawSettings.navbarComponents ?? rawSettings.navbarcomponents) === "string"
      ? JSON.parse(rawSettings.navbarComponents ?? rawSettings.navbarcomponents)
      : (rawSettings.navbarComponents ?? rawSettings.navbarcomponents),
    navbarStyles: typeof (rawSettings.navbarStyles ?? rawSettings.navbarstyles) === "string"
      ? JSON.parse(rawSettings.navbarStyles ?? rawSettings.navbarstyles)
      : (rawSettings.navbarStyles ?? rawSettings.navbarstyles),
    footerHtml: rawSettings.footerHtml ?? rawSettings.footerhtml,
    footerCss: rawSettings.footerCss ?? rawSettings.footercss,
    footerComponents: typeof (rawSettings.footerComponents ?? rawSettings.footercomponents) === "string"
      ? JSON.parse(rawSettings.footerComponents ?? rawSettings.footercomponents)
      : (rawSettings.footerComponents ?? rawSettings.footercomponents),
    footerStyles: typeof (rawSettings.footerStyles ?? rawSettings.footerstyles) === "string"
      ? JSON.parse(rawSettings.footerStyles ?? rawSettings.footerstyles)
      : (rawSettings.footerStyles ?? rawSettings.footerstyles),
    areCommentsEnabledGlobally: Boolean(rawSettings.areCommentsEnabledGlobally ?? rawSettings.arecommentsenabledglobally ?? true),
    postmarkNotifyStaffOnOrder: rawSettings.postmarkNotifyStaffOnOrder !== undefined ? Boolean(rawSettings.postmarkNotifyStaffOnOrder) : (rawSettings.postmarknotifystaffonorder !== undefined ? Boolean(rawSettings.postmarknotifystaffonorder) : true),
    adminNotificationEmails: rawSettings.adminNotificationEmails ?? rawSettings.adminnotificationemails ?? "",
    createdAt: rawSettings.createdAt ?? rawSettings.createdat,
    updatedAt: rawSettings.updatedAt ?? rawSettings.updatedat,
  };
}

export function registerPageRoutes(app: FastifyInstance) {
  app.get("/pages/test-debug", async (request, reply) => {
    try {
      const res = await database("cms_pages").execute();
      return reply.send(res.data);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // --- Profile & Auth ---
  app.get("/profile", async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader) return reply.code(401).send({ message: "Unauthorized" });
      const token = authHeader.split(" ")[1];
      const { setAccessToken } = await import("swiftbase-admin-sdk");
      setAccessToken(token);
      const profile = await getProfile();
      return reply.send(profile);
    } catch (err: any) {
      return reply.code(401).send({ message: "Unauthorized", error: err.message });
    }
  });

  app.put("/profile", async (request: FastifyRequest<{ Body: { firstName: string; lastName: string; email: string } }>, reply) => {
    try {
      const { firstName, lastName, email } = request.body;
      const { updateProfile } = await import("swiftbase-admin-sdk");
      const authHeader = request.headers.authorization;
      if (!authHeader) return reply.code(401).send({ message: "Unauthorized" });
      const token = authHeader.split(" ")[1];
      const { setAccessToken } = await import("swiftbase-admin-sdk");
      setAccessToken(token);
      await updateProfile({ firstName, lastName });
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.code(500).send({ message: err.message });
    }
  });

  app.post("/profile/password", async (request: FastifyRequest<{ Body: { oldPassword?: string; newPassword?: string } }>, reply) => {
    try {
      const { oldPassword, newPassword } = request.body;
      const { changePassword } = await import("swiftbase-admin-sdk");
      const authHeader = request.headers.authorization;
      if (!authHeader) return reply.code(401).send({ message: "Unauthorized" });
      const token = authHeader.split(" ")[1];
      const { setAccessToken } = await import("swiftbase-admin-sdk");
      setAccessToken(token);
      if (oldPassword && newPassword) {
        await changePassword({ currentPassword: oldPassword, newPassword });
      }
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.code(500).send({ message: err.message });
    }
  });

  app.post("/logout", async (request, reply) => {
    return reply.send({ success: true });
  });

  // --- Settings ---
  app.get("/settings", async (request, reply) => {
    try {
      const res = await database("cms_settings").execute();
      const rawSettings = res.data[0];
      const settings = rawSettings ? normalizeSettings(rawSettings) : {
        id: "settings-default",
        projectId: "swiftbase",
        siteTitle: "My SBCMS Site",
        isBlogEnabled: false,
        isStoreEnabled: false,
      };
      return reply.send(settings);
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  // --- Data Import/Export ---
  app.get("/export", async (request, reply) => {
    try {
      const settingsRes = await database("cms_settings").execute();
      const pagesRes = await database("cms_pages").execute();
      const postsRes = await database("cms_posts").execute();
      const productsRes = await database("cms_products").execute();
      const commentsRes = await database("cms_comments").execute();

      const exportData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        settings: (settingsRes.data || []).map(normalizeSettings),
        pages: (pagesRes.data || []).map(normalizePage),
        posts: postsRes.data || [],
        products: productsRes.data || [],
        comments: commentsRes.data || []
      };

      reply.header("Content-Disposition", `attachment; filename="sbcms-export-${Date.now()}.json"`);
      reply.header("Content-Type", "application/json");
      return reply.send(JSON.stringify(exportData, null, 2));
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  app.post("/import", async (request: FastifyRequest<{ Body: any }>, reply) => {
    try {
      const payload: any = request.body;
      if (!payload || typeof payload !== "object") {
        return reply.status(400).send({ message: "Invalid JSON format" });
      }

      // Import Settings
      if (payload.settings && Array.isArray(payload.settings) && payload.settings.length > 0) {
        const settingsObj = payload.settings[0];
        const existingRes = await database("cms_settings").execute();
        if (existingRes.data && existingRes.data.length > 0) {
          await database("cms_settings").where("id", existingRes.data[0].id).update(settingsObj).execute();
        } else {
          await database("cms_settings").insert(settingsObj).execute();
        }
      } else if (payload.settings && typeof payload.settings === "object" && !Array.isArray(payload.settings)) {
        const existingRes = await database("cms_settings").execute();
        if (existingRes.data && existingRes.data.length > 0) {
          await database("cms_settings").where("id", existingRes.data[0].id).update(payload.settings).execute();
        } else {
          await database("cms_settings").insert(payload.settings).execute();
        }
      }

      // Import Pages
      if (payload.pages && Array.isArray(payload.pages)) {
        for (const p of payload.pages) {
          if (!p.id || !p.slug) continue;
          const existing = await database("cms_pages").where("id", p.id).execute();
          if (existing.data && existing.data.length > 0) {
            await database("cms_pages").where("id", p.id).update(p).execute();
          } else {
            await database("cms_pages").insert(p).execute();
          }
        }
      }

      // Import Posts
      if (payload.posts && Array.isArray(payload.posts)) {
        for (const post of payload.posts) {
          if (!post.id) continue;
          const existing = await database("cms_posts").where("id", post.id).execute();
          if (existing.data && existing.data.length > 0) {
            await database("cms_posts").where("id", post.id).update(post).execute();
          } else {
            await database("cms_posts").insert(post).execute();
          }
        }
      }

      // Import Products
      if (payload.products && Array.isArray(payload.products)) {
        for (const prod of payload.products) {
          if (!prod.id) continue;
          const existing = await database("cms_products").where("id", prod.id).execute();
          if (existing.data && existing.data.length > 0) {
            await database("cms_products").where("id", prod.id).update(prod).execute();
          } else {
            await database("cms_products").insert(prod).execute();
          }
        }
      }

      // Import Comments
      if (payload.comments && Array.isArray(payload.comments)) {
        for (const c of payload.comments) {
          if (!c.id) continue;
          const existing = await database("cms_comments").where("id", c.id).execute();
          if (existing.data && existing.data.length > 0) {
            await database("cms_comments").where("id", c.id).update(c).execute();
          } else {
            await database("cms_comments").insert(c).execute();
          }
        }
      }

      // Import Containers (if payload contains container settings)
      if (payload.containers && Array.isArray(payload.containers)) {
        for (const containerItem of payload.containers) {
          if (!containerItem.id) continue;
          try {
            const existing = await database("containers").where("id", containerItem.id).execute();
            if (existing.data && existing.data.length > 0) {
              await database("containers").where("id", containerItem.id).update(containerItem).execute();
            } else {
              await database("containers").insert(containerItem).execute();
            }
          } catch (cErr: any) {
            request.log.warn(`Container import warning: ${cErr.message}`);
          }
        }
      }

      return reply.send({ success: true, message: "Data imported successfully!" });
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  app.get("/auth-config", async (request, reply) => {
    return reply.send({
      projectId: process.env.SWIFTBASE_PROJECT_ID,
      authorityUrl: process.env.SWIFTBASE_BASE_URL || "https://api.swiftbase.io",
    });
  });

  app.put("/settings", async (request: FastifyRequest<{ Body: Partial<CMSSettings> }>, reply) => {
    try {
      const body = request.body as any;
      const res = await database("cms_settings").execute();
      const existing = res.data[0];
      let updatedSettings: CMSSettings;

      const VALID_SETTINGS_COLUMNS = [
        "id",
        "projectId",
        "siteTitle",
        "siteDomain",
        "isBlogEnabled",
        "isStoreEnabled",
        "stripePublishableKey",
        "stripeWebhookSecret",
        "postmarkApiToken",
        "postmarkFromEmail",
        "postmarkNotifyOnOrder",
        "postmarkNotifyStaffOnOrder",
        "adminNotificationEmails",
        "navbarLogo",
        "navbarLinks",
        "footerText",
        "footerLinks",
        "faviconUrl",
        "globalStyles",
        "navbarHtml",
        "navbarCss",
        "navbarComponents",
        "navbarStyles",
        "footerHtml",
        "footerCss",
        "footerComponents",
        "footerStyles",
        "areCommentsEnabledGlobally",
        "createdAt",
        "updatedAt"
      ];

      const cleanSettingsPayload: any = {};
      for (const col of VALID_SETTINGS_COLUMNS) {
        if (body[col] !== undefined) {
          cleanSettingsPayload[col] = body[col];
        } else if (body[col.toLowerCase()] !== undefined) {
          cleanSettingsPayload[col] = body[col.toLowerCase()];
        } else if (existing) {
          const existingValue = existing[col] !== undefined ? existing[col] : existing[col.toLowerCase()];
          if (existingValue !== undefined) {
            cleanSettingsPayload[col] = existingValue;
          }
        }
      }

      const JSON_FIELDS = ["navbarLinks", "footerLinks", "navbarComponents", "navbarStyles", "footerComponents", "footerStyles"];
      for (const field of JSON_FIELDS) {
        if (cleanSettingsPayload[field] !== undefined && typeof cleanSettingsPayload[field] !== "string") {
          cleanSettingsPayload[field] = JSON.stringify(cleanSettingsPayload[field]);
        }
      }

      if (existing) {
        const rawUpdated = {
          ...cleanSettingsPayload,
          updatedAt: new Date().toISOString(),
        };
        await database("cms_settings")
          .where("id", existing.id)
          .update(rawUpdated)
          .execute();
        updatedSettings = normalizeSettings(rawUpdated);
      } else {
        const rawNew = {
          id: `settings-${Date.now()}`,
          projectId: "swiftbase",
          siteTitle: "My SBCMS Site",
          isBlogEnabled: false,
          isStoreEnabled: false,
          ...cleanSettingsPayload,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await database("cms_settings")
          .insert(rawNew)
          .execute();
        updatedSettings = normalizeSettings(rawNew);
      }

      // Automatically re-publish all published pages in the background so that
      // navbar/footer/styles/favicon changes and dynamic widgets propagate immediately.
      rebuildAllPublishedPages().catch((republishErr) => {
        console.error("Failed to background republish pages on settings update:", republishErr);
      });

      return reply.send(updatedSettings);
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  // --- Pages ---
  app.get("/pages", async (request, reply) => {
    try {
      const res = await database("cms_pages").execute();
      const normalized = res.data.map((p: any) => normalizePage(p));
      return reply.send(normalized);
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  app.get("/pages/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const { id } = request.params;
      const res = await database("cms_pages").where("id", id).execute();
      const page = res.data[0];
      if (!page) return reply.status(404).send({ message: "Page not found" });
      return reply.send(normalizePage(page));
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  app.post("/pages", async (request: FastifyRequest<{ Body: Partial<CMSPage> }>, reply) => {
    try {
      const body = request.body as any;
      const newPage = {
        id: `page-${Date.now()}`,
        projectId: process.env.SWIFTBASE_PROJECT_ID || "swiftbase",
        slug: body.slug || "home",
        title: body.title || "Untitled Page",
        layoutHtml: body.layoutHtml ?? body.grapesHtml ?? "",
        layoutCss: body.layoutCss ?? body.grapesCss ?? "",
        layoutComponents: typeof (body.layoutComponents ?? body.grapesComponents) === "string" ? (body.layoutComponents ?? body.grapesComponents) : JSON.stringify(body.layoutComponents ?? body.grapesComponents ?? {}),
        layoutStyles: typeof (body.layoutStyles ?? body.grapesStyles) === "string" ? (body.layoutStyles ?? body.grapesStyles) : JSON.stringify(body.layoutStyles ?? body.grapesStyles ?? {}),
        seoMetadata: typeof body.seoMetadata === "string" ? body.seoMetadata : JSON.stringify(body.seoMetadata || { title: "", description: "" }),
        isPublished: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await database("cms_pages").insert(newPage).execute();
      return reply.send(normalizePage(newPage));
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  app.put("/pages/:id", async (request: FastifyRequest<{ Params: { id: string }; Body: Partial<CMSPage> }>, reply) => {
    try {
      const { id } = request.params;
      const body = request.body as any;
      const res = await database("cms_pages").where("id", id).execute();
      const existing = normalizePage(res.data[0]);
      if (!existing) return reply.status(404).send({ message: "Page not found" });

      const updatedPage = {
        title: body.title !== undefined ? body.title : existing.title,
        slug: body.slug !== undefined ? body.slug : existing.slug,
        layoutHtml: body.layoutHtml !== undefined ? body.layoutHtml : (body.grapesHtml !== undefined ? body.grapesHtml : existing.layoutHtml),
        layoutCss: body.layoutCss !== undefined ? body.layoutCss : (body.grapesCss !== undefined ? body.grapesCss : existing.layoutCss),
        layoutComponents: typeof (body.layoutComponents !== undefined ? body.layoutComponents : (body.grapesComponents !== undefined ? body.grapesComponents : existing.layoutComponents)) === "string"
          ? JSON.parse((body.layoutComponents !== undefined ? body.layoutComponents : (body.grapesComponents !== undefined ? body.grapesComponents : existing.layoutComponents)) as string)
          : (body.layoutComponents !== undefined ? body.layoutComponents : (body.grapesComponents !== undefined ? body.grapesComponents : existing.layoutComponents)),
        layoutStyles: typeof (body.layoutStyles !== undefined ? body.layoutStyles : (body.grapesStyles !== undefined ? body.grapesStyles : existing.layoutStyles)) === "string"
          ? JSON.parse((body.layoutStyles !== undefined ? body.layoutStyles : (body.grapesStyles !== undefined ? body.grapesStyles : existing.layoutStyles)) as string)
          : (body.layoutStyles !== undefined ? body.layoutStyles : (body.grapesStyles !== undefined ? body.grapesStyles : existing.layoutStyles)),
        seoMetadata: typeof (body.seoMetadata !== undefined ? body.seoMetadata : existing.seoMetadata) === "string"
          ? JSON.parse(body.seoMetadata as any)
          : (body.seoMetadata !== undefined ? body.seoMetadata : existing.seoMetadata),
        isPublished: body.isPublished !== undefined ? body.isPublished : existing.isPublished,
        hasUnpublishedChanges: true,
        updatedAt: new Date().toISOString(),
      };

      await database("cms_pages").where("id", id).update(updatedPage).execute();
      return reply.send(normalizePage(updatedPage));
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  app.delete("/pages/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const { id } = request.params;
      await database("cms_pages").where("id", id).delete().execute();
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  app.post("/pages/:id/publish", async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const { id } = request.params;
      const res = await database("cms_pages").where("id", id).execute();
      const page = normalizePage(res.data[0]);
      if (!page) return reply.status(404).send({ message: "Page not found" });

      // Fetch settings to check if modules are enabled
      const settingsRes = await database("cms_settings").execute();
      const rawSettings = settingsRes.data[0];
      const settings = rawSettings ? normalizeSettings(rawSettings) : { isBlogEnabled: false, isStoreEnabled: false } as any;

      const compiledHtml = await compilePageHtml(page, settings);

      // Upload using pre-signed Storage SDK
      const endpoint = `${(process.env.SWIFTBASE_URL || process.env.SWIFTBASE_API_URL || "https://api.swiftbase.io").replace(/\/$/, "")}/storage`;
      const storage = new Storage({ bucket: process.env.SWIFTBASE_STORAGE_BUCKET!, endpoint });
      const targetKey = page.slug === "home" ? "index.html" : `${page.slug}/index.html`;
      await storage.putObject(targetKey, compiledHtml, { contentType: "text/html" });

      // Update publish status in DB
      await database("cms_pages").where("id", id).update({ ...page, isPublished: true, hasUnpublishedChanges: false }).execute();

      return reply.send({ success: true, url: `/prd_storage/sites/${targetKey}` });
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });
}

export async function compilePageHtml(page: CMSPage, settings: CMSSettings): Promise<string> {
  const processedLayoutHtml = page.layoutHtml ? await injectDynamicBlocks(page.layoutHtml) : `
    <div class="p-8 text-center"><h1 class="text-4xl font-black">Welcome</h1></div>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${settings.siteTitle || "SBCMS"} - ${page.seoMetadata?.title || page.title}</title>
  <meta name="description" content="${page.seoMetadata?.description || ''}">
  ${settings.faviconUrl ? `<link rel="icon" href="${settings.faviconUrl}">` : ""}
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    ${page.layoutCss || ""}
    ${settings.navbarCss || ""}
    ${settings.footerCss || ""}
    ${settings.globalStyles || ""}
  </style>
</head>
<body class="bg-base-100 text-base-content min-h-screen flex flex-col">
  <!-- Nav Bar -->
  ${settings.navbarHtml ? settings.navbarHtml : `
  <header class="bg-slate-900 text-white p-4 flex justify-between items-center shadow-lg">
    <a href="/" class="text-xl font-black tracking-tighter">${settings.navbarLogo || settings.siteTitle || "SBCMS"}</a>
    <nav class="flex gap-6 font-bold text-sm">
      ${settings.navbarLinks && settings.navbarLinks.length > 0 
        ? settings.navbarLinks.map((link: any) => `<a href="${link.url}" class="hover:text-primary">${link.label}</a>`).join("\n    ")
        : `
      <a href="/" class="hover:text-primary">Home</a>
      ${settings.isBlogEnabled ? '<a href="/blog" class="hover:text-primary">Blog</a>' : ""}
      ${settings.isStoreEnabled ? '<a href="/store" class="hover:text-primary">Store</a>' : ""}
        `
      }
    </nav>
  </header>
  `}

  <!-- Page Content -->
  <main class="flex-1">
    ${processedLayoutHtml}
  </main>

  <!-- Footer -->
  ${settings.footerHtml ? settings.footerHtml : `
  <footer class="bg-slate-900 text-white p-6 text-center text-xs opacity-60">
    <div class="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
      <p>${settings.footerText || `&copy; ${new Date().getFullYear()} ${settings.siteTitle || "SBCMS"}. Powered by Swiftbase.`}</p>
      ${settings.footerLinks && settings.footerLinks.length > 0 ? `
      <div class="flex gap-4 font-bold">
        ${settings.footerLinks.map((link: any) => `<a href="${link.url}" class="hover:text-primary">${link.label}</a>`).join("\n      ")}
      </div>
      ` : ""}
    </div>
  </footer>
  `}

  <!-- Web Analytics Tracker -->
  <script>
    (function() {
      const trackEvent = (type, custom = {}) => {
        fetch('/api/analytics/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: window.location.pathname,
            referrer: document.referrer,
            browser: navigator.userAgent,
            operatingSystem: navigator.platform,
            deviceType: window.innerWidth < 768 ? 'mobile' : 'desktop',
            conversionName: type === 'conversion' ? custom.name : undefined
          })
        }).catch(err => console.error('Analytics tracking failed:', err));
      };
      // Track Pageview
      trackEvent('pageview');
      window.trackCMSConversion = (name) => trackEvent('conversion', { name });
    })();
  </script>
  ${settings.isStoreEnabled ? getCartDrawerAndScriptHtml() : ""}
</body>
</html>`;
}

export async function rebuildAllPublishedPages() {
  const pagesRes = await database("cms_pages").where("isPublished", true).execute();
  const settingsRes = await database("cms_settings").execute();
  const rawSettings = settingsRes.data[0];
  const settings = rawSettings ? normalizeSettings(rawSettings) : { isBlogEnabled: false, isStoreEnabled: false, siteTitle: "SBCMS" } as any;

  const endpoint = `${(process.env.SWIFTBASE_URL || process.env.SWIFTBASE_API_URL || "https://api.swiftbase.io").replace(/\/$/, "")}/storage`;
  const storage = new Storage({ bucket: process.env.SWIFTBASE_STORAGE_BUCKET!, endpoint });

  for (const rawPage of pagesRes.data) {
    const page = normalizePage(rawPage);
    const compiledHtml = await compilePageHtml(page, settings);
    const targetKey = page.slug === "home" ? "index.html" : `${page.slug}/index.html`;
    await storage.putObject(targetKey, compiledHtml, { contentType: "text/html" });
  }
}

function parseJSONField<T>(field: any, defaultValue: T): T {
  if (field === null || field === undefined) return defaultValue;
  if (typeof field === "object") return field as T;
  try {
    return JSON.parse(field);
  } catch {
    return defaultValue;
  }
}

function normalizeProduct(p: any): CMSProduct {
  return {
    ...p,
    priceCents: Number(p.priceCents) || 0,
    inStock: p.inStock === 1 || p.inStock === true || p.inStock === "1" || p.inStock === "true",
    isPhysical: p.isPhysical === 1 || p.isPhysical === true || p.isPhysical === "1" || p.isPhysical === "true",
    stockQuantity: p.stockQuantity !== null && p.stockQuantity !== undefined ? Number(p.stockQuantity) : null,
    limitPerOrder: p.limitPerOrder !== null && p.limitPerOrder !== undefined ? Number(p.limitPerOrder) : null,
    images: parseJSONField<string[]>(p.images, []),
    affiliateLinks: parseJSONField(p.affiliateLinks, []),
    customOrderFields: parseJSONField(p.customOrderFields, []),
    shippingDetails: parseJSONField(p.shippingDetails, {}),
    addOnProductIds: parseJSONField<string[]>(p.addOnProductIds, []),
  };
}

async function injectDynamicBlocks(html: string): Promise<string> {
  const postsRegex = /<div class="([^"]*recent-posts-block[^"]*)" data-limit="(\d+)" data-tags="([^"]*)"><\/div>/g;
  const productsRegex = /<div class="([^"]*cms-products-widget[^"]*)"([^>]*)><\/div>/g;

  let newHtml = html;

  // 1. Process recent-posts-block
  if (newHtml.includes("recent-posts-block")) {
    let posts: any[] = [];
    try {
      const postsRes = await database("cms_posts").execute();
      posts = postsRes.data.filter((p: any) => p.status === "published");
    } catch (err) {
      console.error("Failed to load posts for dynamic block inject:", err);
    }

    newHtml = await replaceAsync(newHtml, postsRegex, async (fullMatch, classes, limitStr, tagsStr) => {
      const limit = parseInt(limitStr || "5", 10);
      const tags = tagsStr ? tagsStr.split(",").map((t: string) => t.trim().toLowerCase()).filter(Boolean) : [];
      
      let filtered = [...posts];
      if (tags.length > 0) {
        filtered = filtered.filter((post) => {
          if (!post.tags) return false;
          const postTags = post.tags.split(",").map((t: string) => t.trim().toLowerCase());
          return tags.some((tag: string) => postTags.includes(tag));
        });
      }
      
      filtered.sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return dateB - dateA;
      });
      
      const postsToShow = filtered.slice(0, limit);
      
      if (postsToShow.length === 0) {
        return `<div class="${classes} text-center py-8 opacity-50"><p class="text-xs font-semibold uppercase">No blog posts found</p></div>`;
      }
      
      const postsHtml = postsToShow.map((post) => `
        <article class="flex flex-col md:flex-row gap-6 p-6 border border-slate-200 bg-white rounded-3xl shadow-sm hover:shadow-md transition-all duration-200">
          ${post.featureImage ? `
          <div class="w-full md:w-48 h-32 shrink-0 bg-slate-100 rounded-2xl overflow-hidden">
            <img src="${post.featureImage}" class="w-full h-full object-cover" />
          </div>` : ""}
          <div class="flex-1 min-w-0 flex flex-col justify-between">
            <div>
              <h3 class="text-xl font-black text-slate-900 mb-2 truncate">${post.title}</h3>
              <p class="text-sm text-slate-600 line-clamp-2 leading-relaxed mb-4">${post.excerpt || 'Read this article on our blog.'}</p>
            </div>
            <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
              <span>${post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ""}</span>
              <a href="/blog/${post.slug}" class="text-primary font-black hover:underline">Read Article &rarr;</a>
            </div>
          </div>
        </article>
      `).join("");

      return `<div class="${classes} space-y-6">${postsHtml}</div>`;
    });
  }

  // 2. Process cms-products-widget
  if (newHtml.includes("cms-products-widget")) {
    let rawProducts: any[] = [];
    try {
      const prodRes = await database("cms_products").execute();
      rawProducts = (prodRes.data || []).map(normalizeProduct);
    } catch (err) {
      console.error("Failed to load products for dynamic block inject:", err);
    }

    newHtml = await replaceAsync(newHtml, productsRegex, async (fullMatch, classes, attrString) => {
      const getAttr = (name: string): string => {
        const m = attrString.match(new RegExp(`${name}="([^"]*)"`, 'i'));
        return m ? m[1] : "";
      };

      const limit = parseInt(getAttr("data-limit") || "6", 10);
      const rawDefaultCat = (getAttr("data-default-category") || "").trim().toLowerCase();
      const rawExcludeCat = (getAttr("data-exclude-category") || "").trim().toLowerCase();
      const isNegated = rawDefaultCat.startsWith("!") || rawDefaultCat.startsWith("not:");
      const defaultExcludeCategory = rawExcludeCat || (isNegated ? rawDefaultCat.replace(/^(!|not:)/, "").trim() : "");
      const defaultCategory = isNegated ? "" : rawDefaultCat;
      const defaultInStockOnly = getAttr("data-default-instock") === "true";
      const showSearch = getAttr("data-show-search") !== "false";
      const showCategories = getAttr("data-show-categories") !== "false";

      // Strict server-side hidden default filter enforcement
      let candidateProducts = rawProducts.filter(p => {
        if (defaultInStockOnly && !p.inStock) return false;
        const cat = (p.category || "").trim().toLowerCase();
        if (defaultCategory && cat !== defaultCategory) return false;
        if (defaultExcludeCategory && cat === defaultExcludeCategory) return false;
        return true;
      });

      const totalMatching = candidateProducts.length;
      const productsToShow = candidateProducts.slice(0, limit);

      if (productsToShow.length === 0) {
        return `<div class="${classes} text-center py-12 border border-dashed border-slate-200 rounded-3xl opacity-50"><p class="text-xs font-bold uppercase tracking-wider">No products available</p></div>`;
      }

      // Collect unique categories available among the candidate products for visitor filter pills
      const categoriesAvailable = Array.from(new Set(
        candidateProducts.map(p => (p.category || "").trim()).filter(Boolean)
      ));

      const widgetInstanceId = `pw_${Math.random().toString(36).substring(2, 9)}`;

      // Client data payload safely embedded for visitor search / filter within the authorized candidate set
      const safeClientProducts = productsToShow.map(p => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description || "",
        priceCents: p.priceCents,
        inStock: p.inStock,
        category: p.category || "",
        image: p.images && p.images.length > 0 ? p.images[0] : ""
      }));

      const filterBarHtml = (showSearch || (showCategories && categoriesAvailable.length > 0)) ? `
        <div class="mb-6 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          ${showSearch ? `
          <div class="relative flex-1 max-w-sm">
            <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </span>
            <input type="text" id="${widgetInstanceId}_search" placeholder="Search products..." oninput="window['${widgetInstanceId}_filter']()" class="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" />
          </div>` : `<div></div>`}

          ${showCategories && categoriesAvailable.length > 0 ? `
          <div class="flex flex-wrap gap-2 items-center" id="${widgetInstanceId}_cats">
            <button type="button" onclick="window['${widgetInstanceId}_setCat']('')" class="category-pill active px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-slate-900 text-white" data-cat="">All</button>
            ${categoriesAvailable.map(cat => `
              <button type="button" onclick="window['${widgetInstanceId}_setCat']('${cat.replace(/'/g, "\\'")}')" class="category-pill px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-slate-100 text-slate-700 hover:bg-slate-200" data-cat="${cat.replace(/"/g, '&quot;')}">${cat}</button>
            `).join("")}
          </div>` : ""}
        </div>
      ` : "";

      const productCardsHtml = productsToShow.map(p => {
        const imgUrl = p.images && p.images.length > 0 ? p.images[0] : "";
        const formattedPrice = (p.priceCents / 100).toFixed(2);
        const safeName = (p.name || "").replace(/"/g, '&quot;').replace(/'/g, "\\'");
        const safeImg = imgUrl.replace(/"/g, '&quot;').replace(/'/g, "\\'");

        return `
          <div class="product-item-card border border-slate-200 bg-white rounded-3xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between" data-pid="${p.id}" data-cat="${(p.category || '').toLowerCase()}" data-name="${(p.name || '').toLowerCase()}" data-desc="${(p.description || '').replace(/<[^>]*>/g, '').toLowerCase()}">
            <div>
              <div class="relative w-full h-52 bg-slate-100 rounded-2xl overflow-hidden mb-4">
                ${imgUrl ? `<img src="${imgUrl}" class="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />` : `<div class="w-full h-full flex items-center justify-center text-slate-300 font-bold text-xs uppercase tracking-wider">No Image</div>`}
                ${p.category ? `<span class="absolute top-2 left-2 bg-slate-900/70 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-sm">${p.category}</span>` : ""}
                ${!p.inStock ? `<span class="absolute top-2 right-2 bg-rose-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg">Out of Stock</span>` : ""}
              </div>
              <h3 class="text-lg font-black text-slate-900 mb-1 leading-snug">${p.name}</h3>
              <div class="text-xl font-black text-primary mb-3">$${formattedPrice}</div>
              <div class="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-6">${p.description ? p.description.replace(/<[^>]*>/g, '') : ''}</div>
            </div>

            <div class="space-y-2 pt-2 border-t border-slate-100">
              <div class="grid grid-cols-2 gap-2">
                <button type="button" onclick="window.SBCart && window.SBCart.addItem({ id: '${p.id}', name: '${safeName}', priceCents: ${p.priceCents}, image: '${safeImg}' })" class="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs rounded-xl transition-all text-center" ${!p.inStock ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
                  Add to Cart
                </button>
                <button type="button" onclick="window.SBCart ? window.SBCart.buyNow({ id: '${p.id}' }) : (window.location.href='/store/${p.slug}')" class="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all text-center shadow-sm" ${!p.inStock ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
                  Buy Now
                </button>
              </div>
              <a href="/store/${p.slug}" class="block text-center text-[11px] font-bold text-slate-400 hover:text-primary transition-colors py-1">View Details &rarr;</a>
            </div>
          </div>
        `;
      }).join("");

      const clientFilterScript = `
        <script>
          (function() {
            let activeCategory = '';
            window['${widgetInstanceId}_setCat'] = function(cat) {
              activeCategory = (cat || '').toLowerCase();
              const container = document.getElementById('${widgetInstanceId}_cats');
              if (container) {
                const pills = container.querySelectorAll('.category-pill');
                pills.forEach(p => {
                  if (p.getAttribute('data-cat').toLowerCase() === (cat || '').toLowerCase()) {
                    p.classList.add('bg-slate-900', 'text-white');
                    p.classList.remove('bg-slate-100', 'text-slate-700');
                  } else {
                    p.classList.remove('bg-slate-900', 'text-white');
                    p.classList.add('bg-slate-100', 'text-slate-700');
                  }
                });
              }
              window['${widgetInstanceId}_filter']();
            };

            window['${widgetInstanceId}_filter'] = function() {
              const input = document.getElementById('${widgetInstanceId}_search');
              const q = input ? input.value.trim().toLowerCase() : '';
              const grid = document.getElementById('${widgetInstanceId}_grid');
              if (!grid) return;
              const cards = grid.querySelectorAll('.product-item-card');
              let visibleCount = 0;
              cards.forEach(card => {
                const cat = card.getAttribute('data-cat') || '';
                const name = card.getAttribute('data-name') || '';
                const desc = card.getAttribute('data-desc') || '';
                const matchesCat = !activeCategory || cat === activeCategory;
                const matchesSearch = !q || name.includes(q) || desc.includes(q);
                if (matchesCat && matchesSearch) {
                  card.style.display = 'flex';
                  visibleCount++;
                } else {
                  card.style.display = 'none';
                }
              });
              const emptyMsg = document.getElementById('${widgetInstanceId}_empty');
              if (emptyMsg) {
                emptyMsg.style.display = visibleCount === 0 ? 'block' : 'none';
              }
            };
          })();
        </script>
      `;

      return `
        <div class="${classes}">
          ${filterBarHtml}
          <div id="${widgetInstanceId}_grid" class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            ${productCardsHtml}
          </div>
          <div id="${widgetInstanceId}_empty" style="display:none;" class="text-center py-12 border border-dashed border-slate-200 rounded-3xl opacity-50">
            <p class="text-xs font-bold uppercase tracking-wider">No matching products found</p>
          </div>
          ${clientFilterScript}
        </div>
      `;
    });
  }

  // 3. Process cms-ebook-preview-widget (Two-Page Spread with Navigation & Telemetry)
  if (newHtml.includes("cms-ebook-preview-widget")) {
    const previewRegex = /<div class="([^"]*cms-ebook-preview-widget[^"]*)"([^>]*)><\/div>/g;

    newHtml = await replaceAsync(newHtml, previewRegex, async (fullMatch, classes, attrString) => {
      const getAttr = (name: string): string => {
        const m = attrString.match(new RegExp(`${name}="([^"]*)"`, 'i'));
        return m ? m[1] : "";
      };

      const previewId = getAttr("data-preview-id");
      let bookTitle = getAttr("data-book-title") || "Sample Book Preview";
      let author = getAttr("data-author") || "Author Name";
      let coverImage = getAttr("data-cover-image") || "";
      let productId = getAttr("data-product-id") || "";
      let ctaText = getAttr("data-cta-text") || "Buy Full Book";
      let ctaUrl = getAttr("data-cta-url") || (productId ? `/store` : "/store");
      let pages: string[] = [];

      // If previewId is specified, fetch stored preview record
      if (previewId) {
        try {
          const prevRes = await database("cms_ebook_previews").where({ id: previewId }).execute();
          const p = prevRes.data && prevRes.data[0];
          if (p) {
            bookTitle = p.title || bookTitle;
            author = p.author || author;
            coverImage = p.coverImage || coverImage;
            productId = p.productId || productId;
            ctaText = p.ctaText || ctaText;
            ctaUrl = p.ctaUrl || ctaUrl;
            if (p.pages) {
              pages = typeof p.pages === "string" ? JSON.parse(p.pages) : p.pages;
            }
          }
        } catch {}
      }

      if (pages.length === 0) {
        const rawSample = getAttr("data-sample-content") || "Welcome to the sample preview of this book. Enjoy reading this excerpt!";
        let sampleText = rawSample;
        try { sampleText = decodeURIComponent(rawSample.replace(/&quot;/g, '"')); } catch {}
        // Split sample into default pages
        const paras = sampleText.split(/\n\s*\n/).filter(Boolean);
        const mid = Math.ceil(paras.length / 2) || 1;
        pages = [
          paras.slice(0, mid).join("\n\n") || sampleText,
          paras.slice(mid).join("\n\n") || "Enjoy reading the full edition in the store!"
        ];
      }

      // Ensure pages length is even for 2-page spread
      if (pages.length % 2 !== 0) {
        pages.push("*(End of Sample Preview)*");
      }

      const widgetInstanceId = `ebp_${Math.random().toString(36).substring(2, 9)}`;
      const escapedPages = JSON.stringify(pages);

      return `
        <div id="${widgetInstanceId}_root" class="${classes} max-w-5xl mx-auto my-10 p-6 md:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl text-slate-800 dark:text-slate-100 transition-colors">
          <!-- Header Bar -->
          <div class="flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-5 border-b border-slate-200 dark:border-slate-800">
            ${coverImage ? `
            <div class="w-20 h-28 shrink-0 rounded-xl overflow-hidden shadow-md bg-slate-100 dark:bg-slate-800">
              <img src="${coverImage}" class="w-full h-full object-cover" alt="${bookTitle}" />
            </div>` : `
            <div class="w-20 h-28 shrink-0 rounded-xl bg-slate-900 text-white flex flex-col justify-center items-center text-center p-2 shadow-md">
              <span class="text-[9px] font-black uppercase tracking-wider">Preview</span>
            </div>`}

            <div class="flex-1 text-center sm:text-left">
              <div class="inline-block bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md mb-1.5">E-book Sample Reader</div>
              <h3 class="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">${bookTitle}</h3>
              <p class="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">by ${author}</p>
              
              <!-- Quick Controls -->
              <div class="flex items-center justify-center sm:justify-start gap-1.5 mt-3 text-xs">
                <button type="button" onclick="window['${widgetInstanceId}_zoom'](-1)" class="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg font-bold text-xs">A-</button>
                <button type="button" onclick="window['${widgetInstanceId}_zoom'](1)" class="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg font-bold text-xs">A+</button>
                <button type="button" onclick="window['${widgetInstanceId}_toggleTheme']()" class="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg font-bold text-xs">🌓 Theme</button>
              </div>
            </div>

            <div class="shrink-0">
              <a href="${ctaUrl}" onclick="window['${widgetInstanceId}_trackCTA']()" class="btn btn-primary text-white text-xs font-black uppercase tracking-wider rounded-xl px-5 py-2.5 shadow-md flex items-center gap-2">
                ${ctaText} &rarr;
              </a>
            </div>
          </div>

          <!-- Two-Page Open Book Container -->
          <div class="relative py-8">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 relative min-h-[360px] bg-slate-50/60 dark:bg-slate-950/40 p-6 md:p-8 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-inner">
              <!-- Middle Spine Divider -->
              <div class="hidden md:block absolute top-4 bottom-4 left-1/2 -ml-[1px] w-[2px] bg-gradient-to-b from-transparent via-slate-300 dark:via-slate-700 to-transparent"></div>

              <!-- Left Page -->
              <div class="flex flex-col justify-between">
                <div id="${widgetInstanceId}_page_left" class="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-200 leading-relaxed font-serif text-sm transition-all duration-200"></div>
                <div id="${widgetInstanceId}_num_left" class="pt-4 text-center font-mono text-[10px] text-slate-400">1</div>
              </div>

              <!-- Right Page -->
              <div class="flex flex-col justify-between">
                <div id="${widgetInstanceId}_page_right" class="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-200 leading-relaxed font-serif text-sm transition-all duration-200"></div>
                <div id="${widgetInstanceId}_num_right" class="pt-4 text-center font-mono text-[10px] text-slate-400">2</div>
              </div>
            </div>

            <!-- Page Flip Navigation Arrows -->
            <div class="flex items-center justify-between mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button type="button" id="${widgetInstanceId}_prev" onclick="window['${widgetInstanceId}_turn'](-2)" class="btn btn-sm btn-outline rounded-xl font-bold text-xs px-4 flex items-center gap-2">
                &larr; Previous Page
              </button>

              <div id="${widgetInstanceId}_counter" class="text-xs font-mono font-bold text-slate-500">
                Page 1-2 of ${pages.length}
              </div>

              <button type="button" id="${widgetInstanceId}_next" onclick="window['${widgetInstanceId}_turn'](2)" class="btn btn-sm btn-primary text-white rounded-xl font-bold text-xs px-4 flex items-center gap-2">
                Next Page &rarr;
              </button>
            </div>
          </div>

          <script>
            (function() {
              const pages = ${escapedPages};
              const previewId = "${previewId || ''}";
              const sessId = 'sess_' + Math.random().toString(36).substring(2, 10);
              let currentSpread = 0; // 0 means page 0 and 1
              let fontSize = 14;
              let isDark = false;

              function trackEvent(eventType, pageNumber) {
                if (!previewId) return;
                try {
                  navigator.sendBeacon ? 
                    navigator.sendBeacon('/api/ebooks/previews/' + previewId + '/track', JSON.stringify({ eventType, pageNumber, sessionId: sessId })) :
                    fetch('/api/ebooks/previews/' + previewId + '/track', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ eventType, pageNumber, sessionId: sessId })
                    }).catch(() => {});
                } catch(e){}
              }

              function formatMarkdown(text) {
                if (!text) return '';
                return text
                  .replace(/### (.*?)\\n/g, '<h4 class="font-bold text-base mb-2">$1</h4>')
                  .replace(/\\n\\n/g, '</p><p class="mb-3">')
                  .replace(/\\n/g, '<br/>');
              }

              function renderSpread() {
                const leftIdx = currentSpread;
                const rightIdx = currentSpread + 1;

                const leftEl = document.getElementById('${widgetInstanceId}_page_left');
                const rightEl = document.getElementById('${widgetInstanceId}_page_right');
                const numLeftEl = document.getElementById('${widgetInstanceId}_num_left');
                const numRightEl = document.getElementById('${widgetInstanceId}_num_right');
                const counterEl = document.getElementById('${widgetInstanceId}_counter');
                const prevBtn = document.getElementById('${widgetInstanceId}_prev');
                const nextBtn = document.getElementById('${widgetInstanceId}_next');

                if (leftEl) leftEl.innerHTML = '<p>' + formatMarkdown(pages[leftIdx] || '') + '</p>';
                if (rightEl) rightEl.innerHTML = '<p>' + formatMarkdown(pages[rightIdx] || '') + '</p>';
                if (numLeftEl) numLeftEl.textContent = (leftIdx + 1);
                if (numRightEl) numRightEl.textContent = (rightIdx + 1);

                if (counterEl) counterEl.textContent = 'Pages ' + (leftIdx + 1) + '-' + Math.min(rightIdx + 1, pages.length) + ' of ' + pages.length;

                if (prevBtn) prevBtn.disabled = leftIdx === 0;
                if (nextBtn) {
                  if (rightIdx >= pages.length - 1) {
                    nextBtn.textContent = 'Finish Preview';
                    nextBtn.onclick = function() { window['${widgetInstanceId}_trackCTA'](); window.location.href = '${ctaUrl}'; };
                  } else {
                    nextBtn.textContent = 'Next Page \u2192';
                    nextBtn.onclick = function() { window['${widgetInstanceId}_turn'](2); };
                  }
                }
              }

              window['${widgetInstanceId}_turn'] = function(delta) {
                const next = currentSpread + delta;
                if (next >= 0 && next < pages.length) {
                  currentSpread = next;
                  renderSpread();
                  trackEvent('page_turn', currentSpread + 1);
                }
              };

              window['${widgetInstanceId}_zoom'] = function(delta) {
                fontSize = Math.min(22, Math.max(12, fontSize + delta * 2));
                const leftEl = document.getElementById('${widgetInstanceId}_page_left');
                const rightEl = document.getElementById('${widgetInstanceId}_page_right');
                if (leftEl) leftEl.style.fontSize = fontSize + 'px';
                if (rightEl) rightEl.style.fontSize = fontSize + 'px';
              };

              window['${widgetInstanceId}_toggleTheme'] = function() {
                const root = document.getElementById('${widgetInstanceId}_root');
                if (root) root.classList.toggle('dark');
              };

              window['${widgetInstanceId}_trackCTA'] = function() {
                trackEvent('cta_click', currentSpread + 1);
              };

              // Initial View Render & Tracking
              renderSpread();
              trackEvent('view', 1);
            })();
          </script>
        </div>
      `;
    });
  }

  // 4. Process cms-ebook-redeem-widget (Embeddable Redemption Card Component on any page)
  if (newHtml.includes("cms-ebook-redeem-widget")) {
    const redeemRegex = /<div class="([^"]*cms-ebook-redeem-widget[^"]*)"([^>]*)><\/div>/g;

    newHtml = await replaceAsync(newHtml, redeemRegex, async (fullMatch, classes, attrString) => {
      const widgetInstanceId = `rdm_${Math.random().toString(36).substring(2, 9)}`;

      return `
        <div id="${widgetInstanceId}_container" class="${classes} max-w-lg mx-auto my-12 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl text-slate-800 dark:text-slate-100">
          <div class="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl mx-auto shadow-inner mb-4">
            🎟️
          </div>
          <div class="text-center mb-6">
            <h3 class="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Redeem E-book Card</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Enter your single-use code from your handout card or email to unlock and download your complimentary edition.
            </p>
          </div>

          <div id="${widgetInstanceId}_form_area">
            <form id="${widgetInstanceId}_form" onsubmit="window['${widgetInstanceId}_redeem'](event)" class="space-y-4">
              <div>
                <input
                  id="${widgetInstanceId}_input"
                  type="text"
                  placeholder="e.g. READ-K92X-A3F8"
                  class="w-full py-3 px-4 rounded-2xl text-center font-mono font-bold tracking-widest text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 uppercase focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div id="${widgetInstanceId}_error" style="display:none;" class="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 rounded-xl text-xs text-center"></div>

              <button
                type="submit"
                id="${widgetInstanceId}_btn"
                class="btn btn-primary w-full text-white font-bold rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-primary/25"
              >
                Unlock E-book &rarr;
              </button>
            </form>
          </div>

          <!-- Unlocked formats container -->
          <div id="${widgetInstanceId}_result" style="display:none;" class="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div class="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs text-center font-bold">
              🎉 Card code unlocked successfully!
            </div>
            <h4 id="${widgetInstanceId}_book_title" class="font-black text-base text-center"></h4>
            <div id="${widgetInstanceId}_files_list" class="space-y-2"></div>
          </div>

          <script>
            (function() {
              window['${widgetInstanceId}_redeem'] = async function(e) {
                e.preventDefault();
                const codeInput = document.getElementById('${widgetInstanceId}_input');
                const errDiv = document.getElementById('${widgetInstanceId}_error');
                const btn = document.getElementById('${widgetInstanceId}_btn');
                const formArea = document.getElementById('${widgetInstanceId}_form_area');
                const resultDiv = document.getElementById('${widgetInstanceId}_result');
                const titleEl = document.getElementById('${widgetInstanceId}_book_title');
                const filesList = document.getElementById('${widgetInstanceId}_files_list');

                const code = codeInput ? codeInput.value.trim() : '';
                if (!code) return;

                errDiv.style.display = 'none';
                btn.disabled = true;
                btn.textContent = 'Verifying Code...';

                try {
                  const res = await fetch('/api/ebooks/cards/redeem', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code })
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    throw new Error(data.message || 'Invalid redemption code.');
                  }

                  // Load download token details
                  const dRes = await fetch('/api/ebooks/download/' + data.token);
                  const dData = await dRes.json();

                  titleEl.textContent = dData.productTitle || 'Complimentary E-book';
                  filesList.innerHTML = '';
                  (dData.availableFiles || []).forEach(f => {
                    const row = document.createElement('div');
                    row.className = 'flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800';
                    row.innerHTML = '<div><span class="badge badge-primary font-bold text-[9px] uppercase mr-2">' + f.format + '</span><span class="text-xs font-bold">' + f.fileName + '</span></div>' +
                      '<a href="/api/ebooks/download/' + data.token + '/file/' + f.id + '" class="btn btn-xs btn-primary text-white font-bold rounded-lg">Download</a>';
                    filesList.appendChild(row);
                  });

                  formArea.style.display = 'none';
                  resultDiv.style.display = 'block';
                } catch(err) {
                  errDiv.textContent = err.message || 'Failed to redeem code';
                  errDiv.style.display = 'block';
                } finally {
                  btn.disabled = false;
                  btn.textContent = 'Unlock E-book \u2192';
                }
              };
            })();
          </script>
        </div>
      `;
    });
  }

  return newHtml;
}


async function replaceAsync(str: string, regex: RegExp, asyncFn: (...args: any[]) => Promise<string>): Promise<string> {
  const promises: Promise<string>[] = [];
  str.replace(regex, (match, ...args) => {
    const promise = asyncFn(match, ...args);
    promises.push(promise);
    return match;
  });
  const data = await Promise.all(promises);
  return str.replace(regex, () => data.shift() || "");
}

