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
                <font-awesome-icon :icon="ext.id === 'ebook-preview' ? ['fas', 'book-open'] : (ext.id === 'ebook-distribution' ? ['fas', 'share-nodes'] : ['fas', 'puzzle-piece'])" />
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
            <button
              v-if="ext.id === 'ebook-distribution'"
              @click="openEbookModal"
              class="btn btn-sm btn-primary text-white text-xs font-bold rounded-xl px-4 shadow-sm"
            >
              <font-awesome-icon :icon="['fas', 'sliders']" />
              Manage Distribution
            </button>
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

    <!-- E-BOOK DISTRIBUTION DASHBOARD MODAL -->
    <dialog id="ebook-modal" class="modal modal-bottom sm:modal-middle" :class="{ 'modal-open': showEbookModal }">
      <div class="modal-box bg-white dark:bg-slate-900 border border-base-200 dark:border-slate-800 max-w-4xl w-full rounded-3xl p-6">
        <div class="flex items-center justify-between border-b border-base-200 dark:border-slate-800 pb-4 mb-6">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-lg">
              <font-awesome-icon :icon="['fas', 'share-nodes']" />
            </div>
            <div>
              <h3 class="font-black text-xl text-slate-900 dark:text-white">E-book Distribution & Reader Hub</h3>
              <p class="text-xs text-slate-400">Manage file formats, dispatch free review copies, and generate offline cards.</p>
            </div>
          </div>
          <button @click="showEbookModal = false" class="btn btn-sm btn-ghost btn-circle">✕</button>
        </div>

        <!-- Tabs Header -->
        <div class="tabs tabs-boxed bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-6">
          <a
            class="tab tab-sm font-bold text-xs uppercase rounded-xl transition-all"
            :class="{ 'tab-active !bg-primary !text-white shadow-sm': activeEbookTab === 'files' }"
            @click="activeEbookTab = 'files'"
          >
            📚 Book Formats
          </a>
          <a
            class="tab tab-sm font-bold text-xs uppercase rounded-xl transition-all"
            :class="{ 'tab-active !bg-primary !text-white shadow-sm': activeEbookTab === 'free-copies' }"
            @click="activeEbookTab = 'free-copies'; loadFreeCopies()"
          >
            💌 Send Free Copies
          </a>
          <a
            class="tab tab-sm font-bold text-xs uppercase rounded-xl transition-all"
            :class="{ 'tab-active !bg-primary !text-white shadow-sm': activeEbookTab === 'cards' }"
            @click="activeEbookTab = 'cards'; loadCards()"
          >
            🎟️ Offline Download Cards
          </a>
        </div>

        <!-- TAB 1: BOOK FILES -->
        <div v-if="activeEbookTab === 'files'" class="space-y-6">
          <div class="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-base-200 dark:border-slate-800">
            <div class="flex-1 w-full">
              <label class="text-xs font-bold text-slate-500 mb-1 block">Select Book / Product</label>
              <select v-model="selectedProductId" @change="loadEbookFiles" class="select select-bordered select-sm w-full rounded-xl text-xs dark:bg-slate-800">
                <option value="" disabled>-- Select a product --</option>
                <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }} (${{ (p.priceCents / 100).toFixed(2) }})</option>
              </select>
            </div>

            <div class="flex items-end gap-2 w-full sm:w-auto">
              <div>
                <label class="text-xs font-bold text-slate-500 mb-1 block">Format</label>
                <select v-model="uploadFormat" class="select select-bordered select-sm rounded-xl text-xs dark:bg-slate-800">
                  <option value="epub">EPUB</option>
                  <option value="pdf">PDF</option>
                  <option value="mobi">MOBI / Kindle</option>
                </select>
              </div>

              <label class="btn btn-sm btn-primary text-white rounded-xl text-xs font-bold px-4 gap-1.5 cursor-pointer">
                <font-awesome-icon :icon="['fas', 'upload']" />
                Upload File
                <input type="file" class="hidden" @change="handleFileUpload" accept=".epub,.pdf,.mobi,.azw3" />
              </label>
            </div>
          </div>

          <div v-if="uploadingFile" class="flex justify-center py-6">
            <span class="loading loading-spinner loading-md text-primary"></span>
          </div>

          <div v-else-if="!selectedProductId" class="text-center py-12 text-slate-400 text-xs">
            Please select a book from the dropdown to view or upload formats.
          </div>

          <div v-else-if="ebookFiles.length === 0" class="text-center py-12 text-slate-400 text-xs border border-dashed border-base-200 dark:border-slate-800 rounded-2xl">
            No formats uploaded yet for this product. Upload an EPUB, PDF, or MOBI file above.
          </div>

          <div v-else class="space-y-3">
            <h4 class="text-xs font-black uppercase tracking-wider text-slate-400">Available Formats for this Book</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                v-for="file in ebookFiles"
                :key="file.id"
                class="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-base-200 dark:border-slate-800"
              >
                <div class="flex items-center gap-3">
                  <span class="badge badge-primary font-bold uppercase text-[10px]">{{ file.format }}</span>
                  <div>
                    <h5 class="font-bold text-xs text-slate-900 dark:text-white truncate max-w-[180px]">{{ file.fileName }}</h5>
                    <p class="text-[10px] text-slate-400">{{ formatBytes(file.fileSizeBytes) }}</p>
                  </div>
                </div>
                <button @click="deleteEbookFile(file.id)" class="btn btn-ghost btn-xs text-rose-500 hover:bg-rose-500/10 rounded-lg">
                  <font-awesome-icon :icon="['fas', 'trash']" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 2: SEND FREE COPIES -->
        <div v-if="activeEbookTab === 'free-copies'" class="space-y-6">
          <form @submit.prevent="sendFreeCopy" class="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-base-200 dark:border-slate-800 space-y-4">
            <h4 class="text-xs font-black uppercase tracking-wider text-slate-500">Send Complimentary Review Copy</h4>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="text-[11px] font-bold text-slate-500 mb-1 block">Recipient Name</label>
                <input v-model="freeCopyForm.recipientName" type="text" placeholder="e.g. Jane Doe" class="input input-bordered input-sm w-full rounded-xl text-xs dark:bg-slate-800" required />
              </div>
              <div>
                <label class="text-[11px] font-bold text-slate-500 mb-1 block">Recipient Email</label>
                <input v-model="freeCopyForm.recipientEmail" type="email" placeholder="jane@example.com" class="input input-bordered input-sm w-full rounded-xl text-xs dark:bg-slate-800" required />
              </div>
              <div>
                <label class="text-[11px] font-bold text-slate-500 mb-1 block">Book to Send</label>
                <select v-model="freeCopyForm.productId" class="select select-bordered select-sm w-full rounded-xl text-xs dark:bg-slate-800" required>
                  <option value="" disabled>-- Select book --</option>
                  <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
              </div>
            </div>

            <div>
              <label class="text-[11px] font-bold text-slate-500 mb-1 block">Personal Message (Optional)</label>
              <textarea v-model="freeCopyForm.message" rows="2" placeholder="Hi Jane, thank you for reading my book! Here is your complimentary copy." class="textarea textarea-bordered w-full rounded-xl text-xs dark:bg-slate-800"></textarea>
            </div>

            <div class="flex justify-end">
              <button type="submit" class="btn btn-sm btn-primary text-white font-bold rounded-xl px-6 text-xs uppercase" :disabled="sendingFreeCopy">
                <span v-if="sendingFreeCopy" class="loading loading-spinner loading-xs"></span>
                Send Copy & Email &rarr;
              </button>
            </div>
          </form>

          <!-- History Table -->
          <div class="space-y-3">
            <h4 class="text-xs font-black uppercase tracking-wider text-slate-400">Dispatch History</h4>
            <div class="overflow-x-auto max-h-64 border border-base-200 dark:border-slate-800 rounded-2xl">
              <table class="table table-xs w-full">
                <thead>
                  <tr class="bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold uppercase text-[9px]">
                    <th>Recipient</th>
                    <th>Book</th>
                    <th>Download Link</th>
                    <th>Downloads</th>
                    <th>Date Sent</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in freeCopies" :key="c.id" class="hover">
                    <td class="font-bold text-xs">{{ c.recipientName }} <span class="opacity-50 text-[10px]">({{ c.recipientEmail }})</span></td>
                    <td class="text-xs">{{ c.productTitle }}</td>
                    <td>
                      <a :href="`/download/${c.token}`" target="_blank" class="text-primary font-mono text-[10px] hover:underline">/download/{{ c.token.substring(0, 12) }}...</a>
                    </td>
                    <td><span class="badge badge-sm badge-ghost text-[10px]">{{ c.downloadCount }} / {{ c.maxDownloads }}</span></td>
                    <td class="text-[10px] text-slate-400">{{ new Date(c.createdAt).toLocaleDateString() }}</td>
                  </tr>
                  <tr v-if="freeCopies.length === 0">
                    <td colspan="5" class="text-center py-6 text-slate-400 text-xs">No free copies sent yet.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- TAB 3: OFFLINE CARDS -->
        <div v-if="activeEbookTab === 'cards'" class="space-y-6">
          <form @submit.prevent="generateCards" class="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-base-200 dark:border-slate-800 flex flex-wrap items-end gap-3">
            <div class="flex-1 min-w-[200px]">
              <label class="text-[11px] font-bold text-slate-500 mb-1 block">Book for Handout Cards</label>
              <select v-model="cardForm.productId" class="select select-bordered select-sm w-full rounded-xl text-xs dark:bg-slate-800" required>
                <option value="" disabled>-- Select book --</option>
                <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
            </div>
            <div class="w-24">
              <label class="text-[11px] font-bold text-slate-500 mb-1 block">Card Count</label>
              <input v-model.number="cardForm.count" type="number" min="1" max="50" class="input input-bordered input-sm w-full rounded-xl text-xs dark:bg-slate-800" required />
            </div>
            <div class="w-28">
              <label class="text-[11px] font-bold text-slate-500 mb-1 block">Code Prefix</label>
              <input v-model="cardForm.prefix" type="text" placeholder="BOOK" class="input input-bordered input-sm w-full rounded-xl text-xs dark:bg-slate-800 uppercase" />
            </div>
            <button type="submit" class="btn btn-sm btn-primary text-white font-bold rounded-xl px-6 text-xs uppercase" :disabled="generatingCards">
              <span v-if="generatingCards" class="loading loading-spinner loading-xs"></span>
              Generate Cards
            </button>
          </form>

          <!-- Cards Table -->
          <div class="space-y-3">
            <h4 class="text-xs font-black uppercase tracking-wider text-slate-400">Single-Use Card Codes</h4>
            <div class="overflow-x-auto max-h-64 border border-base-200 dark:border-slate-800 rounded-2xl">
              <table class="table table-xs w-full">
                <thead>
                  <tr class="bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold uppercase text-[9px]">
                    <th>Card Code</th>
                    <th>Book</th>
                    <th>Redemption URL</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="card in cards" :key="card.id" class="hover">
                    <td class="font-mono font-bold text-xs text-primary">{{ card.code }}</td>
                    <td class="text-xs">{{ card.productTitle }}</td>
                    <td>
                      <a :href="`/redeem`" target="_blank" class="text-slate-500 font-mono text-[10px] hover:underline">/redeem</a>
                    </td>
                    <td>
                      <span v-if="card.isRedeemed" class="badge badge-sm badge-error text-white font-bold text-[9px]">Redeemed</span>
                      <span v-else class="badge badge-sm badge-success text-white font-bold text-[9px]">Available</span>
                    </td>
                    <td class="text-[10px] text-slate-400">{{ new Date(card.createdAt).toLocaleDateString() }}</td>
                  </tr>
                  <tr v-if="cards.length === 0">
                    <td colspan="5" class="text-center py-6 text-slate-400 text-xs">No download cards generated yet.</td>
                  </tr>
                </tbody>
              </table>
            </div>
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
const products = ref<any[]>([]);
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

