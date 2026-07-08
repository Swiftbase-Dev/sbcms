<template>
  <div class="space-y-8 animate-in fade-in duration-500">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <div>
        <div class="badge bg-primary text-white border-none font-bold uppercase tracking-widest text-[9px] px-3 py-1">CMS Site Content</div>
        <h1 class="text-4xl font-black tracking-tighter">Site Pages</h1>
      </div>
      <button @click="showCreateModal = true" class="btn btn-primary rounded-xl px-6 font-bold text-xs uppercase shadow-lg shadow-primary/20">+ Create Page</button>
    </div>

    <!-- Pages List / Loader -->
    <div v-if="loading" class="flex justify-center items-center py-20 bg-white dark:bg-slate-900 border border-base-200 rounded-3xl shadow-xl">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else class="card bg-white dark:bg-slate-900 border border-base-200 rounded-3xl shadow-xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table w-full">
          <thead>
            <tr class="border-b border-slate-100 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400">
              <th>Title</th>
              <th>Slug / URL</th>
              <th>Status</th>
              <th>Last Updated</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="pages.length === 0">
              <td colspan="5" class="text-center py-12 opacity-55 text-sm">
                No pages created yet. Click "+ Create Page" to get started.
              </td>
            </tr>
            <tr v-for="page in pages" :key="page.id" class="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <td>
                <div class="font-bold text-base">{{ page.title }}</div>
                <div class="text-xs opacity-50">{{ page.seoMetadata?.description || 'No description set' }}</div>
              </td>
              <td>
                <span class="font-mono text-xs p-1 px-2 bg-slate-100 dark:bg-slate-800 rounded-lg">/{{ page.slug }}</span>
              </td>
              <td>
                <div class="flex items-center gap-1.5">
                  <span v-if="page.isPublished" class="badge badge-success text-white font-bold text-xs">Published</span>
                  <span v-else class="badge badge-warning text-white font-bold text-xs">Draft</span>
                  <span v-if="page.isPublished && page.hasUnpublishedChanges" class="badge bg-amber-500 text-white font-bold text-[9px] uppercase tracking-wider px-1.5 py-0.5 border-none">Unpublished Changes</span>
                </div>
              </td>
              <td class="text-xs opacity-60">
                {{ page.updatedAt ? new Date(page.updatedAt).toLocaleString() : 'N/A' }}
              </td>
              <td>
                <div class="flex justify-end gap-2">
                  <router-link :to="'/pages/edit/' + page.id" class="btn btn-sm btn-outline rounded-lg font-bold text-xs">Edit</router-link>
                  <button @click="publishPage(page.id)" class="btn btn-sm btn-primary rounded-lg font-bold text-xs text-white gap-1" :disabled="publishingPageId === page.id">
                    <span v-if="publishingPageId === page.id" class="loading loading-spinner loading-xs"></span>
                    Publish
                  </button>
                  <button @click="confirmDelete(page)" class="btn btn-sm btn-ghost hover:bg-rose-500/10 text-rose-500 rounded-lg font-bold text-xs">Delete</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create Page Modal -->
    <div v-if="showCreateModal" class="modal modal-open">
      <div class="modal-box rounded-3xl border border-base-200 shadow-2xl bg-white dark:bg-slate-900">
        <h3 class="font-black text-2xl tracking-tight">Create New Page</h3>
        <p class="text-xs opacity-50 mb-6">Enter a title and clean URL slug for your page.</p>
        
        <form @submit.prevent="createPage" class="space-y-4">
          <div class="form-control">
            <label class="label font-bold text-xs uppercase text-slate-400">Page Title</label>
            <input type="text" v-model="newForm.title" placeholder="Home / About Us" class="input input-bordered rounded-xl w-full" required />
          </div>

          <div class="form-control">
            <label class="label font-bold text-xs uppercase text-slate-400">Slug</label>
            <input type="text" v-model="newForm.slug" placeholder="e.g. about" class="input input-bordered rounded-xl w-full font-mono text-sm" required />
          </div>

          <div class="modal-action">
            <button type="button" @click="showCreateModal = false" class="btn btn-ghost rounded-xl font-bold">Cancel</button>
            <button type="submit" class="btn btn-primary rounded-xl font-bold px-6 text-white gap-2" :disabled="submitting">
              <span v-if="submitting" class="loading loading-spinner loading-xs"></span>
              Create
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
import { ref, onMounted } from "vue";
import type { CMSPage } from "swiftbase-cms-shared";

const pages = ref<CMSPage[]>([]);
const showCreateModal = ref(false);
const loading = ref(true);
const submitting = ref(false);
const publishingPageId = ref("");
const newForm = ref({ title: "", slug: "" });

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

const fetchPages = async () => {
  try {
    const res = await fetch("/api/pages");
    if (res.ok) {
      pages.value = await res.json();
    }
  } catch (err) {
    console.error("Failed to load pages:", err);
  } finally {
    loading.value = false;
  }
};

const createPage = async () => {
  submitting.value = true;
  try {
    const res = await fetch("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newForm.value),
    });
    if (res.ok) {
      showCreateModal.value = false;
      newForm.value = { title: "", slug: "" };
      await fetchPages();
    }
  } catch (err) {
    console.error("Failed to create page:", err);
  } finally {
    submitting.value = false;
  }
};

const publishPage = async (id: string) => {
  publishingPageId.value = id;
  try {
    const res = await fetch(`/api/pages/${id}/publish`, { method: "POST" });
    if (res.ok) {
      showAlert("Success", "Page compiled & published successfully to Swiftbase Storage CDN!");
      await fetchPages();
    } else {
      const data = await res.json();
      showAlert("Publish Failed", data.message);
    }
  } catch (err: any) {
    console.error("Failed to publish page:", err);
    showAlert("Error", err.message);
  } finally {
    publishingPageId.value = "";
  }
};

const confirmDelete = async (page: CMSPage) => {
  showConfirm(
    "Delete Page",
    `Are you sure you want to delete the page "${page.title}"?`,
    async () => {
      loading.value = true;
      try {
        const res = await fetch(`/api/pages/${page.id}`, { method: "DELETE" });
        if (res.ok) {
          await fetchPages();
        }
      } catch (err) {
        console.error("Failed to delete page:", err);
      } finally {
        loading.value = false;
      }
    }
  );
};

onMounted(fetchPages);
</script>
