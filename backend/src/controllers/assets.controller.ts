import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Storage } from "swiftbase-admin-sdk";
import { Jimp } from "jimp";

export async function generateMissingThumbnails() {
  const bucketName = process.env.SWIFTBASE_STORAGE_BUCKET || "cms-site-assets";
  const storage = new Storage({ bucket: bucketName });
  
  try {
    const result = await storage.listObjects({ prefix: "assets/" });
    const objects = result.contents || [];
    
    // Filter for primary images
    const primaryImages = objects.filter(obj => 
      obj.key !== "assets/" && 
      !obj.key.startsWith("assets/thumb_") &&
      /\.(jpe?g|png|webp|gif)$/i.test(obj.key)
    );

    console.log(`[Thumbnail Worker] Found ${primaryImages.length} images. Checking for missing thumbnails...`);

    for (const img of primaryImages) {
      const filename = img.key.replace(/^assets\//, "");
      const thumbKey = `assets/thumb_${filename}`;
      
      const thumbExists = objects.some(obj => obj.key === thumbKey);
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
  const bucketName = process.env.SWIFTBASE_STORAGE_BUCKET || "cms-site-assets";

  // Trigger background check for missing thumbnails on startup
  generateMissingThumbnails().catch(err => {
    app.log.error(`Failed to generate missing thumbnails: ${err.message}`);
  });

  // List all uploaded assets
  app.get("/assets", async (request, reply) => {
    try {
      const storage = new Storage({ bucket: bucketName });
      const result = await storage.listObjects({ prefix: "assets/" });
      
      const assets = (result.contents || [])
        .filter(obj => obj.key !== "assets/" && !obj.key.startsWith("assets/thumb_")) // Exclude prefix folder and thumbnails
        .map(obj => {
          const filename = obj.key.replace(/^assets\//, "");
          return {
            name: filename,
            key: obj.key,
            size: obj.size,
            lastModified: obj.lastModified,
            url: `/assets/${filename}`,
            thumbnailUrl: `/assets/thumb_${filename}` // Return thumbnail URL reference
          };
        });

      return reply.send(assets);
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });

  // Base64 image upload
  app.post("/assets/upload", async (
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
      const storage = new Storage({ bucket: bucketName });
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
        thumbnailUrl: thumbBase64 ? `/assets/thumb_${safeName}` : `/assets/safeName`
      });
    } catch (err: any) {
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

      const storage = new Storage({ bucket: bucketName });
      await storage.deleteObject(targetKey);
      
      // Attempt thumbnail deletion silently
      await storage.deleteObject(`assets/thumb_${safeName}`).catch(() => {});

      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });
}
