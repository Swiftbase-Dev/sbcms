<template>
  <div class="space-y-8 max-w-6xl mx-auto animate-in fade-in duration-500">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <div>
        <div class="badge bg-primary text-white border-none font-bold uppercase tracking-widest text-[9px] px-3 py-1">CMS Media Asset Library</div>
        <h1 class="text-4xl font-black tracking-tighter">Image Gallery</h1>
        <p class="text-xs opacity-50 mt-1">Manage and upload image assets directly to S3 Storage for page layouts, logo, or favicon usage.</p>
      </div>
    </div>

    <!-- Upload Area & Gallery Grid -->
    <div class="grid gap-8 lg:grid-cols-4">
      <!-- Drag & Drop Zone -->
      <div 
        @dragover.prevent="dragover = true"
        @dragleave.prevent="dragover = false"
        @drop.prevent="handleDrop"
        :class="['card lg:col-span-1 border-2 border-dashed rounded-3xl p-6 flex flex-col items-center justify-center text-center transition-all min-h-[300px]', 
          dragover ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-base-300 hover:border-primary/50 bg-white dark:bg-slate-900 shadow-xl'
        ]"
      >
        <div class="space-y-4 flex flex-col items-center">
          <div :class="['w-16 h-16 rounded-2xl flex items-center justify-center transition-all', dragover ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400']">
            <font-awesome-icon :icon="['fas', 'cloud-arrow-up']" class="w-8 h-8" />
          </div>
          <div>
            <span class="font-bold text-sm block">Drag & Drop Image</span>
            <span class="text-xs opacity-50 block mt-1">PNG, JPG, SVG, GIF or ICO up to 10MB</span>
          </div>
          <div class="divider text-xs opacity-30">OR</div>
          <label class="btn btn-sm btn-primary rounded-xl px-4 text-white font-bold text-xs uppercase cursor-pointer">
            Browse Files
            <input type="file" @change="handleFileChange" accept="image/*,.ico" class="hidden" />
          </label>
        </div>
      </div>

      <!-- Asset Grid -->
      <div class="lg:col-span-3 card bg-white dark:bg-slate-900 border border-base-200 p-8 rounded-3xl shadow-xl space-y-6">
        <!-- Search and Header Controls -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div class="flex items-center gap-3">
            <h3 class="font-bold text-sm uppercase tracking-widest opacity-60">Uploaded Assets ({{ sortedAssets.length }})</h3>
            
            <!-- View Mode Toggle -->
            <div class="join border border-base-300 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs">
              <button 
                type="button"
                @click="viewMode = 'grid'" 
                :class="['join-item btn btn-xs px-2.5 gap-1.5 transition-all', viewMode === 'grid' ? 'btn-primary text-white' : 'btn-ghost']"
                title="Card View"
              >
                <font-awesome-icon :icon="['fas', 'table-cells-large']" class="w-3 h-3" />
                <span class="hidden sm:inline text-[11px] font-bold">Cards</span>
              </button>
              <button 
                type="button"
                @click="viewMode = 'list'" 
                :class="['join-item btn btn-xs px-2.5 gap-1.5 transition-all', viewMode === 'list' ? 'btn-primary text-white' : 'btn-ghost']"
                title="List View"
              >
                <font-awesome-icon :icon="['fas', 'list']" class="w-3 h-3" />
                <span class="hidden sm:inline text-[11px] font-bold">List</span>
              </button>
            </div>
          </div>
          
          <div class="flex items-center gap-3 w-full md:w-auto">
            <input type="text" v-model="searchQuery" placeholder="Search images..." class="input input-sm input-bordered rounded-xl px-3 w-full md:w-48 text-xs focus:outline-none" />
            <button @click="fetchAssets(true)" class="btn btn-xs btn-ghost gap-1 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center shrink-0">
              <font-awesome-icon :icon="['fas', 'rotate']" class="w-3.5 h-3.5" />
              Sync
            </button>
          </div>
        </div>

        <!-- Loader -->
        <div v-if="loading" class="flex justify-center py-20">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>

        <!-- Empty State -->
        <div v-else-if="sortedAssets.length === 0" class="text-center py-20 opacity-55 text-sm flex flex-col items-center justify-center gap-2">
          <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
            <font-awesome-icon :icon="['fas', 'images']" class="w-6 h-6" />
          </div>
          No images matched your filters.
        </div>

        <!-- Gallery Content (Card / List) -->
        <div v-else class="space-y-6">
          <!-- Card View -->
          <div v-if="viewMode === 'grid'" class="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div v-for="asset in paginatedAssets" :key="asset.key" class="group relative card bg-slate-50 dark:bg-slate-800/40 border border-base-200 rounded-2xl overflow-hidden shadow hover:shadow-lg hover:scale-[1.01] transition-all">
              <!-- Thumbnail preview -->
              <div class="h-32 bg-slate-200 dark:bg-slate-800 relative flex items-center justify-center overflow-hidden">
                <img :src="`${asset.thumbnailUrl || asset.url}?t=${new Date(asset.lastModified || Date.now()).getTime()}`" :alt="asset.name" class="object-cover w-full h-full" />
                <!-- Hover Action overlay -->
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-all">
                  <button @click="copyLink(asset.url)" class="btn btn-xs btn-white bg-white text-slate-900 border-none font-bold rounded-lg px-3">
                    Copy URL
                  </button>
                  <button @click="deleteAsset(asset.name)" class="btn btn-xs btn-circle btn-ghost text-rose-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center">
                    <font-awesome-icon :icon="['fas', 'trash-can']" class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <!-- Details -->
              <div class="p-3 text-xs flex flex-col justify-between h-16 bg-white dark:bg-slate-900 border-t border-base-200">
                <span class="font-bold truncate" :title="asset.name">{{ asset.name }}</span>
                <div class="flex justify-between items-center text-[10px] opacity-50 mt-1">
                  <span>{{ formatBytes(asset.size) }}</span>
                  <span>{{ asset.lastModified ? new Date(asset.lastModified).toLocaleDateString() : '' }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- List View -->
          <div v-else class="overflow-x-auto rounded-2xl border border-base-200 shadow-sm bg-white dark:bg-slate-900">
            <table class="table table-sm w-full">
              <thead>
                <tr class="bg-slate-50 dark:bg-slate-800/60 border-b border-base-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th class="w-16">Preview</th>
                  <th class="cursor-pointer select-none hover:text-primary transition-colors" @click="toggleSort('name')">
                    <div class="flex items-center gap-1.5">
                      <span>File Name</span>
                      <font-awesome-icon v-if="sortField === 'name'" :icon="['fas', sortDirection === 'asc' ? 'arrow-up' : 'arrow-down']" class="w-3 h-3 text-primary" />
                    </div>
                  </th>
                  <th class="cursor-pointer select-none hover:text-primary transition-colors w-28" @click="toggleSort('size')">
                    <div class="flex items-center gap-1.5">
                      <span>Size</span>
                      <font-awesome-icon v-if="sortField === 'size'" :icon="['fas', sortDirection === 'asc' ? 'arrow-up' : 'arrow-down']" class="w-3 h-3 text-primary" />
                    </div>
                  </th>
                  <th class="cursor-pointer select-none hover:text-primary transition-colors w-36" @click="toggleSort('lastModified')">
                    <div class="flex items-center gap-1.5">
                      <span>Modified</span>
                      <font-awesome-icon v-if="sortField === 'lastModified'" :icon="['fas', sortDirection === 'asc' ? 'arrow-up' : 'arrow-down']" class="w-3 h-3 text-primary" />
                    </div>
                  </th>
                  <th class="text-right w-28">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-base-200 text-xs">
                <tr v-for="asset in paginatedAssets" :key="asset.key" class="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                  <td>
                    <div class="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-base-200 flex items-center justify-center">
                      <img :src="`${asset.thumbnailUrl || asset.url}?t=${new Date(asset.lastModified || Date.now()).getTime()}`" :alt="asset.name" class="object-cover w-full h-full" />
                    </div>
                  </td>
                  <td class="font-bold text-slate-800 dark:text-slate-200">
                    <span class="truncate block max-w-xs md:max-w-md" :title="asset.name">{{ asset.name }}</span>
                  </td>
                  <td class="opacity-70 font-mono text-[11px] whitespace-nowrap">
                    {{ formatBytes(asset.size) }}
                  </td>
                  <td class="opacity-70 whitespace-nowrap text-[11px]">
                    {{ asset.lastModified ? new Date(asset.lastModified).toLocaleDateString() : '—' }}
                  </td>
                  <td class="text-right">
                    <div class="flex items-center justify-end gap-1.5">
                      <button @click="copyLink(asset.url)" class="btn btn-xs btn-outline rounded-lg font-bold" title="Copy URL">
                        Copy
                      </button>
                      <button @click="deleteAsset(asset.name)" class="btn btn-xs btn-ghost text-rose-500 hover:bg-rose-500/10 rounded-lg" title="Delete">
                        <font-awesome-icon :icon="['fas', 'trash-can']" class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination Controls & Page Size Dropdown -->
          <div class="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <!-- Page Size Selector -->
            <div class="flex items-center gap-2 text-xs text-slate-500 font-bold">
              <span>Show</span>
              <select v-model="itemsPerPage" class="select select-xs select-bordered rounded-lg text-xs font-bold focus:outline-none">
                <option :value="9">9 per page</option>
                <option :value="18">18 per page</option>
                <option :value="36">36 per page</option>
                <option :value="72">72 per page</option>
                <option :value="10000">All assets</option>
              </select>
              <span class="opacity-60 text-[11px]">({{ sortedAssets.length }} total)</span>
            </div>

            <!-- Page Buttons -->
            <div v-if="totalPages > 1" class="flex items-center gap-3">
              <button :disabled="currentPage === 1" @click="currentPage--" class="btn btn-sm btn-outline rounded-xl px-4 font-bold text-xs uppercase">Prev</button>
              <span class="text-xs font-bold text-slate-500">Page {{ currentPage }} of {{ totalPages }}</span>
              <button :disabled="currentPage === totalPages" @click="currentPage++" class="btn btn-sm btn-outline rounded-xl px-4 font-bold text-xs uppercase">Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Reusable custom Modal for alerts/confirms -->
    <div v-if="modal.show" class="modal modal-open z-50">
      <div class="modal-box rounded-3xl border border-base-200 shadow-2xl bg-white dark:bg-slate-900">
        <h3 class="font-black text-2xl tracking-tight">{{ modal.title }}</h3>
        <p class="text-xs opacity-60 mt-2 mb-6">{{ modal.message }}</p>
        <div class="modal-action">
          <button type="button" @click="modal.show = false" class="btn btn-ghost rounded-xl font-bold">
            {{ modal.type === 'confirm' ? 'Cancel' : 'Ok' }}
          </button>
          <button type="button" v-if="modal.type === 'confirm'" @click="modal.onConfirm?.(); modal.show = false" class="btn btn-primary rounded-xl font-bold px-6 text-white">
            Confirm
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { cachedFetch } from "../utils/api";

interface Asset {
  name: string;
  key: string;
  size: number;
  lastModified?: string;
  url: string;
  thumbnailUrl?: string;
}

const assets = ref<Asset[]>([]);
const loading = ref(true);
const dragover = ref(false);

// View Mode & Sorting State
const viewMode = ref<'grid' | 'list'>('grid');
const sortField = ref<'name' | 'size' | 'lastModified'>('name');
const sortDirection = ref<'asc' | 'desc'>('asc');

// Search & Pagination State
const searchQuery = ref("");
const currentPage = ref(1);
const itemsPerPage = ref(9);

const modal = ref({
  show: false,
  title: "",
  message: "",
  type: "alert" as "alert" | "confirm",
  onConfirm: null as (() => void) | null,
});

const showAlert = (title: string, message: string) => {
  modal.value = { show: true, title, message, type: "alert", onConfirm: null };
};

const showConfirm = (title: string, message: string, onConfirm: () => void) => {
  modal.value = { show: true, title, message, type: "confirm", onConfirm };
};

// Reset page to 1 when search query or itemsPerPage changes
watch([searchQuery, itemsPerPage], () => {
  currentPage.value = 1;
});

const toggleSort = (field: 'name' | 'size' | 'lastModified') => {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortDirection.value = 'asc';
  }
};

