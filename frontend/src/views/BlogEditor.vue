<template>
  <div class="space-y-8 animate-in fade-in duration-500">
    <!-- Header -->
    <div class="flex justify-between items-center border-b border-base-200 pb-6">
      <div class="flex items-center gap-4">
        <router-link to="/blog" class="btn btn-sm btn-ghost gap-2 font-bold text-xs uppercase flex items-center justify-center">
          <font-awesome-icon :icon="['fas', 'arrow-left']" class="w-4 h-4" />
          Back
        </router-link>
        <div class="divider divider-horizontal py-3"></div>
        <div>
          <h1 class="text-2xl font-black tracking-tighter">Edit Article</h1>
          <p class="text-xs opacity-50">Draft and publish content dynamically.</p>
        </div>
      </div>

      <div class="flex gap-2">
        <button @click="showSeoModal = true" class="btn btn-sm btn-outline rounded-xl font-bold text-xs uppercase">SEO Settings</button>
        <button @click="savePost('draft')" class="btn btn-sm btn-outline rounded-xl font-bold text-xs uppercase gap-1" :disabled="saving">
          <span v-if="saving" class="loading loading-spinner loading-xs"></span>
          Save Draft
        </button>
        <button @click="savePost('published')" class="btn btn-sm btn-secondary text-white rounded-xl font-bold text-xs uppercase shadow-lg shadow-secondary/20 gap-1" :disabled="saving">
          <span v-if="saving" class="loading loading-spinner loading-xs"></span>
          Publish Post
        </button>
      </div>
    </div>

    <!-- Loading Spinner -->
    <div v-if="loading" class="flex justify-center items-center py-20 bg-white dark:bg-slate-900 border border-base-200 rounded-3xl shadow-xl">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- Layout Form + Editor -->
    <div v-else class="grid gap-8 lg:grid-cols-3">
      <!-- Main Content and Quill Editor -->
      <div class="lg:col-span-2 space-y-6">
        <div class="form-control">
          <label class="label font-bold text-xs uppercase text-slate-400">Post Title</label>
          <input type="text" v-model="postTitle" placeholder="Enter headline title..." class="input input-bordered rounded-2xl w-full text-lg font-bold" />
        </div>

        <div class="form-control">
          <label class="label font-bold text-xs uppercase text-slate-400">Body Content</label>
          <div class="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-base-200 shadow-md">
            <div id="editor-container" class="h-96"></div>
          </div>
        </div>
      </div>

      <!-- Settings & Sidebar fields -->
      <div class="space-y-6">
        <!-- Copy Editor Card -->
        <div class="card bg-white dark:bg-slate-900 border border-base-200 p-6 rounded-3xl shadow-xl space-y-4">
          <div class="flex justify-between items-center">
            <h3 class="font-bold text-sm uppercase tracking-widest opacity-60">Copy Editor</h3>
            <span class="badge badge-secondary text-white font-bold text-[9px] uppercase">Powered by Gemini</span>
          </div>

          <p class="text-xs opacity-60">Scan the document for spelling, grammar, and style suggestions.</p>

          <button 
            type="button" 
            @click="runProofreader" 
            :disabled="scanningAI || !quillInstance" 
            class="btn btn-sm btn-primary text-white w-full rounded-xl uppercase text-xs font-bold"
          >
            <span v-if="scanningAI" class="loading loading-spinner loading-xs"></span>
            {{ scanningAI ? 'Analyzing Text...' : 'Scan Post Content' }}
          </button>

          <!-- Suggestions List -->
          <div v-if="aiCorrections.length > 0" class="space-y-3 pt-2">
            <div class="divider my-0"></div>
            <div class="flex justify-between items-center text-xs">
              <span class="font-bold uppercase text-[10px] text-slate-400">Suggestions ({{ aiCorrections.length }})</span>
              <button type="button" @click="aiCorrections = []" class="text-error font-bold text-[10px] uppercase hover:underline">Clear</button>
            </div>
            
            <div class="max-h-60 overflow-y-auto space-y-2 pr-1">
              <div 
                v-for="(corr, idx) in aiCorrections" 
                :key="idx" 
                class="bg-slate-50 dark:bg-slate-950 border border-base-200 rounded-xl p-3 text-xs space-y-2 hover:border-primary transition-colors"
              >
                <div>
                  <span class="text-error line-through mr-2 font-mono">{{ corr.originalText }}</span>
                  <span class="text-success font-bold font-mono">{{ corr.suggestedText }}</span>
                </div>
                <p class="opacity-60 text-[11px] leading-relaxed">{{ corr.reason }}</p>
                <div class="flex gap-2 pt-1">
                  <button 
                    type="button" 
                    @click="applyCorrection(corr)" 
                    class="btn btn-xs btn-success text-white rounded-lg font-bold text-[9px] uppercase"
                  >
                    Apply Edit
                  </button>
                  <button 
                    type="button" 
                    @click="aiCorrections.splice(idx, 1)" 
                    class="btn btn-xs btn-ghost rounded-lg font-bold text-[9px] uppercase opacity-50 hover:opacity-100"
                  >
                    Ignore
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div v-else-if="scannedOnce" class="text-center py-4 bg-slate-50 dark:bg-slate-950 border border-base-200 border-dashed rounded-xl">
            <p class="text-xs text-success font-bold">✨ No grammar or spelling issues found!</p>
          </div>
        </div>

        <!-- Post Generator Card -->
        <div class="card bg-white dark:bg-slate-900 border border-base-200 p-6 rounded-3xl shadow-xl space-y-4">
          <div class="flex justify-between items-center">
            <h3 class="font-bold text-sm uppercase tracking-widest opacity-60">Post Generator</h3>
            <span class="badge badge-secondary text-white font-bold text-[9px] uppercase">Powered by Gemini</span>
          </div>

          <p class="text-xs opacity-60">Write a topic or description and let AI draft the title and body for you.</p>

          <div class="form-control">
            <textarea 
              v-model="aiGenerationPrompt" 
              placeholder="e.g. Write a 300-word introduction to TypeScript for beginners with simple code snippets..." 
              class="textarea textarea-bordered rounded-xl text-xs h-20 w-full resize-none"
            ></textarea>
          </div>

          <button 
            type="button" 
            @click="generatePostFromPrompt" 
            :disabled="generatingPost || !aiGenerationPrompt.trim() || !quillInstance" 
            class="btn btn-sm btn-accent text-white w-full rounded-xl uppercase text-xs font-bold"
          >
            <span v-if="generatingPost" class="loading loading-spinner loading-xs"></span>
            {{ generatingPost ? 'Generating Post...' : 'Generate Post' }}
          </button>
        </div>

        <!-- Metadata Info -->
        <div class="card bg-white dark:bg-slate-900 border border-base-200 p-6 rounded-3xl shadow-xl space-y-4">
          <h3 class="font-bold text-sm uppercase tracking-widest opacity-60">Post Attributes</h3>
          
          <div class="form-control">
            <label class="label font-bold text-xs uppercase text-slate-400">Slug</label>
            <input type="text" v-model="postSlug" placeholder="e.g. dynamic-web-apps" class="input input-bordered rounded-xl w-full font-mono text-sm" />
          </div>

          <div class="form-control">
            <label class="label font-bold text-xs uppercase text-slate-400">Author</label>
            <input type="text" v-model="postAuthor" placeholder="e.g. Jane Doe" class="input input-bordered rounded-xl w-full text-xs font-bold" />
          </div>

          <div class="form-control">
            <label class="label font-bold text-xs uppercase text-slate-400">Feature Image</label>
            <div class="flex gap-2">
              <input type="text" v-model="featureImage" placeholder="https://image-url.com/asset.jpg" class="input input-sm input-bordered rounded-xl w-full text-xs" />
              <button type="button" @click="openGalleryModal" class="btn btn-sm btn-outline rounded-xl font-bold text-xs uppercase shrink-0">Choose</button>
            </div>
            <div v-if="featureImage" class="mt-2 relative rounded-xl overflow-hidden border border-base-200 h-24 bg-slate-50">
              <img :src="featureImage" class="w-full h-full object-cover" />
              <button type="button" @click="featureImage = ''" class="absolute top-1 right-1 btn btn-xs btn-circle btn-ghost text-rose-500 bg-white/85 hover:bg-rose-500 hover:text-white">✕</button>
            </div>
          </div>

          <div class="form-control">
            <label class="label font-bold text-xs uppercase text-slate-400">Tags</label>
            <div class="flex flex-wrap gap-1.5 mb-2">
              <span v-for="tag in activeTags" :key="tag" class="badge badge-primary font-bold text-[10px] gap-1 py-2 px-2.5 text-white border-none rounded-lg shadow-sm">
                {{ tag }}
                <button type="button" @click="removeTag(tag)" class="hover:text-slate-200 font-normal focus:outline-none">✕</button>
              </span>
            </div>
            
            <div class="relative">
              <input 
                type="text" 
                v-model="tagInput" 
                @focus="showTagAutocomplete = true"
                @blur="handleTagBlur"
                @keydown.enter.prevent="addTagFromInput"
                placeholder="Search or type a tag..." 
                class="input input-bordered rounded-xl w-full text-xs" 
              />
              
              <!-- Autocomplete dropdown -->
              <div v-show="showTagAutocomplete && filteredTags.length > 0" class="absolute left-0 right-0 top-10 bg-white dark:bg-slate-800 border border-base-200 dark:border-slate-700 shadow-xl rounded-xl z-50 max-h-40 overflow-y-auto p-1">
                <button 
                  type="button"
                  v-for="tag in filteredTags" 
                  :key="tag" 
                  @mousedown="addTag(tag)"
                  class="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-xs font-bold transition-colors duration-150"
                >
                  {{ tag }}
                </button>
              </div>
            </div>
          </div>

          <div class="form-control">
            <label class="label font-bold text-xs uppercase text-slate-400">Excerpt / Brief Description</label>
            <textarea v-model="postExcerpt" placeholder="Summary of your article..." class="textarea textarea-bordered rounded-xl w-full h-24 text-xs"></textarea>
          </div>

          <div class="form-control flex-row items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 border border-base-200 rounded-2xl">
            <div>
              <span class="font-bold text-xs">Enable Comments</span>
              <p class="text-[10px] opacity-50">Allow readers to comment on this article.</p>
            </div>
            <input type="checkbox" class="toggle toggle-primary toggle-sm" v-model="areCommentsEnabled" />
          </div>
        </div>
      </div>
    </div>

    <!-- SEO Settings Modal -->
    <div v-if="showSeoModal" class="modal modal-open">
      <div class="modal-box rounded-3xl border border-base-200 shadow-2xl bg-white dark:bg-slate-900">
        <h3 class="font-black text-2xl tracking-tight">SEO & Social Meta</h3>
        <p class="text-xs opacity-50 mb-6">Manage how this blog post displays on search engines.</p>
        
        <div class="space-y-4">
          <div class="form-control">
            <label class="label font-bold text-xs uppercase text-slate-400">SEO Title</label>
            <input type="text" v-model="seoTitle" placeholder="e.g. 10 Tips for Blazing Fast Apps | SBCMS" class="input input-bordered rounded-xl w-full" />
          </div>

          <div class="form-control">
            <label class="label font-bold text-xs uppercase text-slate-400">Meta Description</label>
            <textarea v-model="seoDescription" placeholder="A brief summary optimized for search results..." class="textarea textarea-bordered rounded-xl w-full h-24"></textarea>
          </div>
        </div>

        <div class="modal-action">
          <button @click="showSeoModal = false" class="btn btn-primary rounded-xl font-bold px-6 text-white">Done</button>
        </div>
      </div>
    </div>

    <!-- Gallery Selector Modal -->
    <div v-if="showGalleryModal" class="modal modal-open z-50">
      <div class="modal-box rounded-3xl border border-base-200 shadow-2xl bg-white dark:bg-slate-900 max-w-2xl">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h3 class="font-black text-2xl tracking-tight">Select Feature Image</h3>
            <p class="text-xs opacity-50">Choose an uploaded asset to use as the feature image.</p>
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
            <div v-for="asset in paginatedGalleryAssets" :key="asset.key" @click="selectGalleryImage(asset.url)" class="group cursor-pointer relative card border border-base-200 rounded-xl overflow-hidden shadow hover:shadow-md hover:scale-[1.02] transition-all">
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
          <button @click="closeGalleryModal" class="btn btn-ghost rounded-xl font-bold">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Giphy Selector Modal -->
    <div v-if="showGiphyModal" class="modal modal-open z-50">
      <div class="modal-box rounded-3xl border border-base-200 shadow-2xl bg-white dark:bg-slate-900 max-w-3xl">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <div class="flex items-center gap-2">
              <span class="badge badge-sm font-black bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white border-none">GIPHY</span>
              <h3 class="font-black text-2xl tracking-tight">Insert Animated GIF</h3>
            </div>
            <p class="text-xs opacity-50 mt-1">Search millions of GIFs powered by Giphy.com</p>
          </div>
          <div class="relative w-full sm:w-64">
            <input 
              type="text" 
              v-model="giphySearchQuery" 
              placeholder="Search GIFs on Giphy..." 
              class="input input-sm input-bordered rounded-xl px-3 w-full text-xs focus:outline-none" 
            />
            <span v-if="giphyLoading" class="absolute right-3 top-1/2 -translate-y-1/2 loading loading-spinner loading-xs text-primary"></span>
          </div>
        </div>

        <div v-if="giphyLoading && giphyResults.length === 0" class="flex justify-center py-16">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
        <div v-else-if="giphyResults.length === 0" class="text-center py-16 text-sm opacity-50">
          No GIFs found matching "{{ giphySearchQuery }}".
        </div>
        <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto p-1">
          <div 
            v-for="gif in giphyResults" 
            :key="gif.id" 
            @click="selectGiphyGif(gif.original || gif.preview)" 
            class="group cursor-pointer relative card border border-base-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow hover:shadow-lg hover:scale-[1.03] transition-all bg-slate-950 aspect-video flex items-center justify-center"
          >
            <img :src="gif.preview" :alt="gif.title" class="object-cover w-full h-full" loading="lazy" />
            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span class="badge badge-primary font-bold text-[10px] text-white">Insert GIF</span>
            </div>
          </div>
        </div>

        <div class="modal-action flex justify-between items-center mt-6">
          <span class="text-[10px] opacity-40 font-mono">Powered by GIPHY</span>
          <button @click="showGiphyModal = false" class="btn btn-ghost rounded-xl font-bold">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Reusable custom Modal for alerts/confirms -->
    <div v-if="modal.show" class="modal modal-open z-50">
      <div class="modal-box rounded-3xl border border-base-200 shadow-2xl bg-white dark:bg-slate-900">
        <h3 class="font-black text-2xl tracking-tight">{{ modal.title }}</h3>
        <p class="text-xs opacity-60 mt-2 mb-6">{{ modal.message }}</p>
        <div class="modal-action">
          <button type="button" @click="closeModal" class="btn btn-ghost rounded-xl font-bold">Ok</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, computed, watch } from "vue";
