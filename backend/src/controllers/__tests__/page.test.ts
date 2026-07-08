import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerPageRoutes } from "../page.controller.js";

// Mock the admin SDK
vi.mock("swiftbase-admin-sdk", () => {
  const mockExecute = vi.fn();
  const mockInsert = vi.fn().mockReturnValue({ execute: mockExecute });
  const mockWhere = vi.fn().mockReturnValue({
    execute: mockExecute,
    update: vi.fn().mockReturnValue({ execute: mockExecute }),
    delete: vi.fn().mockReturnValue({ execute: mockExecute }),
  });
  
  const mockDbInstance = vi.fn().mockImplementation(() => {
    const queryBuilder = vi.fn().mockReturnValue({
      execute: mockExecute,
      insert: mockInsert,
      where: mockWhere,
    });
    return queryBuilder;
  });

  return {
    db: mockDbInstance,
    Storage: vi.fn().mockImplementation(() => ({
      putObject: vi.fn().mockResolvedValue({ success: true }),
    })),
    initializeSdk: vi.fn(),
  };
});

describe("Page Controller Endpoints", () => {
  let app: any;

  beforeEach(() => {
    app = Fastify();
    registerPageRoutes(app);
  });

  it("should fetch default settings when no configurations exist in DB", async () => {
    const { db } = await import("swiftbase-admin-sdk");
    const mockDb = db("cms");
    const mockExecute = mockDb("cms_settings").execute as any;
    mockExecute.mockResolvedValueOnce({ data: [] });

    const res = await app.inject({
      method: "GET",
      url: "/settings",
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.siteTitle).toBe("My SBCMS Site");
    expect(json.isBlogEnabled).toBe(false);
  });

  it("should handle page insertion and assign a unique id", async () => {
    const { db } = await import("swiftbase-admin-sdk");
    const mockDb = db("cms");
    const mockExecute = mockDb("cms_pages").insert({}).execute as any;
    mockExecute.mockResolvedValueOnce({ success: true });

    const res = await app.inject({
      method: "POST",
      url: "/pages",
      payload: {
        title: "Test Page Title",
        slug: "test-slug",
      },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.id).toContain("page-");
    expect(json.title).toBe("Test Page Title");
    expect(json.slug).toBe("test-slug");
  });
});
