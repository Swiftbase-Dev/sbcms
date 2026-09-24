<template>
  <div class="space-y-8 animate-in fade-in duration-500">
    <!-- Header & Tabs -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-base-200 pb-4">
      <div>
        <div class="badge bg-primary text-white border-none font-bold uppercase tracking-widest text-[9px] px-3 py-1">CMS E-Commerce</div>
        <h1 class="text-4xl font-black tracking-tighter">{{ storeTab === 'products' ? 'Product Catalog' : 'Orders & Shipments' }}</h1>
      </div>
      
      <!-- Top Level Tabs -->
      <div class="flex items-center gap-2">
        <button 
          type="button" 
          @click="storeTab = 'products'" 
          :class="['btn btn-sm rounded-xl font-bold uppercase text-xs tracking-wider transition-all', storeTab === 'products' ? 'btn-primary text-white shadow-md' : 'btn-ghost']"
        >
          <font-awesome-icon :icon="['fas', 'boxes-stacked']" class="w-3.5 h-3.5 mr-1" />
          Products
        </button>
        <button 
          type="button" 
          @click="storeTab = 'orders'" 
          :class="['btn btn-sm rounded-xl font-bold uppercase text-xs tracking-wider transition-all relative', storeTab === 'orders' ? 'btn-primary text-white shadow-md' : 'btn-ghost']"
        >
          <font-awesome-icon :icon="['fas', 'truck-fast']" class="w-3.5 h-3.5 mr-1" />
          Orders
          <span v-if="unfulfilledOrdersCount > 0" class="badge badge-xs badge-warning ml-1 text-[10px] font-black font-mono">
            {{ unfulfilledOrdersCount }}
          </span>
        </button>
      </div>

      <!-- Products Controls (Visible on Products Tab) -->
      <div v-if="storeTab === 'products'" class="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
        <!-- Card/List View Toggle -->
        <div class="join border border-base-300 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs bg-white dark:bg-slate-900">
          <button 
            type="button"
            @click="viewMode = 'card'" 
            :class="['join-item btn btn-xs px-3 py-1.5 h-auto min-h-0 gap-1.5 transition-all', viewMode === 'card' ? 'btn-primary text-white' : 'btn-ghost']"
            title="Card View"
          >
            <font-awesome-icon :icon="['fas', 'table-cells-large']" class="w-3 h-3" />
            <span class="text-[11px] font-bold">Cards</span>
          </button>
          <button 
            type="button"
            @click="viewMode = 'list'" 
            :class="['join-item btn btn-xs px-3 py-1.5 h-auto min-h-0 gap-1.5 transition-all', viewMode === 'list' ? 'btn-primary text-white' : 'btn-ghost']"
            title="List View"
          >
            <font-awesome-icon :icon="['fas', 'list']" class="w-3 h-3" />
            <span class="text-[11px] font-bold">List</span>
          </button>
        </div>

        <button @click="openCreateModal" class="btn btn-primary rounded-xl px-6 font-bold text-xs uppercase shadow-lg shadow-primary/20">+ Add Product</button>
      </div>

      <!-- Orders Refresh Control (Visible on Orders Tab) -->
      <div v-else class="flex items-center gap-2">
        <button @click="fetchOrders" :disabled="loadingOrders" class="btn btn-sm btn-outline rounded-xl font-bold text-xs uppercase gap-1">
          <span v-if="loadingOrders" class="loading loading-spinner loading-xs"></span>
          <font-awesome-icon v-else :icon="['fas', 'rotate']" class="w-3 h-3" />
          Refresh Orders
        </button>
      </div>
    </div>

    <!-- PRODUCTS TAB CONTENT -->
    <div v-show="storeTab === 'products'" class="space-y-8">

    <!-- Loader / Products Grid -->
    <div v-if="loading" class="flex justify-center items-center py-20 bg-white dark:bg-slate-900 border border-base-200 rounded-3xl shadow-xl">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else-if="viewMode === 'card'" class="space-y-6">
      <div v-if="products.length === 0" class="card bg-white dark:bg-slate-900 border border-base-200 p-12 text-center rounded-3xl shadow-xl">
        <p class="opacity-55 text-sm">No products added yet. Click "+ Add Product" to construct your catalog.</p>
      </div>

      <div v-else class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div v-for="product in paginatedProducts" :key="product.id" class="card bg-white dark:bg-slate-900 border border-base-200 rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300 flex flex-col justify-between">
          <div class="relative h-48 bg-slate-100 dark:bg-slate-800 shrink-0">
            <img v-if="product.images && product.images.length > 0" :src="product.images[0]" class="w-full h-full object-cover" />
            <div v-else class="w-full h-full flex items-center justify-center text-slate-400 font-bold text-sm">No Product Image</div>
            <span v-if="product.category" class="absolute top-3 left-3 badge badge-sm bg-black/60 text-white border-none font-bold backdrop-blur-xs">
              {{ product.category }}
            </span>
            <span :class="['absolute top-3 right-3 badge badge-sm font-bold border-none text-white', product.inStock !== false ? 'bg-emerald-500' : 'bg-rose-500']">
              {{ product.inStock !== false ? 'In Stock' : 'Out of Stock' }}
            </span>
          </div>

          <div class="p-6 flex-1 flex flex-col justify-between gap-4">
            <div>
              <div class="flex justify-between items-start gap-2">
                <h2 class="font-black text-xl tracking-tight line-clamp-1" :title="product.name">{{ product.name }}</h2>
                <span class="text-lg font-black text-primary">${{ (product.priceCents / 100).toFixed(2) }}</span>
              </div>
              <div class="flex items-center gap-2 mt-1">
                <p class="font-mono text-[9px] opacity-40">/store/{{ product.slug }}</p>
                <span v-if="product.sku" class="text-[9px] opacity-40 font-mono">| SKU: {{ product.sku }}</span>
              </div>
              <div class="text-xs opacity-60 mt-3 line-clamp-3 prose prose-xs" v-html="product.description || 'No description provided.'"></div>
              
              <!-- Affiliate links listing if present -->
              <div v-if="product.affiliateLinks && product.affiliateLinks.length > 0" class="mt-4 space-y-1">
                <span class="text-[9px] font-bold uppercase tracking-wider opacity-40">Affiliate Outlets</span>
                <div class="flex flex-wrap gap-1">
                  <span v-for="(link, i) in product.affiliateLinks" :key="i" class="badge badge-outline border-slate-300 dark:border-slate-800 text-[10px] py-2">
                    {{ link.sellerName }}: ${{ (link.priceCents / 100).toFixed(2) }}
                  </span>
                </div>
              </div>

              <!-- Features badges -->
              <div class="flex flex-wrap gap-1 mt-3">
                <span v-if="product.isPhysical === false" class="badge badge-xs badge-info text-white font-bold">Virtual</span>
                <span v-if="product.customOrderFields && product.customOrderFields.length > 0" class="badge badge-xs badge-neutral font-bold">
                  {{ product.customOrderFields.length }} Custom Fields
                </span>
                <span v-if="product.addOnProductIds && product.addOnProductIds.length > 0" class="badge badge-xs badge-ghost font-bold">
                  {{ product.addOnProductIds.length }} Add-ons
                </span>
              </div>
            </div>

            <div class="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
              <span class="text-[9px] opacity-50 font-bold uppercase tracking-widest font-mono">
                {{ product.stripeProductId ? 'Linked Stripe' : 'Local Catalog' }}
              </span>
              <div class="flex items-center gap-1">
                <button @click="duplicateProduct(product)" class="btn btn-xs btn-ghost text-slate-500 hover:text-primary font-bold rounded-lg" title="Duplicate product">
                  <font-awesome-icon :icon="['fas', 'copy']" class="w-3 h-3" />
                  <span class="hidden sm:inline">Duplicate</span>
                </button>
                <button @click="openEditModal(product)" class="btn btn-xs btn-outline rounded-lg font-bold">Edit</button>
                <button @click="deleteProduct(product.id)" class="btn btn-xs btn-ghost hover:bg-rose-500/10 text-rose-500 font-bold rounded-lg">Delete</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Card View Pagination Controls & Page Size Dropdown -->
      <div v-if="products.length > 0" class="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 card bg-white dark:bg-slate-900 border border-base-200 rounded-3xl shadow-sm">
        <div class="flex items-center gap-2 text-xs text-slate-500 font-bold">
          <span>Show</span>
          <select v-model="itemsPerPage" class="select select-xs select-bordered rounded-lg text-xs font-bold focus:outline-none">
            <option :value="9">9 per page</option>
            <option :value="18">18 per page</option>
            <option :value="36">36 per page</option>
            <option :value="72">72 per page</option>
            <option :value="10000">All products</option>
          </select>
          <span class="opacity-60 text-[11px]">({{ sortedProducts.length }} total)</span>
        </div>

        <div v-if="totalPages > 1" class="flex items-center gap-3">
          <button :disabled="currentPage === 1" @click="currentPage--" class="btn btn-sm btn-outline rounded-xl px-4 font-bold text-xs uppercase">Prev</button>
          <span class="text-xs font-bold text-slate-500">Page {{ currentPage }} of {{ totalPages }}</span>
          <button :disabled="currentPage === totalPages" @click="currentPage++" class="btn btn-sm btn-outline rounded-xl px-4 font-bold text-xs uppercase">Next</button>
        </div>
      </div>
    </div>

    <!-- List View -->
    <div v-else class="card bg-white dark:bg-slate-900 border border-base-200 rounded-3xl shadow-xl overflow-hidden">
      <div v-if="products.length === 0" class="p-12 text-center">
        <p class="opacity-55 text-sm">No products added yet. Click "+ Add Product" to construct your catalog.</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="table w-full text-xs">
          <thead>
            <tr class="border-b border-base-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
              <th class="w-16">Image</th>
              <th @click="toggleSort('name')" class="cursor-pointer select-none font-bold uppercase text-slate-400">
                Product Name <span v-if="sortBy === 'name'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th @click="toggleSort('sku')" class="cursor-pointer select-none font-bold uppercase text-slate-400">
                SKU <span v-if="sortBy === 'sku'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th @click="toggleSort('category')" class="cursor-pointer select-none font-bold uppercase text-slate-400">
                Category <span v-if="sortBy === 'category'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th @click="toggleSort('priceCents')" class="cursor-pointer select-none font-bold uppercase text-slate-400">
                Price <span v-if="sortBy === 'priceCents'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th class="font-bold uppercase text-slate-400">Stock Status</th>
              <th class="font-bold uppercase text-slate-400">Type</th>
              <th class="text-right font-bold uppercase text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="product in paginatedProducts" :key="product.id" class="hover:bg-slate-50 dark:hover:bg-slate-800/40 border-b border-base-100 dark:border-slate-800/60 transition-colors">
              <td>
                <div class="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center border border-base-200 dark:border-slate-700">
                  <img v-if="product.images && product.images.length > 0" :src="product.images[0]" class="w-full h-full object-cover" />
                  <span v-else class="text-[9px] text-slate-400 font-bold">N/A</span>
                </div>
              </td>
              <td>
                <div class="font-bold text-slate-900 dark:text-slate-100 text-sm">{{ product.name }}</div>
                <div class="font-mono text-[9px] opacity-40">/store/{{ product.slug }}</div>
              </td>
              <td class="font-mono text-slate-500">{{ product.sku || '—' }}</td>
              <td>
                <span v-if="product.category" class="badge badge-sm badge-ghost font-bold text-[10px]">{{ product.category }}</span>
                <span v-else class="opacity-30">—</span>
              </td>
              <td class="font-black text-primary text-sm">${{ (product.priceCents / 100).toFixed(2) }}</td>
              <td>
                <span :class="['badge badge-xs font-bold border-none text-white', product.inStock !== false ? 'bg-emerald-500' : 'bg-rose-500']">
                  {{ product.inStock !== false ? (product.stockQuantity !== null && product.stockQuantity !== undefined ? `${product.stockQuantity} in stock` : 'In Stock') : 'Out of Stock' }}
                </span>
              </td>
              <td>
                <span v-if="product.isPhysical === false" class="badge badge-xs badge-info text-white font-bold">Virtual</span>
                <span v-else class="badge badge-xs badge-outline opacity-60">Physical</span>
              </td>
              <td class="text-right">
                <div class="flex items-center justify-end gap-1">
                  <button @click="duplicateProduct(product)" class="btn btn-xs btn-ghost text-slate-500 hover:text-primary font-bold rounded-lg" title="Duplicate product">
                    <font-awesome-icon :icon="['fas', 'copy']" class="w-3 h-3" />
                  </button>
                  <button @click="openEditModal(product)" class="btn btn-xs btn-outline rounded-lg font-bold">Edit</button>
                  <button @click="deleteProduct(product.id)" class="btn btn-xs btn-ghost hover:bg-rose-500/10 text-rose-500 font-bold rounded-lg">Delete</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Controls & Page Size Dropdown -->
      <div class="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 border-t border-slate-100 dark:border-slate-800">
        <!-- Page Size Selector -->
        <div class="flex items-center gap-2 text-xs text-slate-500 font-bold">
          <span>Show</span>
          <select v-model="itemsPerPage" class="select select-xs select-bordered rounded-lg text-xs font-bold focus:outline-none">
            <option :value="9">9 per page</option>
            <option :value="18">18 per page</option>
            <option :value="36">36 per page</option>
            <option :value="72">72 per page</option>
            <option :value="10000">All products</option>
          </select>
          <span class="opacity-60 text-[11px]">({{ sortedProducts.length }} total)</span>
        </div>

        <!-- Page Buttons -->
        <div v-if="totalPages > 1" class="flex items-center gap-3">
          <button :disabled="currentPage === 1" @click="currentPage--" class="btn btn-sm btn-outline rounded-xl px-4 font-bold text-xs uppercase">Prev</button>
          <span class="text-xs font-bold text-slate-500">Page {{ currentPage }} of {{ totalPages }}</span>
          <button :disabled="currentPage === totalPages" @click="currentPage++" class="btn btn-sm btn-outline rounded-xl px-4 font-bold text-xs uppercase">Next</button>
        </div>
      </div>
    </div>
    </div> <!-- END PRODUCTS TAB -->

    <!-- Add/Edit Product Modal -->
    <div v-if="showProductModal" class="modal modal-open z-40">
      <div class="modal-box rounded-3xl border border-base-200 shadow-2xl bg-white dark:bg-slate-900 max-w-3xl max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-center mb-1">
          <h3 class="font-black text-2xl tracking-tight">{{ editingId ? 'Edit Product' : 'Add Product' }}</h3>
          <button @click="showProductModal = false" class="btn btn-xs btn-circle btn-ghost">✕</button>
        </div>
        <p class="text-xs opacity-50 mb-6">Setup product details, pricing, gallery images, inventory, custom fields, and shipping.</p>
        
        <form @submit.prevent="saveProduct" class="space-y-6">
          <!-- Basic Info -->
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="form-control">
              <label class="label font-bold text-xs uppercase text-slate-400">Product Name</label>
              <input 
                type="text" 
                v-model="form.name" 
                @input="onNameInput"
                placeholder="e.g. A Whispering Light Novel" 
                class="input input-bordered rounded-xl w-full" 
                required 
              />
            </div>

            <div class="form-control">
              <label class="label font-bold text-xs uppercase text-slate-400">Slug</label>
              <div class="relative">
                <input 
                  type="text" 
                  v-model="form.slug" 
                  @input="slugManuallyEdited = true"
                  placeholder="e.g. whispering-light-novel" 
                  class="input input-bordered rounded-xl w-full font-mono text-sm pr-16" 
                  required 
                />
                <button 
                  type="button" 
                  @click="generateSlugFromName" 
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary hover:underline px-2 py-1"
                  title="Regenerate slug from name"
                >
                  Regen
                </button>
              </div>
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-3">
            <div class="form-control">
              <label class="label font-bold text-xs uppercase text-slate-400">Price (USD)</label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 font-bold opacity-40 text-sm">$</span>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  v-model.number="form.price" 
                  @blur="formatPrice"
                  placeholder="9.99" 
                  class="input input-bordered rounded-xl w-full pl-7 font-mono font-bold" 
                  required 
                />
              </div>
            </div>

            <div class="form-control">
              <label class="label font-bold text-xs uppercase text-slate-400">Category</label>
              <input 
                type="text" 
                v-model="form.category" 
                placeholder="e.g. Books, Merch, Art" 
                class="input input-bordered rounded-xl w-full text-xs" 
              />
            </div>

            <div class="form-control">
              <label class="label font-bold text-xs uppercase text-slate-400">SKU</label>
              <input 
                type="text" 
                v-model="form.sku" 
                placeholder="e.g. BK-WLN-01" 
                class="input input-bordered rounded-xl w-full font-mono text-xs" 
              />
            </div>
          </div>

          <!-- Product Image & Gallery Picker -->
          <div class="form-control">
            <label class="label font-bold text-xs uppercase text-slate-400">Product Image URL</label>
            <div class="flex gap-2">
              <input 
                type="text" 
                v-model="form.imageUrl" 
                placeholder="/assets/... or https://..." 
                class="input input-bordered rounded-xl w-full text-xs font-mono" 
              />
              <button 
                type="button" 
                @click="openGalleryModal" 
                class="btn btn-outline rounded-xl font-bold text-xs shrink-0 gap-1.5"
              >
                <font-awesome-icon :icon="['fas', 'images']" class="w-3.5 h-3.5" />
                Browse Gallery
              </button>
            </div>
            <div v-if="form.imageUrl" class="mt-2 flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-base-200">
              <img :src="form.imageUrl" class="w-12 h-12 object-cover rounded-lg" />
              <span class="text-xs truncate font-mono opacity-70">{{ form.imageUrl }}</span>
            </div>
          </div>

          <!-- Description (Quill Rich Text) -->
          <div class="form-control">
            <label class="label font-bold text-xs uppercase text-slate-400">Description (Rich Text)</label>
            <div class="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-base-200 shadow-sm">
              <div id="product-editor-container" class="h-44"></div>
            </div>
          </div>

          <!-- Inventory & Ordering Controls -->
          <div class="grid gap-4 sm:grid-cols-3 p-4 bg-slate-50 dark:bg-slate-800/40 border border-base-200 rounded-2xl">
            <div class="form-control justify-center">
              <label class="label cursor-pointer justify-start gap-3">
                <input type="checkbox" v-model="form.inStock" class="checkbox checkbox-primary checkbox-sm" />
                <div>
                  <span class="label-text font-bold text-xs">In Stock</span>
                  <p class="text-[10px] opacity-50">Is this product currently available?</p>
                </div>
              </label>
            </div>

            <div class="form-control">
              <label class="label font-bold text-xs uppercase text-slate-400">Stock Quantity</label>
              <input 
                type="number" 
                min="0"
                v-model.number="form.stockQuantity" 
                placeholder="Unlimited if empty" 
                class="input input-sm input-bordered rounded-lg w-full text-xs font-mono" 
              />
            </div>

            <div class="form-control">
              <label class="label font-bold text-xs uppercase text-slate-400">Limit Per Order</label>
              <input 
                type="number" 
                min="1"
                v-model.number="form.limitPerOrder" 
                placeholder="No limit if empty" 
                class="input input-sm input-bordered rounded-lg w-full text-xs font-mono" 
              />
            </div>
          </div>

          <!-- Product Type & Shipping -->
          <div class="p-4 bg-slate-50 dark:bg-slate-800/40 border border-base-200 rounded-2xl space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <span class="font-bold text-xs uppercase tracking-wider text-slate-400">Product Type</span>
                <p class="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {{ form.isPhysical ? 'Physical Goods (Requires shipping)' : 'Virtual / Digital Good' }}
                </p>
              </div>
              <div class="join">
                <button 
                  type="button" 
                  @click="form.isPhysical = true" 
                  :class="['join-item btn btn-xs font-bold', form.isPhysical ? 'btn-primary text-white' : 'btn-ghost']"
                >
                  Physical
                </button>
                <button 
                  type="button" 
                  @click="form.isPhysical = false" 
                  :class="['join-item btn btn-xs font-bold', !form.isPhysical ? 'btn-primary text-white' : 'btn-ghost']"
                >
                  Virtual
                </button>
              </div>
            </div>

            <!-- Shipping Details if Physical -->
            <div v-if="form.isPhysical" class="pt-3 border-t border-base-200 grid gap-3 sm:grid-cols-3 animate-in fade-in">
              <div class="form-control">
                <label class="label font-bold text-[10px] uppercase text-slate-400">Weight</label>
                <input 
                  type="text" 
                  v-model="form.shippingDetails.weight" 
                  placeholder="e.g. 1.2 lbs / 500g" 
                  class="input input-xs input-bordered rounded-lg w-full text-xs" 
                />
              </div>
              <div class="form-control">
                <label class="label font-bold text-[10px] uppercase text-slate-400">Dimensions</label>
                <input 
                  type="text" 
                  v-model="form.shippingDetails.dimensions" 
                  placeholder="e.g. 6 x 9 x 1 in" 
                  class="input input-xs input-bordered rounded-lg w-full text-xs" 
                />
              </div>
              <div class="form-control">
                <label class="label font-bold text-[10px] uppercase text-slate-400">Shipping Notes</label>
                <input 
                  type="text" 
                  v-model="form.shippingDetails.notes" 
                  placeholder="e.g. Ships in 2-3 business days" 
                  class="input input-xs input-bordered rounded-lg w-full text-xs" 
                />
              </div>
            </div>
          </div>

          <!-- Custom Order Fields (for customer personalization/requests) -->
          <div class="p-4 bg-slate-50 dark:bg-slate-800/40 border border-base-200 rounded-2xl space-y-3">
            <div class="flex justify-between items-center">
              <div>
                <span class="font-bold text-xs uppercase tracking-wider text-slate-400">Custom Order Fields</span>
                <p class="text-[11px] opacity-60">Collect personalization requests, dedications, or notes from buyers.</p>
              </div>
              <button type="button" @click="addCustomOrderField" class="btn btn-xs btn-outline rounded-lg font-bold">+ Add Field</button>
            </div>

            <div v-if="form.customOrderFields.length === 0" class="text-xs opacity-40 italic py-1">
              No custom order fields added.
            </div>

            <div v-else class="space-y-2">
              <div v-for="(field, idx) in form.customOrderFields" :key="field.id" class="flex gap-2 items-center bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-base-200">
                <input 
                  type="text" 
                  placeholder="Field Label (e.g. Book Dedication Name)" 
                  v-model="field.label" 
                  class="input input-bordered input-xs rounded-lg flex-1 text-xs" 
                  required 
                />
                <select v-model="field.type" class="select select-bordered select-xs rounded-lg text-xs font-bold">
                  <option value="text">Short Text</option>
                  <option value="textarea">Paragraph / Message</option>
                  <option value="checkbox">Checkbox</option>
                </select>
                <label class="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold select-none px-1">
                  <input type="checkbox" v-model="field.required" class="checkbox checkbox-xs checkbox-primary" />
                  <span>Required</span>
                </label>
                <button type="button" @click="removeCustomOrderField(idx)" class="btn btn-xs btn-circle btn-ghost text-rose-500 font-bold">×</button>
              </div>
            </div>
          </div>

          <!-- Add-on Products -->
          <div class="p-4 bg-slate-50 dark:bg-slate-800/40 border border-base-200 rounded-2xl space-y-3">
            <div>
              <span class="font-bold text-xs uppercase tracking-wider text-slate-400">Featured Add-on Products</span>
              <p class="text-[11px] opacity-60">Select other products to cross-sell alongside this item.</p>
            </div>

            <div v-if="availableAddOnProducts.length === 0" class="text-xs opacity-40 italic py-1">
              No other products available in the store yet.
            </div>

            <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto">
              <label 
                v-for="p in availableAddOnProducts" 
                :key="p.id" 
                class="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded-xl border border-base-200 cursor-pointer hover:border-primary/50 transition-colors"
              >
                <input 
                  type="checkbox" 
                  :value="p.id" 
                  v-model="form.addOnProductIds" 
                  class="checkbox checkbox-xs checkbox-primary" 
                />
                <div class="truncate text-xs">
                  <span class="font-bold block truncate">{{ p.name }}</span>
                  <span class="text-[10px] opacity-50 font-mono">${{ (p.priceCents / 100).toFixed(2) }}</span>
                </div>
              </label>
            </div>
          </div>

          <!-- Affiliate Outlets Section -->
          <div class="border-t border-base-200 pt-4">
            <div class="flex justify-between items-center mb-2">
              <span class="text-xs font-bold uppercase tracking-widest opacity-60">Affiliate Stores</span>
              <button type="button" @click="addAffiliateRow" class="btn btn-xs btn-outline rounded-lg font-bold">+ Add Seller</button>
            </div>
            
            <div class="space-y-2 max-h-40 overflow-y-auto">
              <div v-for="(aff, idx) in form.affiliates" :key="idx" class="flex gap-2 items-center">
                <input type="text" placeholder="Seller Name" v-model="aff.sellerName" class="input input-bordered input-sm rounded-lg w-1/3 text-xs" required />
                <input type="text" placeholder="URL" v-model="aff.url" class="input input-bordered input-sm rounded-lg w-1/3 text-xs" required />
                <input type="number" step="0.01" placeholder="Price" v-model="aff.price" class="input input-bordered input-sm rounded-lg w-1/4 text-xs font-mono" required />
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

    <!-- Gallery Selector Modal -->
    <div v-if="showGalleryModal" class="modal modal-open z-50">
      <div class="modal-box rounded-3xl border border-base-200 shadow-2xl bg-white dark:bg-slate-900 max-w-2xl">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h3 class="font-black text-2xl tracking-tight">Select Gallery Image</h3>
            <p class="text-xs opacity-50">Choose an uploaded image for this product.</p>
          </div>
          <input type="text" v-model="gallerySearchQuery" placeholder="Search images..." class="input input-sm input-bordered rounded-xl px-3 text-xs w-full md:w-44 focus:outline-none" />
        </div>
        
        <div v-if="galleryLoading" class="flex justify-center py-12">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
        <div v-else-if="filteredGalleryAssets.length === 0" class="text-center py-12 text-sm opacity-50">
          No images match your search.
        </div>
        <div v-else class="space-y-4">
          <div class="grid grid-cols-3 gap-4 max-h-80 overflow-y-auto p-1">
            <div 
              v-for="asset in paginatedGalleryAssets" 
              :key="asset.key" 
              @click="selectGalleryImage(asset.url)" 
              class="group cursor-pointer relative card border border-base-200 rounded-xl overflow-hidden shadow hover:shadow-md hover:scale-[1.02] transition-all"
            >
              <div class="h-24 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                <img :src="asset.thumbnailUrl || asset.url" class="object-cover w-full h-full" />
              </div>
              <div class="p-2 text-[10px] truncate bg-white dark:bg-slate-900 font-bold border-t border-base-200 text-slate-700 dark:text-slate-300">
                {{ asset.name }}
              </div>
            </div>
          </div>

          <!-- Pagination inside Modal -->
          <div v-if="totalGalleryPages > 1" class="flex justify-center items-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button :disabled="galleryCurrentPage === 1" @click="galleryCurrentPage--" class="btn btn-xs btn-outline rounded-xl px-3 font-bold uppercase">Prev</button>
            <span class="text-[10px] font-bold text-slate-500">Page {{ galleryCurrentPage }} of {{ totalGalleryPages }}</span>
            <button :disabled="galleryCurrentPage === totalGalleryPages" @click="galleryCurrentPage++" class="btn btn-xs btn-outline rounded-xl px-3 font-bold uppercase">Next</button>
          </div>
        </div>

        <div class="modal-action">
          <button type="button" @click="showGalleryModal = false" class="btn btn-ghost rounded-xl font-bold">Cancel</button>
        </div>
      </div>
    </div>

    <!-- ORDERS TAB CONTENT -->
    <div v-show="storeTab === 'orders'" class="space-y-6">
      <!-- Orders Filter & Stat Bar -->
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div class="card bg-white dark:bg-slate-900 border border-base-200 p-4 rounded-2xl shadow-sm">
          <span class="text-[10px] font-bold uppercase tracking-wider opacity-50">Total Orders</span>
          <span class="text-2xl font-black mt-1">{{ orders.length }}</span>
        </div>
        <div class="card bg-white dark:bg-slate-900 border border-base-200 p-4 rounded-2xl shadow-sm">
          <span class="text-[10px] font-bold uppercase tracking-wider text-amber-500">Unfulfilled</span>
          <span class="text-2xl font-black text-amber-500 mt-1">{{ unfulfilledOrdersCount }}</span>
        </div>
        <div class="card bg-white dark:bg-slate-900 border border-base-200 p-4 rounded-2xl shadow-sm">
          <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Shipped</span>
          <span class="text-2xl font-black text-emerald-500 mt-1">{{ shippedOrdersCount }}</span>
        </div>
        <div class="card bg-white dark:bg-slate-900 border border-base-200 p-4 rounded-2xl shadow-sm">
          <span class="text-[10px] font-bold uppercase tracking-wider opacity-50">Gross Revenue</span>
          <span class="text-2xl font-black text-primary mt-1">${{ (totalRevenueCents / 100).toFixed(2) }}</span>
        </div>
      </div>

      <!-- Orders Filter Controls -->
      <div class="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-base-200 shadow-sm">
        <div class="flex items-center gap-2 w-full sm:w-auto">
          <input 
            type="text" 
            v-model="orderSearchQuery" 
            placeholder="Search by customer, email, order ID, or tracking..." 
            class="input input-sm input-bordered rounded-xl w-full sm:w-80 text-xs focus:outline-none" 
          />
        </div>
        <div class="flex items-center gap-3 w-full sm:w-auto justify-end">
          <span class="text-xs font-bold text-slate-400 uppercase text-[10px]">Filter Status:</span>
          <select v-model="orderStatusFilter" class="select select-sm select-bordered rounded-xl text-xs font-bold focus:outline-none">
            <option value="all">All Orders ({{ orders.length }})</option>
            <option value="unfulfilled">Unfulfilled ({{ unfulfilledOrdersCount }})</option>
            <option value="shipped">Shipped ({{ shippedOrdersCount }})</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <!-- Orders Table -->
      <div class="card bg-white dark:bg-slate-900 border border-base-200 rounded-3xl shadow-xl overflow-hidden">
        <div v-if="loadingOrders" class="p-16 flex justify-center items-center">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>

        <div v-else-if="filteredOrders.length === 0" class="p-16 text-center">
          <p class="opacity-55 text-sm">No orders matching this criteria found.</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="table w-full text-xs">
            <thead>
              <tr class="border-b border-base-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
                <th class="font-bold uppercase text-slate-400">Order ID / Date</th>
                <th class="font-bold uppercase text-slate-400">Customer</th>
                <th class="font-bold uppercase text-slate-400">Items Ordered</th>
                <th class="font-bold uppercase text-slate-400">Shipping Address</th>
                <th class="font-bold uppercase text-slate-400">Amount</th>
                <th class="font-bold uppercase text-slate-400">Fulfillment</th>
                <th class="text-right font-bold uppercase text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in filteredOrders" :key="order.id" class="hover:bg-slate-50 dark:hover:bg-slate-800/40 border-b border-base-100 dark:border-slate-800/60 transition-colors">
                <td>
                  <div class="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">{{ order.id }}</div>
                  <div class="text-[10px] opacity-40 mt-0.5">{{ formatDate(order.createdAt) }}</div>
                </td>
                <td>
                  <div class="font-bold text-slate-800 dark:text-slate-200 text-xs">{{ order.customerName || order.customerEmail }}</div>
                  <div class="text-[10px] opacity-50 font-mono">{{ order.customerEmail }}</div>
                </td>
                <td>
                  <div v-if="order.items && order.items.length > 0" class="space-y-1">
                    <div v-for="(it, idx) in order.items" :key="idx" class="flex items-center gap-1.5 text-xs">
                      <span class="badge badge-xs badge-neutral font-mono font-bold">{{ it.quantity }}×</span>
                      <span class="font-medium truncate max-w-[180px]">{{ it.name }}</span>
                    </div>
                  </div>
                  <div v-else class="opacity-40 italic text-[11px]">Single Item Order</div>
                </td>
                <td>
                  <div v-if="order.shippingAddress" class="text-[11px] leading-tight max-w-[200px]">
                    <span class="font-bold block truncate">{{ order.shippingAddress.name }}</span>
                    <span class="opacity-70 block truncate">{{ order.shippingAddress.line1 }} {{ order.shippingAddress.line2 || '' }}</span>
                    <span class="opacity-60 block truncate">{{ order.shippingAddress.city }}, {{ order.shippingAddress.state }} {{ order.shippingAddress.postalCode }}</span>
                    <span class="opacity-40 block text-[10px]">{{ order.shippingAddress.country }}</span>
                  </div>
                  <div v-else class="text-[11px] opacity-40 italic">Digital / No Shipping Address</div>
                </td>
                <td>
                  <span class="font-black text-slate-900 dark:text-slate-100 text-sm">
                    ${{ ((order.amountTotalCents || 0) / 100).toFixed(2) }}
                  </span>
                </td>
                <td>
                  <div class="space-y-1">
                    <span :class="['badge badge-xs font-bold uppercase tracking-wider', getFulfillmentBadgeClass(order.fulfillmentStatus)]">
                      {{ order.fulfillmentStatus || 'unfulfilled' }}
                    </span>
                    <div v-if="order.trackingNumber" class="text-[10px] font-mono">
                      <a 
                        v-if="order.trackingUrl" 
                        :href="order.trackingUrl" 
                        target="_blank" 
                        class="link link-primary font-bold flex items-center gap-1"
                        title="Open carrier tracking"
                      >
                        {{ order.carrier || 'Tracking' }}: {{ order.trackingNumber }}
                        <font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" class="w-2.5 h-2.5" />
                      </a>
                      <span v-else class="opacity-70">{{ order.carrier }}: {{ order.trackingNumber }}</span>
                    </div>
                  </div>
                </td>
                <td class="text-right">
                  <button 
                    @click="openFulfillModal(order)" 
                    class="btn btn-xs rounded-lg font-bold gap-1"
                    :class="order.fulfillmentStatus === 'shipped' || order.fulfillmentStatus === 'delivered' ? 'btn-ghost text-slate-500' : 'btn-primary text-white'"
                  >
                    <font-awesome-icon :icon="['fas', 'truck']" class="w-3 h-3" />
                    {{ order.fulfillmentStatus === 'shipped' || order.fulfillmentStatus === 'delivered' ? 'Update Tracking' : 'Fulfill' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div> <!-- END ORDERS TAB -->

    <!-- Fulfill Order Modal -->
    <div v-if="showFulfillModal && selectedOrder" class="modal modal-open z-40">
      <div class="modal-box rounded-3xl border border-base-200 shadow-2xl bg-white dark:bg-slate-900 max-w-lg">
        <div class="flex justify-between items-center mb-1">
          <h3 class="font-black text-2xl tracking-tight">Fulfill Order</h3>
          <button @click="showFulfillModal = false" class="btn btn-xs btn-circle btn-ghost">✕</button>
        </div>
        <p class="text-xs opacity-50 mb-6">Assign carrier, tracking number, and optionally send a Postmark shipping update email to the customer.</p>

        <!-- Order Summary Box -->
        <div class="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-base-200 mb-6 space-y-2 text-xs">
          <div class="flex justify-between">
            <span class="opacity-50">Order Reference:</span>
            <span class="font-mono font-bold">{{ selectedOrder.id }}</span>
          </div>
          <div class="flex justify-between">
            <span class="opacity-50">Customer:</span>
            <span class="font-bold">{{ selectedOrder.customerName || selectedOrder.customerEmail }}</span>
          </div>
          <div class="flex justify-between">
            <span class="opacity-50">Recipient Email:</span>
            <span class="font-mono">{{ selectedOrder.customerEmail }}</span>
          </div>
          <div v-if="selectedOrder.shippingAddress" class="pt-2 border-t border-base-200">
            <span class="opacity-50 uppercase text-[10px] font-bold block mb-1">Shipping Destination:</span>
            <div class="font-medium text-[11px] leading-tight">
              {{ selectedOrder.shippingAddress.line1 }}<span v-if="selectedOrder.shippingAddress.line2">, {{ selectedOrder.shippingAddress.line2 }}</span><br />
              {{ selectedOrder.shippingAddress.city }}, {{ selectedOrder.shippingAddress.state }} {{ selectedOrder.shippingAddress.postalCode }} ({{ selectedOrder.shippingAddress.country }})
            </div>
          </div>
        </div>

        <form @submit.prevent="submitFulfillment" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label font-bold text-xs uppercase text-slate-400">Carrier</label>
              <select v-model="fulfillForm.carrier" class="select select-bordered rounded-xl w-full text-xs font-bold">
                <option value="USPS">USPS (United States Postal Service)</option>
                <option value="UPS">UPS (United Parcel Service)</option>
                <option value="FedEx">FedEx</option>
                <option value="DHL">DHL Express</option>
                <option value="Other">Other Carrier</option>
              </select>
            </div>

            <div class="form-control">
              <label class="label font-bold text-xs uppercase text-slate-400">Fulfillment Status</label>
              <select v-model="fulfillForm.fulfillmentStatus" class="select select-bordered rounded-xl w-full text-xs font-bold">
                <option value="shipped">Shipped</option>
                <option value="processing">Processing</option>
                <option value="delivered">Delivered</option>
                <option value="unfulfilled">Unfulfilled</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div class="form-control">
            <label class="label font-bold text-xs uppercase text-slate-400">Tracking Number</label>
            <input 
              type="text" 
              v-model="fulfillForm.trackingNumber" 
              placeholder="e.g. 9400 1118 9956 1234 5678 90" 
              class="input input-bordered rounded-xl w-full font-mono text-xs" 
            />
          </div>

          <div class="form-control">
            <label class="label font-bold text-xs uppercase text-slate-400">Direct Tracking URL (Optional)</label>
            <input 
              type="url" 
              v-model="fulfillForm.trackingUrl" 
              placeholder="Leave blank to auto-generate for USPS / UPS / FedEx / DHL" 
              class="input input-bordered rounded-xl w-full font-mono text-xs" 
            />
          </div>

          <div class="form-control">
            <label class="label font-bold text-xs uppercase text-slate-400">Internal Order Notes (Optional)</label>
            <textarea 
              v-model="fulfillForm.notes" 
              placeholder="Internal fulfillment or packing notes..." 
              class="textarea textarea-bordered rounded-xl w-full text-xs h-20"
            ></textarea>
          </div>

          <div class="form-control flex-row items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 border border-base-200 rounded-2xl">
            <div>
              <span class="font-bold text-xs">Send Email via Postmark</span>
              <p class="text-[11px] opacity-50">Email shipping confirmation and tracking link to customer.</p>
            </div>
            <input type="checkbox" class="toggle toggle-primary" v-model="fulfillForm.sendEmail" />
          </div>

          <div class="modal-action pt-2">
            <button type="button" @click="showFulfillModal = false" class="btn btn-ghost rounded-xl font-bold">Cancel</button>
            <button type="submit" class="btn btn-primary rounded-xl font-bold px-6 text-white gap-2" :disabled="submittingFulfillment">
              <span v-if="submittingFulfillment" class="loading loading-spinner loading-xs"></span>
              Update Order
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
import { ref, onMounted, computed, nextTick, watch } from "vue";
import type { CMSProduct, AffiliateLink, CustomOrderField, ShippingDetails, CMSPurchase } from "swiftbase-cms-shared";
import { cachedFetch } from "../utils/api";
import Quill from "quill";
import "quill/dist/quill.snow.css";

const storeTab = ref<"products" | "orders">("products");

const products = ref<CMSProduct[]>([]);
const showProductModal = ref(false);
const loading = ref(true);
const submitting = ref(false);
const editingId = ref<string | null>(null);
const slugManuallyEdited = ref(false);
const quillInstance = ref<Quill | null>(null);

// Orders Management State
const orders = ref<CMSPurchase[]>([]);
const loadingOrders = ref(false);
const orderSearchQuery = ref("");
const orderStatusFilter = ref<string>("all");
const showFulfillModal = ref(false);
const selectedOrder = ref<CMSPurchase | null>(null);
const submittingFulfillment = ref(false);

const fulfillForm = ref({
  carrier: "USPS",
  fulfillmentStatus: "shipped",
  trackingNumber: "",
  trackingUrl: "",
  notes: "",
  sendEmail: true,
});

// View and Sorting State
const viewMode = ref<"card" | "list">("card");
const sortBy = ref<string>("name");
const sortOrder = ref<"asc" | "desc">("asc");

const toggleSort = (field: string) => {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
  } else {
    sortBy.value = field;
    sortOrder.value = "asc";
  }
};

const sortedProducts = computed(() => {
  return [...products.value].sort((a: any, b: any) => {
    let aVal = a[sortBy.value];
    let bVal = b[sortBy.value];

    if (sortBy.value === "priceCents") {
      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
      return sortOrder.value === "asc" ? aVal - bVal : bVal - aVal;
    }

    aVal = (aVal || "").toString().toLowerCase();
    bVal = (bVal || "").toString().toLowerCase();

    if (aVal < bVal) return sortOrder.value === "asc" ? -1 : 1;
    if (aVal > bVal) return sortOrder.value === "asc" ? 1 : -1;
    return 0;
  });
});

// Products Pagination State
const currentPage = ref(1);
const itemsPerPage = ref(9);

watch([sortBy, sortOrder, itemsPerPage], () => {
  currentPage.value = 1;
});

const totalPages = computed(() => {
  return Math.ceil(sortedProducts.value.length / itemsPerPage.value) || 1;
});

const paginatedProducts = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  return sortedProducts.value.slice(start, start + itemsPerPage.value);
});

