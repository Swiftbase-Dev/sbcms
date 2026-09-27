import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerExtensionRoutes } from "../extension.controller.js";
import { validateManifest, SUPPORTED_PERMISSIONS } from "../extension.engine.js";

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
      listObjects: vi.fn().mockResolvedValue([]),
      deleteObject: vi.fn().mockResolvedValue({ success: true }),
    })),
    initializeSdk: vi.fn(),
  };
});

describe("Extension Engine & Permissions Validation", () => {
  it("should validate a proper manifest successfully", () => {
    const valid = {
      id: "test-extension",
      name: "Test Extension",
      version: "1.0.0",
      description: "A test extension",
      author: "Tester",
      permissions: ["storage:upload", "email:send"],
    };
    const res = validateManifest(valid);
    expect(res.valid).toBe(true);
    expect(res.manifest?.id).toBe("test-extension");
    expect(res.manifest?.permissions).toContain("storage:upload");
  });

  it("should reject manifest with invalid characters in id", () => {
    const invalid = {
      id: "invalid extension id with spaces",
      name: "Invalid",
      version: "1.0.0",
      description: "Desc",
      author: "Author",
      permissions: [],
    };
    const res = validateManifest(invalid);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("id");
  });

  it("should reject manifest with unsupported permissions", () => {
    const invalid = {
      id: "unsupported-perm",
      name: "Bad Perm",
      version: "1.0.0",
      description: "Desc",
      author: "Author",
      permissions: ["root:access:all"],
    };
    const res = validateManifest(invalid);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Unsupported permission");
  });

  it("should map supported permissions to clear human readable descriptions", () => {
    expect(SUPPORTED_PERMISSIONS["storage:upload"].title).toBeDefined();
    expect(SUPPORTED_PERMISSIONS["email:send"].description).toBeDefined();
    expect(SUPPORTED_PERMISSIONS["ui:designer:block"].title).toBeDefined();
  });
});

describe("Extension Controller Endpoints", () => {
  let app: any;

  beforeEach(() => {
    inMemoryData = {};
    app = Fastify();
    registerExtensionRoutes(app);
  });

  it("should inspect a local extension and return permissions list", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/extensions/inspect",
      payload: { gitUrl: "ebook-preview" },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.manifest.id).toBe("ebook-preview");
    expect(json.manifest.name).toContain("E-book");
    expect(Array.isArray(json.permissionDetails)).toBe(true);
    expect(json.permissionDetails[0].permission).toBe("ui:designer:block");
  });

  it("should reject installation without explicit user consent", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/extensions/install",
      payload: {
        gitUrl: "ebook-preview",
        consentGiven: false,
      },
    });

    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.payload);
    expect(json.message).toContain("Explicit user consent");
  });

  it("should install extension with explicit user consent", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/extensions/install",
      payload: {
        gitUrl: "ebook-preview",
        consentGiven: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.extension.id).toBe("ebook-preview");
    expect(json.extension.enabled).toBe(true);
    expect(inMemoryData["cms_extensions"].length).toBe(1);
  });

  it("should list installed extensions", async () => {
    inMemoryData["cms_extensions"] = [
      {
        id: "ebook-preview",
        name: "E-book Sample Preview Widget",
        version: "1.0.0",
        description: "Widget",
        author: "Swiftbase Team",
        enabled: true,
        permissions: JSON.stringify(["ui:designer:block"]),
        manifest: JSON.stringify({ id: "ebook-preview" }),
      },
    ];

    const res = await app.inject({
      method: "GET",
      url: "/extensions",
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.length).toBe(1);
    expect(json[0].id).toBe("ebook-preview");
    expect(json[0].permissions).toContain("ui:designer:block");
  });

  it("should toggle extension enabled status", async () => {
    inMemoryData["cms_extensions"] = [
      {
        id: "ebook-preview",
        name: "E-book Sample Preview Widget",
        version: "1.0.0",
        enabled: true,
      },
    ];

    const res = await app.inject({
      method: "PATCH",
      url: "/extensions/ebook-preview",
      payload: { enabled: false },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.enabled).toBe(false);
  });

  it("should uninstall an extension and delete files", async () => {
    inMemoryData["cms_extensions"] = [
      {
        id: "ebook-preview",
        name: "E-book Sample Preview Widget",
      },
    ];

    const res = await app.inject({
      method: "DELETE",
      url: "/extensions/ebook-preview",
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.id).toBe("ebook-preview");
    expect(inMemoryData["cms_extensions"].length).toBe(0);
  });
});
