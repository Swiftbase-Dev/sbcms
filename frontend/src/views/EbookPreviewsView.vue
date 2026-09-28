<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <div class="flex items-center gap-2 text-xs font-bold text-slate-400 mb-1">
          <router-link to="/extensions" class="hover:text-primary transition-colors">Extensions</router-link>
          <span>/</span>
          <span class="text-slate-200">E-book Previews</span>
        </div>
        <h2 class="text-2xl font-black text-slate-900 dark:text-white tracking-tight">E-book Previews Manager</h2>
        <p class="text-xs text-slate-500 mt-0.5">Create interactive excerpt previews for your store books, auto-extract chapters, and track reader engagement.</p>
      </div>

      <button @click="openCreateModal" class="btn btn-sm btn-primary text-white font-bold rounded-2xl px-5 text-xs uppercase tracking-wider shadow-md flex items-center gap-2">
        <font-awesome-icon :icon="['fas', 'plus']" />
        New E-book Preview
      </button>
    </div>

    <!-- Previews Grid / List -->
    <div v-if="loading" class="flex justify-center py-20">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else-if="previews.length === 0" class="card bg-white dark:bg-slate-900 border border-base-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-sm">
      <div class="w-16 h-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center text-3xl mx-auto shadow-inner">
        <font-awesome-icon :icon="['fas', 'book-open']" />
      </div>
      <div>
        <h3 class="font-black text-lg text-slate-900 dark:text-white">No E-book Previews Configured</h3>
        <p class="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Create a preview linked to one of your store books. We can automatically extract the first chapters from your uploaded EPUB file.
        </p>
      </div>
      <button @click="openCreateModal" class="btn btn-primary btn-sm text-white rounded-2xl font-bold px-6 text-xs uppercase shadow-md">
        Create Your First Preview
      </button>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="prev in previews"
        :key="prev.id"
        class="card bg-white dark:bg-slate-900 border border-base-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
      >
        <div class="space-y-4">
          <!-- Top Row: Cover + Info -->
          <div class="flex items-start gap-4">
            <div class="w-16 h-24 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shadow-sm shrink-0 flex items-center justify-center">
              <img v-if="prev.coverImage" :src="prev.coverImage" class="w-full h-full object-cover" />
              <font-awesome-icon v-else :icon="['fas', 'book-open']" class="text-xl opacity-30 text-slate-400" />
            </div>
            <div class="flex-1 min-w-0">
              <span class="badge badge-xs font-mono font-bold uppercase text-[9px] bg-slate-100 dark:bg-slate-800 border-none mb-1">
                {{ prev.pages?.length || 0 }} pages
              </span>
              <h4 class="font-black text-sm text-slate-900 dark:text-white truncate leading-snug">{{ prev.title }}</h4>
              <p class="text-xs text-slate-400 mt-0.5 truncate">by {{ prev.author }}</p>
              <div class="text-[10px] text-slate-500 font-mono mt-2 truncate">
                ID: {{ prev.id }}
              </div>
            </div>
          </div>

          <!-- Analytics Badges -->
          <div class="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-850 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
            <div>
              <span class="block text-[9px] font-bold uppercase text-slate-400">Views</span>
              <span class="text-xs font-black text-slate-800 dark:text-slate-100 font-mono">{{ prev.viewsCount || 0 }}</span>
            </div>
            <div>
              <span class="block text-[9px] font-bold uppercase text-slate-400">Page Flips</span>
              <span class="text-xs font-black text-slate-800 dark:text-slate-100 font-mono">{{ prev.readsCount || 0 }}</span>
            </div>
            <div>
              <span class="block text-[9px] font-bold uppercase text-slate-400">Clicks</span>
              <span class="text-xs font-black text-primary font-mono">{{ prev.clicksCount || 0 }}</span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-between border-t border-base-200 dark:border-slate-800 pt-3 mt-4">
          <button @click="openAnalytics(prev)" class="btn btn-xs btn-ghost text-slate-500 hover:text-primary font-bold text-[10px] gap-1">
            <font-awesome-icon :icon="['fas', 'chart-simple']" />
            Stats
          </button>
          <div class="flex items-center gap-1.5">
            <button @click="openPreviewViewer(prev)" class="btn btn-xs btn-outline rounded-xl font-bold text-[10px]">
              Test Reader
            </button>
            <button @click="openEditModal(prev)" class="btn btn-xs btn-primary text-white rounded-xl font-bold text-[10px]">
              Edit
            </button>
            <button @click="deletePreview(prev.id)" class="btn btn-xs btn-ghost text-rose-500 hover:bg-rose-500/10 rounded-xl font-bold">
              <font-awesome-icon :icon="['fas', 'trash']" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- CREATE / EDIT MODAL -->
    <dialog class="modal modal-bottom sm:modal-middle" :class="{ 'modal-open': showModal }">
      <div class="modal-box bg-white dark:bg-slate-900 border border-base-200 dark:border-slate-800 max-w-3xl w-full rounded-3xl p-6 space-y-5">
        <div class="flex items-center justify-between border-b border-base-200 dark:border-slate-800 pb-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-lg">
              <font-awesome-icon :icon="['fas', 'book-open']" />
            </div>
            <div>
              <h3 class="font-black text-xl text-slate-900 dark:text-white">{{ form.id ? 'Edit E-book Preview' : 'New E-book Preview' }}</h3>
              <p class="text-xs text-slate-400">Configure book details and sample chapters for the Page Designer reader widget.</p>
            </div>
          </div>
          <button @click="showModal = false" class="btn btn-sm btn-ghost btn-circle">✕</button>
        </div>

        <form @submit.prevent="savePreview" class="space-y-4">
          <!-- Step 1: Select Book Product -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="text-[11px] font-bold text-slate-500 mb-1 block">Link Store Product</label>
              <select v-model="form.productId" @change="onProductSelect" class="select select-bordered select-sm w-full rounded-xl text-xs dark:bg-slate-800" required>
                <option value="" disabled>-- Select book product --</option>
                <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
            </div>

            <div>
              <label class="text-[11px] font-bold text-slate-500 mb-1 block">Preview Title</label>
              <input v-model="form.title" type="text" class="input input-bordered input-sm w-full rounded-xl text-xs dark:bg-slate-800" required />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="text-[11px] font-bold text-slate-500 mb-1 block">Author</label>
              <input v-model="form.author" type="text" class="input input-bordered input-sm w-full rounded-xl text-xs dark:bg-slate-800" required />
            </div>
            <div>
              <label class="text-[11px] font-bold text-slate-500 mb-1 block">Cover Image URL</label>
              <input v-model="form.coverImage" type="text" placeholder="https://..." class="input input-bordered input-sm w-full rounded-xl text-xs dark:bg-slate-800" />
            </div>
          </div>

          <!-- Step 2: Automatic Content Extraction -->
          <div class="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-base-200 dark:border-slate-800 space-y-3">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <span class="font-bold text-xs uppercase tracking-wider text-slate-500">Auto-Extract from Book File</span>
                <p class="text-[11px] text-slate-400">Pull chapters or pages directly from your uploaded EPUB book file.</p>
              </div>

              <div class="flex items-center gap-2">
                <select v-model="extractCount" class="select select-bordered select-xs rounded-lg text-xs dark:bg-slate-800">
                  <option :value="1">First 1 Chapter</option>
                  <option :value="2">First 2 Chapters</option>
                  <option :value="3">First 3 Chapters</option>
                  <option :value="5">First 5 Chapters</option>
                </select>

                <button
                  type="button"
                  @click="runExtraction"
                  class="btn btn-xs btn-primary text-white rounded-lg font-bold gap-1"
                  :disabled="extracting || !form.productId"
                >
                  <span v-if="extracting" class="loading loading-spinner loading-xs"></span>
                  <font-awesome-icon v-else :icon="['fas', 'wand-magic-sparkles']" />
                  Auto-Extract
                </button>
              </div>
            </div>

            <div v-if="extractMsg" class="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 rounded-xl text-xs">
              {{ extractMsg }}
            </div>
          </div>

          <!-- Step 3: Pages Editor -->
          <div>
            <div class="flex justify-between items-center mb-1.5">
              <label class="text-[11px] font-bold text-slate-500">Sample Pages ({{ form.pages.length }} total)</label>
              <button type="button" @click="addPage" class="btn btn-xs btn-ghost text-primary font-bold">+ Add Page</button>
            </div>

            <div class="space-y-3 max-h-56 overflow-y-auto pr-1">
              <div v-for="(p, idx) in form.pages" :key="idx" class="p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-base-200 dark:border-slate-800 space-y-2">
                <div class="flex justify-between items-center text-xs font-bold text-slate-400">
                  <span>Page {{ idx + 1 }}</span>
                  <button type="button" @click="removePage(idx)" class="btn btn-xs btn-circle btn-ghost text-rose-500 font-bold">✕</button>
                </div>
                <textarea v-model="form.pages[idx]" rows="3" class="textarea textarea-bordered w-full rounded-xl text-xs font-serif leading-relaxed dark:bg-slate-900"></textarea>
              </div>
            </div>
          </div>

          <!-- Step 4: CTA -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="text-[11px] font-bold text-slate-500 mb-1 block">Purchase CTA Button Text</label>
              <input v-model="form.ctaText" type="text" placeholder="Buy Full Book" class="input input-bordered input-sm w-full rounded-xl text-xs dark:bg-slate-800" />
            </div>
            <div>
              <label class="text-[11px] font-bold text-slate-500 mb-1 block">CTA Redirect URL</label>
              <input v-model="form.ctaUrl" type="text" placeholder="/store" class="input input-bordered input-sm w-full rounded-xl text-xs dark:bg-slate-800" />
            </div>
          </div>

          <div class="modal-action">
            <button type="button" @click="showModal = false" class="btn btn-sm btn-ghost rounded-xl font-bold text-xs">Cancel</button>
            <button type="submit" class="btn btn-sm btn-primary text-white rounded-xl font-bold px-6 text-xs uppercase tracking-wider" :disabled="saving">
              <span v-if="saving" class="loading loading-spinner loading-xs"></span>
              Save Preview
            </button>
          </div>
        </form>
      </div>
    </dialog>

    <!-- LIVE TWO-PAGE VIEWER MODAL -->
    <dialog class="modal modal-bottom sm:modal-middle" :class="{ 'modal-open': showViewerModal }">
      <div class="modal-box bg-white dark:bg-slate-900 border border-base-200 dark:border-slate-800 max-w-4xl w-full rounded-3xl p-6 space-y-6">
        <div class="flex items-center justify-between border-b border-base-200 dark:border-slate-800 pb-3">
          <div class="flex items-center gap-3">
            <span class="badge badge-primary font-bold text-[9px] uppercase tracking-wider">Live Viewer</span>
            <h3 class="font-black text-xl text-slate-900 dark:text-white">{{ activePreview?.title }}</h3>
          </div>
          <button @click="showViewerModal = false" class="btn btn-sm btn-ghost btn-circle">✕</button>
        </div>

        <!-- 2-Page Book Spread -->
        <div class="relative min-h-[340px] bg-slate-50 dark:bg-slate-950/60 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-inner grid grid-cols-1 md:grid-cols-2 gap-8">
          <!-- Spine Divider -->
          <div class="hidden md:block absolute top-6 bottom-6 left-1/2 -ml-[1px] w-[2px] bg-gradient-to-b from-transparent via-slate-300 dark:via-slate-700 to-transparent"></div>

          <!-- Left Page -->
          <div class="flex flex-col justify-between">
            <div class="prose dark:prose-invert max-w-none text-xs text-slate-700 dark:text-slate-200 font-serif leading-relaxed line-clamp-12" v-html="formatContent(activePreview?.pages[viewerSpread])"></div>
            <div class="text-center font-mono text-[10px] text-slate-400 pt-3">{{ viewerSpread + 1 }}</div>
          </div>

          <!-- Right Page -->
          <div class="flex flex-col justify-between">
            <div class="prose dark:prose-invert max-w-none text-xs text-slate-700 dark:text-slate-200 font-serif leading-relaxed line-clamp-12" v-html="formatContent(activePreview?.pages[viewerSpread + 1])"></div>
            <div class="text-center font-mono text-[10px] text-slate-400 pt-3">{{ viewerSpread + 2 }}</div>
          </div>
        </div>

        <!-- Turn Controls -->
        <div class="flex items-center justify-between pt-2">
          <button
            @click="turnViewerSpread(-2)"
            class="btn btn-sm btn-outline rounded-xl font-bold text-xs"
            :disabled="viewerSpread === 0"
          >
            &larr; Previous Page
          </button>

          <span class="text-xs font-mono font-bold text-slate-500">
            Pages {{ viewerSpread + 1 }}-{{ Math.min(viewerSpread + 2, activePreview?.pages?.length || 0) }} of {{ activePreview?.pages?.length || 0 }}
          </span>

          <button
            @click="turnViewerSpread(2)"
            class="btn btn-sm btn-primary text-white rounded-xl font-bold text-xs"
            :disabled="viewerSpread + 2 >= (activePreview?.pages?.length || 0)"
          >
            Next Page &rarr;
          </button>
        </div>
      </div>
    </dialog>

    <!-- ANALYTICS MODAL -->
    <dialog class="modal modal-bottom sm:modal-middle" :class="{ 'modal-open': showAnalyticsModal }">
      <div class="modal-box bg-white dark:bg-slate-900 border border-base-200 dark:border-slate-800 max-w-lg w-full rounded-3xl p-6 space-y-5">
        <div class="flex items-center justify-between border-b border-base-200 dark:border-slate-800 pb-3">
          <h3 class="font-black text-xl text-slate-900 dark:text-white">Preview Engagement Analytics</h3>
          <button @click="showAnalyticsModal = false" class="btn btn-sm btn-ghost btn-circle">✕</button>
        </div>

        <div v-if="analyticsData" class="space-y-4">
          <div class="grid grid-cols-3 gap-3 text-center">
            <div class="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800">
              <span class="text-[9px] font-bold uppercase text-slate-400">Total Views</span>
              <p class="text-xl font-black font-mono mt-0.5">{{ analyticsData.totalViews }}</p>
            </div>
            <div class="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800">
              <span class="text-[9px] font-bold uppercase text-slate-400">Page Flips</span>
              <p class="text-xl font-black font-mono mt-0.5">{{ analyticsData.totalPageFlips }}</p>
            </div>
            <div class="p-3 bg-primary/10 text-primary rounded-2xl border border-primary/20">
              <span class="text-[9px] font-bold uppercase">CTR</span>
              <p class="text-xl font-black font-mono mt-0.5">{{ analyticsData.clickThroughRate }}</p>
            </div>
          </div>

          <!-- Page Drop-off List -->
          <div>
            <h4 class="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Reading Depth by Page</h4>
            <div class="space-y-1.5 max-h-48 overflow-y-auto">
              <div
                v-for="(count, pageNum) in analyticsData.pagesDropOff"
                :key="pageNum"
                class="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-850 rounded-xl text-xs font-mono"
              >
                <span>Page {{ pageNum }}</span>
                <span class="font-bold text-primary">{{ count }} readers</span>
              </div>
              <div v-if="Object.keys(analyticsData.pagesDropOff || {}).length === 0" class="text-center py-6 text-slate-400 text-xs">
                No page flips recorded yet.
              </div>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { EbookPreview } from "swiftbase-cms-shared";

