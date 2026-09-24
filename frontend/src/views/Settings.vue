<template>
  <div class="space-y-8 w-full max-w-5xl mx-auto animate-in fade-in duration-500">
    <!-- Header -->
    <div>
      <div class="badge bg-primary text-white border-none font-bold uppercase tracking-widest text-[9px] px-3 py-1">CMS System Options</div>
      <h1 class="text-4xl font-black tracking-tighter">Settings</h1>
      <p class="text-xs opacity-50 mt-1">Configure global variables, adjust branding look & feel, and link Stripe keys.</p>
    </div>

    <!-- Form Container -->
    <div class="card bg-white dark:bg-slate-900 border border-base-200 p-8 rounded-3xl shadow-xl space-y-6">
      <!-- Tabs Header -->
      <div class="flex border-b border-base-200 mb-6 gap-2">
        <button type="button" @click="activeTab = 'general'" :class="['pb-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all', activeTab === 'general' ? 'border-primary text-primary' : 'border-transparent opacity-60']">General</button>
        <button type="button" @click="activeTab = 'appearance'" :class="['pb-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all', activeTab === 'appearance' ? 'border-primary text-primary' : 'border-transparent opacity-60']">Appearance</button>
        <button type="button" @click="activeTab = 'data'" :class="['pb-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all', activeTab === 'data' ? 'border-primary text-primary' : 'border-transparent opacity-60']">Data Management</button>
        <button type="button" @click="activeTab = 'payments'" :class="['pb-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all', activeTab === 'payments' ? 'border-primary text-primary' : 'border-transparent opacity-60']" v-if="settings.isStoreEnabled">Payments</button>
        <button type="button" @click="activeTab = 'comments'" :class="['pb-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all', activeTab === 'comments' ? 'border-primary text-primary' : 'border-transparent opacity-60']" v-if="settings.isBlogEnabled && settings.areCommentsEnabledGlobally">Comments</button>
      </div>

      <!-- Loading Skeleton Shimmer -->
      <div v-if="isLoading" class="space-y-6 animate-pulse">
        <div class="space-y-4">
          <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/4"></div>
          <div class="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl w-full"></div>
          <div class="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl w-full"></div>
        </div>
        <div class="divider border-base-200"></div>
        <div class="space-y-4">
          <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/4"></div>
          <div class="h-14 bg-slate-200 dark:bg-slate-800 rounded-xl w-full"></div>
          <div class="h-14 bg-slate-200 dark:bg-slate-800 rounded-xl w-full"></div>
        </div>
      </div>

      <form v-else @submit.prevent="saveSettings" class="space-y-6">
        <!-- General Tab -->
        <div v-show="activeTab === 'general'" class="space-y-6">
          <div class="space-y-4">
            <h3 class="font-bold text-sm uppercase tracking-widest opacity-60">Site Configuration</h3>
            
            <div class="form-control">
              <label class="label font-bold text-xs uppercase text-slate-400">Site Title</label>
              <input type="text" v-model="settings.siteTitle" placeholder="My SBCMS Site" class="input input-bordered rounded-xl w-full" required />
            </div>

            <div class="form-control">
              <label class="label font-bold text-xs uppercase text-slate-400">Site Domain / URL Origin</label>
              <input type="url" v-model="settings.siteDomain" placeholder="https://mysite.com" class="input input-bordered rounded-xl w-full font-mono text-sm" />
            </div>
          </div>

          <div class="divider border-base-200"></div>

          <!-- Modules Toggles -->
          <div class="space-y-4">
            <h3 class="font-bold text-sm uppercase tracking-widest opacity-60">Modular Components</h3>
            
            <div class="form-control flex-row items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 border border-base-200 rounded-2xl">
              <div>
                <span class="font-bold text-sm">Blog Stories</span>
                <p class="text-xs opacity-50">Compile dynamic rich-text blog post structures automatically.</p>
              </div>
              <input type="checkbox" class="toggle toggle-primary" v-model="settings.isBlogEnabled" />
            </div>

            <div class="form-control flex-row items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 border border-base-200 rounded-2xl">
              <div>
                <span class="font-bold text-sm">Store E-Commerce</span>
                <p class="text-xs opacity-50">Support product collections, Stripe redirects, and seller outlets.</p>
              </div>
              <input type="checkbox" class="toggle toggle-primary" v-model="settings.isStoreEnabled" />
            </div>

            <div class="form-control flex-row items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 border border-base-200 rounded-2xl" v-if="settings.isBlogEnabled">
              <div>
                <span class="font-bold text-sm">Blog Comments</span>
                <p class="text-xs opacity-50">Allow readers to submit and view comments on published blog articles.</p>
              </div>
              <input type="checkbox" class="toggle toggle-primary" v-model="settings.areCommentsEnabledGlobally" />
            </div>
          </div>
        </div>

        <!-- Appearance Tab -->
        <div v-show="activeTab === 'appearance'" class="space-y-6">
          <div class="space-y-4">
            <h3 class="font-bold text-sm uppercase tracking-widest opacity-60">Identity & Logo</h3>
            <div class="space-y-4">
              <div class="form-control">
                <label class="label font-bold text-xs uppercase text-slate-400">Navbar Logo / Brand Text / Image URL</label>
                <div class="flex gap-2">
                  <input type="text" v-model="settings.navbarLogo" placeholder="e.g. MyBrand or /assets/logo.png" class="input input-bordered rounded-xl flex-1 font-mono text-xs" />
                  <button type="button" @click="openGalleryPicker('navbarLogo')" class="btn btn-outline rounded-xl font-bold text-xs uppercase">Choose</button>
                </div>
              </div>
              <div class="form-control">
                <label class="label font-bold text-xs uppercase text-slate-400">Favicon URL</label>
                <div class="flex gap-2">
                  <input type="text" v-model="settings.faviconUrl" placeholder="e.g. /assets/favicon.ico" class="input input-bordered rounded-xl flex-1 font-mono text-xs" />
                  <button type="button" @click="openGalleryPicker('faviconUrl')" class="btn btn-outline rounded-xl font-bold text-xs uppercase">Choose</button>
                  <label class="btn btn-primary rounded-xl font-bold text-xs uppercase text-white cursor-pointer flex items-center justify-center gap-1">
                    Upload
                    <input type="file" @change="uploadFaviconDirect" accept="image/*,.ico" class="hidden" />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div class="divider border-base-200"></div>

          <!-- Navigation Links -->
          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <h3 class="font-bold text-sm uppercase tracking-widest opacity-60">Navbar Configuration</h3>
            </div>
            
            <div class="flex justify-between items-center bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-base-200 mb-2">
              <div>
                <h4 class="font-bold text-sm">Visual Navbar Designer</h4>
                <p class="text-xs opacity-50">Build a custom header navbar layout with Page Designer.</p>
              </div>
              <router-link to="/settings/edit-navbar" class="btn btn-sm btn-primary text-white font-bold rounded-xl px-4 uppercase tracking-wider text-xs">
                Design Navbar
              </router-link>
            </div>

            <div class="flex justify-between items-center mt-2">
              <label class="label font-bold text-xs uppercase text-slate-400">Navbar Links</label>
              <button type="button" @click="addNavbarLink" class="btn btn-xs btn-outline btn-primary rounded-lg font-bold">
                + Add Link
              </button>
            </div>
            
            <div v-if="!settings.navbarLinks || settings.navbarLinks.length === 0" class="text-xs opacity-50 py-2">
              No custom links. Falls back to default paths (Home, Blog, Store).
            </div>
            
            <div v-else class="space-y-2">
              <div v-for="(link, index) in settings.navbarLinks" :key="index" class="flex gap-2 items-center">
                <input type="text" v-model="link.label" placeholder="Label" class="input input-bordered input-sm rounded-lg w-1/3 font-bold" />
                <input type="text" v-model="link.url" placeholder="URL (e.g. /about)" class="input input-bordered input-sm rounded-lg flex-1 font-mono" />
                <button type="button" @click="removeNavbarLink(index)" class="btn btn-sm btn-ghost hover:bg-rose-500/10 text-rose-500 btn-square rounded-lg flex items-center justify-center">
                  <font-awesome-icon :icon="['fas', 'xmark']" class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div class="divider border-base-200"></div>

          <!-- Footer Settings -->
          <div class="space-y-4">
            <h3 class="font-bold text-sm uppercase tracking-widest opacity-60">Footer Configuration</h3>
            
            <div class="flex justify-between items-center bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-base-200 mb-2">
              <div>
                <h4 class="font-bold text-sm">Visual Footer Designer</h4>
                <p class="text-xs opacity-50">Build a custom page footer layout with Page Designer.</p>
              </div>
              <router-link to="/settings/edit-footer" class="btn btn-sm btn-primary text-white font-bold rounded-xl px-4 uppercase tracking-wider text-xs">
                Design Footer
              </router-link>
            </div>

            <div class="form-control">
              <label class="label font-bold text-xs uppercase text-slate-400">Footer Text / Copyright</label>
              <input type="text" v-model="settings.footerText" placeholder="e.g. © 2026 MyBrand. All rights reserved." class="input input-bordered rounded-xl w-full" />
            </div>

            <div class="space-y-2">
              <div class="flex justify-between items-center">
                <label class="label font-bold text-xs uppercase text-slate-400">Footer Links</label>
                <button type="button" @click="addFooterLink" class="btn btn-xs btn-outline btn-primary rounded-lg font-bold">
                  + Add Link
                </button>
              </div>

              <div v-if="!settings.footerLinks || settings.footerLinks.length === 0" class="text-xs opacity-50 py-2">
                No custom footer links.
              </div>

              <div v-else class="space-y-2">
                <div v-for="(link, index) in settings.footerLinks" :key="index" class="flex gap-2 items-center">
                  <input type="text" v-model="link.label" placeholder="Label" class="input input-bordered input-sm rounded-lg w-1/3 font-bold" />
                  <input type="text" v-model="link.url" placeholder="URL" class="input input-bordered input-sm rounded-lg flex-1 font-mono" />
                  <button type="button" @click="removeFooterLink(index)" class="btn btn-sm btn-ghost hover:bg-rose-500/10 text-rose-500 btn-square rounded-lg flex items-center justify-center">
                    <font-awesome-icon :icon="['fas', 'xmark']" class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="divider border-base-200"></div>

          <!-- Global Custom CSS Styles -->
          <div class="space-y-4">
            <h3 class="font-bold text-sm uppercase tracking-widest opacity-60">Global Custom CSS</h3>
            <p class="text-xs opacity-50">Add custom CSS rules that will be injected globally across all published pages.</p>
            <div class="form-control space-y-1">
              <!-- Code Tab Header -->
              <div class="flex items-center justify-between bg-slate-900 border-t border-r border-l border-white/5 rounded-t-xl px-4 py-2 select-none text-[10px] font-mono text-slate-400">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  <span class="font-bold tracking-wider text-[11px] text-white">global_styles.css</span>
                </div>
                <span class="opacity-40 uppercase">CSS Editor</span>
              </div>
              
              <!-- Prism Code Editor Container -->
              <div class="relative w-full h-40 font-mono text-xs border border-white/5 rounded-b-xl overflow-hidden bg-slate-950">
                <!-- Highlighted Code Layer -->
                <pre ref="preRef" class="absolute inset-0 m-0 p-4 pointer-events-none overflow-auto text-emerald-400 select-none leading-relaxed css-editor-pre" aria-hidden="true"><code ref="codeBlockRef" class="language-css">{{ settings.globalStyles }}</code></pre>
                
                <!-- Editor Input Layer -->
                <textarea
                  v-model="settings.globalStyles"
                  @input="highlightCode"
                  @scroll="syncScroll"
                  @keydown="handleKeyDown"
                  ref="textareaRef"
                  placeholder="/* Write custom CSS overrides here */&#10;body {&#10;  font-family: sans-serif;&#10;}"
                  class="absolute inset-0 m-0 p-4 bg-transparent text-transparent caret-white focus:outline-none w-full h-full leading-relaxed resize-none overflow-auto font-mono text-xs border-none ring-0 focus:ring-0 focus:border-none css-editor-textarea"
                  spellcheck="false"
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        <!-- Data Management Tab -->
        <div v-show="activeTab === 'data'" class="space-y-6">
          <div class="space-y-4">
            <h3 class="font-bold text-sm uppercase tracking-widest opacity-60">Backup & Migration</h3>
            <p class="text-xs opacity-50">Export full SBCMS database configuration (settings, pages, posts, products, comments) as JSON or import backup files.</p>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="p-5 bg-slate-50 dark:bg-slate-800/40 border border-base-200 rounded-2xl flex flex-col justify-between space-y-4">
                <div>
                  <h4 class="font-bold text-sm">Export Data (JSON)</h4>
                  <p class="text-xs opacity-50 mt-1">Download all site pages, blog posts, store products, comments, and settings into a JSON backup file.</p>
                </div>
                <button type="button" @click="exportData" :disabled="exporting" class="btn btn-primary rounded-xl font-bold text-xs uppercase tracking-wide gap-2 text-white">
                  <span v-if="exporting" class="loading loading-spinner loading-xs"></span>
                  Export JSON Backup
                </button>
              </div>

              <div class="p-5 bg-slate-50 dark:bg-slate-800/40 border border-base-200 rounded-2xl flex flex-col justify-between space-y-4">
                <div>
                  <h4 class="font-bold text-sm">Import Data (JSON)</h4>
                  <p class="text-xs opacity-50 mt-1">Restore or migrate settings and content from an exported SBCMS JSON backup file.</p>
                </div>
                <label class="btn btn-outline btn-primary rounded-xl font-bold text-xs uppercase tracking-wide cursor-pointer flex items-center justify-center gap-2">
                  <span v-if="importing" class="loading loading-spinner loading-xs"></span>
                  <span>{{ importing ? 'Importing...' : 'Upload & Restore JSON' }}</span>
                  <input type="file" @change="importData" accept="application/json,.json" class="hidden" :disabled="importing" />
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Payments Tab -->
        <div v-show="activeTab === 'payments'" class="space-y-4" v-if="settings.isStoreEnabled">
          <h3 class="font-bold text-sm uppercase tracking-widest opacity-60">Payment Gateway (Stripe)</h3>
          
          <div class="form-control">
            <label class="label font-bold text-xs uppercase text-slate-400">Stripe Publishable Key</label>
            <input type="text" v-model="settings.stripePublishableKey" placeholder="pk_test_..." class="input input-bordered rounded-xl w-full text-xs font-mono" />
          </div>

          <div class="form-control">
            <label class="label font-bold text-xs uppercase text-slate-400">Stripe Webhook Secret / Secret Key</label>
            <input type="password" v-model="settings.stripeWebhookSecret" placeholder="sk_test_..." class="input input-bordered rounded-xl w-full text-xs font-mono" />
          </div>

          <div class="form-control pt-2" v-if="settings.isStoreEnabled">
            <button type="button" @click="syncStripeProducts" :disabled="syncingProducts" class="btn btn-outline btn-primary rounded-xl font-bold text-xs uppercase tracking-wide gap-2">
              <span v-if="syncingProducts" class="loading loading-spinner loading-xs"></span>
              Sync Local Products with Stripe
            </button>
          </div>

          <div class="divider border-base-200"></div>

          <h3 class="font-bold text-sm uppercase tracking-widest opacity-60">Email Notifications (Postmark)</h3>
          <p class="text-xs opacity-50">Send automated order confirmation and shipping notification emails with tracking numbers.</p>

          <div class="form-control">
            <label class="label font-bold text-xs uppercase text-slate-400">Postmark Server API Token</label>
            <input type="password" v-model="settings.postmarkApiToken" placeholder="e.g. 12345678-xxxx-xxxx-xxxx-xxxxxxxxxxxx" class="input input-bordered rounded-xl w-full text-xs font-mono" />
          </div>

          <div class="form-control">
            <label class="label font-bold text-xs uppercase text-slate-400">From / Sender Email</label>
            <input type="email" v-model="settings.postmarkFromEmail" placeholder="e.g. orders@jennyrenson.com" class="input input-bordered rounded-xl w-full text-xs" />
            <span class="text-[10px] opacity-40 mt-1">Must be a verified sender signature or domain in your Postmark account.</span>
          </div>

          <div class="form-control flex-row items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 border border-base-200 rounded-2xl mt-2">
            <div>
              <span class="font-bold text-xs">Notify Customer on Order Fulfillment</span>
              <p class="text-[11px] opacity-50">Automatically email buyer carrier details and tracking links when order is fulfilled.</p>
            </div>
            <input type="checkbox" class="toggle toggle-primary" v-model="settings.postmarkNotifyOnOrder" />
          </div>
        </div>

        <!-- Comments Moderation Tab -->
        <div v-show="activeTab === 'comments'" class="space-y-6" v-if="settings.isBlogEnabled">
          <div class="flex justify-between items-center pb-2 border-b border-base-200">
            <h3 class="font-bold text-sm uppercase tracking-widest opacity-60">Comments Moderation ({{ blogComments.length }})</h3>
            <button type="button" @click="fetchComments" class="btn btn-xs btn-ghost gap-1">Refresh</button>
          </div>

          <div v-if="loadingComments" class="flex justify-center py-10">
            <span class="loading loading-spinner loading-lg text-primary"></span>
          </div>

          <div v-else-if="blogComments.length === 0" class="text-center py-10 opacity-55 text-sm">
            No comments submitted yet.
          </div>

          <div v-else class="space-y-4 max-h-[500px] overflow-y-auto pr-2">
            <div v-for="comment in blogComments" :key="comment.id" class="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-base-200 space-y-3">
              <div class="flex justify-between items-start">
                <div>
                  <span class="font-bold text-sm block">{{ comment.authorName }}</span>
                  <span class="text-[10px] opacity-50 block font-mono">{{ comment.authorEmail }} &middot; {{ comment.ipAddress }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span :class="['badge font-bold uppercase text-[9px] px-2 py-0.5 border-none', comment.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800']">
                    {{ comment.status }}
                  </span>
                  <span class="text-[10px] opacity-40 font-semibold">{{ new Date(comment.createdAt).toLocaleString() }}</span>
                </div>
              </div>
              <p class="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans bg-white dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 whitespace-pre-wrap">{{ comment.content }}</p>
              
              <div class="flex justify-between items-center">
                <span class="text-[10px] opacity-50 font-bold uppercase">Post Slug: <span class="font-mono text-primary">{{ comment.postSlug }}</span></span>
                <div class="flex gap-2">
                  <button type="button" v-if="comment.status !== 'approved'" @click="moderateComment(comment.id, 'approved')" class="btn btn-xs btn-success text-white font-bold rounded-lg px-3">
                    Approve
                  </button>
                  <button type="button" v-if="comment.status !== 'spam'" @click="moderateComment(comment.id, 'spam')" class="btn btn-xs btn-outline btn-error font-bold rounded-lg px-3">
                    Flag Spam
                  </button>
                  <button type="button" @click="deleteComment(comment.id)" class="btn btn-xs btn-ghost text-rose-500 font-bold rounded-lg px-2">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end pt-4">
          <button type="submit" class="btn btn-primary rounded-xl px-8 font-bold text-xs uppercase tracking-wider text-white gap-2" :disabled="saving">
            <span v-if="saving" class="loading loading-spinner loading-xs"></span>
            Save Settings
          </button>
        </div>
      </form>
    </div>

    <!-- Gallery Picker Modal -->
    <div v-if="showGalleryModal" class="modal modal-open">
      <div class="modal-box rounded-3xl border border-base-200 shadow-2xl bg-white dark:bg-slate-900 max-w-2xl">
        <h3 class="font-black text-2xl tracking-tight">Select Asset</h3>
        <p class="text-xs opacity-50 mb-6">Choose an image from your uploaded assets.</p>
        
        <div v-if="loadingAssets" class="flex justify-center py-10">
          <span class="loading loading-spinner loading-md text-primary"></span>
        </div>
        <div v-else-if="assetsList.length === 0" class="text-center py-10 opacity-55 text-sm">
          No assets uploaded yet. You can upload them in the Gallery view.
        </div>
        <div v-else class="grid grid-cols-3 gap-4 max-h-60 overflow-y-auto">
          <div v-for="asset in assetsList" :key="asset.key" @click="selectAsset(asset.url)" class="cursor-pointer border border-base-200 hover:border-primary rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-800 flex flex-col items-center p-2 text-center gap-1 group">
            <div class="h-20 w-full flex items-center justify-center bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden">
              <img :src="asset.thumbnailUrl || asset.url" class="object-cover h-full w-full group-hover:scale-105 transition-all" />
            </div>
            <span class="text-[10px] font-bold truncate w-full">{{ asset.name }}</span>
          </div>
        </div>

        <div class="modal-action">
          <button type="button" @click="showGalleryModal = false" class="btn btn-ghost rounded-xl font-bold">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Reusable custom Modal for alerts/confirms -->
    <div v-if="modal.show" class="modal modal-open z-50">
      <div class="modal-box rounded-3xl border border-base-200 shadow-2xl bg-white dark:bg-slate-900">
        <h3 class="font-black text-2xl tracking-tight">{{ modal.title }}</h3>
        <p class="text-xs opacity-60 mt-2 mb-6">{{ modal.message }}</p>
        <div class="modal-action">
          <button type="button" @click="modal.show = false" class="btn btn-ghost rounded-xl font-bold">Ok</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from "vue";
import { useRoute } from "vue-router";
import { cachedFetch } from "../utils/api";
import type { CMSSettings } from "swiftbase-cms-shared";
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";
import "prismjs/components/prism-css";

const route = useRoute();
const activeTab = ref<"general" | "appearance" | "data" | "payments" | "comments">("general");

const settings = ref<CMSSettings>({
  id: "settings-default",
  projectId: "swiftbase",
  siteTitle: "My SBCMS Site",
  isBlogEnabled: false,
  isStoreEnabled: false,
  stripePublishableKey: "",
  stripeWebhookSecret: "",
  postmarkApiToken: "",
  postmarkFromEmail: "",
  postmarkNotifyOnOrder: true,
  navbarLogo: "",
  navbarLinks: [],
  footerText: "",
  footerLinks: [],
  faviconUrl: "",
  globalStyles: "",
  areCommentsEnabledGlobally: true,
});

const saving = ref(false);
const isLoading = ref(true);
const syncingProducts = ref(false);
const exporting = ref(false);
const importing = ref(false);

const exportData = async () => {
  exporting.value = true;
  try {
    const res = await fetch("/api/export");
    if (!res.ok) throw new Error("Failed to export data");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sbcms-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    showAlert("Export Successful", "Database configuration downloaded as JSON backup!");
  } catch (err: any) {
    showAlert("Export Error", err.message || "Failed to export data.");
  } finally {
    exporting.value = false;
  }
};

const importData = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  const files = target.files;
  if (!files || files.length === 0) return;
  const file = files[0];
  const reader = new FileReader();
  reader.readAsText(file);
  reader.onload = async () => {
    try {
      importing.value = true;
      const payload = JSON.parse(reader.result as string);
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        showAlert("Import Successful", data.message || "Data restored successfully!");
        await fetchSettings();
      } else {
        showAlert("Import Failed", data.message || "Failed to import JSON data.");
      }
    } catch (err: any) {
      showAlert("Import Error", err.message || "Invalid JSON backup file.");
    } finally {
      importing.value = false;
      target.value = "";
    }
  };
};

