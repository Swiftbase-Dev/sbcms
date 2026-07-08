import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, Storage } from "swiftbase-admin-sdk";
import type { CMSPost } from "swiftbase-cms-shared";

const database = db(process.env.SWIFTBASE_DATABASE_NAME || "cms");

export async function rebuildBlogSite() {
  const postsRes = await database("cms_posts").execute();
  const rawPosts = postsRes.data.filter((p: any) => p.status === "published");
  const posts = rawPosts.map((p: any) => ({
    ...p,
    title: p.publishedTitle !== null && p.publishedTitle !== undefined ? p.publishedTitle : p.title,
    content: p.publishedContent !== null && p.publishedContent !== undefined ? p.publishedContent : p.content,
    excerpt: (() => {
      const rawExcerpt = p.publishedExcerpt !== null && p.publishedExcerpt !== undefined ? p.publishedExcerpt : p.excerpt;
      if (rawExcerpt && rawExcerpt.trim() !== "") return rawExcerpt;
      const rawContent = p.publishedContent !== null && p.publishedContent !== undefined ? p.publishedContent : (p.content || "");
      const cleanText = rawContent.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
      const cut = cleanText.substring(0, 160);
      return cleanText.length > 160 ? `${cut}...` : cut;
    })(),
    tags: p.publishedTags !== null && p.publishedTags !== undefined ? p.publishedTags : p.tags,
    featureImage: p.publishedFeatureImage !== null && p.publishedFeatureImage !== undefined ? p.publishedFeatureImage : p.featureImage,
    author: p.publishedAuthor !== null && p.publishedAuthor !== undefined ? p.publishedAuthor : (p.author || "Admin"),
    seoMetadata: typeof p.publishedSeoMetadata === "string" ? JSON.parse(p.publishedSeoMetadata) : (p.publishedSeoMetadata !== null && p.publishedSeoMetadata !== undefined ? p.publishedSeoMetadata : p.seoMetadata),
  }));

  const storage = new Storage({ bucket: process.env.SWIFTBASE_STORAGE_BUCKET || "cms-site-assets" });

  // Fetch settings to check navbar, footer, favicon, links, and styles
  let settings: any = { isBlogEnabled: false, isStoreEnabled: false, siteTitle: "SBCMS" };
  try {
    const settingsRes = await database("cms_settings").execute();
    const rawSettings = settingsRes.data[0];
    if (rawSettings) {
      settings = normalizeSettings(rawSettings);
    }
  } catch (err) {
    console.error("Failed to load settings in rebuildBlogSite:", err);
  }

  const navbarHtml = settings.navbarHtml ? settings.navbarHtml : `
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
  `;

  const footerHtml = settings.footerHtml ? settings.footerHtml : `
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
  `;

  const analyticsScript = `
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
  `;

  // 1. Build blog index page
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog - ${settings.siteTitle || "SBCMS"}</title>
  ${settings.faviconUrl ? `<link rel="icon" href="${settings.faviconUrl}">` : ""}
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    ${settings.navbarCss || ""}
    ${settings.footerCss || ""}
    ${settings.globalStyles || ""}
    
    /* Theme adaptation for blog components */
    .blog-article, aside > div, #no-posts-found {
      background-color: var(--bg-accent, #ffffff) !important;
      border-color: rgba(255, 255, 255, 0.1) !important;
      color: var(--text-body, rgb(71, 85, 105)) !important;
    }
    .blog-article h2, aside h3, main h1 {
      color: var(--text-body, rgb(15, 23, 42)) !important;
    }
    .blog-article p, .archive-filter-btn {
      color: var(--text-body, rgb(71, 85, 105)) !important;
      opacity: 0.8;
    }
    input#sidebar-search {
      background-color: var(--bg-body, #ffffff) !important;
      border-color: rgba(255, 255, 255, 0.2) !important;
      color: var(--text-body, inherit) !important;
    }
  </style>
</head>
<body class="bg-base-100 text-base-content min-h-screen flex flex-col">
  ${navbarHtml}

  <main class="flex-1 max-w-6xl mx-auto p-8 min-h-screen w-full">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
      <!-- Main Content (Articles) -->
      <div class="md:col-span-3">
        
        <div id="no-posts-found" class="hidden text-center py-12 border border-dashed border-slate-200 rounded-3xl opacity-60 bg-white">
          <p class="text-sm font-bold uppercase tracking-wide">No posts match your search filters</p>
        </div>
        
        ${posts.length === 0 ? `
          <div class="text-center py-12 border border-dashed border-slate-200 rounded-3xl opacity-60 bg-white">
            <p class="text-sm font-bold uppercase tracking-wide">No posts have been published yet</p>
          </div>
        ` : `
          <div class="grid gap-8 grid-cols-1" id="posts-container">
            ${posts
              .map((p: CMSPost) => {
                const d = p.publishedAt ? new Date(p.publishedAt) : new Date();
                const year = d.getFullYear();
                const month = d.getMonth();
                const tagsHtml = p.tags ? p.tags.split(',').map(tag => `<span class="bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mr-1 mb-1 inline-block">${tag.trim()}</span>`).join('') : '';

                return `
                <article class="blog-article border border-slate-200 bg-white rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between h-full"
                         data-year="${year}" 
                         data-month="${month}" 
                         data-title="${(p.title || '').replace(/"/g, '&quot;')}" 
                         data-excerpt="${(p.excerpt || '').replace(/"/g, '&quot;')}">
                  <div>
                    ${p.featureImage ? `<img src="${p.featureImage}" class="w-full h-48 object-cover rounded-2xl mb-4" />` : ""}
                    
                    <!-- Tags -->
                    <div class="flex flex-wrap mb-3">${tagsHtml}</div>
                    
                    <!-- Clickable Heading -->
                    <h2 class="text-2xl font-black mb-2 text-slate-900">
                      <a href="/blog/${p.slug}" class="hover:text-primary hover:underline transition-all">${p.title}</a>
                    </h2>
                    
                    <!-- Author (Moved under post title) -->
                    <div class="text-[11px] text-slate-400 font-bold mb-4">By ${p.author || "Admin"}</div>
                    
                    <p class="text-sm text-slate-600 mb-4 line-clamp-3 leading-relaxed">${p.excerpt || ""}</p>
                  </div>
                  <div class="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                    <span class="text-xs text-slate-400 font-bold">${p.publishedAt ? new Date(p.publishedAt).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' }) : ""}</span>
                    <a href="/blog/${p.slug}" class="text-primary font-black hover:underline text-sm">Read More &rarr;</a>
                  </div>
                </article>
                `;
              })
              .join("")}
          </div>
        `}
      </div>

      <!-- Sidebar (Search & Archive) -->
      <aside class="md:col-span-1 flex flex-col gap-6">
        <!-- Search Widget -->
        <div class="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <h3 class="text-lg font-black text-slate-900 mb-4">Search</h3>
          <div class="relative">
            <input type="text" id="sidebar-search" placeholder="Search posts..." class="w-full px-4 py-2 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
          </div>
        </div>

        <!-- Archive Widget -->
        <div class="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <h3 class="text-lg font-black text-slate-900 mb-4">Archive</h3>
          <div class="flex flex-col gap-3 text-sm">
            <button class="archive-filter-btn text-left font-black text-primary w-full" data-filter="all">All Posts</button>
            ${renderArchiveDrilldown(posts)}
          </div>
        </div>
      </aside>
    </div>
  </main>

  ${footerHtml}
  ${analyticsScript}
  
  <script>
    (function() {
      const searchInput = document.getElementById('sidebar-search');
      const filterButtons = document.querySelectorAll('.archive-filter-btn');
      const articles = document.querySelectorAll('.blog-article');
      const noPostsFound = document.getElementById('no-posts-found');
      
      let activeFilter = 'all'; 
      let activeYear = null;
      let activeMonth = null;
      let searchQuery = '';

      function updateFilters() {
        let visibleCount = 0;

        articles.forEach(article => {
          const year = article.getAttribute('data-year');
          const month = article.getAttribute('data-month');
          const title = (article.getAttribute('data-title') || '').toLowerCase();
          const excerpt = (article.getAttribute('data-excerpt') || '').toLowerCase();

          const matchesSearch = !searchQuery || title.includes(searchQuery) || excerpt.includes(searchQuery);
          
          let matchesArchive = false;
          if (activeFilter === 'all') {
            matchesArchive = true;
          } else if (activeFilter === 'year') {
            matchesArchive = year === activeYear;
          } else if (activeFilter === 'month') {
            matchesArchive = year === activeYear && month === activeMonth;
          }

          if (matchesSearch && matchesArchive) {
            article.style.display = '';
            visibleCount++;
          } else {
            article.style.display = 'none';
          }
        });

        if (visibleCount === 0 && articles.length > 0) {
          noPostsFound.classList.remove('hidden');
        } else {
          noPostsFound.classList.add('hidden');
        }
      }

      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          searchQuery = e.target.value.toLowerCase().trim();
          updateFilters();
        });
      }

      filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          // Reset active style for all buttons
          filterButtons.forEach(b => {
            b.classList.remove('text-primary', 'font-black');
            if (b.getAttribute('data-filter') !== 'all') {
              b.classList.add('font-normal', 'text-slate-600');
            }
          });

          // Add active style to clicked button
          btn.classList.add('text-primary', 'font-black');
          btn.classList.remove('font-normal', 'text-slate-600');

          activeFilter = btn.getAttribute('data-filter');
          activeYear = btn.getAttribute('data-year');
          activeMonth = btn.getAttribute('data-month');
          
          updateFilters();
        });
      });
    })();
  </script>