import { useRouter } from "vue-router";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import type { CMSPost } from "swiftbase-cms-shared";
import { cachedFetch } from "../utils/api";

class SimpleImageResize {
  quill: any;
  options: any;
  img: HTMLImageElement | null = null;
  overlay: HTMLDivElement | null = null;

  constructor(quill: any, options: any) {
    this.quill = quill;
    this.options = options;
    this.quill.root.addEventListener("click", this.handleClick.bind(this), false);
    this.quill.root.addEventListener("scroll", this.updateOverlayPosition.bind(this), false);
    window.addEventListener("resize", this.updateOverlayPosition.bind(this), false);
  }

  handleClick(evt: MouseEvent) {
    if (evt.target && (evt.target as HTMLElement).tagName === "IMG") {
      this.selectImage(evt.target as HTMLImageElement);
    } else {
      this.hideOverlay();
    }
  }

  selectImage(img: HTMLImageElement) {
    this.img = img;
    this.showOverlay();
  }

  showOverlay() {
    this.hideOverlay();
    
    this.overlay = document.createElement("div");
    this.overlay.style.position = "absolute";
    this.overlay.style.border = "2px dashed #3b82f6";
    this.overlay.style.zIndex = "10";
    this.overlay.style.pointerEvents = "none";
    
    this.updateOverlayPosition();
    
    const handle = document.createElement("div");
    handle.style.position = "absolute";
    handle.style.right = "-6px";
    handle.style.bottom = "-6px";
    handle.style.width = "12px";
    handle.style.height = "12px";
    handle.style.backgroundColor = "#3b82f6";
    handle.style.border = "1px solid white";
    handle.style.cursor = "se-resize";
    handle.style.pointerEvents = "auto";
    
    let startX = 0;
    let startWidth = 0;
    
    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      startX = e.clientX;
      startWidth = this.img!.clientWidth;
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };
    