// Product Form State
const form = ref({
  name: "",
  slug: "",
  price: 0,
  imageUrl: "",
  description: "",
  category: "",
  sku: "",
  inStock: true,
  stockQuantity: null as number | null,
  limitPerOrder: null as number | null,
  isPhysical: true,
  shippingDetails: {
    weight: "",
    dimensions: "",
    notes: "",
  } as ShippingDetails,
  customOrderFields: [] as CustomOrderField[],
  addOnProductIds: [] as string[],
  affiliates: [] as { sellerName: string; url: string; price: number }[],
});

// Available add-ons (all products except current being edited)
const availableAddOnProducts = computed(() => {
  return products.value.filter(p => !editingId.value || p.id !== editingId.value);
});

// Gallery Picker State
const showGalleryModal = ref(false);
const galleryLoading = ref(false);
const galleryAssets = ref<any[]>([]);
const gallerySearchQuery = ref("");
const galleryCurrentPage = ref(1);
const galleryItemsPerPage = 9;

const filteredGalleryAssets = computed(() => {
  const query = gallerySearchQuery.value.toLowerCase().trim();
  if (!query) return galleryAssets.value;
  return galleryAssets.value.filter(a => a.name.toLowerCase().includes(query));
});

const totalGalleryPages = computed(() => {
  return Math.ceil(filteredGalleryAssets.value.length / galleryItemsPerPage) || 1;
});