</body>
</html>`;

  await storage.putObject("blog/index.html", indexHtml, { contentType: "text/html" });

  // 2. Build individual post pages
  for (const post of posts) {
    const commentsHtml = (settings.areCommentsEnabledGlobally !== false && post.areCommentsEnabled !== false) ? `
    <hr class="my-12 border-slate-200" />
    <section id="comments-section" class="mt-8">
      <h3 class="text-2xl font-black tracking-tight text-slate-900 mb-6">Comments</h3>
      
      <!-- Comments List -->
      <div id="comments-container" class="space-y-4 mb-8">
        <p class="text-xs text-slate-400 italic">Loading comments...</p>
      </div>

      <!-- Add Comment Form -->
      <div class="bg-slate-50 rounded-2xl p-6 border border-slate-100">
        <h4 class="font-bold text-slate-900 text-sm mb-4">Leave a Reply</h4>
        <form id="comment-form" class="space-y-4">
          <!-- Honeypot field (hidden from users) -->
          <div style="display: none;">
            <label>Leave this empty</label>
            <input type="text" name="website" id="comment-website-honeypot" />
          </div>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label>
              <input type="text" id="comment-name" required class="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
              <input type="email" id="comment-email" required class="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Comment</label>
            <textarea id="comment-content" rows="4" required class="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary"></textarea>
          </div>
          <button type="submit" id="comment-submit-btn" class="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-xl transition-all">
            Post Comment
          </button>
          <p id="comment-message" class="text-xs font-semibold mt-2 hidden"></p>
        </form>
      </div>
    </section>

    <script>
      (function() {
        const slug = "${post.slug}";
        const container = document.getElementById("comments-container");
        const form = document.getElementById("comment-form");
        const nameInput = document.getElementById("comment-name");
        const emailInput = document.getElementById("comment-email");
        const contentInput = document.getElementById("comment-content");
        const honeypotInput = document.getElementById("comment-website-honeypot");
        const submitBtn = document.getElementById("comment-submit-btn");
        const messageEl = document.getElementById("comment-message");

        function showMessage(text, isError) {
          messageEl.innerText = text;
          messageEl.className = "text-xs font-semibold mt-2 " + (isError ? "text-rose-500" : "text-emerald-500");
          messageEl.classList.remove("hidden");
        }

        async function loadComments() {
          try {
            const res = await fetch("/api/blog/posts/" + slug + "/comments");
            const data = await res.json();
            if (data.commentsEnabled === false) {
              document.getElementById("comments-section").remove();
              return;
            }
            if (data.comments && data.comments.length > 0) {
              container.innerHTML = data.comments.map(c => {
                const date = new Date(c.createdAt).toLocaleDateString();
                const safeName = c.authorName.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                const safeContent = c.content.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\\n/g, "<br>");
                return '<div class="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">' +
                       '<div class="flex justify-between items-center mb-2">' +
                       '<span class="font-bold text-sm">' + safeName + '</span>' +
                       '<span class="text-[10px] text-slate-400 font-semibold">' + date + '</span>' +
                       '</div>' +
                       '<p class="text-xs leading-relaxed opacity-90">' + safeContent + '</p>' +
                       '</div>';
              }).join("");
            } else {
              container.innerHTML = '<p class="text-xs text-slate-400 italic">No comments yet. Be the first to share your thoughts!</p>';
            }
          } catch(err) {
            container.innerHTML = '<p class="text-xs text-rose-400 italic">Failed to load comments.</p>';
          }
        }

        if (form) {
          form.addEventListener("submit", async (e) => {
            e.preventDefault();
            submitBtn.disabled = true;
            submitBtn.innerText = "Posting...";
            messageEl.classList.add("hidden");

            try {
              const res = await fetch("/api/blog/posts/" + slug + "/comments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  authorName: nameInput.value,
                  authorEmail: emailInput.value,
                  content: contentInput.value,
                  website: honeypotInput.value
                })
              });
              const data = await res.json();
              if (res.ok) {
                showMessage(data.message || "Comment published successfully!", false);
                contentInput.value = "";
                loadComments();
              } else {
                showMessage(data.message || "Failed to post comment.", true);
              }
            } catch (err) {
              showMessage("Network error. Please try again.", true);
            } finally {
              submitBtn.disabled = false;
              submitBtn.innerText = "Post Comment";
            }
          });
        }

        loadComments();
      })();
    </script>
    ` : "";

    const postHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${post.seoMetadata?.title || post.title} - ${settings.siteTitle || "SBCMS"}</title>
  <meta name="description" content="${post.seoMetadata?.description || ''}">
  ${settings.faviconUrl ? `<link rel="icon" href="${settings.faviconUrl}">` : ""}
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    ${settings.navbarCss || ""}
    ${settings.footerCss || ""}
    ${settings.globalStyles || ""}
    
    /* Theme adaptation for post view components */
    .bg-slate-50, #comments-container > div {
      background-color: var(--bg-accent, #f8fafc) !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      border-radius: 1rem !important;
      color: var(--text-body, rgb(71, 85, 105)) !important;
    }
    #comments-section h3, #comments-section h4, main h1 {
      color: var(--text-body, rgb(15, 23, 42)) !important;
    }
    #comment-form input, #comment-form textarea {
      background-color: var(--bg-body, #ffffff) !important;
      border-color: rgba(255, 255, 255, 0.2) !important;
      color: var(--text-body, inherit) !important;
    }
    .prose, .prose *, main h1 {
      color: var(--text-body, inherit) !important;
    }
  </style>
</head>
<body class="bg-base-100 text-base-content min-h-screen flex flex-col">
  ${navbarHtml}

  <main class="flex-1 max-w-3xl mx-auto p-8 min-h-screen w-full">
    ${post.featureImage ? `<img src="${post.featureImage}" class="w-full h-72 object-cover rounded-3xl mb-8 shadow-md" />` : ""}
    <h1 class="text-4xl md:text-5xl font-black tracking-tighter mb-4 text-slate-900">${post.title}</h1>
    <div class="text-xs text-slate-400 font-bold uppercase tracking-wider mb-8">Published on ${post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ""}</div>
    <div class="prose max-w-none leading-relaxed text-slate-800">${post.content}</div>
    ${commentsHtml}
  </main>

  ${footerHtml}
  ${analyticsScript}
</body>
</html>`;

    await storage.putObject(`blog/${post.slug}/index.html`, postHtml, { contentType: "text/html" });
  }
}