    const onMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      const newWidth = Math.max(50, startWidth + delta);
      this.img!.style.width = `${newWidth}px`;
      this.img!.style.height = "auto";
      this.updateOverlayPosition();
    };
    
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      this.quill.update();
    };
    
    handle.addEventListener("mousedown", onMouseDown);
    this.overlay.appendChild(handle);
    
    // Add small alignment toolbar
    const toolbar = document.createElement("div");
    toolbar.style.position = "absolute";
    toolbar.style.top = "-32px";
    toolbar.style.left = "50%";
    toolbar.style.transform = "translateX(-50%)";
    toolbar.style.display = "flex";
    toolbar.style.gap = "4px";
    toolbar.style.backgroundColor = "#1e293b";
    toolbar.style.padding = "4px";
    toolbar.style.borderRadius = "8px";
    toolbar.style.boxShadow = "0 4px 6px -1px rgb(0 0 0 / 0.1)";
    toolbar.style.pointerEvents = "auto";

    const createButton = (label: string, styleSetter: () => void) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.innerText = label;
      btn.style.color = "white";
      btn.style.fontSize = "10px";
      btn.style.fontWeight = "bold";
      btn.style.padding = "2px 6px";
      btn.style.borderRadius = "4px";
      btn.style.backgroundColor = "transparent";
      btn.style.border = "none";
      btn.style.cursor = "pointer";
      btn.addEventListener("mouseenter", () => (btn.style.backgroundColor = "#334155"));
      btn.addEventListener("mouseleave", () => (btn.style.backgroundColor = "transparent"));
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        styleSetter();
        this.updateOverlayPosition();
        this.quill.update();
      });
      return btn;
    };

    const btnLeft = createButton("Left", () => {
      this.img!.style.float = "left";
      this.img!.style.display = "inline";
      this.img!.style.margin = "0 16px 16px 0";
    });
    const btnCenter = createButton("Center", () => {
      this.img!.style.float = "none";
      this.img!.style.display = "block";
      this.img!.style.margin = "16px auto";
    });
    const btnRight = createButton("Right", () => {
      this.img!.style.float = "right";
      this.img!.style.display = "inline";
      this.img!.style.margin = "0 0 16px 16px";
    });
    const btnInline = createButton("Inline", () => {
      this.img!.style.float = "none";
      this.img!.style.display = "inline";
      this.img!.style.margin = "0";
    });

    // Red delete button on the right end
    const btnDelete = document.createElement("button");
    btnDelete.type = "button";
    btnDelete.innerText = "✕ Delete";
    btnDelete.style.color = "#f43f5e";
    btnDelete.style.fontSize = "10px";
    btnDelete.style.fontWeight = "bold";
    btnDelete.style.padding = "2px 8px";
    btnDelete.style.borderRadius = "4px";
    btnDelete.style.backgroundColor = "rgba(244, 63, 94, 0.1)";
    btnDelete.style.border = "1px solid rgba(244, 63, 94, 0.3)";
    btnDelete.style.cursor = "pointer";
    btnDelete.style.marginLeft = "4px";
    btnDelete.addEventListener("mouseenter", () => {
      btnDelete.style.backgroundColor = "#e11d48";
      btnDelete.style.color = "white";
    });
    btnDelete.addEventListener("mouseleave", () => {
      btnDelete.style.backgroundColor = "rgba(244, 63, 94, 0.1)";
      btnDelete.style.color = "#f43f5e";
    });
    btnDelete.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.img) {
        try {
          const blot = Quill.find(this.img);
          if (blot) {
            blot.deleteAt(0);
          } else {
            this.img.remove();
          }
        } catch (delErr) {
          this.img.remove();
        }
        this.hideOverlay();
        this.quill.update();
      }
    });

    toolbar.appendChild(btnLeft);
    toolbar.appendChild(btnCenter);
    toolbar.appendChild(btnRight);
    toolbar.appendChild(btnInline);
    toolbar.appendChild(btnDelete);
    this.overlay.appendChild(toolbar);
    
    this.quill.root.parentNode.appendChild(this.overlay);
  }

  updateOverlayPosition() {
    if (!this.overlay || !this.img) return;
    const rect = this.img.getBoundingClientRect();
    const parentRect = this.quill.root.parentNode.getBoundingClientRect();
    
    this.overlay.style.left = `${rect.left - parentRect.left}px`;
    this.overlay.style.top = `${rect.top - parentRect.top}px`;
    this.overlay.style.width = `${rect.width}px`;
    this.overlay.style.height = `${rect.height}px`;
  }

  hideOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }
}

