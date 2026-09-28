<template>
  <div class="space-y-8 max-w-7xl mx-auto">
    <!-- Top Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-base-200 dark:border-slate-800 pb-6">
      <div>
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl shadow-sm">
            <font-awesome-icon :icon="['fas', 'puzzle-piece']" />
          </div>
          <div>
            <h1 class="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Extensions & Modules</h1>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Extend SBCMS with Page Designer blocks, digital distribution hubs, and third-party tools.</p>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button @click="openInstallModal" class="btn btn-primary text-white font-bold text-xs uppercase rounded-xl px-5 shadow-md gap-2">
          <font-awesome-icon :icon="['fas', 'plus']" />
          Install Extension
        </button>
      </div>
    </div>

    <!-- Active Extensions Grid -->
    <div v-if="loading" class="flex justify-center py-20">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else-if="extensions.length === 0" class="text-center py-16 bg-white dark:bg-slate-900 border border-base-200 dark:border-slate-800 rounded-3xl p-8 space-y-4">
      <div class="w-16 h-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center text-2xl mx-auto">
        <font-awesome-icon :icon="['fas', 'puzzle-piece']" />
      </div>
      <div>
        <h3 class="text-lg font-black text-slate-900 dark:text-white">No Extensions Installed</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
          Install standalone extensions from a Git repository to unlock new capabilities like E-book previews and digital distribution.
        </p>
      </div>
      <div class="pt-2 flex justify-center">
        <button @click="openInstallModal" class="btn btn-sm btn-primary text-white rounded-xl text-xs font-bold gap-2">
          <font-awesome-icon :icon="['fas', 'plus']" />
          Install from Git Repository
        </button>
      </div>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div
        v-for="ext in extensions"
        :key="ext.id"
        class="bg-white dark:bg-slate-900 border border-base-200 dark:border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-200"
      >
        <div>
          <!-- Header: Title, version, status toggle -->
          <div class="flex items-start justify-between gap-4 mb-3">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl shrink-0 font-bold">
                <font-awesome-icon :icon="(ext.manifest?.adminPages?.[0]?.icon ? ['fas', ext.manifest.adminPages[0].icon] : ['fas', 'puzzle-piece'])" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="font-black text-lg text-slate-900 dark:text-white">{{ ext.name }}</h3>
                  <span class="badge badge-sm font-mono text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-none">v{{ ext.version }}</span>
                </div>
                <p class="text-xs text-slate-400 mt-0.5">by {{ ext.author }}</p>
              </div>
            </div>

            <!-- Toggle Enable Switch -->
            <input
              type="checkbox"
              class="toggle toggle-primary toggle-sm"
              :checked="ext.enabled"
              @change="toggleExtension(ext)"
              :title="ext.enabled ? 'Click to disable' : 'Click to enable'"
            />
          </div>

          <!-- Description -->
          <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
            {{ ext.description }}
          </p>

          <!-- Permissions list badges -->
          <div class="mb-6 space-y-1.5">
            <span class="text-[10px] font-black uppercase tracking-wider text-slate-400">Granted Permissions:</span>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="perm in ext.permissions"
                :key="perm"
                class="badge badge-sm bg-primary/10 text-primary border-none text-[10px] font-bold py-2"
              >
                ✓ {{ perm }}
              </span>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="pt-4 border-t border-base-200 dark:border-slate-800 flex items-center justify-between">
          <div class="text-[10px] font-mono text-slate-400">
            ID: {{ ext.id }}
          </div>
          <div class="flex items-center gap-2">
            <template v-if="ext.enabled && ext.manifest.adminPages">
              <router-link
                v-for="page in ext.manifest.adminPages"
                :key="page.id"
                :to="`/extensions/${ext.id}/${page.id}`"
                class="btn btn-sm btn-primary text-white text-xs font-bold rounded-xl px-4 shadow-sm"
              >
                <font-awesome-icon :icon="page.icon ? ['fas', page.icon] : ['fas', 'arrow-up-right-from-square']" />
                {{ page.label }}
              </router-link>
            </template>
            <button
              @click="uninstallExtension(ext)"
              class="btn btn-sm btn-ghost text-rose-500 hover:bg-rose-500/10 text-xs font-bold rounded-xl px-3"
            >
              <font-awesome-icon :icon="['fas', 'trash']" />
              Uninstall
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- INSTALL EXTENSION MODAL -->
    <dialog id="install-modal" class="modal modal-bottom sm:modal-middle" :class="{ 'modal-open': showInstallModal }">
      <div class="modal-box bg-white dark:bg-slate-900 border border-base-200 dark:border-slate-800 max-w-lg rounded-3xl p-6">
        <h3 class="font-black text-xl text-slate-900 dark:text-white mb-1">Install Extension</h3>
        <p class="text-xs text-slate-500 mb-6">Enter a Git repository URL to inspect its manifest and permissions before installing.</p>

        <!-- Step 1: Input URL -->
        <div v-if="!inspectResult" class="space-y-4">
          <div class="form-control">
            <label class="label text-xs font-bold text-slate-500">Git Repository URL</label>
            <input
              v-model="gitUrlInput"
              type="text"
              placeholder="https://github.com/organization/extension-repo.git"
              class="input input-bordered w-full rounded-2xl text-xs dark:bg-slate-800"
              @keyup.enter="inspectExtension"
            />
            <span class="text-[10px] text-slate-400 mt-1.5">Enter the Git repository containing a valid <code>manifest.json</code>.</span>
          </div>

          <div v-if="inspectError" class="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs">
            {{ inspectError }}
          </div>

          <div class="modal-action mt-6">
            <button @click="showInstallModal = false" class="btn btn-sm btn-ghost rounded-xl text-xs font-bold">Cancel</button>
            <button
              @click="inspectExtension"
              class="btn btn-sm btn-primary text-white rounded-xl text-xs font-bold px-6"
              :disabled="inspecting || !gitUrlInput.trim()"
            >
              <span v-if="inspecting" class="loading loading-spinner loading-xs"></span>
              Inspect Extension &rarr;
            </button>
          </div>
        </div>

        <!-- Step 2: Manifest & Permissions Consent -->
        <div v-else class="space-y-5">
          <div class="p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-base-200 dark:border-slate-800 flex items-start gap-4">
            <div class="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xl shrink-0 font-bold">
              <font-awesome-icon :icon="['fas', 'puzzle-piece']" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h4 class="font-black text-slate-900 dark:text-white">{{ inspectResult.manifest.name }}</h4>
                <span class="badge badge-sm font-mono text-[9px] bg-slate-200 dark:bg-slate-700">v{{ inspectResult.manifest.version }}</span>
              </div>
              <p class="text-[11px] text-slate-500 mt-0.5">by {{ inspectResult.manifest.author }}</p>
              <p class="text-xs text-slate-600 dark:text-slate-300 mt-2">{{ inspectResult.manifest.description }}</p>
            </div>
          </div>

          <!-- Permissions Review Checklist -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <h5 class="text-xs font-black uppercase tracking-wider text-slate-500">Requested Permissions</h5>
              <span class="badge badge-xs badge-warning font-bold text-[9px] uppercase px-2">Review Required</span>
            </div>

            <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
              <div
                v-for="p in inspectResult.permissionDetails"
                :key="p.permission"
                class="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl"
              >
                <div class="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                  <font-awesome-icon :icon="['fas', 'shield-halved']" class="text-amber-500" />
                  <span>{{ p.title }}</span>
                  <span class="font-mono text-[9px] opacity-60">({{ p.permission }})</span>
                </div>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">{{ p.description }}</p>
              </div>
            </div>
          </div>

          <!-- Consent checkbox -->
          <label class="flex items-start gap-3 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl cursor-pointer">
            <input type="checkbox" v-model="consentGranted" class="checkbox checkbox-primary checkbox-sm mt-0.5" />
            <span class="text-xs text-slate-700 dark:text-slate-200 leading-snug">
              I have reviewed the requested permissions and agree to grant this extension access to my SBCMS instance and cloud storage.
            </span>
          </label>

          <div v-if="installError" class="p-3 bg-rose-50 text-rose-600 rounded-xl text-xs">
            {{ installError }}
          </div>

          <div class="modal-action">
            <button @click="inspectResult = null" class="btn btn-sm btn-ghost rounded-xl text-xs font-bold">Back</button>
            <button
              @click="confirmInstall"
              class="btn btn-sm btn-primary text-white rounded-xl text-xs font-bold px-6 shadow-md"
              :disabled="installing || !consentGranted"
            >
              <span v-if="installing" class="loading loading-spinner loading-xs"></span>
              Grant Consent & Install
            </button>
          </div>
        </div>
      </div>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { CMSExtension } from "swiftbase-cms-shared";

