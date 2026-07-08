import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { search } from "swiftbase-admin-sdk";

export function registerSearchRoutes(app: FastifyInstance) {
  app.get("/search", async (request: FastifyRequest, reply: FastifyReply) => {
    const { q } = request.query as { q: string };
    if (!q) {
      return reply.send({ results: [] });
    }

    // Retrieve search index configurations from environment variables if defined,
    // otherwise fallback gracefully.
    const pagesIndexId = process.env.SWIFTBASE_SEARCH_INDEX_PAGES || "pages_idx";
    const productsIndexId = process.env.SWIFTBASE_SEARCH_INDEX_PRODUCTS || "products_idx";
    const blogsIndexId = process.env.SWIFTBASE_SEARCH_INDEX_BLOGS || "blogs_idx";

    const searchPromises = [
      search(pagesIndexId, q).then((res: any[]) => res.map((item: any) => ({ ...item, type: "page" }))).catch(() => []),
      search(productsIndexId, q).then((res: any[]) => res.map((item: any) => ({ ...item, type: "product" }))).catch(() => []),
      search(blogsIndexId, q).then((res: any[]) => res.map((item: any) => ({ ...item, type: "blog" }))).catch(() => [])
    ];

    try {
      const allResults = await Promise.all(searchPromises);
      const results = allResults.flat();
      return reply.send({ results });
    } catch (err: any) {
      request.log.error(err, "SBCMS global search failed");
      return reply.code(500).send({ error: "Search failed: " + err.message });
    }
  });
}