const Font = Quill.import("formats/font") as any;
if (Font) {
  Font.whitelist = ["sacramento", "cormorant-garamond", "serif", "monospace", "roboto"];
  Quill.register(Font, true);
}

const Size = Quill.import("formats/size") as any;
if (Size) {
  Size.whitelist = ["small", "normal", "large", "huge"];
  Quill.register(Size, true);
}

Quill.register("modules/imageResize", SimpleImageResize);

const props = defineProps<{ id: string }>();
const router = useRouter();

const post = ref<CMSPost | null>(null);
const quillInstance = ref<Quill | null>(null);

const postTitle = ref("");
const postSlug = ref("");
const postExcerpt = ref("");
const featureImage = ref("");
const areCommentsEnabled = ref(true);
const postAuthor = ref("Admin");
const loading = ref(true);
const saving = ref(false);

// SEO
const showSeoModal = ref(false);
const seoTitle = ref("");
const seoDescription = ref("");

// Tags State & Auto-complete
const tagInput = ref("");
const showTagAutocomplete = ref(false);
const activeTags = ref<string[]>([]);
const allTags = ref<string[]>(["Tech", "Design", "Updates", "News", "Tutorial", "Security", "AI", "Development", "Stripe"]);

const modal = ref({
  show: false,
  title: "",
  message: "",
  shouldRedirect: false,
});