const syncStripeProducts = async () => {
  syncingProducts.value = true;
  try {
    const res = await fetch("/api/stripe/sync-products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (res.ok) {
      showAlert("Sync Successful", data.message || "Products synced successfully!");
    } else {
      showAlert("Sync Failed", data.message || "Failed to sync products.");
    }
  } catch (err: any) {
    showAlert("Sync Failed", err.message || "A network error occurred.");
  } finally {
    syncingProducts.value = false;
  }
};

const showGalleryModal = ref(false);
const galleryPickerTarget = ref<"navbarLogo" | "faviconUrl" | "">("");
const assetsList = ref<any[]>([]);
const loadingAssets = ref(false);

const modal = ref({
  show: false,
  title: "",
  message: "",
});

const showAlert = (title: string, message: string) => {
  modal.value = { show: true, title, message };
};

const openGalleryPicker = async (target: "navbarLogo" | "faviconUrl") => {
  galleryPickerTarget.value = target;
  showGalleryModal.value = true;
  loadingAssets.value = true;
  try {
    const res = await fetch("/api/assets");
    if (res.ok) {
      assetsList.value = await res.json();
    }
  } catch (err) {
    console.error(err);
  } finally {
    loadingAssets.value = false;
  }
};

const selectAsset = (url: string) => {
  if (galleryPickerTarget.value === "navbarLogo") {
    settings.value.navbarLogo = url;
  } else if (galleryPickerTarget.value === "faviconUrl") {
    settings.value.faviconUrl = url;
  }
  showGalleryModal.value = false;
  galleryPickerTarget.value = "";
};

