<template>
  <div class="space-y-8 animate-in fade-in duration-500">
    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <div class="badge bg-secondary text-white border-none font-bold uppercase tracking-widest text-[9px] px-3 py-1">CMS Blog Engine</div>
        <h1 class="text-4xl font-black tracking-tighter">Blog Posts</h1>
      </div>
      
      <div class="flex items-center gap-3">
        <!-- View Toggle -->
        <div class="join border border-base-200 bg-white dark:bg-slate-900 rounded-xl overflow-hidden p-0.5 shadow-sm">
          <button @click="viewMode = 'card'" :class="['join-item btn btn-xs border-none font-bold text-[10px] uppercase rounded-lg px-3 py-1.5 h-auto min-h-0', viewMode === 'card' ? 'btn-secondary text-white shadow-sm' : 'btn-ghost']">
            Cards
          </button>
          <button @click="viewMode = 'list'" :class="['join-item btn btn-xs border-none font-bold text-[10px] uppercase rounded-lg px-3 py-1.5 h-auto min-h-0', viewMode === 'list' ? 'btn-secondary text-white shadow-sm' : 'btn-ghost']">
            List
          </button>
        </div>

        <button @click="showCreateModal = true" class="btn btn-sm btn-secondary text-white rounded-xl px-4 font-bold text-xs uppercase shadow-lg shadow-secondary/20">+ Write Article</button>
      </div>
    </div>

    <!-- Loader -->
    <div v-if="loading" class="flex justify-center items-center py-20 bg-white dark:bg-slate-900 border border-base-200 rounded-3xl shadow-xl">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- Empty State -->
    <div v-else-if="posts.length === 0" class="card bg-white dark:bg-slate-900 border border-base-200 p-12 text-center rounded-3xl shadow-xl">
      <p class="opacity-55 text-sm">No articles written yet. Click "+ Write Article" to draft your first post.</p>
    </div>

    <!-- Card View -->
    <div v-else-if="viewMode === 'card'" class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <div v-for="post in sortedPosts" :key="post.id" class="card bg-white dark:bg-slate-900 border border-base-200 rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300 flex flex-col justify-between">
        <!-- Feature image if set -->
        <div class="relative h-48 bg-slate-100 dark:bg-slate-800 shrink-0">
          <img v-if="post.featureImage" :src="post.featureImage" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full flex items-center justify-center text-slate-400 font-bold text-sm">No Feature Image</div>
          <div class="absolute top-4 right-4 flex flex-col items-end gap-1.5">
            <span :class="['badge border-none font-bold text-xs px-3 py-1 shadow-md text-white', post.status === 'published' ? 'badge-success' : 'badge-warning']">
              {{ post.status === 'published' ? 'Published' : 'Draft' }}
            </span>
            <span v-if="post.hasUnpublishedChanges" class="badge badge-info border-none font-bold text-[9px] px-2.5 py-1 shadow-md text-white uppercase tracking-wider">
              Unpublished Changes
            </span>
          </div>
        </div>

        <!-- Description -->
        <div class="p-6 flex-1 flex flex-col justify-between gap-4">
          <div>
            <h2 class="font-black text-xl tracking-tight line-clamp-2">{{ post.title }}</h2>
            <p class="font-mono text-[10px] opacity-40 mt-1">/blog/{{ post.slug }}</p>
            <p class="text-xs opacity-60 mt-3 line-clamp-3">{{ post.excerpt || 'No excerpt provided.' }}</p>
          </div>

          <div class="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
            <span class="text-[10px] opacity-50 font-bold">{{ post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : 'Draft' }}</span>
            <div class="flex gap-1">
              <router-link :to="'/blog/edit/' + post.id" class="btn btn-xs btn-outline rounded-lg font-bold">Edit</router-link>
              <button v-if="post.status !== 'published'" @click="publishPost(post)" class="btn btn-xs btn-secondary text-white font-bold rounded-lg gap-1" :disabled="publishingId === post.id">
                <span v-if="publishingId === post.id" class="loading loading-spinner loading-[10px]"></span>
                Publish
              </button>
              <template v-else>
                <button v-if="post.hasUnpublishedChanges" @click="publishPost(post)" class="btn btn-xs btn-secondary text-white font-bold rounded-lg gap-1" :disabled="publishingId === post.id">
                  <span v-if="publishingId === post.id" class="loading loading-spinner loading-[10px]"></span>
                  Publish Changes
                </button>
                <button @click="unpublishPost(post)" class="btn btn-xs btn-outline btn-warning font-bold rounded-lg gap-1" :disabled="publishingId === post.id">
                  <span v-if="publishingId === post.id" class="loading loading-spinner loading-[10px]"></span>
                  Un-publish
                </button>
              </template>
              <button @click="confirmDelete(post.id)" class="btn btn-xs btn-ghost hover:bg-rose-500/10 text-rose-500 font-bold rounded-lg">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- List View -->
    <div v-else-if="viewMode === 'list'" class="overflow-x-auto bg-white dark:bg-slate-900 border border-base-200 rounded-3xl shadow-xl p-4">
      <table class="table w-full">
        <thead>
          <tr class="border-b border-base-200">
            <th @click="toggleSort('title')" class="cursor-pointer select-none font-bold text-xs uppercase text-slate-400">
              Title <span v-if="sortBy === 'title'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
            </th>
            <th @click="toggleSort('slug')" class="cursor-pointer select-none font-bold text-xs uppercase text-slate-400">
              Slug <span v-if="sortBy === 'slug'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
            </th>
            <th @click="toggleSort('publishedAt')" class="cursor-pointer select-none font-bold text-xs uppercase text-slate-400">
              Published At <span v-if="sortBy === 'publishedAt'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
            </th>
            <th @click="toggleSort('status')" class="cursor-pointer select-none font-bold text-xs uppercase text-slate-400">
              Status <span v-if="sortBy === 'status'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
            </th>
            <th class="text-right font-bold text-xs uppercase text-slate-400">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="post in sortedPosts" :key="post.id" class="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-base-100">
            <td class="font-bold text-slate-800 dark:text-slate-200 max-w-xs truncate">{{ post.title }}</td>
            <td class="font-mono text-xs opacity-60">/blog/{{ post.slug }}</td>
            <td class="text-xs">{{ post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : 'Draft' }}</td>
            <td>
              <div class="flex flex-col gap-1 items-start">
                <span :class="['badge border-none font-bold text-xs px-3 py-1 text-white shadow-sm', post.status === 'published' ? 'badge-success' : 'badge-warning']">
                  {{ post.status === 'published' ? 'Published' : 'Draft' }}
                </span>
                <span v-if="post.hasUnpublishedChanges" class="badge badge-info border-none font-bold text-[8px] px-1.5 py-0.5 text-white uppercase tracking-wider">
                  Unpublished Changes
                </span>
              </div>
            </td>
            <td class="text-right">
              <div class="flex justify-end gap-1">
                <router-link :to="'/blog/edit/' + post.id" class="btn btn-xs btn-outline rounded-lg font-bold">Edit</router-link>
                <button v-if="post.status !== 'published'" @click="publishPost(post)" class="btn btn-xs btn-secondary text-white font-bold rounded-lg" :disabled="publishingId === post.id">
                  Publish
                </button>
                <template v-else>
                  <button v-if="post.hasUnpublishedChanges" @click="publishPost(post)" class="btn btn-xs btn-secondary text-white font-bold rounded-lg" :disabled="publishingId === post.id">
                    Publish Changes
                  </button>
                  <button @click="unpublishPost(post)" class="btn btn-xs btn-outline btn-warning font-bold rounded-lg" :disabled="publishingId === post.id">
                    Un-publish
                  </button>
                </template>
                <button @click="confirmDelete(post.id)" class="btn btn-xs btn-ghost hover:bg-rose-500/10 text-rose-500 font-bold rounded-lg">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create Post Modal -->
    <div v-if="showCreateModal" class="modal modal-open">
      <div class="modal-box rounded-3xl border border-base-200 shadow-2xl bg-white dark:bg-slate-900">
        <h3 class="font-black text-2xl tracking-tight">Write New Article</h3>
        <p class="text-xs opacity-50 mb-6">Give your article a title. You can customize the URL slug and content next.</p>
        
        <form @submit.prevent="createPost" class="space-y-4">
          <div class="form-control">
            <label class="label font-bold text-xs uppercase text-slate-400">Article Title</label>
            <input type="text" v-model="newForm.title" placeholder="e.g. 10 Tips for Blazing Fast Apps" class="input input-bordered rounded-xl w-full" required />
          </div>

          <div class="modal-action">
            <button type="button" @click="showCreateModal = false" class="btn btn-ghost rounded-xl font-bold">Cancel</button>
            <button type="submit" class="btn btn-secondary rounded-xl font-bold px-6 text-white gap-2" :disabled="submitting">
              <span v-if="submitting" class="loading loading-spinner loading-xs"></span>
              Create Draft
            </button>
          </div>
        </form>
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
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import type { CMSPost } from "swiftbase-cms-shared";
import { cachedFetch } from "../utils/api";

