import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerStoreRoutes, normalizeProduct } from "../store.controller.js";

let inMemoryData: Record<string, any[]> = {};

vi.mock("swiftbase-admin-sdk", () => {
  const queryBuilder = (tableName: string) => {
    let whereClause: any = null;
    return {
      where: (clause: any) => {
        whereClause = clause;
        return {
          execute: async () => {
            const table = inMemoryData[tableName] || [];
            if (!whereClause) return { data: table };
            const filtered = table.filter(item => {
              return Object.entries(whereClause).every(([k, v]) => item[k] === v);
            });
            return { data: filtered };
          },
          update: (updates: any) => ({
            execute: async () => {
              const table = inMemoryData[tableName] || [];
              table.forEach(item => {
                if (whereClause && Object.entries(whereClause).every(([k, v]) => item[k] === v)) {
                  Object.assign(item, updates);
                }
              });
              return { success: true };
            }
          }),
          delete: () => ({
            execute: async () => {
              if (!whereClause) {
                inMemoryData[tableName] = [];
              } else {
                inMemoryData[tableName] = (inMemoryData[tableName] || []).filter(item => {
                  return !Object.entries(whereClause).every(([k, v]) => item[k] === v);
                });
              }
              return { success: true };
            }
          }),
        };
      },
      insert: (record: any) => ({
        execute: async () => {
          if (!inMemoryData[tableName]) inMemoryData[tableName] = [];
          inMemoryData[tableName].push(record);
          return { success: true, id: record.id };
        }
      }),
      execute: async () => {
        return { data: inMemoryData[tableName] || [] };
      }
    };
  };

  const mockDbInstance = vi.fn().mockImplementation(() => queryBuilder);

  return {
    db: mockDbInstance,
    Storage: vi.fn().mockImplementation(() => ({
      putObject: vi.fn().mockResolvedValue({ success: true }),
      getObjectAsText: vi.fn().mockResolvedValue("<html>Store</html>"),
      deleteObject: vi.fn().mockResolvedValue({ success: true }),
    })),
    initializeSdk: vi.fn(),
  };
});

describe("Store Controller Existing Functionality & Regressions", () => {
  let app: any;

  beforeEach(() => {
    inMemoryData = {};
    app = Fastify();
    registerStoreRoutes(app);
  });

  it("should normalize product data with fallback JSON fields", () => {
    const raw = {
      id: "prod-1",
      slug: "book-sample",
      name: "Sample Book",
      priceCents: 1500,
      images: JSON.stringify(["https://example.com/cover.jpg"]),
      affiliateLinks: JSON.stringify([]),
      inStock: true,
    };

    const norm = normalizeProduct(raw);
    expect(norm.id).toBe("prod-1");
    expect(norm.name).toBe("Sample Book");
    expect(Array.isArray(norm.images)).toBe(true);
    expect(norm.images[0]).toBe("https://example.com/cover.jpg");
    expect(norm.inStock).toBe(true);
  });

  it("should list products from database", async () => {
    inMemoryData["cms_products"] = [
      {
        id: "prod-1",
        slug: "first-book",
        name: "First Book",
        priceCents: 1200,
        images: "[]",
        affiliateLinks: "[]",
        inStock: true,
      },
    ];

    const res = await app.inject({
      method: "GET",
      url: "/products",
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.length).toBe(1);
    expect(json[0].slug).toBe("first-book");
  });

  it("should create a new product", async () => {
    inMemoryData["cms_settings"] = [{ siteTitle: "Store" }];

    const res = await app.inject({
      method: "POST",
      url: "/products",
      payload: {
        slug: "new-novel",
        name: "New Novel",
        priceCents: 1999,
        category: "Fiction",
        inStock: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.id).toContain("prod-");
    expect(json.name).toBe("New Novel");
    expect(json.slug).toBe("new-novel");

    expect(inMemoryData["cms_products"].length).toBe(1);
  });
});