const paginatedGalleryAssets = computed(() => {
  const start = (galleryCurrentPage.value - 1) * galleryItemsPerPage;
  return filteredGalleryAssets.value.slice(start, start + galleryItemsPerPage);
});

const openGalleryModal = async () => {
  showGalleryModal.value = true;
  galleryLoading.value = true;
  try {
    galleryAssets.value = await cachedFetch("/api/assets");
  } catch (err) {
    console.error("Failed to load gallery assets:", err);
  } finally {
    galleryLoading.value = false;
  }
};

const selectGalleryImage = (url: string) => {
  form.value.imageUrl = url;
  showGalleryModal.value = false;
};

// Auto Slug Logic
const slugify = (text: string) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const onNameInput = () => {
  if (!slugManuallyEdited.value) {
    form.value.slug = slugify(form.value.name);
  }
};

const generateSlugFromName = () => {
  form.value.slug = slugify(form.value.name);
  slugManuallyEdited.value = false;
};

const formatPrice = () => {
  if (typeof form.value.price === "number") {
    form.value.price = parseFloat(form.value.price.toFixed(2));
  }
};

// Modal alert state
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

const initQuillEditor = async (initialContent: string) => {
  await nextTick();
  const container = document.querySelector("#product-editor-container");
  if (container) {
    container.innerHTML = "";
    quillInstance.value = new Quill("#product-editor-container", {
      theme: "snow",
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["link", "clean"],
        ],
      },
    });
    quillInstance.value.root.innerHTML = initialContent || "";
  }
};