function normalizeSettings(s: any): any {
  return {
    id: s.id,
    projectId: s.projectId,
    siteTitle: s.siteTitle || s.sitetitle,
    siteDomain: s.siteDomain || s.sitedomain,
    isBlogEnabled: s.isBlogEnabled !== undefined ? s.isBlogEnabled : s.isblogenabled,
    isStoreEnabled: s.isStoreEnabled !== undefined ? s.isStoreEnabled : s.isstoreenabled,
    stripePublishableKey: s.stripePublishableKey || s.stripepublishablekey,
    stripeWebhookSecret: s.stripeWebhookSecret || s.stripewebhooksecret,
    navbarLogo: s.navbarLogo || s.navbarlogo,
    navbarLinks: typeof s.navbarLinks === "string" ? JSON.parse(s.navbarLinks) : (s.navbarLinks || s.navbarlinks),
    footerText: s.footerText || s.footertext,
    footerLinks: typeof s.footerLinks === "string" ? JSON.parse(s.footerLinks) : (s.footerLinks || s.footerlinks),
    faviconUrl: s.faviconUrl || s.faviconurl,
    globalStyles: s.globalStyles || s.globalstyles,
    navbarHtml: s.navbarHtml || s.navbarhtml,
    navbarCss: s.navbarCss || s.navbarcss,
    navbarComponents: typeof s.navbarComponents === "string" ? JSON.parse(s.navbarComponents) : (s.navbarComponents || s.navbarcomponents),
    navbarStyles: typeof s.navbarStyles === "string" ? JSON.parse(s.navbarStyles) : (s.navbarStyles || s.navbarstyles),
    footerHtml: s.footerHtml || s.footerhtml,
    footerCss: s.footerCss || s.footercss,
    footerComponents: typeof s.footerComponents === "string" ? JSON.parse(s.footerComponents) : (s.footerComponents || s.footercomponents),
    footerStyles: typeof s.footerStyles === "string" ? JSON.parse(s.footerStyles) : (s.footerStyles || s.footerstyles),
    createdAt: s.createdAt || s.createdat,
    updatedAt: s.updatedAt || s.updatedat,
  };
}

