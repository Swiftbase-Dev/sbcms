<template>
  <div class="space-y-6">
    <!-- Breadcrumb & Title Bar -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-base-200 dark:border-slate-800 pb-4">
      <div>
        <div class="flex items-center gap-2 text-xs font-bold text-slate-400 mb-1">
          <router-link to="/extensions" class="hover:text-primary transition-colors">Extensions</router-link>
          <span>/</span>
          <span class="text-slate-300">{{ extension?.name || extId }}</span>
          <span v-if="activePage">/</span>
          <span v-if="activePage" class="text-primary font-bold">{{ activePage.label }}</span>
        </div>
        <h2 class="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          {{ activePage?.label || extension?.name || 'Extension View' }}
        </h2>
        <p class="text-xs text-slate-500 mt-0.5">{{ extension?.description }}</p>
      </div>

      <div class="flex items-center gap-2">
        <router-link to="/extensions" class="btn btn-sm btn-ghost rounded-xl text-xs font-bold text-slate-400 hover:text-white">
          &larr; Back to Extensions
        </router-link>
      </div>
    </div>

    <!-- Error state -->
    <div v-if="error" class="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 rounded-2xl text-xs space-y-2">
      <div class="font-bold text-sm">Failed to load extension</div>
      <p>{{ error }}</p>
    </div>

    <!-- Loading State -->
    <div v-else-if="loading" class="flex flex-col items-center justify-center py-24 gap-3">
      <span class="loading loading-spinner loading-lg text-primary"></span>
      <span class="text-xs font-mono text-slate-400">Loading extension component...</span>
    </div>

    <!-- Native Web Component Container (No iframes) -->
    <div v-else ref="componentHost" class="w-full"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import type { CMSExtension, ExtensionAdminPage } from "swiftbase-cms-shared";

const route = useRoute();
const extId = ref(route.params.extId as string);
const pageId = ref(route.params.pageId as string);

const extension = ref<CMSExtension | null>(null);
const activePage = ref<ExtensionAdminPage | null>(null);
const loading = ref(true);
const error = ref("");
const componentHost = ref<HTMLElement | null>(null);

const loadExtensionComponent = async () => {
  loading.value = true;
  error.value = "";
  extId.value = route.params.extId as string;
  pageId.value = route.params.pageId as string;

  try {
    const res = await fetch("/api/extensions");
    if (!res.ok) throw new Error("Failed to fetch installed extensions.");
    const extensions: CMSExtension[] = await res.json();
    const ext = extensions.find((e) => e.id === extId.value);

    if (!ext) {
      throw new Error(`Extension "${extId.value}" is not installed.`);
    }
    if (!ext.enabled) {
      throw new Error(`Extension "${ext.name}" is currently disabled. Please enable it under Extensions.`);
    }

    extension.value = ext;
    const adminPages = ext.manifest.adminPages || [];
    const page = adminPages.find((p) => p.id === pageId.value) || adminPages[0];

    if (!page) {
      throw new Error(`Admin page "${pageId.value}" not found in extension manifest.`);
    }

    activePage.value = page;

    // Load Web Component bundle script with version cache busting
    const versionParam = ext.version || ext.updatedAt || Date.now();
    const scriptBase = `/api/extensions/${ext.id}/assets/${page.script.replace(/^\//, '')}`;
    const scriptUrl = `${scriptBase}?v=${versionParam}`;
    
    // Inject module script if not already present
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector(`script[data-ext-script="${scriptBase}"]`);
      if (existing) {
        if (existing.getAttribute("src") === scriptUrl) {
          resolve();
          return;
        }
        existing.remove();
      }
      const script = document.createElement("script");
      script.type = "module";
      script.src = scriptUrl;
      script.dataset.extScript = scriptBase;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load extension script: ${scriptUrl}`));
      document.head.appendChild(script);
    });

    loading.value = false;

    // Wait for Vue DOM to update then mount the Web Component
    setTimeout(() => {
      if (componentHost.value) {
        componentHost.value.innerHTML = "";
        const elem = document.createElement(page.tag);
        // Pass context properties directly to custom element
        (elem as any).extensionId = ext.id;
        (elem as any).apiBase = `/api/extensions/${ext.id}`;
        componentHost.value.appendChild(elem);
      }
    }, 50);
  } catch (err: any) {
    error.value = err.message || "Failed to load extension.";
    loading.value = false;
  }
};

watch(() => [route.params.extId, route.params.pageId], () => {
  loadExtensionComponent();
});

onMounted(() => {
  loadExtensionComponent();
});
</script>
