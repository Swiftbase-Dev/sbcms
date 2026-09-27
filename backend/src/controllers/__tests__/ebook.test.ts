import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerEbookRoutes } from "../ebook.controller.js";

let inMemoryData: Record<string, any[]> = {};

vi.mock("swiftbase-admin-sdk", () => {
  const queryBuilder = (tableName: string) => {
    let whereClause: any = null;
    return {
      where: (clause: any) => {
        whereClause = clause;
        return {
          where: (moreClause: any) => {
            whereClause = { ...whereClause, ...moreClause };
            return {
              execute: async () => {
                const table = inMemoryData[tableName] || [];
                const filtered = table.filter(item => {
                  return Object.entries(whereClause).every(([k, v]) => item[k] === v);
                });
                return { data: filtered };
              }
            };
          },
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
      getObject: vi.fn().mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(Buffer.from("dummy-ebook-content")),
      }),
      deleteObject: vi.fn().mockResolvedValue({ success: true }),
    })),
    initializeSdk: vi.fn(),
  };
});

// Mock email helper
vi.mock("../email.helper.js", () => ({
  sendPostmarkEmail: vi.fn().mockResolvedValue({ success: true, messageId: "msg-123" }),
  formatFreeEbookNotificationEmail: vi.fn().mockReturnValue({
    subject: "Test Subject",
    htmlBody: "<p>Test</p>",
  }),
}));

describe("E-book Distribution Controller Endpoints", () => {
  let app: any;

  beforeEach(() => {
    inMemoryData = {};
    app = Fastify();
    registerEbookRoutes(app);
  });

  it("should handle uploading an e-book file (EPUB)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/ebooks/files/prod-123",
      payload: {
        format: "epub",
        fileName: "my-novel.epub",
        base64: Buffer.from("epub data content").toString("base64"),
      },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.file.format).toBe("epub");
    expect(json.file.productId).toBe("prod-123");
    expect(json.file.fileUrl).toContain("ebooks/prod-123/epub/");
    expect(inMemoryData["cms_ebook_files"].length).toBe(1);
  });

  it("should list e-book files for a product", async () => {
    inMemoryData["cms_ebook_files"] = [
      {
        id: "ebf-1",
        productId: "prod-123",
        format: "epub",
        fileName: "novel.epub",
        fileSizeBytes: 1024,
      },
      {
        id: "ebf-2",
        productId: "prod-123",
        format: "pdf",
        fileName: "novel.pdf",
        fileSizeBytes: 2048,
      },
    ];

    const res = await app.inject({
      method: "GET",
      url: "/ebooks/files/prod-123",
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.length).toBe(2);
    expect(json[0].format).toBe("epub");
    expect(json[1].format).toBe("pdf");
  });

  it("should send a free copy and generate a distribution record", async () => {
    inMemoryData["cms_products"] = [{ id: "prod-123", name: "The Great Novel" }];
    inMemoryData["cms_settings"] = [{
      siteTitle: "Author Site",
      postmarkApiToken: "test-token",
      postmarkFromEmail: "author@test.com",
    }];

    const res = await app.inject({
      method: "POST",
      url: "/ebooks/free-copy",
      payload: {
        productId: "prod-123",
        recipientName: "Jane Doe",
        recipientEmail: "jane@example.com",
        message: "Enjoy the review copy!",
      },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.distribution.recipientEmail).toBe("jane@example.com");
    expect(json.distribution.token).toContain("sb-free-");
    expect(json.downloadUrl).toContain("/download/sb-free-");
    expect(json.emailSent).toBe(true);
  });

  it("should generate single-use offline download cards", async () => {
    inMemoryData["cms_products"] = [{ id: "prod-123", name: "Exclusive Release" }];

    const res = await app.inject({
      method: "POST",
      url: "/ebooks/cards/generate",
      payload: {
        productId: "prod-123",
        count: 3,
        prefix: "EVENT",
      },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.count).toBe(3);
    expect(json.cards[0].code).toMatch(/^EVENT-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(json.cards[0].maxDownloads).toBe(1);
    expect(inMemoryData["cms_ebook_distributions"].length).toBe(3);
  });

  it("should redeem an offline download code successfully", async () => {
    inMemoryData["cms_ebook_distributions"] = [{
      id: "dist-card-1",
      code: "EVENT-ABCD-1234",
      token: "sb-card-valid-token",
      productId: "prod-123",
      productTitle: "Exclusive Release",
      isRedeemed: false,
      downloadCount: 0,
      maxDownloads: 1,
    }];

    const res = await app.inject({
      method: "POST",
      url: "/ebooks/cards/redeem",
      payload: { code: "EVENT-ABCD-1234" },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.token).toBe("sb-card-valid-token");
    expect(inMemoryData["cms_ebook_distributions"][0].isRedeemed).toBe(true);
  });

  it("should reject an already exhausted download card code", async () => {
    inMemoryData["cms_ebook_distributions"] = [{
      id: "dist-card-1",
      code: "EVENT-USED-1234",
      token: "sb-card-used-token",
      productId: "prod-123",
      isRedeemed: true,
      downloadCount: 1,
      maxDownloads: 1,
    }];

    const res = await app.inject({
      method: "POST",
      url: "/ebooks/cards/redeem",
      payload: { code: "EVENT-USED-1234" },
    });

    expect(res.statusCode).toBe(410);
    const json = JSON.parse(res.payload);
    expect(json.message).toContain("already been redeemed");
  });

  it("should load download hub info and device guides for a valid token", async () => {
    inMemoryData["cms_ebook_distributions"] = [{
      id: "dist-1",
      token: "test-token",
      type: "free_copy",
      productId: "prod-123",
      productTitle: "The Great Novel",
      recipientName: "Jane",
      downloadCount: 0,
      maxDownloads: 5,
    }];
    inMemoryData["cms_products"] = [{
      id: "prod-123",
      name: "The Great Novel",
      description: "Awesome book",
    }];
    inMemoryData["cms_ebook_files"] = [
      { id: "f-1", productId: "prod-123", format: "epub", fileName: "novel.epub", fileSizeBytes: 5000 },
      { id: "f-2", productId: "prod-123", format: "pdf", fileName: "novel.pdf", fileSizeBytes: 8000 },
    ];

    const res = await app.inject({
      method: "GET",
      url: "/ebooks/download/test-token",
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.distribution.token).toBe("test-token");
    expect(json.product.name).toBe("The Great Novel");
    expect(json.files.length).toBe(2);
    expect(json.deviceGuides.length).toBeGreaterThan(0);
    expect(json.deviceGuides.some((g: any) => g.id === "kindle")).toBe(true);
    expect(json.deviceGuides.some((g: any) => g.id === "apple")).toBe(true);
  });
});
