<template>
  <div class="space-y-8 animate-in fade-in duration-500">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <div>
        <div class="badge bg-primary text-white border-none font-bold uppercase tracking-widest text-[9px] px-3 py-1">CMS E-Commerce</div>
        <h1 class="text-4xl font-black tracking-tighter">Product Catalog</h1>
      </div>
      <button @click="openCreateModal" class="btn btn-primary rounded-xl px-6 font-bold text-xs uppercase shadow-lg shadow-primary/20">+ Add Product</button>
    </div>

    <!-- Loader / Products Grid -->
    <div v-if="loading" class="flex justify-center items-center py-20 bg-white dark:bg-slate-900 border border-base-200 rounded-3xl shadow-xl">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <div v-if="products.length === 0" class="col-span-full card bg-white dark:bg-slate-900 border border-base-200 p-12 text-center rounded-3xl shadow-xl">
        <p class="opacity-55 text-sm">No products added yet. Click "+ Add Product" to construct your catalog.</p>
      </div>

      <div v-for="product in products" :key="product.id" class="card bg-white dark:bg-slate-900 border border-base-200 rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300 flex flex-col justify-between">
        <div class="relative h-48 bg-slate-100 dark:bg-slate-800 shrink-0">
          <img v-if="product.images && product.images.length > 0" :src="product.images[0]" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full flex items-center justify-center text-slate-400 font-bold text-sm">No Product Image</div>
        </div>

        <div class="p-6 flex-1 flex flex-col justify-between gap-4">
          <div>
            <div class="flex justify-between items-start gap-2">
              <h2 class="font-black text-xl tracking-tight line-clamp-1">{{ product.name }}</h2>
              <span class="text-lg font-black text-primary">${{ (product.priceCents / 100).toFixed(2) }}</span>
            </div>
            <p class="font-mono text-[9px] opacity-40 mt-1">/store/{{ product.slug }}</p>
            <p class="text-xs opacity-60 mt-3 line-clamp-3">{{ product.description || 'No description provided.' }}</p>
            
            <!-- Affiliate links listing if present -->
            <div v-if="product.affiliateLinks && product.affiliateLinks.length > 0" class="mt-4 space-y-1">
              <span class="text-[9px] font-bold uppercase tracking-wider opacity-40">Affiliate Outlets</span>
              <div class="flex flex-wrap gap-1">
                <span v-for="(link, i) in product.affiliateLinks" :key="i" class="badge badge-outline border-slate-300 dark:border-slate-800 text-[10px] py-2">
                  {{ link.sellerName }}: ${{ (link.priceCents / 100).toFixed(2) }}
                </span>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
            <span class="text-[9px] opacity-50 font-bold uppercase tracking-widest font-mono">
              {{ product.stripeProductId ? 'Linked Stripe' : 'Mock Checkout' }}
            </span>
            <div class="flex gap-1">
              <button @click="openEditModal(product)" class="btn btn-xs btn-outline rounded-lg font-bold">Edit</button>
              <button @click="deleteProduct(product.id)" class="btn btn-xs btn-ghost hover:bg-rose-500/10 text-rose-500 font-bold rounded-lg">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Product Modal -->
    <div v-if="showProductModal" class="modal modal-open">
      <div class="modal-box rounded-3xl border border-base-200 shadow-2xl bg-white dark:bg-slate-900 max-w-xl">
        <h3 class="font-black text-2xl tracking-tight">{{ editingId ? 'Edit Product' : 'Add Product' }}</h3>
        <p class="text-xs opacity-50 mb-6">Setup product detail pages, pricing tiers, Stripe hooks, and affiliate listings.</p>
        
        <form @submit.prevent="saveProduct" class="space-y-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="form-control">
              <label class="label font-bold text-xs uppercase text-slate-400">Product Name</label>
              <input type="text" v-model="form.name" placeholder="e.g. Standard Subscription" class="input input-bordered rounded-xl w-full" required />
            </div>

            <div class="form-control">
              <label class="label font-bold text-xs uppercase text-slate-400">Slug</label>
              <input type="text" v-model="form.slug" placeholder="e.g. premium-tier" class="input input-bordered rounded-xl w-full font-mono text-sm" required />
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="form-control">
              <label class="label font-bold text-xs uppercase text-slate-400">Price (USD)</label>
              <input type="number" step="0.01" v-model="form.price" placeholder="9.99" class="input input-bordered rounded-xl w-full" required />
            </div>

            <div class="form-control">
              <label class="label font-bold text-xs uppercase text-slate-400">Image URL</label>
              <input type="text" v-model="form.imageUrl" placeholder="https://image-link.com/prod.jpg" class="input input-bordered rounded-xl w-full text-xs" />
            </div>
          </div>

          <div class="form-control">
            <label class="label font-bold text-xs uppercase text-slate-400">Description</label>
            <textarea v-model="form.description" placeholder="Write full product summary description here..." class="textarea textarea-bordered rounded-xl w-full h-20 text-sm"></textarea>
          </div>

          <!-- Affiliate Outlets Section -->
          <div class="border-t border-base-200 pt-4 mt-4">
            <div class="flex justify-between items-center mb-2">
              <span class="text-xs font-bold uppercase tracking-widest opacity-60">Affiliate Stores</span>
              <button type="button" @click="addAffiliateRow" class="btn btn-xs btn-outline rounded-lg font-bold">+ Add Seller</button>
            </div>
            
            <div class="space-y-2 max-h-40 overflow-y-auto">
              <div v-for="(aff, idx) in form.affiliates" :key="idx" class="flex gap-2 items-center">
                <input type="text" placeholder="Seller Name" v-model="aff.sellerName" class="input input-bordered input-sm rounded-lg w-1/3 text-xs" required />
                <input type="text" placeholder="URL" v-model="aff.url" class="input input-bordered input-sm rounded-lg w-1/3 text-xs" required />
                <input type="number" step="0.01" placeholder="Price" v-model="aff.price" class="input input-bordered input-sm rounded-lg w-1/4 text-xs" required />
                <button type="button" @click="removeAffiliateRow(idx)" class="btn btn-xs btn-circle btn-ghost text-rose-500 font-bold">×</button>
              </div>
            </div>
          </div>

          <div class="modal-action">
            <button type="button" @click="showProductModal = false" class="btn btn-ghost rounded-xl font-bold">Cancel</button>
            <button type="submit" class="btn btn-primary rounded-xl font-bold px-6 text-white gap-2" :disabled="submitting">
              <span v-if="submitting" class="loading loading-spinner loading-xs"></span>
              Save Product
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
import type { CMSProduct, AffiliateLink } from "swiftbase-cms-shared";

