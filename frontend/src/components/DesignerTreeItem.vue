<template>
  <div class="designer-tree-item select-none pl-3 border-l border-slate-100 dark:border-slate-800/80 ml-1">
    <div
      class="flex items-center justify-between py-1.5 px-2.5 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 text-xs transition-all duration-150 group"
      :class="selectedId === block.id ? 'bg-primary/10 text-primary font-bold border-l-2 border-primary pl-2' : ''"
      @click.stop="emit('select', block)"
    >
      <div class="flex items-center gap-2 min-w-0">
        <span 
          v-if="block.children && block.children.length > 0"
          @click.stop="isExpanded = !isExpanded"
          class="w-4 h-4 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700/80 rounded transition-colors"
        >
          <font-awesome-icon
            :icon="['fas', isExpanded ? 'chevron-down' : 'chevron-right']"
            class="w-2 h-2 opacity-50"
          />
        </span>
        <span v-else class="w-4 h-4"></span>
        
        <font-awesome-icon :icon="getIconForBlock(block)" class="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
        <span class="truncate font-medium text-[11px] max-w-[130px]">{{ displayName }}</span>
      </div>
      <span class="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 opacity-80 scale-90">{{ block.type }}</span>
    </div>
    
    <div v-if="block.children && block.children.length > 0 && isExpanded" class="mt-1 space-y-1">
      <DesignerTreeItem
        v-for="child in block.children"
        :key="child.id"
        :block="child"
        :selectedId="selectedId"
        @select="emit('select', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

const props = defineProps<{
  block: any;
  selectedId?: string;
}>();

const emit = defineEmits<{
  (e: "select", block: any): void;
}>();

const isExpanded = ref(true);

const displayName = computed(() => {
  if (props.block.attributes?.name) return props.block.attributes.name;
  if (props.block.attributes?.id) return `#${props.block.attributes.id}`;
  if (props.block.content) {
    const text = props.block.content.replace(/<[^>]*>/g, "").trim();
    if (text.length > 20) return `"${text.substring(0, 20)}..."`;
    if (text.length > 0) return `"${text}"`;
  }
  return props.block.tagName || props.block.type;
});

const getIconForBlock = (block: any) => {
  const type = block.type;
  const tag = block.tagName?.toLowerCase();
  
  if (type === "row" || (tag === "div" && block.classes?.includes("flex"))) return ["fas", "table-cells-large"];
  if (type === "column" || block.classes?.includes("flex-1")) return ["fas", "table-columns"];
  if (type === "image" || tag === "img") return ["fas", "image"];
  if (type === "button" || tag === "button") return ["fas", "square-check"];
  if (type === "heading" || ["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) return ["fas", "heading"];
  if (type === "text" || ["p", "span", "a", "label"].includes(tag)) return ["fas", "font"];
  if (type === "form" || tag === "form") return ["fas", "align-justify"];
  if (type === "input-field" || tag === "input") return ["fas", "keyboard"];
  if (type === "textarea-field" || tag === "textarea") return ["fas", "paragraph"];
  if (type === "select" || tag === "select") return ["fas", "square-caret-down"];
  if (type === "rating") return ["fas", "star"];
  if (type === "icon") return ["fas", "icons"];
  return ["fas", "cube"];
};
</script>