function renderArchiveDrilldown(posts: CMSPost[]): string {
  const archive: Record<number, Record<number, { monthName: string; count: number }>> = {};
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  posts.forEach((p) => {
    if (!p.publishedAt) return;
    const d = new Date(p.publishedAt);
    const year = d.getFullYear();
    const month = d.getMonth();
    
    if (!archive[year]) archive[year] = {};
    if (!archive[year][month]) {
      archive[year][month] = { monthName: monthNames[month], count: 0 };
    }
    archive[year][month].count++;
  });

  const sortedYears = Object.keys(archive).map(Number).sort((a, b) => b - a);

  return sortedYears.map(year => {
    const months = archive[year];
    const sortedMonths = Object.keys(months).map(Number).sort((a, b) => b - a);
    
    const monthListHtml = sortedMonths.map(month => {
      const info = months[month];
      return `
        <li class="ml-4 mt-1">
          <button class="archive-filter-btn text-left text-slate-600 hover:text-primary transition-colors duration-200 flex justify-between w-full font-normal" data-filter="month" data-year="${year}" data-month="${month}">
            <span>${info.monthName}</span>
            <span class="text-xs text-slate-400 font-normal">(${info.count})</span>
          </button>
        </li>
      `;
    }).join("");

    const yearCount = Object.values(months).reduce((sum, m) => sum + m.count, 0);

    return `
      <div class="archive-year-group">
        <button class="archive-filter-btn text-left font-bold text-slate-800 hover:text-primary flex justify-between w-full mt-2" data-filter="year" data-year="${year}">
          <span>${year}</span>
          <span class="text-xs text-slate-400 font-normal">(${yearCount})</span>
        </button>
        <ul class="border-l border-slate-100 my-1">
          ${monthListHtml}
        </ul>
      </div>
    `;
  }).join("");
}

