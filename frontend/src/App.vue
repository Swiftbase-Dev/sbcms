<template>
  <div class="drawer lg:drawer-open min-h-screen">
    <input id="admin-drawer" type="checkbox" class="drawer-toggle" />
    <div class="drawer-content flex flex-col w-full overflow-x-hidden">
      <!-- Navbar (Mobile header) -->
      <div class="w-full navbar bg-slate-900 text-white lg:hidden shadow-md px-4" v-if="!isDesignerRoute">
        <div class="flex-none">
          <label for="admin-drawer" class="btn btn-square btn-ghost flex items-center justify-center">
            <font-awesome-icon :icon="['fas', 'bars']" class="w-6 h-6 stroke-current" />
          </label>
        </div>
        <div class="flex-1 px-2 mx-2 text-xl font-black tracking-tighter">SBCMS Admin</div>
      </div>
      
      <!-- Main view container -->
      <main :class="['flex-1 bg-slate-50 dark:bg-slate-950 min-h-screen flex flex-col', isDesignerRoute ? 'p-0' : 'p-6']">
        <router-view></router-view>
      </main>
    </div> 
    
    <div class="drawer-side z-20 transition-all duration-300" :class="[isCollapsed ? 'w-20 !overflow-visible' : 'w-80']">
      <label for="admin-drawer" aria-label="close sidebar" class="drawer-overlay"></label> 
      <div class="menu bg-slate-900 text-white flex flex-col justify-between shadow-2xl min-h-screen transition-all duration-300" :class="[isCollapsed ? 'w-20 p-4 items-center !overflow-visible' : 'w-80 p-6']">
        <!-- Logo and Menu items -->
        <div class="w-full">
          <div class="flex items-center justify-between mb-8 px-2 transition-all duration-300" :class="[isCollapsed ? 'flex-col gap-4' : 'flex-row gap-3']">
            <div class="flex items-center gap-3" v-if="!isCollapsed">
              <div class="w-10 h-10 rounded-xl bg-primary flex items-center justify-center font-black text-xl text-white shadow-lg shrink-0">S</div>
              <div>
                <h1 class="text-xl font-black tracking-tighter">SBCMS</h1>
                <span class="text-[9px] opacity-40 font-bold uppercase tracking-wider">Developer Portal</span>
              </div>
            </div>
            <div class="w-10 h-10 rounded-xl bg-primary flex items-center justify-center font-black text-xl text-white shadow-lg shrink-0" v-else>S</div>
            
            <button @click="toggleCollapse" class="btn btn-ghost btn-circle btn-xs text-white/60 hover:text-white hover:bg-white/10 shrink-0 flex items-center justify-center">
              <font-awesome-icon v-if="!isCollapsed" :icon="['fas', 'angle-left']" class="w-4 h-4" />
              <font-awesome-icon v-else :icon="['fas', 'angle-right']" class="w-4 h-4" />
            </button>
          </div>
          
          <!-- Sidebar Search (Above Dashboard) -->
          <div class="mb-4 w-full px-2">
            <button
              @click="openSearchModal"
              class="flex items-center rounded-xl hover:bg-white/5 transition-all duration-300 text-left text-white"
              :class="[isCollapsed ? 'p-3 justify-center tooltip tooltip-right z-30 w-full h-11' : 'gap-4 p-3 text-sm font-bold w-full']"
              :data-tip="isCollapsed ? 'Search (⌘K)' : null"
            >
              <font-awesome-icon :icon="['fas', 'magnifying-glass']" class="h-5 w-5 text-current shrink-0" />
              <span v-if="!isCollapsed" class="flex-1">Search</span>
            </button>
          </div>

          <ul class="space-y-2 font-bold text-sm w-full">
            <li>
              <router-link to="/dashboard" class="flex items-center rounded-xl hover:bg-white/5 transition-all duration-300" :class="[isCollapsed ? 'p-3 justify-center tooltip tooltip-right z-30' : 'gap-4 p-3']" :data-tip="isCollapsed ? 'Dashboard' : null" active-class="!bg-primary !text-white shadow-lg shadow-primary/20">
                <font-awesome-icon :icon="['fas', 'house']" class="w-5 h-5 shrink-0" />
                <span v-if="!isCollapsed">Dashboard</span>
              </router-link>
            </li>
            <li>
              <router-link to="/pages" class="flex items-center rounded-xl hover:bg-white/5 transition-all duration-300" :class="[isCollapsed ? 'p-3 justify-center tooltip tooltip-right z-30' : 'gap-4 p-3']" :data-tip="isCollapsed ? 'Pages' : null" active-class="!bg-primary !text-white shadow-lg shadow-primary/20">
                <font-awesome-icon :icon="['fas', 'file-lines']" class="w-5 h-5 shrink-0" />
                <span v-if="!isCollapsed">Pages</span>
              </router-link>
            </li>
            <li>
              <router-link to="/gallery" class="flex items-center rounded-xl hover:bg-white/5 transition-all duration-300" :class="[isCollapsed ? 'p-3 justify-center tooltip tooltip-right z-30' : 'gap-4 p-3']" :data-tip="isCollapsed ? 'Gallery' : null" active-class="!bg-primary !text-white shadow-lg shadow-primary/20">
                <font-awesome-icon :icon="['fas', 'images']" class="w-5 h-5 shrink-0" />
                <span v-if="!isCollapsed">Gallery</span>
              </router-link>
            </li>
            <li>
              <router-link to="/blog" class="flex items-center rounded-xl hover:bg-white/5 transition-all duration-300" :class="[isCollapsed ? 'p-3 justify-center tooltip tooltip-right z-30' : 'gap-4 p-3']" :data-tip="isCollapsed ? 'Blog' : null" active-class="!bg-primary !text-white shadow-lg shadow-primary/20" v-if="settings.isBlogEnabled">
                <font-awesome-icon :icon="['fas', 'newspaper']" class="w-5 h-5 shrink-0" />
                <span v-if="!isCollapsed">Blog</span>
              </router-link>
            </li>
            <li>
              <router-link to="/store" class="flex items-center rounded-xl hover:bg-white/5 transition-all duration-300" :class="[isCollapsed ? 'p-3 justify-center tooltip tooltip-right z-30' : 'gap-4 p-3']" :data-tip="isCollapsed ? 'Store' : null" active-class="!bg-primary !text-white shadow-lg shadow-primary/20" v-if="settings.isStoreEnabled">
                <font-awesome-icon :icon="['fas', 'shop']" class="w-5 h-5 shrink-0" />
                <span v-if="!isCollapsed">Store</span>
              </router-link>
            </li>
            <li>
              <router-link to="/settings" class="flex items-center rounded-xl hover:bg-white/5 transition-all duration-300" :class="[isCollapsed ? 'p-3 justify-center tooltip tooltip-right z-30' : 'gap-4 p-3']" :data-tip="isCollapsed ? 'Settings' : null" active-class="!bg-primary !text-white shadow-lg shadow-primary/20">
                <font-awesome-icon :icon="['fas', 'gear']" class="w-5 h-5 shrink-0" />
                <span v-if="!isCollapsed">Settings</span>
              </router-link>
            </li>
          </ul>
        </div>
        
        <!-- Theme Cycle & User profile bottom alignment -->
        <div class="w-full flex flex-col gap-4 border-t border-white/5 pt-6 mt-6">
          <button @click="cycleTheme" class="btn btn-outline border-white/10 hover:bg-white/5 hover:text-white rounded-xl text-xs gap-3 w-full font-bold uppercase tracking-wider flex items-center justify-center" :class="[isCollapsed ? 'p-2 justify-center tooltip tooltip-right z-30' : '']" :data-tip="isCollapsed ? 'Theme: ' + activeTheme : ''">
            <font-awesome-icon :icon="['fas', 'circle-half-stroke']" class="w-4 h-4 shrink-0" />
            <span v-if="!isCollapsed">Theme: {{ activeTheme }}</span>
          </button>
          
          <div class="flex items-center gap-3 w-full p-2 rounded-xl bg-white/5 border border-white/5" v-if="!isCollapsed">
            <router-link to="/profile">
              <div class="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center font-bold shadow hover:ring-2 hover:ring-primary transition-all shrink-0">{{ profile.firstName ? profile.firstName[0] : 'A' }}</div>
            </router-link>
            <div class="flex-1 overflow-hidden">
              <h4 class="font-bold text-xs truncate">{{ profile.firstName }} {{ profile.lastName }}</h4>
              <span class="text-[9px] opacity-40 truncate block font-bold font-mono">{{ profile.email }}</span>
            </div>
            <button @click="handleLogout" class="btn btn-ghost btn-circle btn-xs text-rose-500 hover:bg-rose-500/10 shrink-0 flex items-center justify-center">
              <font-awesome-icon :icon="['fas', 'right-from-bracket']" class="w-4 h-4" />
            </button>
          </div>
          <div class="flex flex-col items-center gap-4 w-full" v-else>
            <router-link to="/profile" class="tooltip tooltip-right z-30" data-tip="View Profile">
              <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold shadow hover:ring-2 hover:ring-primary transition-all shrink-0">{{ profile.firstName ? profile.firstName[0] : 'A' }}</div>
            </router-link>
            <button @click="handleLogout" class="btn btn-ghost btn-circle btn-xs text-rose-500 hover:bg-rose-500/10 tooltip tooltip-right z-30 shrink-0 flex items-center justify-center" data-tip="Logout">
              <font-awesome-icon :icon="['fas', 'right-from-bracket']" class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Global Search Modal -->
    <div v-if="searchOpen" class="modal modal-open z-50">
      <div class="modal-box p-0 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 max-w-xl overflow-hidden flex flex-col h-[400px]">
        <!-- Search Input Bar -->
        <div class="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <font-awesome-icon :icon="['fas', 'magnifying-glass']" class="h-5 w-5 text-slate-400" />
          <input
            id="modal-search-input"
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            placeholder="Type pages, products, or blogs to search..."
            class="w-full bg-transparent border-none text-sm outline-none focus:ring-0 text-slate-900 dark:text-white"
            @input="handleSearchInput"
            @keydown.down.prevent="navigateResults(1)"
            @keydown.up.prevent="navigateResults(-1)"
            @keydown.enter.prevent="selectActiveResult"
            @keydown.esc.prevent="closeSearchModal"
          />
          <button @click="closeSearchModal" class="btn btn-xs btn-ghost btn-circle">✕</button>
        </div>

        <!-- Search Results List -->
        <div class="flex-1 overflow-y-auto p-4 space-y-1">
          <div v-if="searchLoading" class="flex items-center gap-2 py-8 justify-center text-xs opacity-50">
            <span class="loading loading-spinner loading-xs text-primary"></span> Searching database index...
          </div>
          <ul v-else-if="searchResults.length > 0" class="space-y-1">
            <li
              v-for="(item, idx) in searchResults"
              :key="item.record_id"
              @click="handleSearchResultClick(item)"
              class="flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-colors"
              :class="[idx === activeIndex ? 'bg-primary text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50']"
            >
              <span
                class="badge badge-xs text-[9px] uppercase tracking-tighter"
                :class="[idx === activeIndex ? 'bg-white text-primary border-none' : (item.type === 'page' ? 'badge-primary' : item.type === 'product' ? 'badge-secondary' : 'badge-accent')]"
              >
                {{ item.type }}
              </span>
              <span class="text-xs font-semibold truncate flex-1">{{ item.content }}</span>
            </li>
          </ul>
          <div v-else-if="searchQuery" class="py-8 text-center text-xs opacity-40 italic">
            No matching results found
          </div>
          <div v-else class="py-8 text-center text-xs opacity-40 italic">
            Start typing to query database...
          </div>
        </div>

        <!-- Modal Footer Shortcuts -->
        <div class="bg-slate-50 dark:bg-slate-950/40 p-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px] opacity-60 font-mono">
          <div class="flex gap-4">
            <span><kbd class="kbd kbd-xs">↑↓</kbd> Navigate</span>
            <span><kbd class="kbd kbd-xs">Enter</kbd> Select</span>
          </div>
          <div class="flex gap-4">
            <span><kbd class="kbd kbd-xs">ESC</kbd> Close</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue";
