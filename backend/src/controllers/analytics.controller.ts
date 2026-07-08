import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "swiftbase-admin-sdk";
import type { AnalyticsEventPayload } from "swiftbase-cms-shared";

const database = db(process.env.SWIFTBASE_DATABASE_NAME || "cms");

export function registerAnalyticsRoutes(app: FastifyInstance) {
  // Ingest Events
  app.post("/analytics/event", async (request: FastifyRequest<{ Body: AnalyticsEventPayload }>, reply) => {
    try {
      const body = request.body;
      const ip = request.ip;
      
      const newEvent = {
        id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        projectId: "swiftbase",
        path: body.path || "/",
        referrer: body.referrer || "",
        browser: body.browser || "Unknown",
        operatingSystem: body.operatingSystem || "Unknown",
        deviceType: body.deviceType || "desktop",
        countryCode: body.countryCode || "US", // Default to US if geolocating is unavailable
        conversionName: body.conversionName || null,
        timestamp: new Date().toISOString()
      };

      database("cms_analytics_events").insert(newEvent).execute().catch((err: any) => {
        app.log.error(err, "Failed to persist analytics event in background");
      });
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  // Fetch Dashboard Stats
  app.get("/analytics/dashboard", async (request, reply) => {
    try {
      const eventsRes = await database("cms_analytics_events").execute();
      const events = eventsRes.data;

      const purchasesRes = await database("cms_purchases").execute();
      const purchases = purchasesRes.data;

      // Aggregates
      const totalPageviews = events.filter(e => !e.conversionName).length;
      const uniqueSessions = new Set(events.map(e => e.referrer + e.browser)).size;
      const totalPurchases = purchases.length;
      const totalRevenueCents = purchases.reduce((acc, p) => acc + p.amountTotalCents, 0);

      // Device Split
      const devices: Record<string, number> = { mobile: 0, desktop: 0, tablet: 0 };
      // Browser Split
      const browsers: Record<string, number> = {};
      // Country Split (Geo Choropleth)
      const countries: Record<string, number> = {};

      events.forEach(e => {
        if (e.deviceType) devices[e.deviceType] = (devices[e.deviceType] || 0) + 1;
        
        let browserName = "Other";
        if (e.browser.includes("Chrome")) browserName = "Chrome";
        else if (e.browser.includes("Safari")) browserName = "Safari";
        else if (e.browser.includes("Firefox")) browserName = "Firefox";
        browsers[browserName] = (browsers[browserName] || 0) + 1;

        if (e.countryCode) countries[e.countryCode] = (countries[e.countryCode] || 0) + 1;
      });

      // Conversion funnel (Pageview -> Start Checkout -> Complete Checkout)
      const funnel = {
        pageviews: totalPageviews,
        checkoutStarts: events.filter(e => e.conversionName === "checkout_start").length,
        purchasesCompleted: totalPurchases
      };

      return reply.send({
        stats: {
          pageviews: totalPageviews,
          sessions: uniqueSessions,
          purchases: totalPurchases,
          revenue: totalRevenueCents / 100
        },
        splits: {
          devices,
          browsers,
          countries
        },
        funnel
      });
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });
}