const showAlert = (title: string, message: string, shouldRedirect = false) => {
  modal.value = { show: true, title, message, shouldRedirect };
};

const closeModal = () => {
  modal.value.show = false;
  if (modal.value.shouldRedirect) {
    router.push("/blog");
  }
};

// Gallery State
const showGalleryModal = ref(false);
const galleryLoading = ref(false);
const galleryAssets = ref<any[]>([]);
const isQuillImageSelection = ref(false);
const lastQuillSelectionIndex = ref(0);

// AI Copyeditor State & Methods
const scanningAI = ref(false);
const scannedOnce = ref(false);
const aiCorrections = ref<Array<{ originalText: string; suggestedText: string; reason: string }>>([]);

const runProofreader = async () => {
  if (!quillInstance.value) return;
  const rawText = quillInstance.value.getText().trim();
  if (!rawText) return;

  scanningAI.value = true;
  scannedOnce.value = false;
  aiCorrections.value = [];

  try {
    const data: any = await cachedFetch("/api/ai/proofread", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: rawText }),
    });
    aiCorrections.value = data.corrections || [];
    scannedOnce.value = true;
  } catch (err) {
    console.error("Proofreader request failed:", err);
  } finally {
    scanningAI.value = false;
  }
};

const applyCorrection = (corr: { originalText: string; suggestedText: string; reason: string }) => {
  if (!quillInstance.value) return;
  const text = quillInstance.value.getText();
  const index = text.indexOf(corr.originalText);
  if (index !== -1) {
    quillInstance.value.deleteText(index, corr.originalText.length);
    quillInstance.value.insertText(index, corr.suggestedText);
    
    // Remove the correction from the list
    aiCorrections.value = aiCorrections.value.filter(c => c !== corr);
  }
};