// E-book management modal state
const showEbookModal = ref(false);
const activeEbookTab = ref<"files" | "free-copies" | "cards">("files");
const selectedProductId = ref("");
const uploadFormat = ref<"epub" | "pdf" | "mobi">("epub");
const ebookFiles = ref<any[]>([]);
const uploadingFile = ref(false);

const freeCopyForm = ref({
  recipientName: "",
  recipientEmail: "",
  productId: "",
  message: "",
});
const sendingFreeCopy = ref(false);
const freeCopies = ref<any[]>([]);

const cardForm = ref({
  productId: "",
  count: 5,
  prefix: "READ",
});
const generatingCards = ref(false);
const cards = ref<any[]>([]);

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

const loadProducts = async () => {
  try {
    const res = await fetch("/api/products");
    if (res.ok) {
      products.value = await res.json();
    }
  } catch (err) {
    console.error("Failed to load products:", err);
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

// ==========================================
// E-BOOK DISTRIBUTION ACTIONS
// ==========================================

const openEbookModal = () => {
  showEbookModal.value = true;
  if (products.value.length > 0 && !selectedProductId.value) {
    selectedProductId.value = products.value[0].id;
    freeCopyForm.value.productId = products.value[0].id;
    cardForm.value.productId = products.value[0].id;
    loadEbookFiles();
  }
};

const loadEbookFiles = async () => {
  if (!selectedProductId.value) return;
  try {
    const res = await fetch(`/api/ebooks/files/${selectedProductId.value}`);
    if (res.ok) {
      ebookFiles.value = await res.json();
    }
  } catch (err) {
    console.error("Failed to load ebook files:", err);
  }
};

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files && target.files[0];
  if (!file || !selectedProductId.value) return;

  uploadingFile.value = true;
  try {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      const res = await fetch(`/api/ebooks/files/${selectedProductId.value}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: uploadFormat.value,
          fileName: file.name,
          base64,
        }),
      });
      if (res.ok) {
        await loadEbookFiles();
      }
      uploadingFile.value = false;
    };
    reader.readAsDataURL(file);
  } catch (err) {
    console.error("Upload error:", err);
    uploadingFile.value = false;
  }
};

const deleteEbookFile = async (fileId: string) => {
  if (!confirm("Are you sure you want to delete this format file?")) return;
  try {
    const res = await fetch(`/api/ebooks/files/${fileId}`, { method: "DELETE" });
    if (res.ok) {
      await loadEbookFiles();
    }
  } catch (err) {
    console.error("Failed to delete format file:", err);
  }
};

const sendFreeCopy = async () => {
  sendingFreeCopy.value = true;
  try {
    const res = await fetch("/api/ebooks/free-copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(freeCopyForm.value),
    });
    if (res.ok) {
      freeCopyForm.value.recipientName = "";
      freeCopyForm.value.recipientEmail = "";
      freeCopyForm.value.message = "";
      await loadFreeCopies();
      alert("Free copy invitation sent successfully!");
    }
  } catch (err) {
    console.error("Failed to send free copy:", err);
  } finally {
    sendingFreeCopy.value = false;
  }
};

const loadFreeCopies = async () => {
  try {
    const res = await fetch("/api/ebooks/free-copies");
    if (res.ok) {
      freeCopies.value = await res.json();
    }
  } catch (err) {
    console.error("Failed to load free copies:", err);
  }
};

const generateCards = async () => {
  generatingCards.value = true;
  try {
    const res = await fetch("/api/ebooks/cards/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cardForm.value),
    });
    if (res.ok) {
      await loadCards();
    }
  } catch (err) {
    console.error("Failed to generate cards:", err);
  } finally {
    generatingCards.value = false;
  }
};

const loadCards = async () => {
  try {
    const res = await fetch("/api/ebooks/cards");
    if (res.ok) {
      cards.value = await res.json();
    }
  } catch (err) {
    console.error("Failed to load cards:", err);
  }
};

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

onMounted(async () => {
  await Promise.all([loadExtensions(), loadProducts()]);
});
</script>