const previews = ref<EbookPreview[]>([]);
const products = ref<any[]>([]);
const loading = ref(true);
const saving = ref(false);
const extracting = ref(false);
const extractMsg = ref("");

const showModal = ref(false);
const showViewerModal = ref(false);
const showAnalyticsModal = ref(false);

const activePreview = ref<EbookPreview | null>(null);
const analyticsData = ref<any>(null);
const viewerSpread = ref(0);
const extractCount = ref(2);

const form = ref<any>({
  id: "",
  productId: "",
  title: "",
  author: "",
  coverImage: "",
  pages: [],
  ctaText: "Buy Full Book",
  ctaUrl: "/store",
});

const loadPreviews = async () => {
  loading.value = true;
  try {
    const res = await fetch("/api/ebooks/previews");
    if (res.ok) {
      previews.value = await res.json();
    }
  } catch (err) {
    console.error("Failed to load previews:", err);
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

const openCreateModal = () => {
  form.value = {
    id: "",
    productId: "",
    title: "",
    author: "",
    coverImage: "",
    pages: ["Chapter 1\n\nThe quiet dawn illuminated the forgotten library...", "Chapter 1 (Continued)\n\nEndless shelves of leather-bound manuscripts held ancient secrets..."],
    ctaText: "Buy Full Book",
    ctaUrl: "/store",
  };
  extractMsg.value = "";
  showModal.value = true;
};

const openEditModal = (p: EbookPreview) => {
  form.value = {
    id: p.id,
    productId: p.productId,
    title: p.title,
    author: p.author,
    coverImage: p.coverImage || "",
    pages: [...(p.pages || [])],
    ctaText: p.ctaText || "Buy Full Book",
    ctaUrl: p.ctaUrl || "/store",
  };
  extractMsg.value = "";
  showModal.value = true;
};

const onProductSelect = () => {
  const prod = products.value.find(p => p.id === form.value.productId);
  if (prod) {
    if (!form.value.title) form.value.title = prod.name;
    if (!form.value.coverImage && prod.images && prod.images.length > 0) {
      form.value.coverImage = prod.images[0];
    }
    form.value.ctaUrl = `/store/${prod.slug || prod.id}`;
  }
};

const runExtraction = async () => {
  if (!form.value.productId) return;
  extracting.value = true;
  extractMsg.value = "";
  try {
    const res = await fetch("/api/ebooks/previews/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: form.value.productId,
        mode: "chapters",
        count: extractCount.value,
      }),
    });
    const data = await res.json();
    if (res.ok && data.pages) {
      form.value.pages = data.pages;
      extractMsg.value = `Successfully extracted ${data.pages.length} pages from ${data.sourceFileName}!`;
    } else {
      extractMsg.value = data.message || "Failed to extract content.";
    }
  } catch (err: any) {
    extractMsg.value = err.message || "Extraction request error.";
  } finally {
    extracting.value = false;
  }
};