// AI Post Generator State & Methods
const aiGenerationPrompt = ref("");
const generatingPost = ref(false);

const generatePostFromPrompt = async () => {
  if (!aiGenerationPrompt.value.trim() || !quillInstance.value) return;

  generatingPost.value = true;
  try {
    const data: any = await cachedFetch("/api/ai/generate-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: aiGenerationPrompt.value }),
    });

    if (data.title) postTitle.value = data.title;
    if (data.content) quillInstance.value.root.innerHTML = data.content;
    
    aiGenerationPrompt.value = "";
    showAlert("Success", "Blog post content generated successfully!", false);
  } catch (err) {
    console.error("Post generation failed:", err);
    showAlert("Error", "Failed to generate blog post. Please try again.", false);
  } finally {
    generatingPost.value = false;
  }
};

// Search & Pagination inside Gallery Modal
const gallerySearchQuery = ref("");
const galleryCurrentPage = ref(1);
const galleryItemsPerPage = ref(6);

// Giphy Modal State & Methods
const showGiphyModal = ref(false);
const giphySearchQuery = ref("");
const giphyLoading = ref(false);
const giphyResults = ref<any[]>([]);
const lastGiphySelectionIndex = ref(0);

const FALLBACK_GIFS = [
  { id: "1", title: "Excited Cat", preview: "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif", original: "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif" },
  { id: "2", title: "Happy Dance", preview: "https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif", original: "https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif" },
  { id: "3", title: "Mind Blown", preview: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif", original: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif" },
  { id: "4", title: "Thumbs Up", preview: "https://media.giphy.com/media/111ebonMs90YLu/giphy.gif", original: "https://media.giphy.com/media/111ebonMs90YLu/giphy.gif" },
  { id: "5", title: "Confused Travolta", preview: "https://media.giphy.com/media/g01ZnwAUvutuK8GIQn/giphy.gif", original: "https://media.giphy.com/media/g01ZnwAUvutuK8GIQn/giphy.gif" },
  { id: "6", title: "Popcorn", preview: "https://media.giphy.com/media/GLbiGvv9qrpny/giphy.gif", original: "https://media.giphy.com/media/GLbiGvv9qrpny/giphy.gif" },
  { id: "7", title: "Celebration", preview: "https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif", original: "https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif" },
  { id: "8", title: "Writing Typing", preview: "https://media.giphy.com/media/unQ3IJU2RG7DO/giphy.gif", original: "https://media.giphy.com/media/unQ3IJU2RG7DO/giphy.gif" },
];

const fetchGiphyGifs = async (query = "") => {
  giphyLoading.value = true;
  try {
    const q = query.trim();
    const endpoint = q 
      ? `https://api.giphy.com/v1/gifs/search?api_key=sXpGFDGZs0Dv1mmNFvYaGUvYwKX0PWIh&q=${encodeURIComponent(q)}&limit=24&rating=g`
      : `https://api.giphy.com/v1/gifs/trending?api_key=sXpGFDGZs0Dv1mmNFvYaGUvYwKX0PWIh&limit=24&rating=g`;
    
    const resp = await fetch(endpoint);
    if (resp.ok) {
      const data = await resp.json();
      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        giphyResults.value = data.data.map((item: any) => ({
          id: item.id,
          title: item.title || "GIF",
          preview: item.images?.fixed_height?.url || item.images?.downsized?.url || item.images?.original?.url,
          original: item.images?.original?.url || item.images?.downsized?.url
        }));
      } else {
        giphyResults.value = FALLBACK_GIFS.filter(g => !q || g.title.toLowerCase().includes(q.toLowerCase()));
      }
    } else {
      giphyResults.value = FALLBACK_GIFS.filter(g => !q || g.title.toLowerCase().includes(q.toLowerCase()));
    }
  } catch (err) {
    console.warn("Giphy API error, falling back to local list:", err);
    const q = query.trim().toLowerCase();
    giphyResults.value = FALLBACK_GIFS.filter(g => !q || g.title.toLowerCase().includes(q));
  } finally {
    giphyLoading.value = false;
  }
};

let giphyDebounceTimer: any = null;
watch(giphySearchQuery, (newVal) => {
  clearTimeout(giphyDebounceTimer);
  giphyDebounceTimer = setTimeout(() => {
    fetchGiphyGifs(newVal);
  }, 350);
});

const openGiphyModal = () => {
  let range = null;
  try {
    range = quillInstance.value?.getSelection();
  } catch (e) {
    // ignore
  }
  lastGiphySelectionIndex.value = range ? range.index : (quillInstance.value?.getLength() || 1) - 1;
  showGiphyModal.value = true;
  if (giphyResults.value.length === 0) {
    fetchGiphyGifs();
  }
};

