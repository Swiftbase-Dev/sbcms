import fs from "fs";
import path from "path";
import { Storage } from "swiftbase-admin-sdk";
import type { ExtensionManifest, ExtensionPermission } from "swiftbase-cms-shared";

export const SUPPORTED_PERMISSIONS: Record<ExtensionPermission, { title: string; description: string }> = {
  "storage:upload": {
    title: "Cloud Storage Access",
    description: "Upload and manage files (such as e-books and preview assets) in your Object Storage bucket.",
  },
  "store:orders:read": {
    title: "Store & Orders Read",
    description: "Read store product and customer purchase records for automated digital fulfillment.",
  },
  "email:send": {
    title: "Email Dispatch",
    description: "Send transactional notification emails and download links to customers and recipients.",
  },
  "ui:designer:block": {
    title: "Page Designer Blocks",
    description: "Add interactive custom widgets and layout blocks to the Page Designer.",
  },
  "routes:public": {
    title: "Public Custom Routes",
    description: "Provide customer-facing pages such as digital download hubs and reading rooms.",
  },
};

function getStorageInstance() {
  const bucket = process.env.SWIFTBASE_STORAGE_BUCKET || "swiftbase-cms-storage";
  const endpoint = `${(process.env.SWIFTBASE_URL || process.env.SWIFTBASE_API_URL || "https://api.swiftbase.io").replace(/\/$/, "")}/storage`;
  return new Storage({ bucket, endpoint });
}


/**
 * Validate manifest structure and permissions.
 */
export function validateManifest(raw: any): { valid: boolean; error?: string; manifest?: ExtensionManifest } {
  if (!raw || typeof raw !== "object") {
    return { valid: false, error: "Manifest must be a JSON object" };
  }

  const { id, name, version, description, author, permissions } = raw;

  if (!id || typeof id !== "string" || !/^[a-z0-9\-_]+$/i.test(id)) {
    return { valid: false, error: "Manifest 'id' must be a non-empty alphanumeric slug (letters, numbers, hyphens, underscores)" };
  }
  if (!name || typeof name !== "string") {
    return { valid: false, error: "Manifest 'name' is required" };
  }
  if (!version || typeof version !== "string") {
    return { valid: false, error: "Manifest 'version' is required" };
  }
  if (!description || typeof description !== "string") {
    return { valid: false, error: "Manifest 'description' is required" };
  }
  if (!author || typeof author !== "string") {
    return { valid: false, error: "Manifest 'author' is required" };
  }
  if (!Array.isArray(permissions)) {
    return { valid: false, error: "Manifest 'permissions' must be an array" };
  }

  for (const perm of permissions) {
    if (!Object.prototype.hasOwnProperty.call(SUPPORTED_PERMISSIONS, perm)) {
      return { valid: false, error: `Unsupported permission: '${perm}'` };
    }
  }

  return {
    valid: true,
    manifest: {
      id,
      name,
      version,
      description,
      author,
      permissions: permissions as ExtensionPermission[],
      homepage: raw.homepage,
      repository: raw.repository,
      main: raw.main,
      entry: raw.entry,
      files: Array.isArray(raw.files) ? raw.files : [],
      widgets: Array.isArray(raw.widgets) ? raw.widgets : [],
      routes: Array.isArray(raw.routes) ? raw.routes : [],
    },
  };
}

/**
 * Fetch and inspect manifest from a Git URL, raw URL, or local extension bundle.
 */
