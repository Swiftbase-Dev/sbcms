import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, Storage } from "swiftbase-admin-sdk";
import type { CMSProduct, CMSSettings, CMSPurchase, AffiliateLink, ShippingAddress, OrderItem, CustomOrderField } from "swiftbase-cms-shared";
import Stripe from "stripe";
import { getCartDrawerAndScriptHtml } from "./cart.helper.js";
import { sendPostmarkEmail, formatShippingNotificationEmail, formatOrderConfirmationEmail, formatNewOrderAdminNotificationEmail } from "./email.helper.js";
import { rebuildAllPublishedPages } from "./page.controller.js";

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

export function normalizeProduct(p: any): CMSProduct {
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

    const customFieldsHtml = product.customOrderFields && product.customOrderFields.length > 0
      ? `
      <div id="product-custom-fields-box" class="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 mb-6">
        <div>
          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500">Order Personalization & Details</h3>
          <p class="text-[11px] text-slate-400 mt-0.5">Please provide any custom dedications or preferences for this item.</p>
        </div>
        <div class="space-y-3">
          ${product.customOrderFields.map((field: CustomOrderField) => {
            const fieldId = `cf_${field.id}`;
            const reqStar = field.required ? '<span class="text-rose-500 font-bold ml-0.5">*</span>' : '';
            const reqAttr = field.required ? 'data-required="true"' : '';
            
            if (field.type === 'textarea') {
              return `
                <div>
                  <label for="${fieldId}" class="block text-xs font-bold text-slate-700 mb-1">
                    ${field.label}${reqStar}
                  </label>
                  <textarea id="${fieldId}" data-field-id="${field.id}" data-field-label="${field.label.replace(/"/g, '&quot;')}" ${reqAttr} class="custom-order-input w-full p-3 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-none" rows="3" placeholder="Enter your text here..."></textarea>
                  <div class="field-error-msg hidden text-[11px] text-rose-500 mt-1 font-semibold">This field is required</div>
                </div>
              `;
            } else if (field.type === 'checkbox') {
              return `
                <div>
                  <label class="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" id="${fieldId}" data-field-id="${field.id}" data-field-label="${field.label.replace(/"/g, '&quot;')}" ${reqAttr} class="custom-order-input w-4 h-4 rounded text-slate-900 focus:ring-slate-900 border-slate-300" />
                    <span class="text-xs font-bold text-slate-700">${field.label}${reqStar}</span>
                  </label>
                  <div class="field-error-msg hidden text-[11px] text-rose-500 mt-1 font-semibold">You must check this box to continue</div>
                </div>
              `;
            } else {
              return `
                <div>
                  <label for="${fieldId}" class="block text-xs font-bold text-slate-700 mb-1">
                    ${field.label}${reqStar}
                  </label>
                  <input type="text" id="${fieldId}" data-field-id="${field.id}" data-field-label="${field.label.replace(/"/g, '&quot;')}" ${reqAttr} class="custom-order-input w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-none" placeholder="Enter ${field.label.replace(/"/g, '&quot;')}..." />
                  <div class="field-error-msg hidden text-[11px] text-rose-500 mt-1 font-semibold">This field is required</div>
                </div>
              `;
            }
          }).join('')}
        </div>
      </div>
      `
      : "";

    const mainCoverImg = product.images && product.images.length > 0 ? product.images[0] : "";

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
    <!-- Gallery & Full Cover Viewer -->
    <div>
      <div class="group relative cursor-pointer overflow-hidden rounded-3xl bg-slate-100 border border-slate-200 shadow-md mb-4" onclick="openCoverModal('${mainCoverImg}')" title="Click to view full book cover">
        ${mainCoverImg 
          ? `<img id="main-product-cover-img" src="${mainCoverImg}" class="w-full max-h-[520px] object-contain mx-auto transition-transform duration-300 group-hover:scale-105" />` 
          : '<div class="w-full h-80 flex items-center justify-center text-4xl text-neutral-300">No Image</div>'}
        ${mainCoverImg ? `
        <div class="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <span class="bg-slate-900/80 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow backdrop-blur-sm flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>
            View Full Cover
          </span>
        </div>` : ''}
      </div>
      <div class="grid grid-cols-4 gap-2">
        ${product.images ? product.images.map((img: string) => `
          <div onclick="switchMainImage('${img}')" class="h-20 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden cursor-pointer hover:border-slate-900 transition-all p-1 flex items-center justify-center">
            <img src="${img}" class="h-full object-contain mx-auto" />
          </div>
        `).join("") : ""}
      </div>
    </div>

    <!-- Product Info & Ordering -->
    <div class="flex flex-col justify-between">
      <div>
        <h1 class="text-4xl font-black tracking-tighter mb-2 text-slate-900">${product.name}</h1>
        <div class="text-3xl font-black text-primary mb-6">$${(product.priceCents / 100).toFixed(2)}</div>
        <div class="leading-relaxed opacity-75 mb-6 prose prose-sm max-w-none text-slate-700">${product.description || "No description provided."}</div>
        
        ${customFieldsHtml}
      </div>

      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <button type="button" onclick="handleAddToCart()" class="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold rounded-2xl transition-all text-base shadow-sm" ${!product.inStock ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
            Add to Cart
          </button>
          <button type="button" onclick="handleBuyNow()" class="w-full bg-slate-950 text-white font-bold py-4 rounded-2xl hover:bg-opacity-90 shadow-lg text-base" ${!product.inStock ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
            Buy Now
          </button>
        </div>
        ${affiliateHtml}
      </div>
    </div>
  </main>

  <!-- Full Book Cover Lightbox Modal -->
  <div id="full-cover-modal" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm hidden items-center justify-center p-4" onclick="closeCoverModal()">
    <div class="relative max-w-4xl max-h-[90vh] flex flex-col items-center justify-center" onclick="event.stopPropagation()">
      <button onclick="closeCoverModal()" class="absolute -top-10 right-0 text-white hover:text-slate-300 font-black text-2xl leading-none">&times; Close</button>
      <img id="full-cover-modal-img" src="" class="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10" />
      <div id="full-cover-title" class="text-white text-xs font-bold mt-2 opacity-80">${product.name}</div>
    </div>
  </div>

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

    let currentMainImg = '${mainCoverImg}';
    function switchMainImage(url) {
      currentMainImg = url;
      const el = document.getElementById('main-product-cover-img');
      if (el) el.src = url;
    }

    function openCoverModal(url) {
      const targetUrl = url || currentMainImg;
      if (!targetUrl) return;
      const modal = document.getElementById('full-cover-modal');
      const img = document.getElementById('full-cover-modal-img');
      if (img) img.src = targetUrl;
      if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
      }
    }

    function closeCoverModal() {
      const modal = document.getElementById('full-cover-modal');
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      }
    }

    function collectCustomFields() {
      const inputs = document.querySelectorAll('.custom-order-input');
      const fields = {};
      let hasError = false;

      inputs.forEach(input => {
        const label = input.getAttribute('data-field-label') || 'Field';
        const isReq = input.getAttribute('data-required') === 'true';
        const isCheckbox = input.type === 'checkbox';
        const value = isCheckbox ? input.checked : input.value.trim();
        const parent = input.closest('div');
        const errEl = parent ? parent.querySelector('.field-error-msg') : null;

        if (isReq) {
          if ((isCheckbox && !value) || (!isCheckbox && !value)) {
            hasError = true;
            if (errEl) errEl.classList.remove('hidden');
            input.classList.add('border-rose-500');
          } else {
            if (errEl) errEl.classList.add('hidden');
            input.classList.remove('border-rose-500');
          }
        }

        if (isCheckbox ? value : (value !== '')) {
          fields[label] = value;
        }
      });

      if (hasError) return null;
      return fields;
    }

    function handleAddToCart() {
      const customFields = collectCustomFields();
      if (customFields === null) return;
      if (window.SBCart) {
        window.SBCart.addItem({
          id: '${product.id}',
          name: '${safeName}',
          priceCents: ${product.priceCents},
          image: '${safeImg}'
        }, customFields);
      }
    }

    function handleBuyNow() {
      const customFields = collectCustomFields();
      if (customFields === null) return;
      if (window.SBCart) {
        window.SBCart.buyNow({
          id: '${product.id}',
          name: '${safeName}',
          priceCents: ${product.priceCents},
          image: '${safeImg}'
        }, customFields);
      } else {
        checkout('${product.id}', customFields);
      }
    }

    async function checkout(productId, customFields) {
      if (window.trackCMSConversion) {
        window.trackCMSConversion('checkout_start');
      }

      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId,
            quantity: 1,
            customFields: customFields || undefined,
            items: [{
              productId,
              quantity: 1,
              customFields: customFields || undefined
            }]
          })
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

export async function renderCheckoutSuccessHtml(sessionId?: string): Promise<string> {
  const dbName = process.env.SWIFTBASE_DATABASE_NAME || "cms";
  const database = db(dbName);

  // 1. Fetch settings for branding and header/footer
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
    console.error("Failed to load settings in renderCheckoutSuccessHtml:", err);
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

  // 2. Lookup purchase or stripe session if session_id is provided
  let purchase: CMSPurchase | null = null;
  let stripeSession: Stripe.Checkout.Session | null = null;

  if (sessionId) {
    try {
      const res = await database("cms_purchases").where("stripeSessionId", sessionId).execute();
      if (res.data && res.data[0]) {
        purchase = normalizePurchase(res.data[0]);
      }
    } catch (e: any) {
      console.warn("Could not query cms_purchases by stripeSessionId:", e.message);
    }

    // Fallback: If webhook hasn't fired yet or purchase not inserted, retrieve directly from Stripe
    if (!purchase) {
      try {
        const stripeKey = process.env.STRIPE_SECRET_KEY || settings?.stripeWebhookSecret;
        if (stripeKey) {
          const stripe = new Stripe(stripeKey, { apiVersion: "2024-04-10" });
          stripeSession = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ["line_items", "line_items.data.price.product"],
          });
        }
      } catch (stripeErr: any) {
        console.warn("Could not retrieve Stripe session directly:", stripeErr.message);
      }
    }
  }

  // Derive order details
  const orderId = purchase ? purchase.id : (sessionId || `ORDER-${Date.now()}`);
  const customerEmail = purchase?.customerEmail || stripeSession?.customer_details?.email || "";
  const customerName = purchase?.customerName || stripeSession?.customer_details?.name || stripeSession?.shipping_details?.name || "";
  const totalAmountCents = purchase ? purchase.amountTotalCents : (stripeSession?.amount_total || 0);

  // Items list
  interface DisplayItem {
    name: string;
    quantity: number;
    amountCents: number;
    image?: string;
    customFields?: Record<string, any>;
  }

  const items: DisplayItem[] = [];
  if (purchase && purchase.items && purchase.items.length > 0) {
    for (const item of purchase.items) {
      items.push({
        name: item.name,
        quantity: item.quantity,
        amountCents: item.unitAmountCents * item.quantity,
        image: item.images && item.images.length > 0 ? item.images[0] : undefined,
        customFields: item.customFields,
      });
    }
  } else if (stripeSession && (stripeSession as any).line_items?.data) {
    for (const line of (stripeSession as any).line_items.data) {
      const prod = line.price?.product as Stripe.Product | undefined;
      items.push({
        name: line.description || prod?.name || "Product",
        quantity: line.quantity || 1,
        amountCents: line.amount_total || 0,
        image: prod?.images && prod.images.length > 0 ? prod.images[0] : undefined,
      });
    }
  }

  // Shipping Address
  let shippingAddr = purchase?.shippingAddress;
  if (!shippingAddr && stripeSession?.shipping_details?.address) {
    const a = stripeSession.shipping_details.address;
    shippingAddr = {
      name: stripeSession.shipping_details.name || customerName,
      line1: a.line1 || "",
      line2: a.line2 || "",
      city: a.city || "",
      state: a.state || "",
      postalCode: a.postal_code || "",
      country: a.country || "",
      phone: stripeSession.customer_details?.phone || undefined,
    };
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation - ${settings.siteTitle || "Store"}</title>
  ${settings.faviconUrl ? `<link rel="icon" href="${settings.faviconUrl}">` : ""}
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    ${settings.navbarCss || ""}
    ${settings.footerCss || ""}
    ${settings.globalStyles || ""}
  </style>
</head>
<body class="bg-slate-50 text-slate-900 min-h-screen flex flex-col font-sans antialiased">
  ${navbarHtml}

  <main class="max-w-3xl mx-auto px-4 py-12 md:py-16 flex-1 w-full">
    <!-- Success Banner Card -->
    <div class="bg-white rounded-3xl p-8 md:p-10 shadow-xl border border-slate-100 text-center mb-8">
      <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 mb-6 shadow-inner ring-8 ring-emerald-50">
        <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
        </svg>
      </div>

      <h1 class="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-2">
        Thank You for Your Order!
      </h1>
      <p class="text-base text-slate-600 max-w-lg mx-auto">
        Your payment was processed successfully. ${customerEmail ? `A confirmation receipt has been sent to <span class="font-bold text-slate-800">${customerEmail}</span>.` : 'Your order is confirmed and being prepared.'}
      </p>

      <div class="mt-6 inline-flex flex-wrap items-center justify-center gap-3 text-xs bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-2xl text-slate-600">
        <span>Order Reference: <strong class="font-mono text-slate-900">${orderId}</strong></span>
        <span class="text-slate-300">•</span>
        <span>Status: <strong class="text-emerald-700 font-semibold uppercase tracking-wider">Paid / Confirmed</strong></span>
      </div>
    </div>

    <!-- Order Items & Summary -->
    <div class="bg-white rounded-3xl p-8 md:p-10 shadow-xl border border-slate-100 mb-8 space-y-6">
      <div class="flex items-center justify-between border-b border-slate-100 pb-4">
        <h2 class="text-lg font-black text-slate-900 tracking-tight">Order Summary</h2>
        <span class="text-xs font-semibold text-slate-500">${items.length} ${items.length === 1 ? 'item' : 'items'}</span>
      </div>

      ${items.length > 0 ? `
      <div class="divide-y divide-slate-100">
        ${items.map(item => `
        <div class="py-4 flex gap-4 items-center">
          ${item.image ? `
            <img src="${item.image}" alt="${item.name.replace(/"/g, '&quot;')}" class="w-16 h-16 object-cover rounded-xl border border-slate-200 shadow-sm flex-shrink-0" />
          ` : `
            <div class="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 font-bold text-xs flex-shrink-0">
              Item
            </div>
          `}
          <div class="flex-1 min-w-0">
            <h3 class="font-bold text-slate-900 text-sm md:text-base truncate">${item.name}</h3>
            <p class="text-xs text-slate-500">Qty: ${item.quantity}</p>
            ${item.customFields && Object.keys(item.customFields).length > 0 ? `
              <div class="mt-1 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200/60 space-y-0.5">
                ${Object.entries(item.customFields).map(([k, v]) => `<div><span class="font-semibold">${k}:</span> ${v}</div>`).join('')}
              </div>
            ` : ''}
          </div>
          <div class="text-sm font-bold text-slate-900 text-right">
            $${(item.amountCents / 100).toFixed(2)}
          </div>
        </div>
        `).join('')}
      </div>
      ` : `
      <div class="py-4 text-center text-sm text-slate-500">
        Your order details are confirmed. If you have questions about this order, please contact the site author.
      </div>
      `}

      <div class="border-t border-slate-100 pt-4 space-y-2">
        <div class="flex justify-between items-center text-base font-black text-slate-900">
          <span>Total Paid</span>
          <span class="text-xl font-black text-slate-900">$${(totalAmountCents / 100).toFixed(2)}</span>
        </div>
      </div>
    </div>

    <!-- Shipping Address (if physical) -->
    ${shippingAddr && (shippingAddr.line1 || shippingAddr.city) ? `
    <div class="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 mb-8">
      <h2 class="text-lg font-black text-slate-900 tracking-tight mb-4 flex items-center gap-2">
        <svg class="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
        </svg>
        Shipping Destination
      </h2>
      <div class="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <div class="font-bold text-slate-900">${shippingAddr.name || customerName}</div>
        <div>${shippingAddr.line1}</div>
        ${shippingAddr.line2 ? `<div>${shippingAddr.line2}</div>` : ''}
        <div>${shippingAddr.city}${shippingAddr.state ? `, ${shippingAddr.state}` : ''} ${shippingAddr.postalCode || ''}</div>
        <div>${shippingAddr.country || ''}</div>
        ${shippingAddr.phone ? `<div class="mt-2 text-xs text-slate-500">Phone: ${shippingAddr.phone}</div>` : ''}
      </div>
    </div>
    ` : ''}

    <!-- Continue Actions -->
    <div class="text-center space-y-4">
      <a href="/store" class="inline-flex items-center justify-center gap-2 px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-2xl shadow-lg hover:shadow-xl transition-all">
        <span>Continue Shopping</span>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
        </svg>
      </a>
      <div>
        <a href="/" class="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors">
          Return to Home
        </a>
      </div>
    </div>
  </main>

  ${footerHtml}

  <!-- Client-side Cart Cleanup & Analytics -->
  <script>
    (function() {
      // 1. Clear local cart
      try {
        localStorage.removeItem('sb_cms_cart');
        if (window.SBCart && typeof window.SBCart.clearCart === 'function') {
          window.SBCart.clearCart();
        }
      } catch (e) {
        console.warn('Could not clear cart from localStorage:', e);
      }

      // 2. Track purchase conversion event
      try {
        fetch('/api/analytics/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: window.location.pathname,
            referrer: document.referrer,
            browser: navigator.userAgent,
            operatingSystem: navigator.platform,
            deviceType: window.innerWidth < 768 ? 'mobile' : 'desktop',
            conversionName: 'purchase_completed'
          })
        }).catch(function() {});
      } catch (e) {}
    })();
  </script>