const extensions = ref<CMSExtension[]>([]);
const loading = ref(true);

// Install modal state
const showInstallModal = ref(false);
const gitUrlInput = ref("");
const inspecting = ref(false);
const inspectResult = ref<any>(null);
const inspectError = ref("");
const consentGranted = ref(false);
const installing = ref(false);
const installError = ref("");

const loadExtensions = async () => {
  loading.value = true;
  try {
    const res = await fetch("/api/extensions");
    if (res.ok) {
      extensions.value = await res.json();
    }
  } catch (err) {
    console.error("Failed to load extensions:", err);
  } finally {
    loading.value = false;
  }
};

const openInstallModal = () => {
  gitUrlInput.value = "";
  inspectResult.value = null;
  inspectError.value = "";
  consentGranted.value = false;
  installError.value = "";
  showInstallModal.value = true;
};

const inspectExtension = async () => {
  if (!gitUrlInput.value.trim()) return;
  inspecting.value = true;
  inspectError.value = "";
  try {
    const res = await fetch("/api/extensions/inspect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gitUrl: gitUrlInput.value.trim() }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Failed to inspect extension");
    }
    inspectResult.value = await res.json();
  } catch (err: any) {
    inspectError.value = err.message;
  } finally {
    inspecting.value = false;
  }
};

const confirmInstall = async () => {
  if (!consentGranted.value || !inspectResult.value) return;
  installing.value = true;
  installError.value = "";
  try {
    const res = await fetch("/api/extensions/install", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gitUrl: gitUrlInput.value.trim(),
        consentGiven: true,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Failed to install extension");
    }
    showInstallModal.value = false;
    await loadExtensions();
  } catch (err: any) {
    installError.value = err.message;
  } finally {
    installing.value = false;
  }
};

const toggleExtension = async (ext: CMSExtension) => {
  try {
    const newStatus = !ext.enabled;
    const res = await fetch(`/api/extensions/${ext.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: newStatus }),
    });
    if (res.ok) {
      ext.enabled = newStatus;
    }
  } catch (err) {
    console.error("Failed to toggle extension status:", err);
  }
};

const uninstallExtension = async (ext: CMSExtension) => {
  if (!confirm(`Are you sure you want to uninstall "${ext.name}"?`)) return;
  try {
    const res = await fetch(`/api/extensions/${ext.id}`, { method: "DELETE" });
    if (res.ok) {
      await loadExtensions();
    }
  } catch (err) {
    console.error("Failed to uninstall extension:", err);
  }
};

onMounted(async () => {
  await loadExtensions();
});
</script>
