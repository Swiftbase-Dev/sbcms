import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, Storage } from "swiftbase-admin-sdk";
import type { CMSProduct, CMSSettings, CMSPurchase, AffiliateLink } from "swiftbase-cms-shared";
import Stripe from "stripe";

const database = db(process.env.SWIFTBASE_DATABASE_NAME || "cms");

async function rebuildStoreSite() {
  const productsRes = await database("cms_products").execute();
  const products = productsRes.data;

  const storage = new Storage({ bucket: process.env.SWIFTBASE_STORAGE_BUCKET || "cms-site-assets" });

  // 1. Build Store List HTML
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Store - SBCMS</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-base-100 text-base-content">
  <header class="bg-slate-900 text-white p-4 flex justify-between items-center shadow-lg">
    <a href="/" class="text-xl font-black tracking-tighter">SBCMS</a>
    <nav class="flex gap-6 font-bold text-sm">
      <a href="/" class="hover:text-primary">Home</a>
      <a href="/blog" class="hover:text-primary">Blog</a>
      <a href="/store" class="text-primary font-black">Store</a>
    </nav>
  </header>

  <main class="max-w-6xl mx-auto p-8 min-h-screen">
    <h1 class="text-5xl font-black mb-8 tracking-tighter">Products</h1>
    <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      ${products
        .map(
          (p: CMSProduct) => `
        <div class="border border-base-200 bg-white rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col justify-between">
          <div>
            ${p.images && p.images.length > 0 ? `<img src="${p.images[0]}" class="w-full h-56 object-cover rounded-2xl mb-4" />` : ""}
            <h2 class="text-2xl font-black mb-1">${p.name}</h2>
            <div class="text-xl font-black text-primary mb-4">$${(p.priceCents / 100).toFixed(2)}</div>
            <p class="text-sm opacity-60 mb-6">${p.description || ""}</p>
          </div>
          <div class="flex flex-col gap-2">
            <a href="/store/${p.slug}" class="btn bg-primary text-white text-center font-black py-3 rounded-2xl block hover:bg-opacity-90 shadow-md">View Product</a>
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  </main>

  <footer class="bg-slate-900 text-white p-6 text-center text-xs opacity-60">
    <p>&copy; ${new Date().getFullYear()} SBCMS. Powered by Swiftbase.</p>
  </footer>
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

    const productHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${product.name} - Store</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-base-100 text-base-content">
  <header class="bg-slate-900 text-white p-4 flex justify-between items-center shadow-lg">
    <a href="/" class="text-xl font-black tracking-tighter">SBCMS</a>
    <nav class="flex gap-6 font-bold text-sm">
      <a href="/" class="hover:text-primary">Home</a>
      <a href="/blog" class="hover:text-primary">Blog</a>
      <a href="/store" class="text-primary font-black">Store</a>
    </nav>
  </header>

  <main class="max-w-5xl mx-auto p-8 min-h-screen grid gap-8 md:grid-cols-2">
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
        <p class="leading-relaxed opacity-75 mb-8">${product.description || "No description provided."}</p>
      </div>

      <div>
        <button onclick="checkout('${product.id}')" class="w-full bg-slate-950 text-white font-bold py-4 rounded-2xl hover:bg-opacity-90 shadow-lg text-lg flex justify-center items-center gap-2">
          <span>Buy Now</span>
        </button>
        ${affiliateHtml}
      </div>
    </div>
  </main>

  <footer class="bg-slate-900 text-white p-6 text-center text-xs opacity-60">
    <p>&copy; ${new Date().getFullYear()} SBCMS. Powered by Swiftbase.</p>
  </footer>

  <script>
    async function checkout(productId) {
      // Trigger analytics checkout conversion start
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
          alert('Failed to launch checkout: ' + (data.message || 'Unknown error'));
        }
      } catch (err) {
        console.error('Checkout failed:', err);
      }
    }
  </script>
</body>
</html>`;

    await storage.putObject(`store/${product.slug}/index.html`, productHtml, { contentType: "text/html" });
  }
}

export function registerStoreRoutes(app: FastifyInstance) {
  // Stripe instance helper
  const getStripe = async (): Promise<Stripe | null> => {
    const settingsRes = await database("cms_settings").execute();
    const settings = settingsRes.data[0];
    const stripeKey = process.env.STRIPE_SECRET_KEY || settings?.stripeWebhookSecret; // fallback
    if (!stripeKey) return null;
    return new Stripe(stripeKey);
  };

  app.get("/products", async (request, reply) => {
    try {
      const res = await database("cms_products").execute();
      return reply.send(res.data);
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
            description: body.description,
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

      const newProduct: CMSProduct = {
        id: `prod-${Date.now()}`,
        projectId: "swiftbase",
        slug: body.slug || `prod-${Date.now()}`,
        name: body.name || "Unnamed Product",
        description: body.description || "",
        priceCents: body.priceCents || 0,
        stripeProductId,
        stripePriceId,
        images: body.images || [],
        affiliateLinks: body.affiliateLinks || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await database("cms_products").insert(newProduct).execute();
      await rebuildStoreSite();

      return reply.send(newProduct);
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

      if (stripe && (body.name !== undefined || body.priceCents !== undefined)) {
        try {
          // Create new price if rate changes
          if (body.priceCents !== undefined && body.priceCents !== existing.priceCents && stripeProductId) {
            const price = await stripe.prices.create({
              product: stripeProductId,
              unit_amount: body.priceCents,
              currency: "usd",
            });
            stripePriceId = price.id;
          }
        } catch (stripeErr: any) {
          app.log.warn(`Stripe product update price creation skipped or failed: ${stripeErr.message}`);
        }
      }

      const updatedProduct = {
        ...existing,
        ...body,
        stripePriceId,
        stripeProductId,
        updatedAt: new Date().toISOString(),
      };

      await database("cms_products").where("id", id).update(updatedProduct).execute();
      await rebuildStoreSite();

      return reply.send(updatedProduct);
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
              description: prod.description,
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

  // Stripe Checkout Session Creation
  app.post("/checkout", async (request: FastifyRequest<{ Body: { productId: string } }>, reply) => {
    try {
      const { productId } = request.body;
      const res = await database("cms_products").where("id", productId).execute();
      const product = res.data[0];
      if (!product) return reply.status(404).send({ message: "Product not found" });

      const stripe = await getStripe();
      if (!stripe) {
        // Mock Stripe payment link if keys are not set yet
        const mockRedirectUrl = `https://checkout.stripe.com/pay/mock_session_${Date.now()}`;
        return reply.send({ url: mockRedirectUrl });
      }

      const settingsRes = await database("cms_settings").execute();
      const settings = settingsRes.data[0];
      const origin = settings?.siteDomain || "http://localhost:3000";

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price: product.stripePriceId || "",
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/store/${product.slug}`,
        metadata: {
          productId: product.id,
        },
      });

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
        const session = payload.data.object;
        const productId = session.metadata.productId;
        const amountTotal = session.amount_total;

        const purchase: CMSPurchase = {
          id: `purch-${Date.now()}`,
          projectId: "swiftbase",
          productId,
          stripeSessionId: session.id,
          customerEmail: session.customer_details?.email || "anonymous@example.com",
          amountTotalCents: amountTotal || 0,
          status: "completed",
          createdAt: new Date().toISOString(),
        };

        await database("cms_purchases").insert(purchase).execute();
      }
      return reply.send({ received: true });
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });
}
