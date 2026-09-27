import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Storage } from "swiftbase-admin-sdk";
import { Jimp } from "jimp";

function getStorageInstance() {
  const bucket = process.env.SWIFTBASE_STORAGE_BUCKET;
  if (!bucket) {
    throw new Error("SWIFTBASE_STORAGE_BUCKET environment variable is required");
  }
  const endpoint = `${(process.env.SWIFTBASE_URL || process.env.SWIFTBASE_API_URL || "https://api.swiftbase.io").replace(/\/$/, "")}/storage`;
  return new Storage({ bucket, endpoint });
}

export async function generateMissingThumbnails() {
  const storage = getStorageInstance();
  
  try {
    const result = await storage.listObjects({ prefix: "assets/" });
    const rawItems: any[] = Array.isArray(result) 
      ? result 
      : (Array.isArray((result as any)?.contents) ? (result as any).contents : []);

    const objects = rawItems.map((obj: any) => ({
      key: obj.key || (obj.path && obj.name ? `${obj.path}/${obj.name}` : obj.name || ""),
      size: obj.size || 0,
      lastModified: obj.lastModified || obj.modified
    }));
    
    // Filter for primary images
    const primaryImages = objects.filter(obj => 
      obj.key &&
      obj.key !== "assets/" && 
      !obj.key.startsWith("assets/thumb_") &&
      !obj.key.startsWith("thumb_") &&
      /\.(jpe?g|png|webp|gif)$/i.test(obj.key)
    );

    console.log(`[Thumbnail Worker] Found ${primaryImages.length} images. Checking for missing thumbnails...`);

    for (const img of primaryImages) {
      const filename = img.key.replace(/^assets\//, "");
      const thumbKey = `assets/thumb_${filename}`;
      
      const thumbExists = objects.some(obj => obj.key === thumbKey || obj.key === `thumb_${filename}`);
      if (!thumbExists) {
        console.log(`[Thumbnail Worker] Generating thumbnail for ${img.key}...`);
        try {
          const originalRes = await storage.getObject(img.key);
          const originalBuffer = await originalRes.arrayBuffer();
          
          const image = await Jimp.read(Buffer.from(originalBuffer));
          
          const w = image.width;
          const h = image.height;
          let newWidth = 256;
          let newHeight = 256;
          if (w > h) {
            newHeight = Math.round((h * 256) / w) || 1;
          } else {
            newWidth = Math.round((w * 256) / h) || 1;
          }
          
          image.resize({ w: newWidth, h: newHeight });
          const thumbBuffer = await image.getBuffer("image/jpeg");
          
          await storage.putObject(thumbKey, thumbBuffer, { contentType: "image/jpeg" });
          console.log(`[Thumbnail Worker] Created thumbnail ${thumbKey}`);
        } catch (innerErr) {
          console.error(`[Thumbnail Worker] Failed to create thumbnail for ${img.key}:`, innerErr);
        }
      }
    }
    console.log("[Thumbnail Worker] Complete check.");
  } catch (err) {
    console.error("[Thumbnail Worker] Error scanning bucket objects:", err);
  }
}

export function registerAssetRoutes(app: FastifyInstance) {
  // Trigger background check for missing thumbnails on startup
  generateMissingThumbnails().catch(err => {
    app.log.error(`Failed to generate missing thumbnails: ${err.message}`);
  });

  // List all uploaded assets
  app.get("/assets", async (request, reply) => {
    try {
      const storage = getStorageInstance();
      const result = await storage.listObjects({ prefix: "assets/" });
      
      const rawItems: any[] = Array.isArray(result) 
        ? result 
        : (Array.isArray((result as any)?.contents) ? (result as any).contents : []);

      const assets = rawItems
        .map((obj: any) => {
          const rawKey = obj.key || (obj.path && obj.name ? `${obj.path}/${obj.name}` : obj.name || "");
          const filename = rawKey.replace(/^assets\//, "").replace(/^\//, "");
          return {
            name: filename,
            key: rawKey.startsWith("assets/") ? rawKey : `assets/${rawKey}`,
            size: obj.size || 0,
            lastModified: obj.lastModified || obj.modified,
            url: `/assets/${filename}`,
            thumbnailUrl: `/assets/thumb_${filename}`
          };
        })
        .filter(obj => obj.name && obj.name !== "assets" && !obj.name.startsWith("thumb_"));

      return reply.send(assets);
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  // Base64 image upload
  app.post("/assets/upload", { bodyLimit: 52428800 }, async (
    request: FastifyRequest<{ Body: { name: string; contentType: string; base64: string; thumbBase64?: string } }>,
    reply
  ) => {
    try {
      const { name, contentType, base64, thumbBase64 } = request.body;
      if (!name || !base64) {
        return reply.status(400).send({ message: "Missing file name or base64 content" });
      }

      // Sanitize filename to prevent path traversal
      const safeName = name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const targetKey = `assets/${safeName}`;

      const buffer = Buffer.from(base64, "base64");
      const storage = getStorageInstance();
      await storage.putObject(targetKey, buffer, { contentType: contentType || "application/octet-stream" });

      // Save thumbnail if provided
      if (thumbBase64) {
        const thumbBuffer = Buffer.from(thumbBase64, "base64");
        await storage.putObject(`assets/thumb_${safeName}`, thumbBuffer, { contentType: "image/jpeg" });
      }

      return reply.send({
        success: true,
        name: safeName,
        url: `/assets/${safeName}`,
        thumbnailUrl: `/assets/thumb_${safeName}`
      });
    } catch (err: any) {
      request.log.error(err, `Upload error for asset: ${err.message}`);
      return reply.status(500).send({ message: err.message });
    }
  });

  // Delete an asset
  app.delete("/assets/:name", async (
    request: FastifyRequest<{ Params: { name: string } }>,
    reply
  ) => {
    try {
      const { name } = request.params;
      const safeName = name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const targetKey = `assets/${safeName}`;

      const storage = getStorageInstance();
      await storage.deleteObject(targetKey);
      
      // Attempt thumbnail deletion silently
      await storage.deleteObject(`assets/thumb_${safeName}`).catch(() => {});

      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });
}