import { useRoute, useRouter } from "vue-router";

const router = useRouter();

const activeTheme = ref<"light" | "dark" | "auto">("auto");
const route = useRoute();
const isCollapsed = ref(localStorage.getItem("cms-sidebar-collapsed") === "true");

const isDesignerRoute = computed(() => {
  return route.path.includes("/pages/edit/") || route.path.includes("/settings/edit-");
});

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
  localStorage.setItem("cms-sidebar-collapsed", String(isCollapsed.value));
};

const cycleTheme = () => {
  if (activeTheme.value === "light") {
    setTheme("dark");
  } else if (activeTheme.value === "dark") {
    setTheme("auto");
  } else {
    setTheme("light");
  }
};
const settings = ref({
  isBlogEnabled: true,
  isStoreEnabled: true,
});
const profile = ref({
  firstName: "System",
  lastName: "Administrator",
  email: "admin@swiftbase.io",
});

const applyTheme = (theme: "light" | "dark" | "auto") => {
  const root = document.documentElement;
  let isDark = false;
  if (theme === "auto") {
    isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  } else {
    isDark = theme === "dark";
  }

  // Update DaisyUI attribute theme
  root.setAttribute("data-theme", isDark ? "dark" : "light");

  // Update Tailwind dark class override
  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
};