const selectGiphyGif = (url: string) => {
  if (quillInstance.value) {
    try {
      quillInstance.value.focus();
      quillInstance.value.insertEmbed(lastGiphySelectionIndex.value, "image", url);
      quillInstance.value.setSelection(lastGiphySelectionIndex.value + 1, 0);
    } catch (e) {
      quillInstance.value.root.innerHTML += `<p><img src="${url}" /></p>`;
    }
  }
  showGiphyModal.value = false;
};

watch(gallerySearchQuery, () => {
  galleryCurrentPage.value = 1;
});

watch(postTitle, (newVal) => {
  postSlug.value = newVal
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
});

const filteredGalleryAssets = computed(() => {
  const query = gallerySearchQuery.value.toLowerCase().trim();
  if (!query) return galleryAssets.value;
  return galleryAssets.value.filter((a) => a.name.toLowerCase().includes(query));
});

const totalGalleryPages = computed(() => {
  return Math.ceil(filteredGalleryAssets.value.length / galleryItemsPerPage.value) || 1;
});

const paginatedGalleryAssets = computed(() => {
  const start = (galleryCurrentPage.value - 1) * galleryItemsPerPage.value;
  return filteredGalleryAssets.value.slice(start, start + galleryItemsPerPage.value);
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

const closeGalleryModal = () => {
  showGalleryModal.value = false;
  isQuillImageSelection.value = false;
};

const selectGalleryImage = (url: string) => {
  if (isQuillImageSelection.value && quillInstance.value) {
    try {
      quillInstance.value.focus();
      quillInstance.value.insertEmbed(lastQuillSelectionIndex.value, "image", url);
      quillInstance.value.setSelection(lastQuillSelectionIndex.value + 1, 0);
    } catch (e) {
      console.warn("Quill insertEmbed error caught, using fallback HTML append:", e);
      quillInstance.value.root.innerHTML += `<p><img src="${url}" /></p>`;
    }
    isQuillImageSelection.value = false;
  } else {
    featureImage.value = url;
  }
  showGalleryModal.value = false;
};

// Tags management
const filteredTags = computed(() => {
  const query = tagInput.value.toLowerCase().trim();
  if (!query) {
    return allTags.value.filter(t => !activeTags.value.includes(t)).slice(0, 5);
  }
  return allTags.value.filter(
    t => t.toLowerCase().includes(query) && !activeTags.value.includes(t)
  ).slice(0, 5);
});

const addTag = (tag: string) => {
  const cleaned = tag.trim();
  if (cleaned && !activeTags.value.includes(cleaned)) {
    activeTags.value.push(cleaned);
  }
  tagInput.value = "";
  showTagAutocomplete.value = false;
};

const addTagFromInput = () => {
  if (tagInput.value) {
    addTag(tagInput.value);
  }
};

const removeTag = (tag: string) => {
  activeTags.value = activeTags.value.filter(t => t !== tag);
};

const handleTagBlur = () => {
  setTimeout(() => {
    showTagAutocomplete.value = false;
  }, 200);
};

const fetchPost = async () => {
  try {
    const posts: CMSPost[] = await cachedFetch("/api/posts");
      
      // Extract popular tags from other posts
      const tagsSet = new Set<string>(allTags.value);
      posts.forEach(p => {
        if (p.tags) {
          p.tags.split(",").forEach(t => {
            const trimmed = t.trim();
            if (trimmed) tagsSet.add(trimmed);
          });
        }
      });
      allTags.value = Array.from(tagsSet);

      const current = posts.find((p) => p.id === props.id);
      if (current) {
        post.value = current;
        postTitle.value = current.title;
        postSlug.value = current.slug;
        postExcerpt.value = current.excerpt || "";
        featureImage.value = current.featureImage || "";
        seoTitle.value = current.seoMetadata?.title || "";
        seoDescription.value = current.seoMetadata?.description || "";
        areCommentsEnabled.value = current.areCommentsEnabled !== false;
        postAuthor.value = current.author || "Admin";
        activeTags.value = current.tags ? current.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
        
        // Turn off loading first, triggering DOM render of editor-container
        loading.value = false;
        await nextTick();
        
        const container = document.querySelector("#editor-container");
        if (container) {
          quillInstance.value = new Quill("#editor-container", {
            theme: "snow",
            modules: {
              imageResize: {},
              toolbar: {
                container: [
                  [{ font: ["", "sacramento", "cormorant-garamond", "serif", "monospace", "roboto"] }],
                  [{ size: ["small", false, "large", "huge"] }],
                  [{ header: [1, 2, 3, false] }],
                  ["bold", "italic", "underline", "strike"],
                  [{ color: [] }, { background: [] }],
                  ["blockquote", "code-block"],
                  [{ list: "ordered" }, { list: "bullet" }],
                  [{ align: [] }],
                  ["link", "image", "giphy"],
                  ["clean"],
                ],
                handlers: {
                  giphy: () => {
                    openGiphyModal();
                  }
                }
              },
            },
          });
          
          quillInstance.value.root.setAttribute("spellcheck", "true");
          
          // Custom image handler to open our S3 gallery
          quillInstance.value.getModule("toolbar").addHandler("image", () => {
            let range = null;
            try {
              range = quillInstance.value?.getSelection();
            } catch (e) {
              console.warn("Quill selection error caught, using fallback index:", e);
            }
            lastQuillSelectionIndex.value = range ? range.index : (quillInstance.value?.getLength() || 1) - 1;
            isQuillImageSelection.value = true;
            openGalleryModal();
          });

          quillInstance.value.root.innerHTML = current.content || "";
        }
      }
  } catch (err) {
    console.error("Failed to load blog post:", err);
    loading.value = false;
  }
};

const savePost = async (status: 'draft' | 'published') => {
  if (!quillInstance.value) return;
  saving.value = true;
  try {
    let excerptVal = postExcerpt.value;
    if (!excerptVal || excerptVal.trim() === "") {
      const rawText = quillInstance.value.root.innerText || "";
      excerptVal = rawText.trim().substring(0, 160);
      if (rawText.length > 160) {
        excerptVal += "...";
      }
      postExcerpt.value = excerptVal;
    }

    let seoDescVal = seoDescription.value;
    if (!seoDescVal || seoDescVal.trim() === "") {
      seoDescVal = excerptVal.length > 155 ? excerptVal.substring(0, 155) + "..." : excerptVal;
      seoDescription.value = seoDescVal;
    }

    const updatedPost: Partial<CMSPost> = {
      title: postTitle.value,
      slug: postSlug.value,
      excerpt: excerptVal,
      tags: activeTags.value.join(", "),
      featureImage: featureImage.value,
      content: quillInstance.value.root.innerHTML,
      status,
      areCommentsEnabled: areCommentsEnabled.value,
      author: postAuthor.value,
      seoMetadata: {
        title: seoTitle.value,
        description: seoDescVal,
      },
    };

    await cachedFetch(`/api/posts/${props.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedPost),
    });
    showAlert("Success", `Post saved successfully as ${status}!`, true);
  } catch (err) {
    console.error("Failed to save post:", err);
  } finally {
    saving.value = false;
  }
};

onMounted(async () => {
  await fetchPost();
});
</script>

<style>
.ql-toolbar.ql-snow {
  border-top: none;
  border-left: none;
  border-right: none;
  border-bottom: 1px solid #e2e8f0;
}
.ql-container.ql-snow {
  border: none;
}
.dark .ql-toolbar.ql-snow {
  border-bottom-color: #334155;
  background-color: #0f172a;
}
.dark .ql-snow .ql-stroke {
  stroke: #94a3b8;
}
.dark .ql-snow .ql-fill {
  fill: #94a3b8;
}
.dark .ql-snow .ql-picker {
  color: #94a3b8;
}
.dark .ql-snow .ql-picker-options {
  background-color: #1e293b;
  border-color: #334155;
}

/* Custom Quill Fonts */
.ql-snow .ql-picker.ql-font .ql-picker-label[data-value="sacramento"]::before,
.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="sacramento"]::before {
  content: 'Sacramento';
  font-family: 'Sacramento', cursive;
}
.ql-font-sacramento {
  font-family: 'Sacramento', cursive;
}

.ql-snow .ql-picker.ql-font .ql-picker-label[data-value="cormorant-garamond"]::before,
.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="cormorant-garamond"]::before {
  content: 'Cormorant';
  font-family: 'Cormorant Garamond', serif;
}
.ql-font-cormorant-garamond {
  font-family: 'Cormorant Garamond', serif;
}

.ql-snow .ql-picker.ql-font .ql-picker-label[data-value="serif"]::before,
.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="serif"]::before {
  content: 'Serif';
  font-family: Georgia, Times New Roman, serif;
}
.ql-font-serif {
  font-family: Georgia, Times New Roman, serif;
}

.ql-snow .ql-picker.ql-font .ql-picker-label[data-value="monospace"]::before,
.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="monospace"]::before {
  content: 'Monospace';
  font-family: Monaco, Courier New, monospace;
}
.ql-font-monospace {
  font-family: Monaco, Courier New, monospace;
}

.ql-snow .ql-picker.ql-font .ql-picker-label[data-value="roboto"]::before,
.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="roboto"]::before {
  content: 'Roboto';
  font-family: 'Roboto', sans-serif;
}
.ql-font-roboto {
  font-family: 'Roboto', sans-serif;
}

/* Custom Giphy Toolbar Button */
.ql-snow button.ql-giphy {
  width: 28px !important;
  font-weight: 900 !important;
  font-size: 10px !important;
  position: relative;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
}
.ql-snow button.ql-giphy::after {
  content: 'GIF';
  font-size: 9px;
  font-weight: 900;
  background: linear-gradient(135deg, #ec4899, #8b5cf6);
  color: white;
  padding: 1px 4px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}
</style>