const sortedAssets = computed(() => {
  const query = searchQuery.value.toLowerCase().trim();
  let list = assets.value;
  if (query) {
    list = list.filter(a => a.name.toLowerCase().includes(query));
  }

  return [...list].sort((a, b) => {
    let comparison = 0;
    if (sortField.value === 'name') {
      comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    } else if (sortField.value === 'size') {
      comparison = (a.size || 0) - (b.size || 0);
    } else if (sortField.value === 'lastModified') {
      const timeA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
      const timeB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
      comparison = timeA - timeB;
    }
    return sortDirection.value === 'asc' ? comparison : -comparison;
  });
});

const totalPages = computed(() => {
  return Math.ceil(sortedAssets.value.length / itemsPerPage.value) || 1;
});

const paginatedAssets = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  return sortedAssets.value.slice(start, start + itemsPerPage.value);
});

const fetchAssets = async (forceRefresh = false) => {
  loading.value = true;
  try {
    assets.value = await cachedFetch("/api/assets", undefined, forceRefresh);
  } catch (err) {
    console.error("Failed to load assets:", err);
  } finally {
    loading.value = false;
  }
};

const handleDrop = async (e: DragEvent) => {
  dragover.value = false;
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    await uploadFile(files[0]);
  }
};

const handleFileChange = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  const files = target.files;
  if (files && files.length > 0) {
    await uploadFile(files[0]);
  }
};