const setTheme = (theme: "light" | "dark" | "auto") => {
  activeTheme.value = theme;
  localStorage.setItem("cms-theme", theme);
  applyTheme(theme);
};

// Polling settings status
const fetchSettings = async () => {
  try {
    const res = await fetch("/api/settings");
    if (res.ok) {
      settings.value = await res.json();
    }
  } catch (err) {
    console.error("Failed to fetch settings:", err);
  }
};

const fetchProfile = async () => {
  try {
    const res = await fetch("/api/profile");
    if (res.ok) {
      profile.value = await res.json();
    }
  } catch (err) {
    console.error("Failed to fetch profile:", err);
  }
};

const handleLogout = async () => {
  if (confirm("Are you sure you want to sign out of SBCMS?")) {
    try {
      await fetch("/api/logout", { method: "POST" });
      window.location.reload();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  }
};

onMounted(() => {
  const saved = localStorage.getItem("cms-theme") as "light" | "dark" | "auto" | null;
  if (saved) activeTheme.value = saved;
  applyTheme(activeTheme.value);

  // Sync auto theme dynamically
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (activeTheme.value === "auto") applyTheme("auto");
  });

  fetchSettings();
  fetchProfile();

  // Listen for Cmd+K / Ctrl+K to open search modal, and Esc to close
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      openSearchModal();
    } else if (e.key === "Escape" && searchOpen.value) {
      e.preventDefault();
      closeSearchModal();
    }
  });
});