</body>
</html>`;
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
      rebuildAllPublishedPages().catch(e => app.log.warn(`rebuildAllPublishedPages error: ${e.message}`));

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
      rebuildAllPublishedPages().catch(e => app.log.warn(`rebuildAllPublishedPages error: ${e.message}`));

      return reply.send(normalizeProduct(updatedProduct));
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  app.delete("/products/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const { id } = request.params;
      await database("cms_products").where("id", id).delete().execute();
      await rebuildStoreSite().catch(e => app.log.warn(`rebuildStoreSite error: ${e.message}`));
      rebuildAllPublishedPages().catch(e => app.log.warn(`rebuildAllPublishedPages error: ${e.message}`));
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
        rebuildAllPublishedPages().catch(e => app.log.warn(`rebuildAllPublishedPages error: ${e.message}`));
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
  app.post("/checkout", async (request: FastifyRequest<{ Body: { productId?: string; quantity?: number; customFields?: Record<string, any>; items?: Array<{ productId: string; quantity: number; customFields?: Record<string, any> }> } }>, reply) => {
    try {
      const { productId, quantity, customFields, items } = request.body;
      let checkoutItems: Array<{ productId: string; quantity: number; customFields?: Record<string, any> }> = [];

      if (items && Array.isArray(items) && items.length > 0) {
        checkoutItems = items.filter(i => i.productId && Number(i.quantity) > 0);
      } else if (productId) {
        checkoutItems = [{ productId, quantity: Number(quantity) || 1, customFields }];
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

      const currentDb = process.env.SWIFTBASE_DATABASE_NAME || "cms";

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        metadata: {
          siteDatabase: currentDb,
          siteOrigin: origin,
          productIds: JSON.stringify(checkoutItems.map(i => ({
            id: i.productId,
            qty: i.quantity,
            customFields: i.customFields || undefined
          }))),
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
        const currentDb = process.env.SWIFTBASE_DATABASE_NAME || "cms";
        const sessionDb = session.metadata?.siteDatabase;

        // Multi-tenant check: if session has a target siteDatabase and it doesn't match this instance, ignore safely.
        if (sessionDb && sessionDb !== currentDb) {
          app.log.info(`Stripe webhook ignored for session ${session.id}: target siteDatabase ${sessionDb} does not match current ${currentDb}`);
          return reply.send({ ignored: true, reason: `Target siteDatabase ${sessionDb} does not match current ${currentDb}` });
        }

        // Idempotency check: don't process if already exists in cms_purchases
        const existingPurchaseRes = await database("cms_purchases").where("stripeSessionId", session.id).execute();
        if (existingPurchaseRes.data && existingPurchaseRes.data.length > 0) {
          return reply.send({ received: true, alreadyProcessed: true });
        }

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
                customFields: m.customFields || undefined,
              };
            });
          }
        } catch (itemErr: any) {
          app.log.warn(`Error resolving items for purchase: ${itemErr.message}`);
        }

        // Extract customer & shipping details
        // Note: Stripe webhook payloads sometimes omit expanded shipping_details; fetch full session if missing
        let fullSession = session;
        if (!fullSession.shipping_details?.address && stripe) {
          try {
            fullSession = await stripe.checkout.sessions.retrieve(session.id);
          } catch (fetchErr: any) {
            app.log.warn(`Could not retrieve full session ${session.id} from Stripe: ${fetchErr.message}`);
          }
        }

        const customerEmail = fullSession.customer_details?.email || session.customer_details?.email || "anonymous@example.com";
        const customerName = fullSession.customer_details?.name || fullSession.shipping_details?.name || session.customer_details?.name || session.shipping_details?.name || "";

        let shippingAddress: ShippingAddress | undefined = undefined;
        const shippingSource = fullSession.shipping_details?.address ? fullSession.shipping_details : fullSession.customer_details;
        if (shippingSource?.address) {
          const addr = shippingSource.address;
          shippingAddress = {
            name: fullSession.shipping_details?.name || fullSession.customer_details?.name || customerName,
            line1: addr.line1 || "",
            line2: addr.line2 || "",
            city: addr.city || "",
            state: addr.state || "",
            postalCode: addr.postal_code || "",
            country: addr.country || "",
            phone: fullSession.customer_details?.phone || undefined,
          };
        }

        const purchase: any = {
          id: `purch-${Date.now()}`,
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

        try {
          await database("cms_purchases").insert({
            ...purchase,
            projectId: process.env.SWIFTBASE_PROJECT_ID || "author-sites"
          }).execute();
        } catch (insertErr: any) {
          if (insertErr.message?.includes("no column named projectId")) {
            await database("cms_purchases").insert(purchase).execute();
          } else {
            throw insertErr;
          }
        }

        // Check if Postmark confirmation email should be sent
        try {
          const settingsRes = await database("cms_settings").execute();
          const settings = settingsRes.data[0];
          if (settings?.postmarkApiToken && settings?.postmarkFromEmail) {
            // 1. Send confirmation email to customer
            if (customerEmail) {
              const emailContent = formatOrderConfirmationEmail({
                siteTitle: settings.siteTitle || "Store",
                customerName,
                orderId: purchase.id,
                amountTotalCents: amountTotal || 0,
                items,
                shippingAddress,
              });

              const emailResult = await sendPostmarkEmail({
                apiToken: settings.postmarkApiToken,
                from: settings.postmarkFromEmail,
                to: customerEmail,
                subject: emailContent.subject,
                htmlBody: emailContent.htmlBody,
              });

              if (emailResult.success) {
                app.log.info(`Order confirmation email sent via Postmark for purchase ${purchase.id}`);
              } else {
                app.log.warn(`Postmark send failed for purchase ${purchase.id}: ${emailResult.error}`);
              }
            }

            // 2. Send notification email to all project users / staff
            const shouldNotifyStaff = settings.postmarkNotifyStaffOnOrder !== false;
            if (shouldNotifyStaff) {
              const recipientEmails = new Set<string>();

              // Fetch all users in current project via Swiftbase Identity API
              try {
                const { getAccessToken } = await import("swiftbase-admin-sdk");
                const currentToken = await getAccessToken();
                const baseUrl = (process.env.SWIFTBASE_BASE_URL || "https://api.swiftbase.io").replace(/\/$/, "");
                const projectId = process.env.SWIFTBASE_PROJECT_ID || "author-sites";

                const usersRes = await fetch(`${baseUrl}/api/identity/users?projectId=${encodeURIComponent(projectId)}`, {
                  headers: currentToken ? { "Authorization": `Bearer ${currentToken}` } : {}
                });

                if (usersRes.ok) {
                  const usersData: any = await usersRes.json();
                  const usersList: any[] = Array.isArray(usersData) ? usersData : (usersData?.items || []);
                  for (const u of usersList) {
                    if (u.email && typeof u.email === "string" && u.email.includes("@")) {
                      recipientEmails.add(u.email.trim().toLowerCase());
                    }
                  }
                } else {
                  app.log.warn(`Could not fetch project users for order notification (Status ${usersRes.status})`);
                }
              } catch (userFetchErr: any) {
                app.log.warn(`Error querying project users for order alert: ${userFetchErr.message}`);
              }

              // Add any explicit adminNotificationEmails configured in settings
              if (settings.adminNotificationEmails && typeof settings.adminNotificationEmails === "string") {
                const extras = settings.adminNotificationEmails.split(",").map((e: string) => e.trim().toLowerCase());
                for (const em of extras) {
                  if (em && em.includes("@")) {
                    recipientEmails.add(em);
                  }
                }
              }

              if (recipientEmails.size > 0) {
                const siteOrigin = session.metadata?.siteOrigin || (settings.siteDomain ? `https://${settings.siteDomain}` : "");
                const adminUrl = siteOrigin ? `${siteOrigin}/admin` : undefined;

                const staffEmailContent = formatNewOrderAdminNotificationEmail({
                  siteTitle: settings.siteTitle || "Store",
                  orderId: purchase.id,
                  customerName,
                  customerEmail,
                  amountTotalCents: amountTotal || 0,
                  items,
                  shippingAddress,
                  adminUrl,
                });

                for (const recipient of recipientEmails) {
                  try {
                    const staffResult = await sendPostmarkEmail({
                      apiToken: settings.postmarkApiToken,
                      from: settings.postmarkFromEmail,
                      to: recipient,
                      subject: staffEmailContent.subject,
                      htmlBody: staffEmailContent.htmlBody,
                    });
                    if (staffResult.success) {
                      app.log.info(`Staff order alert email sent to ${recipient} for purchase ${purchase.id}`);
                    } else {
                      app.log.warn(`Postmark send failed to staff ${recipient} for purchase ${purchase.id}: ${staffResult.error}`);
                    }
                  } catch (sendErr: any) {
                    app.log.warn(`Error sending staff order alert to ${recipient}: ${sendErr.message}`);
                  }
                }
              }
            }
          }
        } catch (emailErr: any) {
          app.log.warn(`Failed to process order emails: ${emailErr.message}`);
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
