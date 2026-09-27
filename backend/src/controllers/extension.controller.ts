import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
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

      const { manifest } = await fetchGitManifest(gitUrl, ref || "main");
      
      // Store extension bundle in Object Storage
      await installExtensionBundle(manifest);

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
}