const uploadFaviconDirect = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  const files = target.files;
  if (files && files.length > 0) {
    const file = files[0];
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        
        saving.value = true;
        const res = await fetch("/api/assets/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            contentType: file.type,
            base64
          })
        });
        if (res.ok) {
          const data = await res.json();
          settings.value.faviconUrl = data.url;
          await saveSettings();
          showAlert("Success", "Favicon uploaded and settings saved successfully!");
        } else {
          showAlert("Upload Failed", "Direct upload failed.");
        }
      } catch (err) {
        console.error(err);
        showAlert("Upload Error", "Direct upload failed.");
      } finally {
        saving.value = false;
      }
    };
  }
};

const addNavbarLink = () => {
  if (!settings.value.navbarLinks) settings.value.navbarLinks = [];
  settings.value.navbarLinks.push({ label: "New Link", url: "/" });
};

const removeNavbarLink = (index: number) => {
  if (settings.value.navbarLinks) {
    settings.value.navbarLinks.splice(index, 1);
  }
};

const addFooterLink = () => {
  if (!settings.value.footerLinks) settings.value.footerLinks = [];
  settings.value.footerLinks.push({ label: "New Link", url: "/" });
};

const removeFooterLink = (index: number) => {
  if (settings.value.footerLinks) {
    settings.value.footerLinks.splice(index, 1);
  }
};

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const preRef = ref<HTMLPreElement | null>(null);
const codeBlockRef = ref<HTMLElement | null>(null);

