import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fs from "fs";
import path from "path";
import { db } from "swiftbase-admin-sdk";
import type { CMSExtension } from "swiftbase-cms-shared";
import {
  fetchGitManifest,
  installExtensionBundle,
  deleteExtensionBundle,
} from "./extension.engine.js";

function getDb() {
  const dbName = process.env.SWIFTBASE_DATABASE_NAME || "cms";
  return db(dbName);
}

function parseJsonField(val: any, fallback: any = null) {
  if (!val) return fallback;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function normalizeExtension(row: any): CMSExtension {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    description: row.description || "",
    author: row.author || "",
    gitUrl: row.gitUrl || "",
    commitHash: row.commitHash,
    enabled: Boolean(row.enabled),
    permissions: parseJsonField(row.permissions, []),
    manifest: parseJsonField(row.manifest, {}),
    settings: parseJsonField(row.settings, {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function registerExtensionRoutes(app: FastifyInstance) {
  // 1. Inspect a Git repository before installing to display details and permissions
  app.post("/extensions/inspect", async (
    request: FastifyRequest<{ Body: { gitUrl: string; ref?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { gitUrl, ref } = request.body || {};
      if (!gitUrl || typeof gitUrl !== "string") {
        return reply.status(400).send({ message: "gitUrl is required" });
      }

      const inspected = await fetchGitManifest(gitUrl, ref || "main");
      return reply.send(inspected);
    } catch (err: any) {
      request.log.error(err, `Failed to inspect extension: ${err.message}`);
      return reply.status(400).send({ message: err.message || "Failed to inspect extension manifest" });
    }
  });

  // 2. Install extension with user consent to permissions
  app.post("/extensions/install", async (
    request: FastifyRequest<{ Body: { gitUrl: string; ref?: string; consentGiven: boolean } }>,
    reply: FastifyReply
  ) => {
    try {
      const { gitUrl, ref, consentGiven } = request.body || {};
      if (!gitUrl || typeof gitUrl !== "string") {
        return reply.status(400).send({ message: "gitUrl is required" });
      }
      if (!consentGiven) {
        return reply.status(400).send({ message: "Explicit user consent to permissions is required to install this extension" });
      }

      const { manifest, files } = await fetchGitManifest(gitUrl, ref || "main");
      
      // Store extension bundle in Object Storage
      await installExtensionBundle(manifest, files);

      const database = getDb();
      const existingRes = await database("cms_extensions").where({ id: manifest.id }).execute();
      const existing = existingRes.data && existingRes.data.length > 0 ? existingRes.data[0] : null;

      const now = new Date().toISOString();
      const extRecord = {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author,
        gitUrl: gitUrl.trim(),
        enabled: true,
        permissions: JSON.stringify(manifest.permissions),
        manifest: JSON.stringify(manifest),
        settings: existing ? existing.settings : JSON.stringify({}),
        updatedAt: now,
      };

      if (existing) {
        await database("cms_extensions").where({ id: manifest.id }).update(extRecord).execute();
      } else {
        await database("cms_extensions").insert({
          ...extRecord,
          createdAt: now,
        }).execute();
      }

      return reply.send({
        success: true,
        extension: {
          ...extRecord,
          enabled: true,
          permissions: manifest.permissions,
          manifest,
          settings: parseJsonField(extRecord.settings, {}),
        },
      });
    } catch (err: any) {
      request.log.error(err, `Extension installation failed: ${err.message}`);
      return reply.status(500).send({ message: err.message || "Failed to install extension" });
    }
  });

  // 3. List installed extensions
  app.get("/extensions", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const database = getDb();
      const res = await database("cms_extensions").execute();
      const rows = res.data || [];
      const extensions = rows.map(normalizeExtension);
      return reply.send(extensions);
    } catch (err: any) {
      request.log.error(err, "Failed to list extensions");
      return reply.status(500).send({ message: err.message || "Failed to list extensions" });
    }
  });

  // 4. Update extension status (enable/disable) or settings
  app.patch("/extensions/:id", async (
    request: FastifyRequest<{ Params: { id: string }; Body: { enabled?: boolean; settings?: Record<string, any> } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const { enabled, settings } = request.body || {};
      const database = getDb();

      const existingRes = await database("cms_extensions").where({ id }).execute();
      if (!existingRes.data || existingRes.data.length === 0) {
        return reply.status(404).send({ message: "Extension not found" });
      }

      const updates: any = { updatedAt: new Date().toISOString() };
      if (typeof enabled === "boolean") {
        updates.enabled = enabled;
      }
      if (settings !== undefined) {
        updates.settings = JSON.stringify(settings);
      }

      await database("cms_extensions").where({ id }).update(updates).execute();

      const updatedRes = await database("cms_extensions").where({ id }).execute();
      return reply.send(normalizeExtension(updatedRes.data[0]));
    } catch (err: any) {
      request.log.error(err, `Failed to update extension ${request.params.id}`);
      return reply.status(500).send({ message: err.message || "Failed to update extension" });
    }
  });

  // 5. Uninstall extension
  app.delete("/extensions/:id", async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const database = getDb();

      // Clean up files from storage bucket
      await deleteExtensionBundle(id);

      // Remove from database
      await database("cms_extensions").where({ id }).delete().execute();

      return reply.send({ success: true, id });
    } catch (err: any) {
      request.log.error(err, `Failed to uninstall extension ${request.params.id}`);
      return reply.status(500).send({ message: err.message || "Failed to uninstall extension" });
    }
  });

  // 6. Serve extension static assets (scripts, styles, icons) from Object Storage or local fallback
  app.get("/extensions/:id/assets/*", async (
    request: FastifyRequest<{ Params: { id: string; "*": string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const assetPath = (request.params as any)["*"];
      if (!assetPath) {
        return reply.status(404).send({ message: "Asset path is required" });
      }

      // 1. Check local directory fallback (for development / local extensions)
      const possibleLocalPaths = [
        path.resolve(process.cwd(), "../extensions", id, assetPath),
        path.resolve(process.cwd(), "../../extensions", id, assetPath),
        path.resolve("/Users/bchiappetta/Projects/swiftbase/extensions", id, assetPath),
      ];

      for (const p of possibleLocalPaths) {
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          const content = fs.readFileSync(p);
          const ext = path.extname(p).toLowerCase();
          const contentType =
            ext === ".js" ? "application/javascript" :
            ext === ".css" ? "text/css" :
            ext === ".json" ? "application/json" :
            ext === ".svg" ? "image/svg+xml" :
            "application/octet-stream";

          reply.header("Content-Type", contentType);
          reply.header("Cache-Control", "no-cache");
          return reply.send(content);
        }
      }

      // 2. Fetch from Object Storage
      const { Storage } = await import("swiftbase-admin-sdk");
      const bucket = process.env.SWIFTBASE_STORAGE_BUCKET || "swiftbase-cms-storage";
      const endpoint = `${(process.env.SWIFTBASE_URL || process.env.SWIFTBASE_BASE_URL || process.env.SWIFTBASE_API_URL || "https://api.swiftbase.io").replace(/\/$/, "")}/storage`;
      const storage = new Storage({ bucket, endpoint });

      const storageKey = `extensions/${id}/${assetPath}`;
      const obj = await storage.getObject(storageKey);
      const buffer = await obj.arrayBuffer();

      const ext = path.extname(assetPath).toLowerCase();
      const contentType =
        ext === ".js" ? "application/javascript" :
        ext === ".css" ? "text/css" :
        ext === ".json" ? "application/json" :
        ext === ".svg" ? "image/svg+xml" :
        obj.headers.get("Content-Type") || "application/octet-stream";

      reply.header("Content-Type", contentType);
      reply.header("Cache-Control", "no-cache");
      return reply.send(Buffer.from(buffer));
    } catch (err: any) {
      request.log.warn(`Extension asset not found (${request.params.id}): ${err.message}`);
      return reply.status(404).send({ message: "Asset not found" });
    }
  });

  // 7. Generic Extension Key-Value / Document Store API
  app.get("/extensions/:id/data/:collection", async (
    request: FastifyRequest<{ Params: { id: string; collection: string }; Querystring: { key?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id, collection } = request.params;
      const { key } = (request.query as any) || {};
      const database = getDb();

      let query = database("cms_extension_data").where({ extensionId: id, collection });
      if (key) {
        query = query.where({ key });
      }
      const res = await query.execute();
      const records = (res.data || []).map((r: any) => ({
        id: r.id,
        key: r.key,
        data: parseJsonField(r.data, {}),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));

      return reply.send(key ? (records[0] || null) : records);
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  app.post("/extensions/:id/data/:collection", async (
    request: FastifyRequest<{ Params: { id: string; collection: string }; Body: { key: string; data: any } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id, collection } = request.params;
      const { key, data } = request.body || {};
      if (!key) return reply.status(400).send({ message: "key is required" });

      const database = getDb();
      const now = new Date().toISOString();
      const existing = await database("cms_extension_data").where({ extensionId: id, collection, key }).execute();

      if (existing.data && existing.data.length > 0) {
        await database("cms_extension_data").where({ id: existing.data[0].id }).update({
          data: JSON.stringify(data),
          updatedAt: now,
        }).execute();
      } else {
        const recordId = `ext_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await database("cms_extension_data").insert({
          id: recordId,
          extensionId: id,
          collection,
          key,
          data: JSON.stringify(data),
          createdAt: now,
          updatedAt: now,
        }).execute();
      }

      return reply.send({ success: true, key, data });
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  app.delete("/extensions/:id/data/:collection", async (
    request: FastifyRequest<{ Params: { id: string; collection: string }; Querystring: { key: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id, collection } = request.params;
      const { key } = (request.query as any) || {};
      if (!key) return reply.status(400).send({ message: "key is required" });

      const database = getDb();
      await database("cms_extension_data").where({ extensionId: id, collection, key }).delete().execute();
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });
}