const openCreateModal = () => {
  editingId.value = null;
  slugManuallyEdited.value = false;
  form.value = {
    name: "",
    slug: "",
    price: 0,
    imageUrl: "",
    description: "",
    category: "",
    sku: "",
    inStock: true,
    stockQuantity: null,
    limitPerOrder: null,
    isPhysical: true,
    shippingDetails: { weight: "", dimensions: "", notes: "" },
    customOrderFields: [],
    addOnProductIds: [],
    affiliates: [],
  };
  showProductModal.value = true;
  initQuillEditor("");
};

const openEditModal = (product: CMSProduct) => {
  editingId.value = product.id;
  slugManuallyEdited.value = true;
  form.value = {
    name: product.name,
    slug: product.slug,
    price: parseFloat((product.priceCents / 100).toFixed(2)),
    imageUrl: product.images?.[0] || "",
    description: product.description || "",
    category: product.category || "",
    sku: product.sku || "",
    inStock: product.inStock !== false,
    stockQuantity: product.stockQuantity ?? null,
    limitPerOrder: product.limitPerOrder ?? null,
    isPhysical: product.isPhysical !== false,
    shippingDetails: product.shippingDetails ? { ...product.shippingDetails } : { weight: "", dimensions: "", notes: "" },
    customOrderFields: product.customOrderFields ? JSON.parse(JSON.stringify(product.customOrderFields)) : [],
    addOnProductIds: product.addOnProductIds ? [...product.addOnProductIds] : [],
    affiliates: (product.affiliateLinks || []).map((l) => ({
      sellerName: l.sellerName,
      url: l.url,
      price: parseFloat((l.priceCents / 100).toFixed(2)),
    })),
  };
  showProductModal.value = true;
  initQuillEditor(product.description || "");
};