const addPage = () => {
  form.value.pages.push("New excerpt page content...");
};

const removePage = (idx: number) => {
  form.value.pages.splice(idx, 1);
};

const savePreview = async () => {
  saving.value = true;
  try {
    const res = await fetch("/api/ebooks/previews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form.value),
    });
    if (res.ok) {
      showModal.value = false;
      await loadPreviews();
    }
  } catch (err) {
    console.error("Failed to save preview:", err);
  } finally {
    saving.value = false;
  }
};

const deletePreview = async (id: string) => {
  if (!confirm("Are you sure you want to delete this e-book preview?")) return;
  try {
    const res = await fetch(`/api/ebooks/previews/${id}`, { method: "DELETE" });
    if (res.ok) {
      await loadPreviews();
    }
  } catch (err) {
    console.error("Failed to delete preview:", err);
  }
};

const openPreviewViewer = (p: EbookPreview) => {
  activePreview.value = p;
  viewerSpread.value = 0;
  showViewerModal.value = true;
};

const turnViewerSpread = (delta: number) => {
  if (!activePreview.value) return;
  const next = viewerSpread.value + delta;
  if (next >= 0 && next < (activePreview.value.pages?.length || 0)) {
    viewerSpread.value = next;
  }
};

const openAnalytics = async (p: EbookPreview) => {
  try {
    const res = await fetch(`/api/ebooks/previews/${p.id}/analytics`);
    if (res.ok) {
      analyticsData.value = await res.json();
      showAnalyticsModal.value = true;
    }
  } catch (err) {
    console.error("Failed to load analytics:", err);
  }
};

const formatContent = (text?: string) => {
  if (!text) return '<p class="text-slate-400 italic">No content on this page.</p>';
  return text.replace(/\n\n/g, '</p><p class="mb-3">').replace(/\n/g, '<br/>');
};

onMounted(() => {
  loadPreviews();
  loadProducts();
});
</script>
