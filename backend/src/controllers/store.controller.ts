import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, Storage } from "swiftbase-admin-sdk";
import type { CMSProduct, CMSSettings, CMSPurchase, AffiliateLink, ShippingAddress, OrderItem } from "swiftbase-cms-shared";
import Stripe from "stripe";
import { getCartDrawerAndScriptHtml } from "./cart.helper.js";
import { sendPostmarkEmail, formatShippingNotificationEmail, formatOrderConfirmationEmail } from "./email.helper.js";

const database = db(process.env.SWIFTBASE_DATABASE_NAME || "cms");

function parseJSONField<T>(field: any, defaultValue: T): T {
  if (field === null || field === undefined) return defaultValue;
  if (typeof field === "object") return field as T;
  try {
    return JSON.parse(field);
  } catch {
    return defaultValue;
  }
}

export function cleanDescriptionForStripe(html?: string): string | undefined {
  if (!html) return undefined;
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
  return text.substring(0, 500) || undefined;
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
    affiliateLinks: parseJSONField<AffiliateLink[]>(p.affiliateLinks, []),
    customOrderFields: parseJSONField(p.customOrderFields, []),
    shippingDetails: parseJSONField(p.shippingDetails, {}),
    addOnProductIds: parseJSONField<string[]>(p.addOnProductIds, []),
  };
}

function normalizePurchase(p: any): CMSPurchase {
  return {
    ...p,
    amountTotalCents: Number(p.amountTotalCents) || 0,
    shippingAddress: parseJSONField(p.shippingAddress, undefined),
    items: parseJSONField(p.items, []),
  };
}