// Watch settings updates when moving routes
watch(() => route.path, () => {
  fetchSettings();
  fetchProfile();
});

// Global Search state and actions
const searchOpen = ref(false);
const searchQuery = ref("");
const searchResults = ref<any[]>([]);
const searchLoading = ref(false);
const activeIndex = ref(-1);
const searchInputRef = ref<HTMLInputElement | null>(null);

const openSearchModal = () => {
  searchOpen.value = true;
  activeIndex.value = -1;
  searchQuery.value = "";
  searchResults.value = [];
  setTimeout(() => {
    const input = document.getElementById("modal-search-input") || searchInputRef.value;
    if (input) input.focus();
  }, 100);
};

const closeSearchModal = () => {
  searchOpen.value = false;
  searchQuery.value = "";
  searchResults.value = [];
  activeIndex.value = -1;
};

const performSearch = async () => {
  if (!searchQuery.value) {
    searchResults.value = [];
    activeIndex.value = -1;
    return;
  }
  searchLoading.value = true;
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.value)}`);
    if (res.ok) {
      const data = await res.json();
      searchResults.value = data.results || [];
      activeIndex.value = searchResults.value.length > 0 ? 0 : -1;
    }
  } catch (err) {
    console.error("Search failed", err);
  } finally {
    searchLoading.value = false;
  }
};

let searchTimeout: any = null;
const handleSearchInput = () => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    performSearch();
  }, 300);
};

const navigateResults = (direction: number) => {
  if (searchResults.value.length === 0) return;
  let nextIndex = activeIndex.value + direction;
  if (nextIndex < 0) {
    nextIndex = searchResults.value.length - 1;
  } else if (nextIndex >= searchResults.value.length) {
    nextIndex = 0;
  }
  activeIndex.value = nextIndex;
};

const selectActiveResult = () => {
  if (activeIndex.value >= 0 && activeIndex.value < searchResults.value.length) {
    handleSearchResultClick(searchResults.value[activeIndex.value]);
  }
};

const handleSearchResultClick = (item: any) => {
  closeSearchModal();
  // Route to the corresponding resource view
  if (item.type === "page") {
    router.push("/pages");
  } else if (item.type === "blog") {
    router.push("/blog");
  } else if (item.type === "product") {
    router.push("/store");
  }
};
</script>