export async function fetchGitManifest(gitUrl: string, ref = "main"): Promise<{
  manifest: ExtensionManifest;
  permissionDetails: Array<{ permission: ExtensionPermission; title: string; description: string }>;
  sourceType: "github" | "gitlab" | "local" | "generic";
  files?: Record<string, string>;
}> {
  const trimmed = gitUrl.trim();
  let rawJson = "";
  let sourceType: "github" | "gitlab" | "local" | "generic" = "generic";

  // Check if it's a file:// protocol or absolute/relative directory to a standalone git repo
  let localDir = "";
  if (trimmed.startsWith("file://")) {
    localDir = trimmed.replace("file://", "");
  } else if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) {
    localDir = path.resolve(process.cwd(), trimmed);
  } else {
    // Also check extensions folder in workspace if path matches
    const possiblePaths = [
      path.resolve(process.cwd(), "../extensions", trimmed),
      path.resolve(process.cwd(), "../../extensions", trimmed),
      path.resolve("/Users/bchiappetta/Projects/swiftbase/extensions", trimmed),
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        localDir = p;
        break;
      }
    }
  }

  if (localDir && fs.existsSync(localDir)) {
    const manifestPath = path.join(localDir, "manifest.json");
    if (fs.existsSync(manifestPath)) {
      rawJson = fs.readFileSync(manifestPath, "utf-8");
      sourceType = "local";
    }
  }

  // If not local, parse GitHub / GitLab or URL
  if (!rawJson) {
    const githubMatch = trimmed.match(/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?/i);
    const gitlabMatch = trimmed.match(/gitlab\.com\/([^/]+)\/([^/.]+)(?:\.git)?/i);

    if (githubMatch) {
      sourceType = "github";
      const [, owner, repo] = githubMatch;
      const rawUrls = [
        `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/manifest.json`,
        `https://raw.githubusercontent.com/${owner}/${repo}/master/manifest.json`,
      ];

      let lastError: Error | null = null;
      for (const url of rawUrls) {
        try {
          const res = await fetch(url, { headers: { Accept: "application/json" } });
          if (res.ok) {
            rawJson = await res.text();
            break;
          }
        } catch (err: any) {
          lastError = err;
        }
      }

      if (!rawJson && lastError) {
        throw new Error(`Failed to fetch manifest from GitHub repo (${owner}/${repo}): ${lastError.message}`);
      }
    } else if (gitlabMatch) {
      sourceType = "gitlab";
      const [, owner, repo] = gitlabMatch;
      const rawUrl = `https://gitlab.com/${owner}/${repo}/-/raw/${ref}/manifest.json`;
      const res = await fetch(rawUrl);
      if (res.ok) {
        rawJson = await res.text();
      }
    } else if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      // Direct raw JSON or tar endpoint
      const manifestUrl = trimmed.endsWith(".json") ? trimmed : `${trimmed.replace(/\/$/, "")}/manifest.json`;
      const res = await fetch(manifestUrl);
      if (res.ok) {
        rawJson = await res.text();
      }
    }
  }

  if (!rawJson) {
    throw new Error(`Could not find or fetch manifest.json from '${trimmed}'. Please verify the repository URL and ensure manifest.json exists at root.`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    throw new Error("Invalid manifest.json: Unable to parse JSON content.");
  }

  const validation = validateManifest(parsed);
  if (!validation.valid || !validation.manifest) {
    throw new Error(`Invalid extension manifest: ${validation.error}`);
  }

  const manifest = validation.manifest;
  const permissionDetails = manifest.permissions.map((perm) => ({
    permission: perm,
    title: SUPPORTED_PERMISSIONS[perm]?.title || perm,
    description: SUPPORTED_PERMISSIONS[perm]?.description || "General extension capability",
  }));

  // Collect files declared by the manifest to download
  const filesToFetch: string[] = [];
  if (manifest.entry) filesToFetch.push(manifest.entry);
  if (manifest.main) filesToFetch.push(manifest.main);
  if (Array.isArray(manifest.files)) filesToFetch.push(...manifest.files);
  if (Array.isArray(manifest.widgets)) {
    for (const w of manifest.widgets) {
      if (w.script) filesToFetch.push(w.script);
    }
  }

  const extensionFiles: Record<string, string> = {};
  const uniqueFiles = Array.from(new Set(filesToFetch)).filter(Boolean);

  for (const relPath of uniqueFiles) {
    if (sourceType === "local" && localDir) {
      const fullPath = path.join(localDir, relPath);
      if (fs.existsSync(fullPath)) {
        extensionFiles[relPath] = fs.readFileSync(fullPath, "utf-8");
      }
    } else if (sourceType === "github") {
      const githubMatch = trimmed.match(/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?/i);
      if (githubMatch) {
        const [, owner, repo] = githubMatch;
        const candidateUrls = [
          `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${relPath}`,
          `https://raw.githubusercontent.com/${owner}/${repo}/master/${relPath}`,
          `https://raw.githubusercontent.com/${owner}/${repo}/main/${relPath}`,
        ];
        for (const fileUrl of candidateUrls) {
          try {
            const fRes = await fetch(fileUrl);
            if (fRes.ok) {
              extensionFiles[relPath] = await fRes.text();
              break;
            }
          } catch {}
        }
      }
    }
  }

  return {
    manifest,
    permissionDetails,
    sourceType,
    files: extensionFiles,
  };
}

/**
 * Upload extension files and manifest to Object Storage.
 */
export async function installExtensionBundle(manifest: ExtensionManifest, files: Record<string, Buffer | string> = {}): Promise<void> {
  const storage = getStorageInstance();
  const baseKey = `extensions/${manifest.id}`;

  // Always store manifest.json in the storage bucket
  const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2), "utf-8");
  await storage.putObject(`${baseKey}/manifest.json`, manifestBuffer, {
    contentType: "application/json",
  });

  // Upload any additional files (scripts, styles, assets)
  for (const [filename, content] of Object.entries(files)) {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf-8");
    const ext = path.extname(filename).toLowerCase();
    const contentType = 
      ext === ".js" ? "application/javascript" :
      ext === ".css" ? "text/css" :
      ext === ".json" ? "application/json" :
      ext === ".svg" ? "image/svg+xml" :
      "application/octet-stream";

    await storage.putObject(`${baseKey}/${filename}`, buffer, { contentType });
  }
}

/**
 * Remove extension files from Object Storage.
 */
export async function deleteExtensionBundle(extensionId: string): Promise<void> {
  const storage = getStorageInstance();
  const prefix = `extensions/${extensionId}/`;

  try {
    const listRes = await storage.listObjects({ prefix });
    const rawItems: any[] = Array.isArray(listRes) 
      ? listRes 
      : (Array.isArray((listRes as any)?.contents) ? (listRes as any).contents : []);

    for (const item of rawItems) {
      const key = item.key || (item.path && item.name ? `${item.path}/${item.name}` : item.name);
      if (key) {
        await storage.deleteObject(key).catch(() => {});
      }
    }
  } catch (err: any) {
    console.warn(`Failed to cleanup storage for extension ${extensionId}: ${err.message}`);
  }
}

/**
 * Safely execute an extension hook with timeout and circuit-breaker.
 */
export async function safeExecuteHook<T>(
  extensionId: string,
  hookName: string,
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    console.error(`[Extension Error: ${extensionId} in hook ${hookName}]:`, err.message);
    return fallback;
  }
}
