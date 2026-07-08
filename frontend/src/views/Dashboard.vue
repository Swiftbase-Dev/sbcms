<template>
  <div class="space-y-8 animate-in fade-in duration-500">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <div>
        <div class="badge bg-primary text-white border-none font-bold uppercase tracking-widest text-[9px] px-3 py-1">CMS Analytics</div>
        <h1 class="text-4xl font-black tracking-tighter">Dashboard Overview</h1>
      </div>
      <button @click="fetchData" class="btn btn-outline border-slate-300 dark:border-slate-800 rounded-xl px-6 font-bold text-xs uppercase">Refresh</button>
    </div>

    <!-- Cards Grid -->
    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <div class="card bg-white dark:bg-slate-900 border border-base-200 p-6 rounded-3xl shadow-xl flex flex-col justify-between">
        <span class="text-xs opacity-50 font-bold uppercase tracking-widest">Pageviews</span>
        <div class="text-4xl font-black mt-2 tracking-tight">{{ stats.pageviews }}</div>
      </div>
      <div class="card bg-white dark:bg-slate-900 border border-base-200 p-6 rounded-3xl shadow-xl flex flex-col justify-between">
        <span class="text-xs opacity-50 font-bold uppercase tracking-widest">Unique Sessions</span>
        <div class="text-4xl font-black mt-2 tracking-tight">{{ stats.sessions }}</div>
      </div>
      <div class="card bg-white dark:bg-slate-900 border border-base-200 p-6 rounded-3xl shadow-xl flex flex-col justify-between">
        <span class="text-xs opacity-50 font-bold uppercase tracking-widest">Store Purchases</span>
        <div class="text-4xl font-black mt-2 tracking-tight">{{ stats.purchases }}</div>
      </div>
      <div class="card bg-white dark:bg-slate-900 border border-base-200 p-6 rounded-3xl shadow-xl flex flex-col justify-between">
        <span class="text-xs opacity-50 font-bold uppercase tracking-widest">Total Revenue</span>
        <div class="text-4xl font-black mt-2 tracking-tight text-primary">${{ stats.revenue.toFixed(2) }}</div>
      </div>
    </div>

    <!-- Analytics Splits -->
    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <!-- Device Stats -->
      <div class="card bg-white dark:bg-slate-900 border border-base-200 p-6 rounded-3xl shadow-xl">
        <h3 class="font-bold text-sm mb-4 uppercase tracking-widest opacity-60">Device Distribution</h3>
        <div class="space-y-4">
          <div v-for="(count, device) in splits.devices" :key="device" class="space-y-2">
            <div class="flex justify-between text-xs font-bold capitalize">
              <span>{{ device }}</span>
              <span>{{ count }} ({{ getPercentage(count, stats.pageviews) }}%)</span>
            </div>
            <progress class="progress progress-primary w-full h-2 rounded-full" :value="count" :max="stats.pageviews || 1"></progress>
          </div>
        </div>
      </div>

      <!-- Browser Share -->
      <div class="card bg-white dark:bg-slate-900 border border-base-200 p-6 rounded-3xl shadow-xl">
        <h3 class="font-bold text-sm mb-4 uppercase tracking-widest opacity-60">Top Browsers</h3>
        <div class="space-y-4">
          <div v-for="(count, browser) in splits.browsers" :key="browser" class="space-y-2">
            <div class="flex justify-between text-xs font-bold">
              <span>{{ browser }}</span>
              <span>{{ count }}</span>
            </div>
            <progress class="progress progress-secondary w-full h-2 rounded-full" :value="count" :max="stats.pageviews || 1"></progress>
          </div>
        </div>
      </div>

      <!-- Country / Geo Statistics -->
      <div class="card bg-white dark:bg-slate-900 border border-base-200 p-6 rounded-3xl shadow-xl">
        <h3 class="font-bold text-sm mb-4 uppercase tracking-widest opacity-60">Visitor Origins (Choropleth List)</h3>
        <div class="max-h-60 overflow-y-auto space-y-3">
          <div v-for="(count, country) in splits.countries" :key="country" class="flex justify-between items-center text-xs font-bold border-b border-slate-100 dark:border-slate-800 pb-2">
            <span class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-primary"></span>
              <span>{{ country }}</span>
            </span>
            <span>{{ count }} views</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Conversion Funnel Section -->
    <div class="card bg-white dark:bg-slate-900 border border-base-200 p-8 rounded-3xl shadow-xl">
      <h3 class="font-bold text-sm mb-6 uppercase tracking-widest opacity-60">Conversion Flow Funnel</h3>
      <div class="grid gap-4 md:grid-cols-3 text-center">
        <div class="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-base-200">
          <div class="text-[9px] opacity-40 font-bold uppercase tracking-wider">Step 1: Pageviews</div>
          <div class="text-3xl font-black mt-2">{{ funnel.pageviews }}</div>
          <div class="text-xs opacity-50 mt-1">100% of visits</div>
        </div>
        <div class="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-base-200">
          <div class="text-[9px] opacity-40 font-bold uppercase tracking-wider">Step 2: Checkout Starts</div>
          <div class="text-3xl font-black mt-2">{{ funnel.checkoutStarts }}</div>
          <div class="text-xs opacity-50 mt-1">{{ getPercentage(funnel.checkoutStarts, funnel.pageviews) }}% conversion</div>
        </div>
        <div class="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-base-200">
          <div class="text-[9px] opacity-40 font-bold uppercase tracking-wider">Step 3: Completed Purchases</div>
          <div class="text-3xl font-black mt-2 text-primary">{{ funnel.purchasesCompleted }}</div>
          <div class="text-xs opacity-50 mt-1">{{ getPercentage(funnel.purchasesCompleted, funnel.checkoutStarts) }}% checkout completion</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

const stats = ref({ pageviews: 0, sessions: 0, purchases: 0, revenue: 0 });
const splits = ref<{ devices: Record<string, number>; browsers: Record<string, number>; countries: Record<string, number> }>({
  devices: {},
  browsers: {},
  countries: {},
});
const funnel = ref({ pageviews: 0, checkoutStarts: 0, purchasesCompleted: 0 });

const getPercentage = (val: number, total: number) => {
  if (!total) return 0;
  return Math.round((val / total) * 100);
};

const fetchData = async () => {
  try {
    const res = await fetch("/api/analytics/dashboard");
    if (res.ok) {
      const data = await res.json();
      stats.value = data.stats;
      splits.value = data.splits;
      funnel.value = data.funnel;
    }
  } catch (err) {
    console.error("Failed to load dashboard metrics:", err);
  }
};

onMounted(fetchData);
</script>
