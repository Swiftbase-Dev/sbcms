<template>
  <div class="min-h-screen bg-slate-950 text-white font-sans flex flex-col justify-between selection:bg-primary selection:text-white">
    <!-- Navbar / Brand -->
    <header class="h-20 border-b border-white/10 px-6 sm:px-12 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-3">
        <a href="/" class="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div class="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center font-black text-xl text-white shadow-lg shadow-primary/20">
            S
          </div>
          <div>
            <span class="font-black text-lg tracking-tight text-white block leading-none">{{ pageTitle || 'Extension Hub' }}</span>
            <span class="text-[10px] text-slate-400 font-mono">{{ extensionName || 'Swiftbase Portal' }}</span>
          </div>
        </a>
      </div>
      <a href="/" class="text-xs font-bold text-slate-400 hover:text-white transition-colors">
        Return Home &rarr;
      </a>
    </header>

    <!-- Main Content -->
    <main class="flex-1 flex flex-col items-center justify-center p-6 sm:p-12">
      <!-- Loading State -->
      <div v-if="loading" class="text-center py-20">
        <span class="loading loading-spinner loading-lg text-primary"></span>
        <p class="text-xs text-slate-400 mt-4 font-mono">Loading page...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="max-w-md w-full bg-slate-900 border border-white/10 p-8 rounded-3xl shadow-2xl text-center space-y-4">
        <div class="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center text-xl mx-auto">
          ⚠️
        </div>
        <h3 class="text-lg font-bold text-white">Page Unavailable</h3>
        <p class="text-xs text-slate-400">{{ error }}</p>
        <a href="/" class="btn btn-sm btn-outline rounded-xl text-xs">Return Home</a>
      </div>

      <!-- Dynamic Web Component Host -->
      <div v-else ref="componentHost" class="w-full flex justify-center"></div>
    </main>

    <!-- Footer -->
    <footer class="border-t border-white/10 py-6 text-center text-xs text-slate-500">
      Powered by Swiftbase Extensions
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import type { CMSExtension } from "swiftbase-cms-shared";

const route = useRoute();
const loading = ref(true);
const error = ref("");
const pageTitle = ref("");
const extensionName = ref("");
const componentHost = ref<HTMLElement | null>(null);

const resolvePublicRoute = async () => {
  loading.value = true;
  error.value = "";
  const currentPath = window.location.pathname;

  try {
    const res = await fetch("/api/extensions");
    if (!res.ok) throw new Error("Failed to load extensions configuration.");
    const extensions: CMSExtension[] = await res.json();

    let matchedRoute: any = null;
    let matchedExt: CMSExtension | null = null;
    let pathParams: Record<string, string> = {};

    for (const ext of extensions) {
      if (!ext.enabled) continue;
      const routes = ext.manifest.publicRoutes || [];
      for (const r of routes) {
        // Simple regex matcher for parameterized paths e.g. /download/:token or /redeem
        const pattern = "^" + r.path.replace(/:([a-zA-Z0-9_]+)/g, "(?<$1>[^/]+)") + "$";
        const regex = new RegExp(pattern);
        const match = currentPath.match(regex);
        if (match) {
          matchedRoute = r;
          matchedExt = ext;
          pathParams = match.groups || {};
          break;
        }
      }
      if (matchedRoute) break;
    }

    if (!matchedRoute || !matchedExt) {
      throw new Error("Route not found.");
    }

    pageTitle.value = matchedRoute.title;
    extensionName.value = matchedExt.name;

    // Load bundle script
    const scriptUrl = `/api/extensions/${matchedExt.id}/assets/${matchedRoute.script.replace(/^\//, '')}`;
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector(`script[data-ext-script="${scriptUrl}"]`);
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.type = "module";
      script.src = scriptUrl;
      script.dataset.extScript = scriptUrl;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load component script: ${scriptUrl}`));
      document.head.appendChild(script);
    });

    loading.value = false;

    // Mount Custom Element Web Component
    setTimeout(() => {
      if (componentHost.value) {
        componentHost.value.innerHTML = "";
        const elem = document.createElement(matchedRoute.tag);
        (elem as any).extensionId = matchedExt!.id;
        (elem as any).params = pathParams;
        (elem as any).apiBase = `/api/extensions/${matchedExt!.id}`;
        // Also set attributes for any named params (e.g. data-token="...")
        for (const [k, v] of Object.entries(pathParams)) {
          elem.setAttribute(`data-${k}`, v);
        }
        componentHost.value.appendChild(elem);
      }
    }, 50);
  } catch (err: any) {
    error.value = err.message || "Unable to display this extension route.";
    loading.value = false;
  }
};

onMounted(() => {
  resolvePublicRoute();
});
</script>
