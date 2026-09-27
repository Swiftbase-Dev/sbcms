<template>
  <div class="min-h-screen bg-slate-950 text-white font-sans flex flex-col justify-between selection:bg-primary selection:text-white">
    <!-- Navbar / Brand -->
    <header class="h-20 border-b border-white/10 px-6 sm:px-12 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center font-black text-xl text-white shadow-lg shadow-primary/20">
          S
        </div>
        <div>
          <span class="font-black text-lg tracking-tight text-white block leading-none">E-book Reader Hub</span>
          <span class="text-[10px] text-slate-400 font-mono">Digital Distribution Portal</span>
        </div>
      </div>
      <a href="/store" class="text-xs font-bold text-slate-400 hover:text-white transition-colors">
        Visit Store &rarr;
      </a>
    </header>

    <!-- Main Content -->
    <main class="flex-1 flex items-center justify-center p-6 sm:p-12">
      <!-- Loading State -->
      <div v-if="loading" class="text-center py-20">
        <span class="loading loading-spinner loading-lg text-primary"></span>
        <p class="text-xs text-slate-400 mt-4 font-mono">Loading your book...</p>
      </div>

      <!-- Error / Code Redemption View -->
      <div v-else-if="!data && !loading" class="max-w-md w-full bg-slate-900 border border-white/10 p-8 rounded-3xl shadow-2xl space-y-6">
        <div class="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl mx-auto shadow-inner">
          <font-awesome-icon :icon="['fas', 'ticket']" />
        </div>
        <div class="text-center">
          <h2 class="text-2xl font-black text-white tracking-tight">Redeem Download Code</h2>
          <p class="text-xs text-slate-400 mt-2 leading-relaxed">
            Enter the code from your handout card or email to unlock and download your complimentary e-book.
          </p>
        </div>

        <form @submit.prevent="redeemCode" class="space-y-4">
          <div class="form-control">
            <input
              v-model="inputCode"
              type="text"
              placeholder="e.g. READ-A3F8-K92X"
              class="input input-bordered w-full rounded-2xl text-center font-mono font-bold tracking-widest text-sm bg-slate-950 border-white/20 uppercase focus:border-primary"
              required
            />
          </div>

          <div v-if="redeemError" class="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 rounded-xl text-xs text-center">
            {{ redeemError }}
          </div>

          <button
            type="submit"
            class="btn btn-primary w-full text-white font-bold rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-primary/25"
            :disabled="redeeming || !inputCode.trim()"
          >
            <span v-if="redeeming" class="loading loading-spinner loading-xs"></span>
            Unlock E-book &rarr;
          </button>
        </form>
      </div>

      <!-- Success Download Hub -->
      <div v-else class="max-w-4xl w-full bg-slate-900 border border-white/10 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8">
        <!-- Top Book Details Banner -->
        <div class="flex flex-col sm:flex-row items-center sm:items-start gap-8 pb-8 border-b border-white/10">
          <div class="w-32 h-48 shrink-0 rounded-2xl bg-slate-800 overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center">
            <img
              v-if="data.product?.images && data.product.images.length > 0"
              :src="data.product.images[0]"
              :alt="data.product.name"
              class="w-full h-full object-cover"
            />
            <div v-else class="text-center p-4 text-slate-500">
              <font-awesome-icon :icon="['fas', 'book-open']" class="text-3xl mb-2 opacity-50" />
              <span class="text-[10px] font-black uppercase tracking-wider block">No Cover</span>
            </div>
          </div>

          <div class="flex-1 text-center sm:text-left">
            <div class="inline-block bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3">
              Complimentary E-book Access
            </div>
            <h1 class="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              {{ data.product?.name || data.distribution.productTitle }}
            </h1>
            <p v-if="data.distribution.recipientName" class="text-xs text-slate-400 mt-2">
              Prepared for <strong class="text-white">{{ data.distribution.recipientName }}</strong>
            </p>
            <p v-if="data.product?.description" class="text-xs text-slate-300 mt-3 line-clamp-3 leading-relaxed">
              {{ data.product.description.replace(/<[^>]*>/g, '') }}
            </p>
          </div>
        </div>

        <!-- Format Download Section -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black uppercase tracking-wider text-slate-400">1. Choose Your Preferred Format</h3>
            <span class="text-[11px] text-slate-500 font-mono">Downloads used: {{ data.distribution.downloadCount }} / {{ data.distribution.maxDownloads }}</span>
          </div>

          <div v-if="!data.files || data.files.length === 0" class="p-6 text-center border border-dashed border-white/10 rounded-2xl text-slate-400 text-xs">
            No downloadable formats have been uploaded for this book yet. Please check back soon or contact support.
          </div>

          <div v-else class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              v-for="file in data.files"
              :key="file.id"
              class="bg-slate-950 p-5 rounded-2xl border border-white/10 flex flex-col justify-between gap-4 hover:border-primary/50 transition-all duration-200"
            >
              <div>
                <div class="flex items-center justify-between mb-2">
                  <span class="badge badge-primary font-black text-[10px] uppercase">{{ file.format }}</span>
                  <span class="text-[10px] font-mono text-slate-400">{{ formatBytes(file.fileSizeBytes) }}</span>
                </div>
                <h4 class="font-bold text-sm text-white truncate">{{ file.fileName }}</h4>
                <p class="text-[11px] text-slate-400 mt-1">
                  {{ file.format === 'epub' ? 'Recommended for Apple Books, Kobo, and Send-to-Kindle' : (file.format === 'pdf' ? 'Great for large screens and printing' : 'MOBI format for legacy devices') }}
                </p>
              </div>

              <a
                :href="`/api/ebooks/download/${token}/file/${file.id}`"
                target="_blank"
                class="btn btn-sm btn-primary text-white rounded-xl text-xs font-bold gap-2 shadow-md"
              >
                <font-awesome-icon :icon="['fas', 'download']" />
                Download {{ file.format.toUpperCase() }}
              </a>
            </div>
          </div>
        </div>

        <!-- Step-by-Step Device Setup Guide -->
        <div class="space-y-4 pt-4 border-t border-white/10">
          <h3 class="text-sm font-black uppercase tracking-wider text-slate-400">2. Device Reading Instructions</h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              v-for="guide in data.deviceGuides"
              :key="guide.id"
              class="bg-slate-950/60 p-5 rounded-2xl border border-white/5 space-y-3"
            >
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-xl bg-white/5 text-primary flex items-center justify-center text-sm">
                  <font-awesome-icon :icon="['fas', guide.icon]" />
                </div>
                <div>
                  <h4 class="font-bold text-xs text-white">{{ guide.title }}</h4>
                  <span class="text-[10px] font-mono text-slate-500">Format: {{ guide.format }}</span>
                </div>
              </div>

              <ul class="space-y-2 text-[11px] text-slate-400 pl-2">
                <li v-for="(step, idx) in guide.steps" :key="idx" class="flex items-start gap-2">
                  <span class="text-primary font-black shrink-0">•</span>
                  <span>{{ step }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="h-16 border-t border-white/10 px-6 flex items-center justify-center text-xs text-slate-500 shrink-0">
      Powered by Swiftbase CMS &bull; Secure Digital Distribution
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

const token = ref<string>((route.params.token as string) || "");
const data = ref<any>(null);
const loading = ref(false);
const inputCode = ref("");
const redeeming = ref(false);
const redeemError = ref("");

const loadDownloadDetails = async (t: string) => {
  if (!t) return;
  loading.value = true;
  try {
    const res = await fetch(`/api/ebooks/download/${t}`);
    if (res.ok) {
      data.value = await res.json();
    } else {
      const err = await res.json().catch(() => ({}));
      redeemError.value = err.message || "Invalid or expired download link.";
    }
  } catch (err: any) {
    redeemError.value = err.message || "Network error loading download hub.";
  } finally {
    loading.value = false;
  }
};

const redeemCode = async () => {
  if (!inputCode.value.trim()) return;
  redeeming.value = true;
  redeemError.value = "";
  try {
    const res = await fetch("/api/ebooks/cards/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: inputCode.value.trim() }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Invalid download code.");
    }
    const result = await res.json();
    token.value = result.token;
    router.replace(`/download/${result.token}`);
    await loadDownloadDetails(result.token);
  } catch (err: any) {
    redeemError.value = err.message;
  } finally {
    redeeming.value = false;
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
  if (token.value) {
    await loadDownloadDetails(token.value);
  }
});
</script>