const duplicateProduct = async (product: CMSProduct) => {
  const newName = `Copy of ${product.name}`;
  const baseSlug = slugify(newName);
  const newSlug = `${baseSlug}-${Date.now().toString().slice(-4)}`;

  const clone: Partial<CMSProduct> = {
    name: newName,
    slug: newSlug,
    priceCents: product.priceCents,
    description: product.description,
    category: product.category,
    sku: product.sku ? `${product.sku}-COPY` : "",
    inStock: product.inStock,
    stockQuantity: product.stockQuantity,
    limitPerOrder: product.limitPerOrder,
    isPhysical: product.isPhysical,
    shippingDetails: product.shippingDetails,
    customOrderFields: product.customOrderFields,
    addOnProductIds: product.addOnProductIds,
    images: product.images ? [...product.images] : [],
    affiliateLinks: product.affiliateLinks ? [...product.affiliateLinks] : [],
  };

  loading.value = true;
  try {
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clone),
    });
    if (res.ok) {
      await fetchProducts();
      showAlert("Product Duplicated", `Successfully duplicated "${product.name}".`);
    } else {
      const err = await res.json().catch(() => ({}));
      showAlert("Duplicate Failed", err.message || "Failed to duplicate product.");
    }
  } catch (err: any) {
    console.error("Failed to duplicate product:", err);
    showAlert("Error", err.message || "An unexpected error occurred.");
  } finally {
    loading.value = false;
  }
};

