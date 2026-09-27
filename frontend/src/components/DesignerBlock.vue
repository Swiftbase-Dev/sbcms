<template>
  <div
    :class="wrapperClasses"
    :style="wrapperStyles"
    @click.stop="onSelect"
    draggable="true"
    @dragstart.stop="onDragStart"
    @dragover.prevent.stop="onDragOver"
    @dragenter.prevent.stop="onDragEnter"
    @dragleave.stop="onDragLeave"
    @drop.prevent.stop="onDrop"
  >
    <!-- Drop indicator lines -->
    <div v-if="dropPosition === 'before'" class="absolute -top-1 left-0 right-0 h-1 bg-primary z-30 rounded animate-pulse"></div>
    <div v-if="dropPosition === 'after'" class="absolute -bottom-1 left-0 right-0 h-1 bg-primary z-30 rounded animate-pulse"></div>
    <div v-if="dropPosition === 'inside'" class="absolute inset-0 bg-primary/5 border-2 border-primary border-dashed z-20 pointer-events-none rounded"></div>

    <!-- Active Selection Overlay Options -->
    <div v-if="isSelected" class="absolute -top-6 right-2 z-40 flex items-center gap-1.5 bg-primary text-white text-[9px] font-black uppercase px-2 py-1 rounded shadow-lg select-none">
      <span>{{ block.type }}</span>
      <button @click.stop="$emit('duplicate', block.id)" title="Duplicate" class="hover:text-primary-content opacity-75 hover:opacity-100 transition-opacity flex items-center">
        <font-awesome-icon :icon="['fas', 'copy']" class="w-3 h-3" />
      </button>
      <button @click.stop="$emit('remove', block.id)" title="Delete" class="hover:text-red-300 opacity-75 hover:opacity-100 transition-opacity flex items-center">
        <font-awesome-icon :icon="['fas', 'trash-can']" class="w-3 h-3" />
      </button>
    </div>

    <!-- Recursive Component Renderer mapping tagName -->

    <!-- Image Blocks -->
    <img
      v-if="block.type === 'image' || block.tagName === 'img'"
      :src="block.attributes?.src || 'https://via.placeholder.com/600x400'"
      :alt="block.attributes?.alt || 'Image element'"
      :class="classesString"
      :style="computedStyles"
    />

    <!-- Text Block with contenteditable for fast adjustments -->
    <component
      v-else-if="isTextBlock"
      :is="block.tagName"
      :class="[classesString, 'focus:outline-none']"
      :data-block-id="block.id"
      contenteditable="true"
      @blur="onBlur"
      @keydown.enter.prevent="onEnter"
      v-html="block.content"
      :style="computedStyles"
    ></component>

    <!-- Custom HTML Block -->
    <div
      v-else-if="block.type === 'html'"
      :class="classesString"
      v-html="block.content"
      :style="computedStyles"
    ></div>

    <!-- Recent Blog Posts Dynamic Block -->
    <div
      v-else-if="block.type === 'recent-posts'"
      :class="[classesString, 'recent-posts-block']"
      :style="computedStyles"
    >
      <div v-if="loadingPosts" class="flex justify-center py-6">
        <span class="loading loading-spinner loading-md text-primary"></span>
      </div>
      <div v-else-if="filteredPosts.length === 0" class="p-6 text-center border border-dashed border-base-200 dark:border-slate-800 rounded-2xl bg-base-200/10">
        <font-awesome-icon :icon="['fas', 'newspaper']" class="w-6 h-6 mb-2 opacity-40 mx-auto" />
        <p class="text-xs opacity-50 font-bold uppercase">No matching blog posts found</p>
        <p class="text-[10px] opacity-40 mt-0.5">Ensure posts are published and match tag filters.</p>
      </div>
      <div v-else class="space-y-4">
        <div 
          v-for="post in filteredPosts" 
          :key="post.id" 
          class="flex flex-col md:flex-row gap-4 p-4 border border-base-200 dark:border-slate-800/80 rounded-2xl bg-white dark:bg-slate-900/40 shadow-sm"
        >
          <div v-if="post.featureImage" class="w-full md:w-32 h-20 shrink-0 bg-slate-100 dark:bg-slate-850 rounded-xl overflow-hidden">
            <img :src="post.featureImage" class="w-full h-full object-cover" />
          </div>
          <div class="flex-1 min-w-0 flex flex-col justify-between">
            <div>
              <h4 class="font-bold text-xs text-slate-900 dark:text-white truncate mb-1">{{ post.title }}</h4>
              <p class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-2">{{ post.excerpt || 'Read this post on our blog...' }}</p>
            </div>
            <div class="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400">
              <span>{{ post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : 'Draft' }}</span>
              <span v-if="post.tags" class="badge badge-sm rounded-lg opacity-85 text-[8px] bg-slate-100 dark:bg-slate-800 border-none">{{ post.tags }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Store Products Dynamic Block -->
    <div
      v-else-if="block.type === 'products-widget'"
      :class="[classesString, 'cms-products-widget']"
      :style="computedStyles"
    >
      <div v-if="loadingProducts" class="flex justify-center py-6">
        <span class="loading loading-spinner loading-md text-primary"></span>
      </div>
      <div v-else-if="filteredProducts.length === 0" class="p-6 text-center border border-dashed border-base-200 dark:border-slate-800 rounded-2xl bg-base-200/10">
        <font-awesome-icon :icon="['fas', 'cart-shopping']" class="w-6 h-6 mb-2 opacity-40 mx-auto" />
        <p class="text-xs opacity-50 font-bold uppercase">No matching products found</p>
        <p class="text-[10px] opacity-40 mt-0.5">Ensure products exist and match category/stock filters.</p>
      </div>
      <div v-else class="space-y-4">
        <!-- Widget Preview Filter Bar -->
        <div v-if="block.attributes?.showSearch !== 'false' || block.attributes?.showCategories !== 'false'" class="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-850/50 rounded-2xl border border-base-200 dark:border-slate-800">
          <div v-if="block.attributes?.showSearch !== 'false'" class="text-xs text-slate-400 font-mono">
            🔍 Search filter enabled
          </div>
          <div v-if="block.attributes?.showCategories !== 'false'" class="text-xs text-slate-400 font-mono">
            🏷️ Category filter enabled
          </div>
          <div v-if="block.attributes?.defaultCategory" class="badge badge-xs badge-primary font-bold">
            Locked Category: {{ block.attributes.defaultCategory }}
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="prod in filteredProducts"
            :key="prod.id"
            class="card bg-white dark:bg-slate-900 border border-base-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between"
          >
            <div class="relative h-36 bg-slate-100 dark:bg-slate-800 shrink-0">
              <img v-if="prod.images && prod.images.length > 0" :src="prod.images[0]" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold">No Image</div>
              <span v-if="prod.category" class="absolute top-2 left-2 badge badge-xs bg-black/60 text-white border-none font-bold">
                {{ prod.category }}
              </span>
            </div>
            <div class="p-4 flex-1 flex flex-col justify-between gap-2">
              <div>
                <div class="flex justify-between items-start">
                  <h4 class="font-bold text-xs text-slate-900 dark:text-white truncate">{{ prod.name }}</h4>
                  <span class="font-black text-primary text-xs">${{ (prod.priceCents / 100).toFixed(2) }}</span>
                </div>
                <div class="text-[11px] opacity-60 line-clamp-2 mt-1" v-html="prod.description || ''"></div>
              </div>
              <div class="flex gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button class="btn btn-xs btn-primary rounded-lg flex-1 text-white font-bold text-[9px] pointer-events-none">Add to Cart</button>
                <button class="btn btn-xs btn-outline rounded-lg font-bold text-[9px] pointer-events-none">Buy Now</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- E-book Preview Dynamic Widget -->
    <div
      v-else-if="block.type === 'ebook-preview-widget'"
      :class="[classesString, 'cms-ebook-preview-widget']"
      :style="computedStyles"
    >
      <div class="max-w-2xl mx-auto p-6 bg-white dark:bg-slate-900 border border-base-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-5">
        <div class="flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-5 border-b border-base-200 dark:border-slate-800">
          <div class="w-20 h-28 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden shadow-sm flex items-center justify-center">
            <img v-if="block.attributes?.['data-cover-image']" :src="block.attributes['data-cover-image']" class="w-full h-full object-cover" />
            <div v-else class="text-center p-2 text-slate-400">
              <font-awesome-icon :icon="['fas', 'book-open']" class="text-xl mb-1 opacity-40" />
              <span class="text-[8px] font-black uppercase tracking-wider block">Preview</span>
            </div>
          </div>
          <div class="flex-1 text-center sm:text-left">
            <span class="badge badge-primary badge-sm font-black uppercase text-[8px] tracking-widest mb-1.5">E-book Sample Reader</span>
            <h4 class="font-black text-lg text-slate-900 dark:text-white leading-tight">
              {{ block.attributes?.['data-book-title'] || 'Sample Book Title' }}
            </h4>
            <p class="text-xs text-slate-400 mt-0.5">by {{ block.attributes?.['data-author'] || 'Author Name' }}</p>
            <div class="flex items-center justify-center sm:justify-start gap-1.5 mt-3 text-[10px]">
              <span class="btn btn-xs btn-outline rounded-lg text-[9px] pointer-events-none">A-</span>
              <span class="btn btn-xs btn-outline rounded-lg text-[9px] pointer-events-none">A+</span>
              <span class="btn btn-xs btn-outline rounded-lg text-[9px] pointer-events-none">🌓 Theme</span>
            </div>
          </div>
        </div>

        <div class="prose max-w-none text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-serif line-clamp-6">
          {{ block.attributes?.['data-sample-content'] || 'Chapter 1: The Beginning... (Configure sample content in properties inspector)' }}
        </div>

        <div class="pt-4 border-t border-base-200 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
          <span>Interactive Preview Widget</span>
          <span class="text-primary font-bold">Buy Full Book &rarr;</span>
        </div>
      </div>
    </div>

    <!-- Inputs/Buttons & non-recursive tag leaves -->
    <input

      v-else-if="block.tagName === 'input'"
      :type="block.attributes?.type || 'text'"
      :placeholder="block.attributes?.placeholder || ''"
      :class="classesString"
      :style="computedStyles"
      disabled
    />

    <textarea
      v-else-if="block.tagName === 'textarea'"
      :placeholder="block.attributes?.placeholder || ''"
      :class="classesString"
      :style="computedStyles"
      disabled
    ></textarea>

    <!-- Button elements -->
    <button
      v-else-if="block.tagName === 'button'"
      :class="classesString"
      :style="computedStyles"
      type="button"
    >
      {{ block.content || 'Button' }}
    </button>

    <!-- FontAwesome Icon elements -->
    <font-awesome-icon
      v-else-if="block.tagName === 'font-awesome-icon' || block.type === 'icon'"
      :icon="['fas', block.attributes?.icon || 'star']"
      :class="classesString"
      :style="computedStyles"
    />

    <component
      v-else-if="true"
      :is="block.tagName"
      :class="[
        classesString,
        block.children?.length === 0 ? 'min-h-[60px] border border-dashed border-base-content/25 flex items-center justify-center rounded-xl bg-base-200/20' : ''
      ]"
      :style="computedStyles"
    >
      <div v-if="block.children?.length === 0" class="text-[9px] uppercase tracking-wider font-bold opacity-30 pointer-events-none">
        Empty {{ block.type }} container (Drop elements here)
      </div>
      <DesignerBlock
        v-for="child in block.children"
        :key="child.id"
        :block="child"
        :selectedId="selectedId"
        :showOutlines="showOutlines"
        @select="$emit('select', $event)"
        @drag-block="onChildDragBlock"
        @update-content="onChildUpdateContent"
        @remove="$emit('remove', $event)"
        @duplicate="$emit('duplicate', $event)"
      />
    </component>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, ref, onMounted } from "vue";