export async function rebuildStoreSite() {
  const productsRes = await database("cms_products").execute();
  const rawProducts = productsRes.data || [];
  const products: CMSProduct[] = rawProducts.map(normalizeProduct);

  const storage = new Storage({ bucket: process.env.SWIFTBASE_STORAGE_BUCKET! });

  // Fetch settings to check navbar, footer, favicon, styles
  let settings: any = { isBlogEnabled: false, isStoreEnabled: true, siteTitle: "SBCMS" };
  try {
    const settingsRes = await database("cms_settings").execute();
    const rawSettings = settingsRes.data[0];
    if (rawSettings) {
      settings = {
        ...rawSettings,
        siteTitle: rawSettings.siteTitle || rawSettings.sitetitle,
        siteDomain: rawSettings.siteDomain || rawSettings.sitedomain,
        navbarLogo: rawSettings.navbarLogo || rawSettings.navbarlogo,
        navbarLinks: typeof rawSettings.navbarLinks === "string" ? JSON.parse(rawSettings.navbarLinks) : (rawSettings.navbarLinks || rawSettings.navbarlinks),
        footerText: rawSettings.footerText || rawSettings.footertext,
        footerLinks: typeof rawSettings.footerLinks === "string" ? JSON.parse(rawSettings.footerLinks) : (rawSettings.footerLinks || rawSettings.footerlinks),
        faviconUrl: rawSettings.faviconUrl || rawSettings.faviconurl,
        globalStyles: rawSettings.globalStyles || rawSettings.globalstyles,
        navbarHtml: rawSettings.navbarHtml || rawSettings.navbarhtml,
        navbarCss: rawSettings.navbarCss || rawSettings.navbarcss,
        footerHtml: rawSettings.footerHtml || rawSettings.footerhtml,
        footerCss: rawSettings.footerCss || rawSettings.footercss,
      };
    }
  } catch (err) {
    console.error("Failed to load settings in rebuildStoreSite:", err);
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
      <a href="/store" class="text-primary font-black">Store</a>
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

  const cartDrawerHtml = getCartDrawerAndScriptHtml();

  // 1. Build Store List HTML
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Store - ${settings.siteTitle || "SBCMS"}</title>
  ${settings.faviconUrl ? `<link rel="icon" href="${settings.faviconUrl}">` : ""}
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    ${settings.navbarCss || ""}
    ${settings.footerCss || ""}
    ${settings.globalStyles || ""}
  </style>
</head>
<body class="bg-base-100 text-base-content min-h-screen flex flex-col">
  ${navbarHtml}

  <main class="max-w-6xl mx-auto p-8 flex-1 w-full">
    <h1 class="text-5xl font-black mb-8 tracking-tighter">Products</h1>
    <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      ${products
        .map(
          (p: CMSProduct) => {
            const imgUrl = p.images && p.images.length > 0 ? p.images[0] : "";
            const safeName = (p.name || "").replace(/"/g, '&quot;').replace(/'/g, "\\'");
            const safeImg = imgUrl.replace(/"/g, '&quot;').replace(/'/g, "\\'");
            return `
        <div class="border border-base-200 bg-white rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col justify-between">
          <div>
            ${imgUrl ? `<img src="${imgUrl}" class="w-full h-56 object-cover rounded-2xl mb-4" />` : `<div class="w-full h-56 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300 font-bold mb-4">No Image</div>`}
            <h2 class="text-2xl font-black mb-1">${p.name}</h2>
            <div class="text-xl font-black text-primary mb-4">$${(p.priceCents / 100).toFixed(2)}</div>
            <p class="text-sm opacity-60 mb-6">${(p.description || "").replace(/<[^>]*>/g, '')}</p>
          </div>
          <div class="space-y-2 pt-2 border-t border-slate-100">
            <div class="grid grid-cols-2 gap-2">
              <button onclick="window.SBCart && window.SBCart.addItem({ id: '${p.id}', name: '${safeName}', priceCents: ${p.priceCents}, image: '${safeImg}' })" class="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs rounded-xl transition-all text-center" ${!p.inStock ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
                Add to Cart
              </button>
              <button onclick="window.SBCart ? window.SBCart.buyNow({ id: '${p.id}' }) : (window.location.href='/store/${p.slug}')" class="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all text-center shadow-sm" ${!p.inStock ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
                Buy Now
              </button>
            </div>
            <a href="/store/${p.slug}" class="block text-center text-xs font-bold text-slate-400 hover:text-primary transition-colors py-1">View Details &rarr;</a>
          </div>
        </div>
      `;
          }
        )
        .join("")}
    </div>
  </main>

  ${footerHtml}

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
      trackEvent('pageview');
      window.trackCMSConversion = (name) => trackEvent('conversion', { name });
    })();
  </script>
  ${cartDrawerHtml}
</body>
</html>`;

  await storage.putObject("store/index.html", indexHtml, { contentType: "text/html" });

  // 2. Build individual Product Pages
  for (const product of products) {
    const affiliateHtml = product.affiliateLinks && product.affiliateLinks.length > 0 
      ? `
      <div class="mt-8 border-t border-base-200 pt-6">
        <h3 class="text-lg font-bold mb-4">Also available from these sellers:</h3>
        <div class="flex flex-wrap gap-4">
          ${product.affiliateLinks.map((link: AffiliateLink) => `
            <a href="${link.url}" target="_blank" class="border border-primary text-primary px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary hover:text-white transition-all">
              ${link.sellerName} - $${(link.priceCents / 100).toFixed(2)}
            </a>
          `).join("")}
        </div>
      </div>` 
      : "";

    const imgUrl = product.images && product.images.length > 0 ? product.images[0] : "";
    const safeName = (product.name || "").replace(/"/g, '&quot;').replace(/'/g, "\\'");
    const safeImg = imgUrl.replace(/"/g, '&quot;').replace(/'/g, "\\'");

    const productHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${product.name} - ${settings.siteTitle || "Store"}</title>
  ${settings.faviconUrl ? `<link rel="icon" href="${settings.faviconUrl}">` : ""}
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    ${settings.navbarCss || ""}
    ${settings.footerCss || ""}
    ${settings.globalStyles || ""}
  </style>
</head>
<body class="bg-base-100 text-base-content min-h-screen flex flex-col">
  ${navbarHtml}

  <main class="max-w-5xl mx-auto p-8 flex-1 w-full grid gap-8 md:grid-cols-2">
    <!-- Gallery -->
    <div>
      ${product.images && product.images.length > 0 
        ? `<img src="${product.images[0]}" class="w-full h-[400px] object-cover rounded-3xl shadow-md mb-4" />` 
        : '<div class="w-full h-80 bg-base-200 rounded-3xl flex items-center justify-center text-4xl text-neutral-300">No Image</div>'}
      <div class="grid grid-cols-4 gap-2">
        ${product.images ? product.images.slice(1).map((img: string) => `<img src="${img}" class="h-20 object-cover rounded-xl" />`).join("") : ""}
      </div>
    </div>

    <!-- Product Info -->
    <div class="flex flex-col justify-between">
      <div>
        <h1 class="text-4xl font-black tracking-tighter mb-2">${product.name}</h1>
        <div class="text-3xl font-black text-primary mb-6">$${(product.priceCents / 100).toFixed(2)}</div>
        <div class="leading-relaxed opacity-75 mb-8 prose prose-sm max-w-none">${product.description || "No description provided."}</div>
      </div>

      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <button onclick="window.SBCart && window.SBCart.addItem({ id: '${product.id}', name: '${safeName}', priceCents: ${product.priceCents}, image: '${safeImg}' })" class="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold rounded-2xl transition-all text-base shadow-sm" ${!product.inStock ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
            Add to Cart
          </button>
          <button onclick="window.SBCart ? window.SBCart.buyNow({ id: '${product.id}' }) : checkout('${product.id}')" class="w-full bg-slate-950 text-white font-bold py-4 rounded-2xl hover:bg-opacity-90 shadow-lg text-base" ${!product.inStock ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
            Buy Now
          </button>
        </div>
        ${affiliateHtml}
      </div>
    </div>
  </main>

  ${footerHtml}

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
      trackEvent('pageview');
      window.trackCMSConversion = (name) => trackEvent('conversion', { name });
    })();

    async function checkout(productId) {
      if (window.trackCMSConversion) {
        window.trackCMSConversion('checkout_start');
      }

      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId })
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          alert('Checkout initiation failed.');
        }
      } catch (err) {
        console.error('Checkout error:', err);
      }
    }
  </script>
  ${cartDrawerHtml}
</body>
</html>`;

    await storage.putObject(`store/${product.slug}/index.html`, productHtml, { contentType: "text/html" });
  }
}