const generateThumbnailBase64 = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        const MAX_WIDTH = 256;
        const MAX_HEIGHT = 256;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        resolve(dataUrl.split(",")[1]);
      };
    };
  });
};

const uploadFile = (file: File): Promise<void> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        
        loading.value = true;

        // Generate client-side thumbnail for images
        let thumbBase64 = undefined;
        if (file.type.startsWith("image/")) {
          try {
            thumbBase64 = await generateThumbnailBase64(file);
          } catch (tErr) {
            console.warn("Failed to generate thumbnail, using original image:", tErr);
          }
        }
        
        await cachedFetch("/api/assets/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            contentType: file.type,
            base64,
            thumbBase64
          })
        });
        await fetchAssets(true);
      } catch (err: any) {
        console.error("Upload error:", err);
        showAlert("Upload Error", "Failed to upload file to storage.");
      } finally {
        loading.value = false;
        resolve();
      }
    };
    reader.onerror = (err) => {
      console.error("Reader error:", err);
      reject(err);
    };
  });
};

const deleteAsset = async (name: string) => {
  showConfirm(
    "Delete Image",
    `Are you sure you want to delete the image "${name}"?`,
    async () => {
      loading.value = true;
      try {
        await cachedFetch(`/api/assets/${encodeURIComponent(name)}`, {
          method: "DELETE"
        });
        await fetchAssets(true);
      } catch (err: any) {
        console.error("Deletion error:", err);
        showAlert("Deletion Failed", err.message);
      } finally {
        loading.value = false;
      }
    }
  );
};

const copyLink = (url: string) => {
  const fullUrl = window.location.protocol + "//" + window.location.host + url;
  navigator.clipboard.writeText(fullUrl);
  showAlert("Link Copied", "Asset URL copied to clipboard!");
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

onMounted(fetchAssets);
</script>
