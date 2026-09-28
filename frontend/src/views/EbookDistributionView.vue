<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <div class="flex items-center gap-2 text-xs font-bold text-slate-400 mb-1">
          <router-link to="/extensions" class="hover:text-primary transition-colors">Extensions</router-link>
          <span>/</span>
          <span class="text-slate-200">E-book Distribution</span>
        </div>
        <h2 class="text-2xl font-black text-slate-900 dark:text-white tracking-tight">E-book Distribution & Reader Hub</h2>
        <p class="text-xs text-slate-500 mt-0.5">Manage digital book formats, send review copies, and generate offline handout card codes.</p>
      </div>
    </div>

    <!-- Tabs Header -->
    <div class="tabs tabs-boxed bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl w-fit">
      <a
        class="tab tab-sm font-bold text-xs uppercase rounded-xl transition-all"
        :class="{ 'tab-active !bg-primary !text-white shadow-sm': activeTab === 'files' }"
        @click="activeTab = 'files'"
      >
        📚 Book Formats
      </a>
      <a
        class="tab tab-sm font-bold text-xs uppercase rounded-xl transition-all"
        :class="{ 'tab-active !bg-primary !text-white shadow-sm': activeTab === 'free-copies' }"
        @click="activeTab = 'free-copies'; loadFreeCopies()"
      >
        💌 Send Free Copies
      </a>
      <a
        class="tab tab-sm font-bold text-xs uppercase rounded-xl transition-all"
        :class="{ 'tab-active !bg-primary !text-white shadow-sm': activeTab === 'cards' }"
        @click="activeTab = 'cards'; loadCards()"
      >
        🎟️ Offline Download Cards
      </a>
    </div>

    <!-- TAB 1: BOOK FILES -->
    <div v-if="activeTab === 'files'" class="card bg-white dark:bg-slate-900 border border-base-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
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

          <label class="btn btn-sm btn-primary text-white rounded-xl text-xs font-bold px-4 gap-1.5 cursor-pointer shadow-sm">
            <font-awesome-icon :icon="['fas', 'upload']" />
            Upload File
            <input type="file" class="hidden" @change="handleFileUpload" accept=".epub,.pdf,.mobi,.azw3" />
          </label>
        </div>
      </div>

      <div v-if="uploadingFile" class="flex justify-center py-10">
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
                <h5 class="font-bold text-xs text-slate-900 dark:text-white truncate max-w-[200px]">{{ file.fileName }}</h5>
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
    <div v-if="activeTab === 'free-copies'" class="card bg-white dark:bg-slate-900 border border-base-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
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
          <button type="submit" class="btn btn-sm btn-primary text-white font-bold rounded-xl px-6 text-xs uppercase shadow-md" :disabled="sendingFreeCopy">
            <span v-if="sendingFreeCopy" class="loading loading-spinner loading-xs"></span>
            Send Copy & Email &rarr;
          </button>
        </div>
      </form>

      <!-- History Table -->
      <div class="space-y-3">
        <h4 class="text-xs font-black uppercase tracking-wider text-slate-400">Dispatch History</h4>
        <div class="overflow-x-auto border border-base-200 dark:border-slate-800 rounded-2xl">
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
    <div v-if="activeTab === 'cards'" class="card bg-white dark:bg-slate-900 border border-base-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
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
        <button type="submit" class="btn btn-sm btn-primary text-white font-bold rounded-xl px-6 text-xs uppercase shadow-md" :disabled="generatingCards">
          <span v-if="generatingCards" class="loading loading-spinner loading-xs"></span>
          Generate Cards
        </button>
      </form>

      <!-- Cards Table -->
      <div class="space-y-3">
        <h4 class="text-xs font-black uppercase tracking-wider text-slate-400">Single-Use Card Codes</h4>
        <div class="overflow-x-auto border border-base-200 dark:border-slate-800 rounded-2xl">
          <table class="table table-xs w-full">
            <thead>
              <tr class="bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold uppercase text-[9px]">
                <th>Card Code</th>
                <th>Book</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="card in cards" :key="card.id" class="hover">
                <td class="font-mono font-bold text-xs text-primary">{{ card.code }}</td>
                <td class="text-xs">{{ card.productTitle }}</td>
                <td>
                  <span v-if="card.isRedeemed" class="badge badge-sm badge-error text-white font-bold text-[9px]">Redeemed</span>
                  <span v-else class="badge badge-sm badge-success text-white font-bold text-[9px]">Available</span>
                </td>
                <td class="text-[10px] text-slate-400">{{ new Date(card.createdAt).toLocaleDateString() }}</td>
              </tr>
              <tr v-if="cards.length === 0">
                <td colspan="4" class="text-center py-6 text-slate-400 text-xs">No download cards generated yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

const activeTab = ref<"files" | "free-copies" | "cards">("files");
const products = ref<any[]>([]);
const selectedProductId = ref("");
const uploadFormat = ref("epub");
const ebookFiles = ref<any[]>([]);
const uploadingFile = ref(false);

const freeCopies = ref<any[]>([]);
const sendingFreeCopy = ref(false);
const freeCopyForm = ref({
  productId: "",
  recipientName: "",
  recipientEmail: "",
  message: "",
});

const cards = ref<any[]>([]);
const generatingCards = ref(false);
const cardForm = ref({
  productId: "",
  count: 10,
  prefix: "READ",
});

const loadProducts = async () => {
  try {
    const res = await fetch("/api/products");
    if (res.ok) {
      products.value = await res.json();
      if (products.value.length > 0 && !selectedProductId.value) {
        selectedProductId.value = products.value[0].id;
        loadEbookFiles();
      }
    }
  } catch (err) {
    console.error("Failed to load products:", err);
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

const handleFileUpload = async (event: any) => {
  const file = event.target.files && event.target.files[0];
  if (!file || !selectedProductId.value) return;

  uploadingFile.value = true;
  try {
    const reader = new FileReader();
    reader.onload = async (e: any) => {
      const base64 = e.target.result.split(",")[1];
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
    console.error("File upload failed:", err);
    uploadingFile.value = false;
  }
};

const deleteEbookFile = async (fileId: string) => {
  if (!confirm("Are you sure you want to delete this format?")) return;
  try {
    const res = await fetch(`/api/ebooks/files/${fileId}`, { method: "DELETE" });
    if (res.ok) {
      await loadEbookFiles();
    }
  } catch (err) {
    console.error("Failed to delete format:", err);
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

const sendFreeCopy = async () => {
  sendingFreeCopy.value = true;
  try {
    const res = await fetch("/api/ebooks/free-copies/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(freeCopyForm.value),
    });
    if (res.ok) {
      freeCopyForm.value = { productId: "", recipientName: "", recipientEmail: "", message: "" };
      await loadFreeCopies();
    }
  } catch (err) {
    console.error("Failed to send free copy:", err);
  } finally {
    sendingFreeCopy.value = false;
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

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

onMounted(() => {
  loadProducts();
});
</script>