export function registerBlogRoutes(app: FastifyInstance) {
  app.get("/posts", async (request, reply) => {
    try {
      const res = await database("cms_posts").execute();
      return reply.send(res.data);
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  app.post("/posts", async (request: FastifyRequest<{ Body: Partial<CMSPost> }>, reply) => {
    try {
      const body = request.body;
      const newPost: CMSPost = {
        id: `post-${Date.now()}`,
        projectId: "swiftbase",
        slug: body.slug || `post-${Date.now()}`,
        title: body.title || "Untitled Post",
        content: body.content || "",
        excerpt: body.excerpt || "",
        tags: body.tags || "",
        featureImage: body.featureImage || "",
        status: body.status || "draft",
        author: body.author || "Admin",
        seoMetadata: body.seoMetadata || { title: "", description: "" },
        publishedAt: body.status === "published" ? new Date().toISOString() : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await database("cms_posts").insert(newPost).execute();

      if (newPost.status === "published") {
        await rebuildBlogSite();
      }

      return reply.send(newPost);
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  app.put("/posts/:id", async (request: FastifyRequest<{ Params: { id: string }; Body: Partial<CMSPost> & { unpublish?: boolean } }>, reply) => {
    try {
      const { id } = request.params;
      const body = request.body;
      const res = await database("cms_posts").where("id", id).execute();
      const existing = res.data[0];
      if (!existing) return reply.status(404).send({ message: "Post not found" });

      const wasPublished = existing.status === "published";
      const isPublishingNow = body.status === "published";
      const isUnpublishing = body.status === "draft" && body.unpublish === true;

      // Initialize update payload
      const updatedPost: any = {
        ...existing,
        ...body,
        updatedAt: new Date().toISOString(),
      };

      // Clean up body-specific fields before updating database
      delete updatedPost.unpublish;

      if (isPublishingNow) {
        // Copy draft content to published content columns
        updatedPost.publishedTitle = body.title !== undefined ? body.title : existing.title;
        updatedPost.publishedContent = body.content !== undefined ? body.content : existing.content;
        updatedPost.publishedExcerpt = body.excerpt !== undefined ? body.excerpt : existing.excerpt;
        updatedPost.publishedTags = body.tags !== undefined ? body.tags : existing.tags;
        updatedPost.publishedFeatureImage = body.featureImage !== undefined ? body.featureImage : existing.featureImage;
        updatedPost.publishedSeoMetadata = body.seoMetadata !== undefined ? body.seoMetadata : existing.seoMetadata;
        updatedPost.publishedAuthor = body.author !== undefined ? body.author : (existing.author || "Admin");
        
        updatedPost.status = "published";
        updatedPost.hasUnpublishedChanges = false;
        if (!existing.publishedAt) {
          updatedPost.publishedAt = new Date().toISOString();
        }
      } else if (isUnpublishing) {
        updatedPost.status = "draft";
        updatedPost.hasUnpublishedChanges = false;
        updatedPost.publishedAt = null;
        updatedPost.publishedTitle = null;
        updatedPost.publishedContent = null;
        updatedPost.publishedExcerpt = null;
        updatedPost.publishedTags = null;
        updatedPost.publishedFeatureImage = null;
        updatedPost.publishedSeoMetadata = null;
        updatedPost.publishedAuthor = null;
      } else {
        // Just saving draft edits
        if (wasPublished) {
          updatedPost.status = "published";
          updatedPost.hasUnpublishedChanges = true;
        } else {
          updatedPost.status = "draft";
          updatedPost.hasUnpublishedChanges = false;
        }
      }

      await database("cms_posts").where("id", id).update(updatedPost).execute();

      // Rebuild if publishing now or unpublishing
      if (isPublishingNow || isUnpublishing) {
        await rebuildBlogSite();
      }

      return reply.send(updatedPost);
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  app.delete("/posts/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const { id } = request.params;
      const res = await database("cms_posts").where("id", id).execute();
      const existing = res.data[0];
      if (!existing) return reply.status(404).send({ message: "Post not found" });

      await database("cms_posts").where("id", id).delete().execute();

      if (existing.status === "published") {
        await rebuildBlogSite();
      }

      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });
}