// Define recursive component name for template self-reference
export default defineComponent({
  name: "DesignerBlock",
  props: {
    block: {
      type: Object,
      required: true
    },
    selectedId: {
      type: String,
      default: ""
    },
    showOutlines: {
      type: Boolean,
      default: true
    }
  },
  emits: ["select", "drag-block", "update-content", "remove", "duplicate"],
  setup(props, { emit }) {
    const dropPosition = ref<'before' | 'after' | 'inside' | null>(null);

    const isSelected = computed(() => {
      return props.selectedId === props.block.id;
    });

    const isTextBlock = computed(() => {
      const tags = ["p", "h1", "h2", "h3", "h4", "h5", "h6", "span", "a", "li", "label"];
      return tags.includes(props.block.tagName);
    });

    const isContainer = computed(() => {
      const containerTypes = ["row", "column", "section", "container", "card", "form", "div", "ul", "ol", "header", "footer", "nav", "carousel"];
      return containerTypes.includes(props.block.type) || containerTypes.includes(props.block.tagName);
    });

    const isLayoutClass = (cls: string): boolean => {
      const baseCls = cls.includes(":") ? cls.split(":").pop()! : cls;
      return (
        baseCls.startsWith("w-") ||
        baseCls.startsWith("h-") ||
        baseCls.startsWith("min-w-") ||
        baseCls.startsWith("min-h-") ||
        baseCls.startsWith("max-w-") ||
        baseCls.startsWith("max-h-") ||
        baseCls.startsWith("m-") ||
        baseCls.startsWith("mt-") ||
        baseCls.startsWith("mr-") ||
        baseCls.startsWith("mb-") ||
        baseCls.startsWith("ml-") ||
        baseCls.startsWith("mx-") ||
        baseCls.startsWith("my-") ||
        baseCls === "flex-1" ||
        baseCls === "flex-auto" ||
        baseCls === "flex-initial" ||
        baseCls === "flex-none" ||
        baseCls.startsWith("grow") ||
        baseCls.startsWith("shrink") ||
        baseCls.startsWith("self-") ||
        baseCls.startsWith("col-span-") ||
        baseCls.startsWith("row-span-") ||
        baseCls === "absolute" ||
        baseCls === "relative" ||
        baseCls === "fixed" ||
        baseCls === "sticky" ||
        baseCls.startsWith("top-") ||
        baseCls.startsWith("bottom-") ||
        baseCls.startsWith("left-") ||
        baseCls.startsWith("right-") ||
        baseCls.startsWith("inset-") ||
        baseCls.startsWith("z-")
      );
    };

    const wrapperClasses = computed(() => {
      const list = ["relative group"];
      if (props.showOutlines) {
        list.push("outline-dashed outline-[1px] outline-slate-300 dark:outline-slate-800");
      }
      if (isSelected.value) {
        list.push("ring-2 ring-primary ring-offset-1 rounded-sm");
      } else {
        list.push("hover:ring-1 hover:ring-primary/40");
      }

      if (Array.isArray(props.block.classes)) {
        props.block.classes.forEach((cls: string) => {
          if (isLayoutClass(cls)) list.push(cls);
        });
      } else if (typeof props.block.classes === "string") {
        props.block.classes.split(" ").forEach((cls: string) => {
          if (isLayoutClass(cls)) list.push(cls);
        });
      }
      return list;
    });

    const classesString = computed(() => {
      const list: string[] = [];
      let hasWidthClass = false;
      let hasHeightClass = false;

      const processClass = (cls: string) => {
        if (isLayoutClass(cls)) {
          const baseCls = cls.includes(":") ? cls.split(":").pop()! : cls;
          if (baseCls.startsWith("w-")) hasWidthClass = true;
          if (baseCls.startsWith("h-")) hasHeightClass = true;
        } else {
          list.push(cls);
        }
      };

      if (Array.isArray(props.block.classes)) {
        props.block.classes.forEach(processClass);
      } else if (typeof props.block.classes === "string") {
        props.block.classes.split(" ").forEach(processClass);
      }

      if (hasWidthClass) list.push("w-full");
      if (hasHeightClass) list.push("h-full");

      return list.join(" ");
    });

    const computedStyles = computed(() => {
      const base: Record<string, string> = {};
      if (props.block.styles) {
        const layoutKeys = [
          "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
          "width", "height", "max-width", "max-height", "min-width", "min-height",
          "position", "top", "right", "bottom", "left", "z-index",
          "flex", "flex-grow", "flex-shrink", "flex-basis", "align-self", "justify-self",
          "grid-area", "grid-column", "grid-row",
          "border-radius", "border-top-left-radius", "border-top-right-radius", "border-bottom-left-radius", "border-bottom-right-radius"
        ];
        
        for (const [key, val] of Object.entries(props.block.styles)) {
          if (!layoutKeys.includes(key)) {
            base[key] = val as string;
          }
        }
      }
      return base;
    });

    const wrapperStyles = computed(() => {
      const base: Record<string, string> = {};
      if (props.block.type === "column") {
        base["min-height"] = "80px";
      }
      if (props.block.styles) {
        const layoutKeys = [
          "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
          "width", "height", "max-width", "max-height", "min-width", "min-height",
          "position", "top", "right", "bottom", "left", "z-index",
          "flex", "flex-grow", "flex-shrink", "flex-basis", "align-self", "justify-self",
          "grid-area", "grid-column", "grid-row",
          "border-radius", "border-top-left-radius", "border-top-right-radius", "border-bottom-left-radius", "border-bottom-right-radius"
        ];
        for (const key of layoutKeys) {
          if (props.block.styles[key] !== undefined) {
            base[key] = props.block.styles[key];
          }
        }
      }
      return base;
    });

    const onSelect = () => {
      emit("select", props.block);
    };

    const onBlur = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      emit("update-content", { id: props.block.id, content: target.innerHTML });
    };

    const onEnter = (e: Event) => {
      const target = e.target as HTMLElement;
      target.blur();
    };

    // Drag events
    const onDragStart = (e: DragEvent) => {
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", props.block.id);
        e.dataTransfer.setData("blockId", props.block.id);
      }
    };

    const postsList = ref<any[]>([]);
    const loadingPosts = ref(false);

    const fetchPostsForPreview = async () => {
      if (props.block.type !== "recent-posts") return;
      loadingPosts.value = true;
      try {
        const res = await fetch("/api/posts");
        if (res.ok) {
          const allPosts = await res.json();
          postsList.value = allPosts.filter((p: any) => p.status === "published");
        }
      } catch (err) {
        console.error("Failed to fetch posts for preview:", err);
      } finally {
        loadingPosts.value = false;
      }
    };

    const filteredPosts = computed(() => {
      let result = [...postsList.value];
      
      const filterTags = props.block.attributes?.tags
        ? props.block.attributes.tags.split(",").map((t: string) => t.trim().toLowerCase()).filter(Boolean)
        : [];
      
      if (filterTags.length > 0) {
        result = result.filter((post: any) => {
          if (!post.tags) return false;
          const postTags = post.tags.split(",").map((t: string) => t.trim().toLowerCase());
          return filterTags.some((tag: string) => postTags.includes(tag));
        });
      }
      
      result.sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return dateB - dateA;
      });
      
      const limit = parseInt(props.block.attributes?.limit || "5", 10);
      return result.slice(0, limit);
    });

    const productsList = ref<any[]>([]);
    const loadingProducts = ref(false);

    const fetchProductsForPreview = async () => {
      if (props.block.type !== "products-widget") return;
      loadingProducts.value = true;
      try {
        const res = await fetch("/api/products");
        if (res.ok) {
          productsList.value = await res.json();
        }
      } catch (err) {
        console.error("Failed to fetch products for preview:", err);
      } finally {
        loadingProducts.value = false;
      }
    };

    const filteredProducts = computed(() => {
      let result = [...productsList.value];
      const rawDefaultCat = (props.block.attributes?.defaultCategory || "").trim().toLowerCase();
      const rawExcludeCat = (props.block.attributes?.excludeCategory || "").trim().toLowerCase();
      const isNegated = rawDefaultCat.startsWith("!") || rawDefaultCat.startsWith("not:");
      const excludeCat = rawExcludeCat || (isNegated ? rawDefaultCat.replace(/^(!|not:)/, "").trim() : "");
      const lockedCat = isNegated ? "" : rawDefaultCat;
      const inStockOnly = props.block.attributes?.defaultInStockOnly === "true";

      if (lockedCat) {
        result = result.filter((p: any) => (p.category || "").toLowerCase() === lockedCat);
      }
      if (excludeCat) {
        result = result.filter((p: any) => (p.category || "").toLowerCase() !== excludeCat);
      }
      if (inStockOnly) {
        result = result.filter((p: any) => p.inStock !== false);
      }

      const limit = parseInt(props.block.attributes?.limit || "6", 10);
      return result.slice(0, limit);
    });

    onMounted(() => {
      if (props.block.type === "recent-posts") {
        fetchPostsForPreview();
      } else if (props.block.type === "products-widget") {
        fetchProductsForPreview();
      }
    });

    const onDragOver = (e: DragEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const height = rect.height;

      if (isContainer.value) {
        // Container block dropzones (before, inside, after)
        if (relativeY < height * 0.25) {
          dropPosition.value = "before";
        } else if (relativeY > height * 0.75) {
          dropPosition.value = "after";
        } else {
          dropPosition.value = "inside";
        }
      } else {
        // Leaf nodes dropzones (before, after)
        if (relativeY < height * 0.5) {
          dropPosition.value = "before";
        } else {
          dropPosition.value = "after";
        }
      }
    };

    const onDragEnter = () => {
      // Prevent default to allow drop
    };

    const onDragLeave = () => {
      dropPosition.value = null;
    };

    const onDrop = (e: DragEvent) => {
      const sidebarId = e.dataTransfer?.getData("sidebarId");
      const sourceId = e.dataTransfer?.getData("blockId") || e.dataTransfer?.getData("text/plain");
      const targetId = props.block.id;
      const position = dropPosition.value;

      dropPosition.value = null;

      if (sidebarId && targetId && position) {
        emit("drag-block", {
          sidebarId,
          targetId,
          position,
          isNew: true
        });
      } else if (sourceId && targetId && position) {
        emit("drag-block", {
          sourceId,
          targetId,
          position,
          isNew: false
        });
      }
    };

    // Bubble nested recursive events
    const onChildDragBlock = (data: any) => {
      emit("drag-block", data);
    };

    const onChildUpdateContent = (data: any) => {
      emit("update-content", data);
    };

    return {
      isSelected,
      isTextBlock,
      isContainer,
      classesString,
      computedStyles,
      wrapperStyles,
      wrapperClasses,
      dropPosition,
      onSelect,
      onBlur,
      onEnter,
      onDragStart,
      onDragOver,
      onDragEnter,
      onDragLeave,
      onDrop,
      onChildDragBlock,
      onChildUpdateContent,
      postsList,
      loadingPosts,
      filteredPosts,
      productsList,
      loadingProducts,
      filteredProducts
    };
  }
});
</script>