export function registerStoreRoutes(app: FastifyInstance) {
  // Stripe instance helper
  const getStripe = async (): Promise<Stripe | null> => {
    try {
      const settingsRes = await database("cms_settings").execute();
      const settings = settingsRes.data[0];
      const stripeKey = process.env.STRIPE_SECRET_KEY || settings?.stripeWebhookSecret; // fallback
      if (!stripeKey) return null;
      return new Stripe(stripeKey, { apiVersion: "2024-04-10" });
    } catch {
      return null;
    }
  };

  app.get("/products", async (request, reply) => {
    try {
      const res = await database("cms_products").execute();
      const list = (res.data || []).map(normalizeProduct);
      return reply.send(list);
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  app.post("/products", async (request: FastifyRequest<{ Body: Partial<CMSProduct> }>, reply) => {
    try {
      const body = request.body;
      const stripe = await getStripe();

      let stripePriceId = "";
      let stripeProductId = "";

      // Sync Stripe product details if API is configured
      if (stripe && body.name && body.priceCents) {
        try {
          const product = await stripe.products.create({
            name: body.name,
            description: cleanDescriptionForStripe(body.description),
          });
          const price = await stripe.prices.create({
            product: product.id,
            unit_amount: body.priceCents,
            currency: "usd",
          });
          stripeProductId = product.id;
          stripePriceId = price.id;
        } catch (stripeErr: any) {
          app.log.warn(`Stripe product creation skipped or failed: ${stripeErr.message}`);
        }
      }

      const id = body.id || `prod-${Date.now()}`;
      const newProduct: any = {
        id,
        projectId: process.env.SWIFTBASE_PROJECT_ID || "author-sites",
        slug: body.slug || `prod-${Date.now()}`,
        name: body.name || "Unnamed Product",
        description: body.description || "",
        priceCents: body.priceCents || 0,
        stripeProductId,
        stripePriceId,
        images: JSON.stringify(body.images || []),
        affiliateLinks: JSON.stringify(body.affiliateLinks || []),
        category: body.category || "",
        sku: body.sku || "",
        inStock: body.inStock !== false,
        stockQuantity: body.stockQuantity !== undefined ? body.stockQuantity : null,
        limitPerOrder: body.limitPerOrder !== undefined ? body.limitPerOrder : null,
        customOrderFields: JSON.stringify(body.customOrderFields || []),
        isPhysical: body.isPhysical !== false,
        shippingDetails: JSON.stringify(body.shippingDetails || {}),
        addOnProductIds: JSON.stringify(body.addOnProductIds || []),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await database("cms_products").insert(newProduct).execute();
      await rebuildStoreSite().catch(e => app.log.warn(`rebuildStoreSite error: ${e.message}`));

      return reply.send(normalizeProduct(newProduct));
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  app.put("/products/:id", async (request: FastifyRequest<{ Params: { id: string }; Body: Partial<CMSProduct> }>, reply) => {
    try {
      const { id } = request.params;
      const body = request.body;
      const res = await database("cms_products").where("id", id).execute();
      const existing = res.data[0];
      if (!existing) return reply.status(404).send({ message: "Product not found" });

      const stripe = await getStripe();
      let stripePriceId = existing.stripePriceId;
      let stripeProductId = existing.stripeProductId;

      if (stripe && stripeProductId) {
        try {
          const updateData: Stripe.ProductUpdateParams = {};
          if (body.name !== undefined) updateData.name = body.name;
          if (body.description !== undefined) updateData.description = cleanDescriptionForStripe(body.description);

          if (Object.keys(updateData).length > 0) {
            await stripe.products.update(stripeProductId, updateData);
          }

          // Create new price if rate changes
          if (body.priceCents !== undefined && body.priceCents !== existing.priceCents) {
            const price = await stripe.prices.create({
              product: stripeProductId,
              unit_amount: body.priceCents,
              currency: "usd",
            });
            stripePriceId = price.id;
          }
        } catch (stripeErr: any) {
          app.log.warn(`Stripe product update skipped or failed: ${stripeErr.message}`);
        }
      }

      const updatedProduct: any = {
        ...existing,
        ...body,
        stripePriceId,
        stripeProductId,
        images: body.images !== undefined ? JSON.stringify(body.images) : existing.images,
        affiliateLinks: body.affiliateLinks !== undefined ? JSON.stringify(body.affiliateLinks) : existing.affiliateLinks,
        customOrderFields: body.customOrderFields !== undefined ? JSON.stringify(body.customOrderFields) : existing.customOrderFields,
        shippingDetails: body.shippingDetails !== undefined ? JSON.stringify(body.shippingDetails) : existing.shippingDetails,
        addOnProductIds: body.addOnProductIds !== undefined ? JSON.stringify(body.addOnProductIds) : existing.addOnProductIds,
        updatedAt: new Date().toISOString(),
      };

      await database("cms_products").where("id", id).update(updatedProduct).execute();
      await rebuildStoreSite().catch(e => app.log.warn(`rebuildStoreSite error: ${e.message}`));

      return reply.send(normalizeProduct(updatedProduct));
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  app.delete("/products/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const { id } = request.params;
      await database("cms_products").where("id", id).delete().execute();
      await rebuildStoreSite();
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  app.post("/stripe/sync-products", async (request, reply) => {
    try {
      const stripe = await getStripe();
      if (!stripe) {
        return reply.status(400).send({ message: "Stripe Secret Key is not configured. Please configure it in settings first." });
      }

      // Fetch all local products
      const productsRes = await database("cms_products").execute();
      const localProducts = productsRes.data || [];

      // Filter for unsynced products
      const unsynced = localProducts.filter((p: any) => !p.stripeProductId || !p.stripePriceId);
      
      if (unsynced.length === 0) {
        return reply.send({ success: true, message: "All products are already synchronized with Stripe.", syncedCount: 0 });
      }

      let syncedCount = 0;
      for (const prod of unsynced) {
        try {
          let stripeProductId = prod.stripeProductId;
          if (!stripeProductId) {
            const product = await stripe.products.create({
              name: prod.name,
              description: cleanDescriptionForStripe(prod.description),
            });
            stripeProductId = product.id;
          }

          const price = await stripe.prices.create({
            product: stripeProductId,
            unit_amount: prod.priceCents,
            currency: "usd",
          });

          await database("cms_products")
            .where("id", prod.id)
            .update({
              stripeProductId,
              stripePriceId: price.id,
              updatedAt: new Date().toISOString()
            })
            .execute();

          syncedCount++;
        } catch (stripeErr: any) {
          app.log.error(`Stripe sync failed for product ${prod.id}: ${stripeErr.message}`);
        }
      }

      if (syncedCount > 0) {
        await rebuildStoreSite();
      }

      return reply.send({ 
        success: true, 
        message: `Successfully synchronized ${syncedCount} product(s) with Stripe.`,
        syncedCount 
      });
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  // Stripe Checkout Session Creation (Supports single product or multi-item cart)
  app.post("/checkout", async (request: FastifyRequest<{ Body: { productId?: string; quantity?: number; items?: Array<{ productId: string; quantity: number }> } }>, reply) => {
    try {
      const { productId, quantity, items } = request.body;
      let checkoutItems: Array<{ productId: string; quantity: number }> = [];

      if (items && Array.isArray(items) && items.length > 0) {
        checkoutItems = items.filter(i => i.productId && Number(i.quantity) > 0);
      } else if (productId) {
        checkoutItems = [{ productId, quantity: Number(quantity) || 1 }];
      }

      if (checkoutItems.length === 0) {
        return reply.status(400).send({ message: "No valid items provided for checkout." });
      }

      // Fetch all products in this checkout
      const productIds = new Set(checkoutItems.map(i => i.productId));
      const res = await database("cms_products").execute();
      const productsMap = new Map<string, any>(
        (res.data || [])
          .filter((p: any) => productIds.has(p.id))
          .map((p: any) => [p.id, normalizeProduct(p)])
      );

      // Validate all items exist
      for (const item of checkoutItems) {
        if (!productsMap.has(item.productId)) {
          return reply.status(404).send({ message: `Product ${item.productId} not found.` });
        }
      }

      const stripe = await getStripe();
      if (!stripe) {
        // Mock Stripe payment link if keys are not set yet
        const mockRedirectUrl = `https://checkout.stripe.com/pay/mock_session_${Date.now()}`;
        return reply.send({ url: mockRedirectUrl });
      }

      const settingsRes = await database("cms_settings").execute();
      const settings = settingsRes.data[0];
      const origin = settings?.siteDomain || "http://localhost:3000";

      // Prepare Stripe line items
      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = checkoutItems.map(item => {
        const prod = productsMap.get(item.productId)!;
        if (prod.stripePriceId) {
          return {
            price: prod.stripePriceId,
            quantity: item.quantity,
          };
        } else {
          return {
            price_data: {
              currency: "usd",
              product_data: {
                name: prod.name,
                description: cleanDescriptionForStripe(prod.description),
                images: prod.images && prod.images.length > 0 ? [prod.images[0]] : undefined,
              },
              unit_amount: prod.priceCents || 0,
            },
            quantity: item.quantity,
          };
        }
      });

      const firstProduct = productsMap.get(checkoutItems[0].productId);
      const cancelUrl = checkoutItems.length === 1 && firstProduct
        ? `${origin}/store/${firstProduct.slug}`
        : `${origin}/store`;

      // Check if any product in this checkout requires physical shipping
      const requiresShipping = checkoutItems.some(item => {
        const prod = productsMap.get(item.productId);
        return prod && prod.isPhysical !== false;
      });

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        metadata: {
          productIds: JSON.stringify(checkoutItems.map(i => ({ id: i.productId, qty: i.quantity }))),
          productId: checkoutItems[0].productId,
        },
      };

      if (requiresShipping) {
        // Collect shipping address natively on Stripe Checkout
        sessionParams.shipping_address_collection = {
          allowed_countries: [
            "US", "CA", "GB", "AU", "NZ", "DE", "FR", "IT", "ES", "NL", "IE", "SE", "NO", "DK", "CH", "AT", "BE"
          ],
        };
        sessionParams.phone_number_collection = {
          enabled: true,
        };
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      return reply.send({ url: session.url });
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  // Stripe Webhook Listener
  app.post("/stripe/webhook", async (request, reply) => {
    try {
      const payload = request.body as any;
      const stripe = await getStripe();

      if (stripe && payload.type === "checkout.session.completed") {
        const session = payload.data.object as Stripe.Checkout.Session;
        const productId = session.metadata?.productId || "";
        const amountTotal = session.amount_total;

        // Parse line items or metadata items
        let items: OrderItem[] = [];
        try {
          if (session.metadata?.productIds) {
            const parsedMeta = JSON.parse(session.metadata.productIds);
            const pIds = new Set(parsedMeta.map((m: any) => m.id));
            const productsRes = await database("cms_products").execute();
            const prodMap = new Map<string, any>(
              (productsRes.data || []).filter((p: any) => pIds.has(p.id)).map((p: any) => [p.id, normalizeProduct(p)])
            );
            items = parsedMeta.map((m: any) => {
              const p = prodMap.get(m.id);
              return {
                productId: m.id,
                name: p?.name || "Product",
                quantity: Number(m.qty) || 1,
                unitAmountCents: p?.priceCents || 0,
                images: p?.images,
              };
            });
          }
        } catch (itemErr: any) {
          app.log.warn(`Error resolving items for purchase: ${itemErr.message}`);
        }

        // Extract customer & shipping details
        const customerEmail = session.customer_details?.email || "anonymous@example.com";
        const customerName = session.customer_details?.name || session.shipping_details?.name || "";

        let shippingAddress: ShippingAddress | undefined = undefined;
        if (session.shipping_details?.address) {
          const addr = session.shipping_details.address;
          shippingAddress = {
            name: session.shipping_details.name || customerName,
            line1: addr.line1 || "",
            line2: addr.line2 || "",
            city: addr.city || "",
            state: addr.state || "",
            postalCode: addr.postal_code || "",
            country: addr.country || "",
            phone: session.customer_details?.phone || undefined,
          };
        }

        const purchase: any = {
          id: `purch-${Date.now()}`,
          projectId: process.env.SWIFTBASE_PROJECT_ID || "author-sites",
          productId,
          stripeSessionId: session.id,
          customerEmail,
          customerName,
          amountTotalCents: amountTotal || 0,
          status: "completed",
          fulfillmentStatus: "unfulfilled",
          trackingNumber: null,
          carrier: null,
          trackingUrl: null,
          shippingAddress: shippingAddress ? JSON.stringify(shippingAddress) : null,
          items: JSON.stringify(items),
          notes: "",
          shippedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await database("cms_purchases").insert(purchase).execute();

        // Check if Postmark confirmation email should be sent
        try {
          const settingsRes = await database("cms_settings").execute();
          const settings = settingsRes.data[0];
          if (settings?.postmarkApiToken && settings?.postmarkFromEmail && customerEmail) {
            const emailContent = formatOrderConfirmationEmail({
              siteTitle: settings.siteTitle || "Store",
              customerName,
              orderId: purchase.id,
              amountTotalCents: amountTotal || 0,
              items,
              shippingAddress,
            });

            await sendPostmarkEmail({
              apiToken: settings.postmarkApiToken,
              from: settings.postmarkFromEmail,
              to: customerEmail,
              subject: emailContent.subject,
              htmlBody: emailContent.htmlBody,
            });
            app.log.info(`Order confirmation email sent via Postmark for purchase ${purchase.id}`);
          }
        } catch (emailErr: any) {
          app.log.warn(`Failed to send order confirmation email: ${emailErr.message}`);
        }
      }
      return reply.send({ received: true });
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  // Orders Management Routes
  app.get("/orders", async (request, reply) => {
    try {
      const res = await database("cms_purchases").execute();
      const list = (res.data || [])
        .map(normalizePurchase)
        .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      return reply.send(list);
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  app.get("/orders/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const { id } = request.params;
      const res = await database("cms_purchases").where("id", id).execute();
      const order = res.data[0];
      if (!order) return reply.status(404).send({ message: "Order not found" });
      return reply.send(normalizePurchase(order));
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  app.put("/orders/:id/fulfill", async (request: FastifyRequest<{
    Params: { id: string };
    Body: {
      trackingNumber?: string;
      carrier?: string;
      trackingUrl?: string;
      fulfillmentStatus?: string;
      notes?: string;
      sendEmail?: boolean;
    };
  }>, reply) => {
    try {
      const { id } = request.params;
      const { trackingNumber, carrier, trackingUrl, fulfillmentStatus, notes, sendEmail } = request.body;

      const res = await database("cms_purchases").where("id", id).execute();
      const existing = res.data[0];
      if (!existing) return reply.status(404).send({ message: "Order not found" });

      const newStatus = fulfillmentStatus || (trackingNumber ? "shipped" : existing.fulfillmentStatus || "unfulfilled");
      const shippedAt = newStatus === "shipped" && !existing.shippedAt ? new Date().toISOString() : existing.shippedAt;

      // Auto-generate standard tracking URLs if not explicitly provided
      let finalTrackingUrl = trackingUrl || existing.trackingUrl;
      const cleanTracking = (trackingNumber || existing.trackingNumber || "").trim();
      const cleanCarrier = (carrier || existing.carrier || "USPS").toUpperCase();

      if (!finalTrackingUrl && cleanTracking) {
        if (cleanCarrier.includes("USPS")) {
          finalTrackingUrl = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(cleanTracking)}`;
        } else if (cleanCarrier.includes("UPS")) {
          finalTrackingUrl = `https://www.ups.com/track?tracknum=${encodeURIComponent(cleanTracking)}`;
        } else if (cleanCarrier.includes("FEDEX")) {
          finalTrackingUrl = `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(cleanTracking)}`;
        } else if (cleanCarrier.includes("DHL")) {
          finalTrackingUrl = `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(cleanTracking)}`;
        }
      }

      const updatedOrder: any = {
        ...existing,
        fulfillmentStatus: newStatus,
        trackingNumber: cleanTracking || existing.trackingNumber,
        carrier: carrier || existing.carrier,
        trackingUrl: finalTrackingUrl,
        notes: notes !== undefined ? notes : existing.notes,
        shippedAt,
        updatedAt: new Date().toISOString(),
      };

      await database("cms_purchases").where("id", id).update(updatedOrder).execute();

      // Trigger Postmark Shipping Email if requested
      const normalized = normalizePurchase(updatedOrder);
      let emailSent = false;
      let emailError = "";

      if (sendEmail !== false && newStatus === "shipped" && cleanTracking && normalized.customerEmail) {
        try {
          const settingsRes = await database("cms_settings").execute();
          const settings = settingsRes.data[0];
          if (settings?.postmarkApiToken && settings?.postmarkFromEmail) {
            const emailContent = formatShippingNotificationEmail({
              siteTitle: settings.siteTitle || "Store",
              customerName: normalized.customerName,
              orderId: normalized.id,
              carrier: normalized.carrier || "Carrier",
              trackingNumber: cleanTracking,
              trackingUrl: finalTrackingUrl,
              items: normalized.items,
              shippingAddress: normalized.shippingAddress,
            });

            const emailResult = await sendPostmarkEmail({
              apiToken: settings.postmarkApiToken,
              from: settings.postmarkFromEmail,
              to: normalized.customerEmail,
              subject: emailContent.subject,
              htmlBody: emailContent.htmlBody,
            });

            if (emailResult.success) {
              emailSent = true;
              app.log.info(`Shipping notification email sent to ${normalized.customerEmail} for order ${id}`);
            } else {
              emailError = emailResult.error || "Postmark error";
              app.log.warn(`Postmark send failed for order ${id}: ${emailError}`);
            }
          } else {
            emailError = "Postmark API Token or From Email not configured in Settings > Payments.";
          }
        } catch (mailErr: any) {
          emailError = mailErr.message;
          app.log.warn(`Shipping email trigger error: ${mailErr.message}`);
        }
      }

      return reply.send({
        success: true,
        order: normalized,
        emailSent,
        emailError: emailError || undefined,
      });
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });
}