const router = useRouter();
const posts = ref<CMSPost[]>([]);
const showCreateModal = ref(false);
const loading = ref(true);
const submitting = ref(false);
const publishingId = ref("");
const newForm = ref({ title: "" });
const authorName = ref("Admin");

const fetchUserProfile = async () => {
  try {
    const res = await fetch("/api/profile");
    if (res.ok) {
      const profile = await res.json();
      if (profile.firstName || profile.lastName) {
        authorName.value = `${profile.firstName || ""} ${profile.lastName || ""}`.trim();
      }
    }
  } catch (err) {
    console.error("Failed to load user profile in Blog.vue:", err);
  }
};

// View options
const viewMode = ref<"card" | "list">("card");
const sortBy = ref<string>("publishedAt");
const sortOrder = ref<"desc" | "asc">("desc");

const modal = ref({
  show: false,
  title: "",
  message: "",
  type: "alert" as "alert" | "confirm",
  onConfirm: null as (() => void) | null,
});

const showConfirm = (title: string, message: string, onConfirm: () => void) => {
  modal.value = { show: true, title, message, type: "confirm", onConfirm };
};

const fetchPosts = async (forceRefresh = false) => {
  try {
    posts.value = await cachedFetch("/api/posts", undefined, forceRefresh);
  } catch (err) {
    console.error("Failed to load blog posts:", err);
  } finally {
    loading.value = false;
  }
};