const highlightCode = () => {
  nextTick(() => {
    if (codeBlockRef.value) {
      Prism.highlightElement(codeBlockRef.value);
    }
  });
};

const syncScroll = () => {
  if (textareaRef.value && preRef.value) {
    preRef.value.scrollTop = textareaRef.value.scrollTop;
    preRef.value.scrollLeft = textareaRef.value.scrollLeft;
  }
};

const handleKeyDown = (e: KeyboardEvent) => {
  const target = e.target as HTMLTextAreaElement;
  const pairs: Record<string, string> = {
    "{": "}",
    "(": ")",
    "[": "]",
    "\"": "\"",
    "'": "'"
  };

  if (pairs[e.key] !== undefined) {
    e.preventDefault();
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const val = target.value;
    const closeChar = pairs[e.key];
    
    settings.value.globalStyles = val.substring(0, start) + e.key + closeChar + val.substring(end);
    
    nextTick(() => {
      target.selectionStart = target.selectionEnd = start + 1;
      highlightCode();
    });
  }
};

const blogComments = ref<any[]>([]);
const loadingComments = ref(false);

const fetchComments = async () => {
  loadingComments.value = true;
  try {
    blogComments.value = await cachedFetch("/api/comments");
  } catch (err) {
    console.error("Failed to load comments:", err);
  } finally {
    loadingComments.value = false;
  }
};