const products = ref<CMSProduct[]>([]);
const showProductModal = ref(false);
const loading = ref(true);
const submitting = ref(false);
const editingId = ref<string | null>(null);

const form = ref({
  name: "",
  slug: "",
  price: 0,
  imageUrl: "",
  description: "",
  affiliates: [] as { sellerName: string; url: string; price: number }[],
});

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

const fetchProducts = async () => {
  try {
    const res = await fetch("/api/products");
    if (res.ok) {
      products.value = await res.json();
    }
  } catch (err) {
    console.error("Failed to load products list:", err);
  } finally {
    loading.value = false;
  }
};

const openCreateModal = () => {
  editingId.value = null;
  form.value = {
    name: "",
    slug: "",
    price: 0,
    imageUrl: "",
    description: "",
    affiliates: [],
  };
  showProductModal.value = true;
};

const openEditModal = (product: CMSProduct) => {
  editingId.value = product.id;
  form.value = {
    name: product.name,
    slug: product.slug,
    price: product.priceCents / 100,
    imageUrl: product.images?.[0] || "",
    description: product.description || "",
    affiliates: (product.affiliateLinks || []).map((l) => ({
      sellerName: l.sellerName,
      url: l.url,
      price: l.priceCents / 100,
    })),
  };
  showProductModal.value = true;
};

const addAffiliateRow = () => {
  form.value.affiliates.push({ sellerName: "", url: "", price: 0 });
};

const removeAffiliateRow = (index: number) => {
  form.value.affiliates.splice(index, 1);
};

const saveProduct = async () => {
  submitting.value = true;
  try {
    const affiliateLinks: AffiliateLink[] = form.value.affiliates.map((a) => ({
      sellerName: a.sellerName,
      url: a.url,
      priceCents: Math.round(a.price * 100),
    }));

    const payload: Partial<CMSProduct> = {
      name: form.value.name,
      slug: form.value.slug,
      priceCents: Math.round(form.value.price * 100),
      description: form.value.description,
      images: form.value.imageUrl ? [form.value.imageUrl] : [],
      affiliateLinks,
    };

    const url = editingId.value ? `/api/products/${editingId.value}` : "/api/products";
    const method = editingId.value ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      showProductModal.value = false;
      await fetchProducts();
    }
  } catch (err) {
    console.error("Failed to save product:", err);
  } finally {
    submitting.value = false;
  }
};

const deleteProduct = async (id: string) => {
  showConfirm(
    "Delete Product",
    "Are you sure you want to delete this product?",
    async () => {
      loading.value = true;
      try {
        const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
        if (res.ok) {
          await fetchProducts();
        }
      } catch (err) {
        console.error("Failed to delete product:", err);
      } finally {
        loading.value = false;
      }
    }
  );
};

onMounted(fetchProducts);
</script>