const createPost = async () => {
  submitting.value = true;
  try {
    const data = await cachedFetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newForm.value,
        author: authorName.value
      }),
    });
    showCreateModal.value = false;
    router.push(`/blog/edit/${data.id}`);
  } catch (err) {
    console.error("Failed to create blog post draft:", err);
  } finally {
    submitting.value = false;
  }
};

const publishPost = async (post: CMSPost) => {
  publishingId.value = post.id;
  try {
    await cachedFetch(`/api/posts/${post.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "published" }),
    });
    await fetchPosts(true); // Force refetch/cache invalidate on GET posts list
  } catch (err) {
    console.error("Failed to publish blog post:", err);
  } finally {
    publishingId.value = "";
  }
};

const unpublishPost = async (post: CMSPost) => {
  publishingId.value = post.id;
  try {
    await cachedFetch(`/api/posts/${post.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "draft", unpublish: true }),
    });
    await fetchPosts(true);
  } catch (err) {
    console.error("Failed to un-publish blog post:", err);
  } finally {
    publishingId.value = "";
  }
};

const confirmDelete = async (id: string) => {
  showConfirm(
    "Delete Article",
    "Are you sure you want to delete this blog post?",
    async () => {
      loading.value = true;
      try {
        await cachedFetch(`/api/posts/${id}`, { method: "DELETE" });
        await fetchPosts(true);
      } catch (err) {
        console.error("Failed to delete post:", err);
      } finally {
        loading.value = false;
      }
    }
  );
};

// Sorting actions
const toggleSort = (field: string) => {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
  } else {
    sortBy.value = field;
    sortOrder.value = "desc";
  }
};

const sortedPosts = computed(() => {
  return [...posts.value].sort((a, b) => {
    let valA: any = a[sortBy.value as keyof CMSPost];
    let valB: any = b[sortBy.value as keyof CMSPost];

    if (valA === undefined || valA === null) valA = "";
    if (valB === undefined || valB === null) valB = "";

    if (typeof valA === "string" && typeof valB === "string") {
      return sortOrder.value === "asc"
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    } else {
      return sortOrder.value === "asc"
        ? (valA > valB ? 1 : -1)
        : (valB > valA ? 1 : -1);
    }
  });
});

onMounted(() => {
  fetchPosts();
  fetchUserProfile();
});
</script>