const addCustomOrderField = () => {
  form.value.customOrderFields.push({
    id: `field-${Date.now()}`,
    label: "",
    type: "text",
    required: false,
  });
};

const removeCustomOrderField = (index: number) => {
  form.value.customOrderFields.splice(index, 1);
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
    const descriptionHtml = quillInstance.value ? quillInstance.value.root.innerHTML : form.value.description;

    const affiliateLinks: AffiliateLink[] = form.value.affiliates.map((a) => ({
      sellerName: a.sellerName,
      url: a.url,
      priceCents: Math.round(Number(a.price) * 100),
    }));

    const payload: Partial<CMSProduct> = {
      name: form.value.name,
      slug: form.value.slug,
      priceCents: Math.round(Number(form.value.price) * 100),
      description: descriptionHtml,
      category: form.value.category,
      sku: form.value.sku,
      inStock: form.value.inStock,
      stockQuantity: form.value.stockQuantity,
      limitPerOrder: form.value.limitPerOrder,
      isPhysical: form.value.isPhysical,
      shippingDetails: form.value.shippingDetails,
      customOrderFields: form.value.customOrderFields,
      addOnProductIds: form.value.addOnProductIds,
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
    } else {
      const err = await res.json().catch(() => ({}));
      showAlert("Save Failed", err.message || "Failed to save product.");
    }
  } catch (err: any) {
    console.error("Failed to save product:", err);
    showAlert("Error", err.message || "An unexpected error occurred.");
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

// Orders Computed & Actions
const unfulfilledOrdersCount = computed(() => {
  return orders.value.filter(o => !o.fulfillmentStatus || o.fulfillmentStatus === "unfulfilled").length;
});

const shippedOrdersCount = computed(() => {
  return orders.value.filter(o => o.fulfillmentStatus === "shipped").length;
});

const totalRevenueCents = computed(() => {
  return orders.value.reduce((sum, o) => sum + (o.amountTotalCents || 0), 0);
});

const filteredOrders = computed(() => {
  let list = [...orders.value];

  if (orderStatusFilter.value !== "all") {
    if (orderStatusFilter.value === "unfulfilled") {
      list = list.filter(o => !o.fulfillmentStatus || o.fulfillmentStatus === "unfulfilled");
    } else {
      list = list.filter(o => o.fulfillmentStatus === orderStatusFilter.value);
    }
  }

  const query = orderSearchQuery.value.toLowerCase().trim();
  if (query) {
    list = list.filter(o => {
      return (
        o.id.toLowerCase().includes(query) ||
        (o.customerEmail && o.customerEmail.toLowerCase().includes(query)) ||
        (o.customerName && o.customerName.toLowerCase().includes(query)) ||
        (o.trackingNumber && o.trackingNumber.toLowerCase().includes(query)) ||
        (o.shippingAddress?.name && o.shippingAddress.name.toLowerCase().includes(query)) ||
        (o.shippingAddress?.city && o.shippingAddress.city.toLowerCase().includes(query)) ||
        (o.shippingAddress?.postalCode && o.shippingAddress.postalCode.toLowerCase().includes(query))
      );
    });
  }

  return list;
});

const formatDate = (isoStr?: string) => {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return isoStr;
  }
};

