import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, Storage, getProfile } from "swiftbase-admin-sdk";
import type { CMSPage, CMSSettings } from "swiftbase-cms-shared";

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
    isBlogEnabled: rawSettings.isBlogEnabled ?? rawSettings.isblogenabled ?? false,
    isStoreEnabled: rawSettings.isStoreEnabled ?? rawSettings.isstoreenabled ?? false,
    stripePublishableKey: rawSettings.stripePublishableKey ?? rawSettings.stripepublishablekey,
    stripeWebhookSecret: rawSettings.stripeWebhookSecret ?? rawSettings.stripewebhooksecret,
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
      // navbar/footer/styles/favicon changes propagate immediately.
      // We run this asynchronously without blocking the reply.
      (async () => {
        try {
          const pagesRes = await database("cms_pages").where("isPublished", true).execute();
          const storage = new Storage({ bucket: process.env.SWIFTBASE_STORAGE_BUCKET || "cms-site-assets" });
          for (const rawPage of pagesRes.data) {
            const page = normalizePage(rawPage);
            const compiledHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${updatedSettings.siteTitle || "SBCMS"} - ${page.seoMetadata?.title || page.title}</title>
  <meta name="description" content="${page.seoMetadata?.description || ''}">
  ${updatedSettings.faviconUrl ? `<link rel="icon" href="${updatedSettings.faviconUrl}">` : ""}
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    ${page.layoutCss || ""}
    ${updatedSettings.navbarCss || ""}
    ${updatedSettings.footerCss || ""}
    ${updatedSettings.globalStyles || ""}
  </style>
</head>
<body class="bg-base-100 text-base-content min-h-screen flex flex-col">
  <!-- Nav Bar -->
  ${updatedSettings.navbarHtml ? updatedSettings.navbarHtml : `
  <header class="bg-slate-900 text-white p-4 flex justify-between items-center shadow-lg">
    <a href="/" class="text-xl font-black tracking-tighter">${updatedSettings.navbarLogo || updatedSettings.siteTitle || "SBCMS"}</a>
    <nav class="flex gap-6 font-bold text-sm">
      ${updatedSettings.navbarLinks && updatedSettings.navbarLinks.length > 0 
        ? updatedSettings.navbarLinks.map((link: any) => `<a href="${link.url}" class="hover:text-primary">${link.label}</a>`).join("\n    ")
        : `
      <a href="/" class="hover:text-primary">Home</a>
      ${updatedSettings.isBlogEnabled ? '<a href="/blog" class="hover:text-primary">Blog</a>' : ""}
      ${updatedSettings.isStoreEnabled ? '<a href="/store" class="hover:text-primary">Store</a>' : ""}
        `
      }
    </nav>
  </header>
  `}

  <!-- Page Content -->
  <main class="flex-1">
    ${page.layoutHtml ? page.layoutHtml : `
      <div class="p-8 text-center"><h1 class="text-4xl font-black">Welcome</h1></div>
    `}
  </main>

  <!-- Footer -->
  ${updatedSettings.footerHtml ? updatedSettings.footerHtml : `
  <footer class="bg-slate-900 text-white p-6 text-center text-xs opacity-60">
    <div class="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
      <p>${updatedSettings.footerText || `&copy; ${new Date().getFullYear()} ${updatedSettings.siteTitle || "SBCMS"}. Powered by Swiftbase.`}</p>
      ${updatedSettings.footerLinks && updatedSettings.footerLinks.length > 0 ? `
      <div class="flex gap-4 font-bold">
        ${updatedSettings.footerLinks.map((link: any) => `<a href="${link.url}" class="hover:text-primary">${link.label}</a>`).join("\n      ")}
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
</body>
</html>`;
            const targetKey = page.slug === "home" ? "index.html" : `${page.slug}/index.html`;
            await storage.putObject(targetKey, compiledHtml, { contentType: "text/html" });
          }
        } catch (republishErr) {
          console.error("Failed to background republish pages on settings update:", republishErr);
        }
      })();

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
        projectId: "swiftbase",
        slug: body.slug || "home",
        title: body.title || "Untitled Page",
        layoutHtml: body.layoutHtml ?? body.grapesHtml ?? "",
        layoutCss: body.layoutCss ?? body.grapesCss ?? "",
        layoutComponents: body.layoutComponents ?? body.grapesComponents ?? {},
        layoutStyles: body.layoutStyles ?? body.grapesStyles ?? {},
        seoMetadata: body.seoMetadata || { title: "", description: "" },
        isPublished: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await database("cms_pages").insert(newPage).execute();
      return reply.send(newPage);
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

      const processedLayoutHtml = page.layoutHtml ? await injectDynamicBlocks(page.layoutHtml) : `
        <div class="p-8 text-center"><h1 class="text-4xl font-black">Welcome</h1></div>
      `;

      // Compile static HTML with Tailwind, Quill, and Stripe integration
      const compiledHtml = `<!DOCTYPE html>
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
</body>
</html>`;

      // Upload using pre-signed Storage SDK
      const storage = new Storage({ bucket: process.env.SWIFTBASE_STORAGE_BUCKET || "cms-site-assets" });
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

async function injectDynamicBlocks(html: string): Promise<string> {
  const regex = /<div class="([^"]*recent-posts-block[^"]*)" data-limit="(\d+)" data-tags="([^"]*)"><\/div>/g;
  
  let posts: any[] = [];
  try {
    const postsRes = await database("cms_posts").execute();
    posts = postsRes.data.filter((p: any) => p.status === "published");
  } catch (err) {
    console.error("Failed to load posts for dynamic block inject:", err);
  }

  let newHtml = html;
  newHtml = await replaceAsync(newHtml, regex, async (fullMatch, classes, limitStr, tagsStr) => {
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