const moderateComment = async (id: string, status: "approved" | "spam") => {
  try {
    await cachedFetch(`/api/comments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    await fetchComments();
  } catch (err) {
    console.error("Failed to moderate comment:", err);
  }
};

const deleteComment = async (id: string) => {
  if (!confirm("Are you sure you want to delete this comment?")) return;
  try {
    await cachedFetch(`/api/comments/${id}`, {
      method: "DELETE"
    });
    await fetchComments();
  } catch (err) {
    console.error("Failed to delete comment:", err);
  }
};

watch(activeTab, (newTab) => {
  if (newTab === "comments") {
    fetchComments();
  }
});

const fetchSettings = async () => {
  isLoading.value = true;
  try {
    const data = await cachedFetch("/api/settings", undefined, true);
    if (data) {
      settings.value = {
        ...settings.value,
        ...data,
      };
      highlightCode();
      if (settings.value.isBlogEnabled && settings.value.areCommentsEnabledGlobally) {
        await fetchComments();
      }
    }
  } catch (err) {
    console.error("Failed to load settings:", err);
  } finally {
    isLoading.value = false;
  }
};

const saveSettings = async () => {
  saving.value = true;
  try {
    // Preserve custom navbarHtml and navbarComponents designed by user or custom themes.
    // Only generate a default fallback if navbarHtml is completely empty.
    if (!settings.value.navbarHtml && settings.value.navbarLinks && settings.value.navbarLinks.length > 0) {
      const brandText = settings.value.navbarLogo || settings.value.siteTitle || "SBCMS";
      const linksHtml = settings.value.navbarLinks.map((link: any) => `<a href="${link.url}" class="mx-4 hover:text-primary">${link.label}</a>`).join('\n            ');
      settings.value.navbarHtml = `<header class="bg-slate-900 text-white p-4 flex justify-between items-center shadow-lg"><a href="/" class="text-xl font-black tracking-tighter">${brandText}</a><nav class="flex gap-6 font-bold text-sm">\n            ${linksHtml}\n          </nav></header>`;
    }

    await cachedFetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings.value),
    });
    showAlert("Success", "Settings updated successfully!");
    await fetchSettings();
  } catch (err) {
    console.error("Failed to save settings:", err);
    showAlert("Error", "Failed to save settings.");
  } finally {
    saving.value = false;
  }
};

onMounted(async () => {
  await fetchSettings();
  if (route.query.tab === "appearance") {
    activeTab.value = "appearance";
  } else if (route.query.tab === "payments") {
    activeTab.value = "payments";
  } else if (route.query.tab === "general") {
    activeTab.value = "general";
  } else if (route.query.tab === "comments") {
    activeTab.value = "comments";
  }
});
</script>

<style scoped>
.css-editor-textarea {
  white-space: pre !important;
  word-wrap: normal !important;
  overflow: auto !important;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
  font-size: 12px !important;
  line-height: 20px !important;
  padding: 16px !important;
  margin: 0 !important;
  border: none !important;
  text-rendering: optimizeLegibility !important;
  -webkit-font-smoothing: antialiased !important;
}
.css-editor-pre {
  white-space: pre !important;
  word-wrap: normal !important;
  overflow: hidden !important;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
  font-size: 12px !important;
  line-height: 20px !important;
  padding: 16px !important;
  margin: 0 !important;
  border: none !important;
  text-rendering: optimizeLegibility !important;
  -webkit-font-smoothing: antialiased !important;
}
.css-editor-pre code {
  font-family: inherit !important;
  font-size: inherit !important;
  line-height: inherit !important;
}
/* Force identical font styles to prevent character-width misalignments */
.css-editor-pre span, .css-editor-pre code {
  font-weight: normal !important;
  font-style: normal !important;
}
</style>