const getFulfillmentBadgeClass = (status?: string) => {
  switch (status) {
    case "shipped":
      return "badge-success text-white";
    case "delivered":
      return "badge-info text-white";
    case "processing":
      return "badge-primary text-white";
    case "cancelled":
      return "badge-error text-white";
    case "unfulfilled":
    default:
      return "badge-warning text-slate-900";
  }
};

const fetchOrders = async () => {
  loadingOrders.value = true;
  try {
    const data = await cachedFetch("/api/orders", undefined, true);
    if (Array.isArray(data)) {
      orders.value = data;
    }
  } catch (err) {
    console.error("Failed to load orders:", err);
  } finally {
    loadingOrders.value = false;
  }
};

const openFulfillModal = (order: CMSPurchase) => {
  selectedOrder.value = order;
  fulfillForm.value = {
    carrier: order.carrier || "USPS",
    fulfillmentStatus: order.fulfillmentStatus || "shipped",
    trackingNumber: order.trackingNumber || "",
    trackingUrl: order.trackingUrl || "",
    notes: order.notes || "",
    sendEmail: true,
  };
  showFulfillModal.value = true;
};

const submitFulfillment = async () => {
  if (!selectedOrder.value) return;
  submittingFulfillment.value = true;
  try {
    const res = await fetch(`/api/orders/${selectedOrder.value.id}/fulfill`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fulfillForm.value),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showFulfillModal.value = false;
      await fetchOrders();
      let msg = "Order updated successfully!";
      if (data.emailSent) {
        msg += " Shipping notification email dispatched via Postmark.";
      } else if (data.emailError) {
        msg += ` Note: Email notification was not sent (${data.emailError}).`;
      }
      showAlert("Order Fulfilled", msg);
    } else {
      showAlert("Fulfillment Error", data.message || "Failed to update order.");
    }
  } catch (err: any) {
    console.error("Failed to fulfill order:", err);
    showAlert("Error", err.message || "Failed to communicate with server.");
  } finally {
    submittingFulfillment.value = false;
  }
};

watch(storeTab, (tab) => {
  if (tab === "orders" && orders.value.length === 0) {
    fetchOrders();
  }
});

onMounted(() => {
  fetchProducts();
  fetchOrders();
});
</script>
