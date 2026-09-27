<template>
  <div :class="['h-screen flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-950 font-sans', isFullScreen ? 'fixed inset-0 z-50' : '']">
    
    <!-- Top Designer Bar -->
    <div class="h-16 bg-slate-900 border-b border-white/5 flex items-center justify-between px-6 text-white shrink-0 shadow-lg">
      <div class="flex items-center gap-4">
        <router-link :to="(id === 'navbar' || id === 'footer') ? '/settings?tab=appearance' : '/pages'" class="btn btn-sm btn-ghost gap-2 font-bold text-xs uppercase hover:bg-white/5 text-slate-300">
          <font-awesome-icon :icon="['fas', 'arrow-left']" class="w-4 h-4" />
          Exit
        </router-link>
        <div class="divider divider-horizontal border-white/5 py-3"></div>
        <div>
          <h1 class="font-black tracking-tight text-md text-white">{{ page?.title || 'Loading Designer...' }}</h1>
          <p class="text-[9px] font-mono opacity-50 uppercase tracking-wider">{{ (id === 'navbar' || id === 'footer') ? 'Global Layout Component' : `Page Slug: /${page?.slug}` }}</p>
        </div>
      </div>

      <!-- Canvas View Actions & Previews -->
      <div class="flex items-center gap-6">
        <!-- View Size Toggle -->
        <div class="flex items-center bg-slate-800 p-1 rounded-xl border border-white/10 select-none">
          <button
            v-for="size in screenSizes"
            :key="size.id"
            @click="activeSize = size.id"
            :class="['p-2 rounded-lg transition-all duration-200 flex items-center justify-center', activeSize === size.id ? 'bg-primary text-white shadow-md' : 'opacity-50 hover:opacity-100 text-slate-300']"
            :title="size.name"
          >
            <font-awesome-icon :icon="size.icon || ['fas', 'desktop']" class="w-4 h-4" />
          </button>
        </div>

        <!-- Light / Dark Preview Switch -->
        <div class="flex items-center bg-slate-800 p-1 rounded-xl border border-white/10 select-none">
          <button @click="isPreviewDark = false" :class="['px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all', !isPreviewDark ? 'bg-white text-slate-900 shadow-md' : 'opacity-40 hover:opacity-100 text-slate-300']">Light</button>
          <button @click="isPreviewDark = true" :class="['px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all', isPreviewDark ? 'bg-slate-950 text-white shadow-md' : 'opacity-40 hover:opacity-100 text-slate-300']">Dark</button>
        </div>

        <!-- Grid borders outlines toggle -->
        <button
          @click="showOutlines = !showOutlines"
          :class="['btn btn-sm btn-outline border-white/10 font-bold text-xs uppercase hover:bg-white/5 gap-1.5', showOutlines ? 'bg-white/10 text-white' : 'text-slate-400']"
          title="Toggle element outline borders"
        >
          <font-awesome-icon :icon="['fas', 'border-all']" class="w-4 h-4" />
          Outlines
        </button>

        <!-- Toggle Full Screen mode -->
        <button
          @click="isFullScreen = !isFullScreen"
          class="btn btn-sm btn-ghost hover:bg-white/5 text-slate-400 hover:text-white flex items-center"
          title="Toggle Fullscreen"
        >
          <font-awesome-icon v-if="!isFullScreen" :icon="['fas', 'expand']" class="w-4 h-4" />
          <font-awesome-icon v-else :icon="['fas', 'compress']" class="w-4 h-4" />
        </button>
      </div>

      <div class="flex items-center gap-3">
        <!-- Undo / Redo Actions Group -->
        <div class="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-white/10 select-none mr-2">
          <button
            @click="historyStack.length > 1 && undo()"
            :class="[
              'btn btn-xs btn-ghost flex items-center justify-center w-7 h-7 p-0 transition-all rounded-lg',
              historyStack.length <= 1 ? 'opacity-30 cursor-not-allowed text-slate-500' : 'opacity-100 text-slate-300 hover:text-white hover:bg-white/10'
            ]"
            title="Undo (Cmd+Z)"
          >
            <font-awesome-icon :icon="['fas', 'undo']" class="w-3.5 h-3.5" />
          </button>
          <button
            @click="redoStack.length > 0 && redo()"
            :class="[
              'btn btn-xs btn-ghost flex items-center justify-center w-7 h-7 p-0 transition-all rounded-lg',
              redoStack.length === 0 ? 'opacity-30 cursor-not-allowed text-slate-500' : 'opacity-100 text-slate-300 hover:text-white hover:bg-white/10'
            ]"
            title="Redo (Cmd+Shift+Z)"
          >
            <font-awesome-icon :icon="['fas', 'redo']" class="w-3.5 h-3.5" />
          </button>
        </div>

        <button @click="showSeoModal = true" class="btn btn-sm bg-transparent hover:bg-white/5 text-slate-300 hover:text-white border border-white/10 hover:border-white/30 font-bold text-xs uppercase">SEO Settings</button>
        <button 
          @click="savePage(false)" 
          class="btn btn-sm bg-transparent hover:bg-white/10 text-white border border-white/20 hover:border-white font-black text-xs uppercase px-6 gap-2 disabled:!bg-slate-800/50 disabled:!text-slate-400 disabled:!border-white/10 disabled:!cursor-not-allowed" 
          :disabled="saving || publishing"
        >
          <span v-if="saving" class="loading loading-spinner loading-xs"></span>
          {{ saving ? 'Saving...' : 'Save Design' }}
        </button>
        <button
          v-if="id !== 'navbar' && id !== 'footer'"
          @click="publishPage"
          class="btn btn-sm btn-primary text-white font-black text-xs uppercase px-6 gap-2 disabled:!bg-primary/50 disabled:!text-white/60 disabled:!border-transparent disabled:!cursor-not-allowed"
          :disabled="publishing || saving"
        >
          <span v-if="publishing" class="loading loading-spinner loading-xs"></span>
          Publish
        </button>
      </div>
    </div>

    <!-- Main Builder Workspace -->
    <div class="flex flex-1 overflow-hidden">
      
      <!-- Left Panel (Drag & Drop Elements / AI Assistant) -->
      <div class="w-80 bg-white dark:bg-slate-900 border-r border-base-200 dark:border-slate-800 flex flex-col shrink-0">
        <!-- Tabs Header -->
        <div class="flex border-b border-base-200 dark:border-slate-800 bg-base-100/50">
          <button @click="activeTab = 'blocks'" :class="['flex-1 py-3 text-xs font-black uppercase tracking-wider text-center border-b-2 transition-all', activeTab === 'blocks' ? 'border-primary text-primary' : 'border-transparent opacity-60']">
            Elements
          </button>
          <button @click="activeTab = 'ai'" :class="['flex-1 py-3 text-xs font-black uppercase tracking-wider text-center border-b-2 transition-all', activeTab === 'ai' ? 'border-primary text-primary' : 'border-transparent opacity-60']">
            AI Assistant
          </button>
        </div>

        <!-- Sidebar List Scrollable -->
        <div class="flex-1 overflow-y-auto p-5 space-y-6">
          
          <!-- Element Cards List -->
          <div v-show="activeTab === 'blocks'" class="space-y-6">
            <div v-for="category in categories" :key="category.name" class="space-y-3">
              <h4 class="text-[10px] font-black uppercase tracking-widest opacity-40">{{ category.name }}</h4>
              
              <div class="grid grid-cols-2 gap-3">
                <div
                  v-for="item in category.items"
                  :key="item.id"
                  draggable="true"
                  @dragstart="onDragStartSidebar($event, item)"
                  class="flex flex-col items-center justify-center p-3 gap-2 bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-800 border border-base-200 dark:border-slate-800 rounded-2xl cursor-grab active:cursor-grabbing hover:shadow-md transition-all duration-200 select-none group text-center"
                >
                  <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <font-awesome-icon :icon="item.icon || ['fas', 'square']" class="w-5 h-5" />
                  </div>
                  <span class="font-black text-[9px] uppercase tracking-wider opacity-75">{{ item.label }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- AI Assistant Input Form -->
          <div v-show="activeTab === 'ai'" class="space-y-4">
            <div class="badge bg-primary/10 text-primary border-none font-bold uppercase tracking-widest text-[9px] px-3 py-1">Swiftbase AI Agent</div>
            <h3 class="font-black text-lg tracking-tight">AI Page Builder</h3>
            <p class="text-xs opacity-60 leading-relaxed">Describe a custom layout section or full page mock. The AI agent generates modern Tailwind CSS layouts and maps them directly to designer blocks.</p>
            
            <textarea
              v-model="aiPrompt"
              placeholder="e.g. A dark hero section with a gradient background, a primary call-to-action button, and a clean three-column features layout below..."
              class="textarea textarea-bordered w-full h-36 rounded-xl text-sm focus:outline-none dark:bg-slate-800"
              :disabled="generating"
            ></textarea>
            
            <button @click="generateLayout" class="btn btn-primary w-full text-white font-bold rounded-xl" :disabled="generating || !aiPrompt.trim()">
              {{ generating ? 'Generating Section...' : 'Generate Design' }}
            </button>
          </div>

        </div>
      </div>

      <!-- Central Canvas Area -->
      <div :class="['flex-1 relative flex items-center justify-center p-0 overflow-hidden transition-all duration-300', isPreviewDark ? 'bg-slate-950' : 'bg-slate-100']" @click="selectedBlock = null">
        
        <!-- Animated canvas container sizing -->
        <div
          id="designer-canvas-frame"
          :class="[
            'h-full border border-base-200 dark:border-slate-800 shadow-2xl overflow-y-auto transition-all duration-300 relative flex flex-col designer-preview-canvas',
            isPreviewDark ? 'dark bg-slate-900 text-white' : 'bg-white text-slate-900'
          ]"
          :data-theme="isPreviewDark ? 'dark' : 'light'"
          :style="{ width: canvasWidth }"
          @dragover.prevent
          @drop="onDropCanvasRoot"
          @click.self="selectedBlock = null"
        >
          <!-- Injected Scope Custom Global CSS Styles -->
          <component is="style" v-if="scopedGlobalStyles" v-text="scopedGlobalStyles"></component>
          <!-- Canvas Top indicator drop area -->
          <div v-if="blocks.length === 0" class="flex-1 flex flex-col items-center justify-center p-12 text-center select-none">
            <div class="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center text-3xl mb-6 animate-bounce">
              <font-awesome-icon :icon="['fas', 'cloud-arrow-up']" class="w-10 h-10" />
            </div>
            <h3 class="font-black text-xl tracking-tight">Drag Elements Here</h3>
            <p class="text-xs opacity-50 mt-1 max-w-sm leading-relaxed">Select layouts, cards, and buttons from the left sidebar and drop them here to start building your custom page.</p>
          </div>

          <div v-else class="p-8 space-y-4 flex-1">
            <DesignerBlock
              v-for="block in blocks"
              :key="block.id"
              :block="block"
              :selectedId="selectedBlock?.id"
              :showOutlines="showOutlines"
              @select="onSelectBlock"
              @drag-block="onDragBlockReorder"
              @update-content="onUpdateBlockContent"
              @remove="onRemoveBlock"
              @duplicate="onDuplicateBlock"
            />
          </div>
        </div>

      </div>

      <!-- Right Panel (Tailwind CSS Inspector & Formatting Pane) -->
      <div class="w-80 bg-white dark:bg-slate-900 border-l border-base-200 dark:border-slate-800 flex flex-col shrink-0">
        
        <!-- Inspector title -->
        <div class="p-4 border-b border-base-200 dark:border-slate-800 bg-base-100/50 flex justify-between items-center">
          <span class="text-xs font-black uppercase tracking-widest text-slate-400">Element Inspector</span>
          <span v-if="selectedBlock" class="badge badge-primary font-bold text-[8px] uppercase tracking-wider">{{ selectedBlock.type }}</span>
        </div>

        <div class="flex-1 overflow-y-auto p-5 space-y-6">
          <div v-if="!selectedBlock" class="space-y-4 animate-in fade-in duration-200">
            <div class="flex items-center justify-between pb-2 border-b border-base-200 dark:border-slate-800">
              <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">Document Outline</span>
              <span class="badge badge-sm font-bold text-[9px] uppercase tracking-wider">{{ blocks.length }} Root Node(s)</span>
            </div>
            
            <div v-if="blocks.length === 0" class="py-12 text-center opacity-40 select-none">
              <font-awesome-icon :icon="['fas', 'folder-open']" class="w-8 h-8 mb-3 text-primary opacity-60 mx-auto" />
              <h4 class="font-bold text-xs uppercase tracking-wider">Empty Page</h4>
              <p class="text-[10px] opacity-75 max-w-[180px] mt-1 mx-auto">Drag and drop layouts or elements to start building.</p>
            </div>
            
            <div v-else class="space-y-1.5 pr-1">
              <DesignerTreeItem
                v-for="block in blocks"
                :key="block.id"
                :block="block"
                :selectedId="selectedBlock?.id"
                @select="onSelectBlock"
              />
            </div>
          </div>

          <div v-else class="space-y-6 animate-in fade-in duration-300">
            <!-- Properties Form (href, src, alt, content) -->
            <div class="space-y-4">
              <h4 class="text-[10px] font-black uppercase tracking-widest opacity-40">Content & Attributes</h4>
              
              <!-- Content input for standard elements -->
              <div v-if="selectedBlock.content !== undefined" class="form-control">
                <label class="label p-0 pb-1">
                  <span class="label-text text-[10px] font-black uppercase opacity-40">Text Content</span>
                </label>
                <textarea
                  v-model="selectedBlock.content"
                  class="textarea textarea-bordered text-xs rounded-xl w-full h-24 focus:outline-none dark:bg-slate-800"
                  placeholder="Enter element text content..."
                ></textarea>
              </div>

              <!-- URL for links / source for images -->
              <div v-if="selectedBlock.attributes?.href !== undefined" class="form-control">
                <label class="label p-0 pb-1">
                  <span class="label-text text-[10px] font-black uppercase opacity-40">Link URL</span>
                </label>
                <input
                  type="text"
                  v-model="selectedBlock.attributes.href"
                  class="input input-bordered text-xs rounded-xl w-full focus:outline-none dark:bg-slate-800"
                  placeholder="e.g. /about"
                />
              </div>

              <div v-if="selectedBlock.type === 'image' || selectedBlock.tagName === 'img'" class="space-y-3">
                <div class="form-control">
                  <label class="label p-0 pb-1 flex justify-between items-center">
                    <span class="label-text text-[10px] font-black uppercase opacity-40">Image Source URL</span>
                    <button
                      type="button"
                      @click.stop="openGalleryPicker('imageBlock')"
                      class="text-[9px] font-bold text-primary uppercase hover:underline"
                    >Choose</button>
                  </label>
                  <input
                    type="text"
                    v-model="selectedBlock.attributes.src"
                    class="input input-bordered text-xs rounded-xl w-full focus:outline-none dark:bg-slate-800"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
                 <div class="form-control">
                  <label class="label p-0 pb-1">
                    <span class="label-text text-[10px] font-black uppercase opacity-40">Alternative Alt Text</span>
                  </label>
                  <input
                    type="text"
                    v-model="selectedBlock.attributes.alt"
                    class="input input-bordered text-xs rounded-xl w-full focus:outline-none dark:bg-slate-800"
                    placeholder="Alt details..."
                  />
                </div>

                <!-- Width / Height Constraints (Custom Styles) -->
                <div class="grid grid-cols-2 gap-2 border-t border-base-200/50 dark:border-slate-800/50 pt-2">
                  <div class="form-control">
                    <label class="label p-0 pb-1">
                      <span class="label-text text-[9px] font-bold uppercase opacity-50 font-black">Width</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 200px, 50%, auto"
                      :value="selectedBlock.styles?.width || ''"
                      @change="e => {
                        selectedBlock.styles = selectedBlock.styles || {};
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val) selectedBlock.styles.width = val;
                        else delete selectedBlock.styles.width;
                        saveHistoryState();
                      }"
                      class="input input-bordered input-xs rounded-lg text-xs dark:bg-slate-800"
                    />
                  </div>

                  <div class="form-control">
                    <label class="label p-0 pb-1">
                      <span class="label-text text-[9px] font-bold uppercase opacity-50 font-black">Height</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 150px, auto"
                      :value="selectedBlock.styles?.height || ''"
                      @change="e => {
                        selectedBlock.styles = selectedBlock.styles || {};
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val) selectedBlock.styles.height = val;
                        else delete selectedBlock.styles.height;
                        saveHistoryState();
                      }"
                      class="input input-bordered input-xs rounded-lg text-xs dark:bg-slate-800"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div class="form-control">
                    <label class="label p-0 pb-1">
                      <span class="label-text text-[9px] font-bold uppercase opacity-50 font-black">Max Width</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 100%, 600px"
                      :value="selectedBlock.styles?.['max-width'] || ''"
                      @change="e => {
                        selectedBlock.styles = selectedBlock.styles || {};
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val) selectedBlock.styles['max-width'] = val;
                        else delete selectedBlock.styles['max-width'];
                        saveHistoryState();
                      }"
                      class="input input-bordered input-xs rounded-lg text-xs dark:bg-slate-800"
                    />
                  </div>

                  <div class="form-control">
                    <label class="label p-0 pb-1">
                      <span class="label-text text-[9px] font-bold uppercase opacity-50 font-black">Max Height</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 400px, none"
                      :value="selectedBlock.styles?.['max-height'] || ''"
                      @change="e => {
                        selectedBlock.styles = selectedBlock.styles || {};
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val) selectedBlock.styles['max-height'] = val;
                        else delete selectedBlock.styles['max-height'];
                        saveHistoryState();
                      }"
                      class="input input-bordered input-xs rounded-lg text-xs dark:bg-slate-800"
                    />
                  </div>
                </div>
              </div>

              <!-- Rating Block Icon Settings -->
              <div v-if="selectedBlock.type === 'rating'" class="space-y-3">
                <div class="form-control">
                  <label class="label p-0 pb-1">
                    <span class="label-text text-[10px] font-black uppercase opacity-40">Rating Icon (FontAwesome name)</span>
                  </label>
                  <input
                    type="text"
                    :value="selectedBlock.attributes?.icon || 'star'"
                    @input="e => updateRatingIcon((e.target as HTMLInputElement).value)"
                    class="input input-bordered text-xs rounded-xl w-full focus:outline-none dark:bg-slate-800"
                    placeholder="e.g. star, heart, thumbs-up"
                  />
                </div>
              </div>

              <!-- Recent Blog Entries Settings -->
              <div v-if="selectedBlock.type === 'recent-posts'" class="space-y-3">
                <div class="form-control">
                  <label class="label p-0 pb-1">
                    <span class="label-text text-[10px] font-black uppercase opacity-40">Posts Limit</span>
                  </label>
                  <input
                    type="number"
                    v-model="selectedBlock.attributes.limit"
                    class="input input-bordered text-xs rounded-xl w-full focus:outline-none dark:bg-slate-800"
                    placeholder="e.g. 5"
                    min="1"
                    max="50"
                  />
                </div>
                <div class="form-control">
                  <label class="label p-0 pb-1">
                    <span class="label-text text-[10px] font-black uppercase opacity-40">Filter Tags (comma-separated)</span>
                  </label>
                  <input
                    type="text"
                    v-model="selectedBlock.attributes.tags"
                    class="input input-bordered text-xs rounded-xl w-full focus:outline-none dark:bg-slate-800"
                    placeholder="e.g. tech, design"
                  />
                  <span class="text-[9px] opacity-40 mt-1">Leave empty to show posts of all tags.</span>
                </div>
              </div>

              <!-- Store Products Widget Settings -->
              <div v-if="selectedBlock.type === 'products-widget'" class="space-y-4 p-3 bg-slate-50 dark:bg-slate-850 border border-base-200 dark:border-slate-800 rounded-2xl">
                <div class="flex items-center gap-1.5 pb-1 border-b border-base-200 dark:border-slate-800">
                  <font-awesome-icon :icon="['fas', 'cart-shopping']" class="w-3 h-3 text-primary" />
                  <span class="text-[10px] font-black uppercase tracking-wider text-slate-500">Products Catalog Widget</span>
                </div>

                <div class="form-control">
                  <label class="label p-0 pb-1">
                    <span class="label-text text-[10px] font-black uppercase opacity-40">Max Products to Show</span>
                  </label>
                  <input
                    type="number"
                    v-model="selectedBlock.attributes.limit"
                    class="input input-bordered text-xs rounded-xl w-full focus:outline-none dark:bg-slate-800"
                    placeholder="e.g. 6"
                    min="1"
                    max="100"
                  />
                </div>

                <!-- Hidden Default Filters (Never shown to end visitors) -->
                <div class="p-3 bg-primary/5 border border-primary/20 rounded-xl space-y-2.5">
                  <div class="flex items-center justify-between">
                    <span class="text-[9px] font-black uppercase tracking-wider text-primary">Hidden Default Filter</span>
                    <span class="badge badge-xs badge-primary font-bold text-[8px]">Enforced Server-Side</span>
                  </div>
                  <p class="text-[10px] opacity-60 leading-tight">Restrict this widget to specific items. Visitors cannot see or clear this filter.</p>
                  
                  <div class="form-control">
                    <label class="label p-0 pb-1">
                      <span class="label-text text-[9px] font-bold uppercase opacity-60">Locked Category</span>
                    </label>
                    <input
                      type="text"
                      v-model="selectedBlock.attributes.defaultCategory"
                      class="input input-bordered input-sm text-xs rounded-lg w-full focus:outline-none dark:bg-slate-800 font-bold"
                      placeholder="e.g. Books"
                    />
                    <span class="text-[9px] opacity-40 mt-0.5">Show only products in this category.</span>
                  </div>

                  <div class="form-control">
                    <label class="label p-0 pb-1">
                      <span class="label-text text-[9px] font-bold uppercase opacity-60">Excluded Category</span>
                    </label>
                    <input
                      type="text"
                      v-model="selectedBlock.attributes.excludeCategory"
                      class="input input-bordered input-sm text-xs rounded-lg w-full focus:outline-none dark:bg-slate-800 font-bold"
                      placeholder="e.g. Books"
                    />
                    <span class="text-[9px] opacity-40 mt-0.5">Hide products matching this category (e.g. "Books").</span>
                  </div>

                  <label class="label cursor-pointer justify-start gap-2 p-0 pt-1">
                    <input 
                      type="checkbox" 
                      v-model="selectedBlock.attributes.defaultInStockOnly" 
                      :true-value="'true'"
                      :false-value="'false'"
                      class="checkbox checkbox-primary checkbox-xs rounded" 
                    />
                    <span class="label-text text-[10px] font-bold">Only Show In-Stock Items</span>
                  </label>
                </div>

                <!-- Visitor Search and Filters Controls -->
                <div class="space-y-2 pt-1 border-t border-base-200 dark:border-slate-800">
                  <span class="text-[9px] font-black uppercase tracking-wider opacity-40">Visitor Filter Bar</span>
                  <label class="label cursor-pointer justify-start gap-2 p-0">
                    <input 
                      type="checkbox" 
                      v-model="selectedBlock.attributes.showSearch" 
                      :true-value="'true'"
                      :false-value="'false'"
                      class="checkbox checkbox-xs rounded" 
                    />
                    <span class="label-text text-[10px]">Show Search Bar to Visitors</span>
                  </label>
                  <label class="label cursor-pointer justify-start gap-2 p-0">
                    <input 
                      type="checkbox" 
                      v-model="selectedBlock.attributes.showCategories" 
                      :true-value="'true'"
                      :false-value="'false'"
                      class="checkbox checkbox-xs rounded" 
                    />
                    <span class="label-text text-[10px]">Show Category Buttons to Visitors</span>
                  </label>
                </div>
              </div>

              <!-- E-book Preview Widget Settings -->
              <div v-if="selectedBlock.type === 'ebook-preview-widget'" class="space-y-4 p-3 bg-slate-50 dark:bg-slate-850 border border-base-200 dark:border-slate-800 rounded-2xl">
                <div class="flex items-center gap-1.5 pb-1 border-b border-base-200 dark:border-slate-800">
                  <font-awesome-icon :icon="['fas', 'book-open']" class="w-3 h-3 text-primary" />
                  <span class="text-[10px] font-black uppercase tracking-wider text-slate-500">E-book Preview Settings</span>
                </div>

                <div class="form-control">
                  <label class="label p-0 pb-1">
                    <span class="label-text text-[10px] font-black uppercase opacity-40">Book Title</span>
                  </label>
                  <input
                    type="text"
                    v-model="selectedBlock.attributes['data-book-title']"
                    class="input input-bordered input-sm text-xs rounded-xl w-full dark:bg-slate-800"
                    placeholder="e.g. The Quantum Horizon"
                  />
                </div>

                <div class="form-control">
                  <label class="label p-0 pb-1">
                    <span class="label-text text-[10px] font-black uppercase opacity-40">Author</span>
                  </label>
                  <input
                    type="text"
                    v-model="selectedBlock.attributes['data-author']"
                    class="input input-bordered input-sm text-xs rounded-xl w-full dark:bg-slate-800"
                    placeholder="e.g. Jane Doe"
                  />
                </div>

                <div class="form-control">
                  <label class="label p-0 pb-1">
                    <span class="label-text text-[10px] font-black uppercase opacity-40">Cover Image URL</span>
                  </label>
                  <input
                    type="text"
                    v-model="selectedBlock.attributes['data-cover-image']"
                    class="input input-bordered input-sm text-xs rounded-xl w-full dark:bg-slate-800"
                    placeholder="https://.../cover.jpg"
                  />
                </div>

                <div class="form-control">
                  <label class="label p-0 pb-1">
                    <span class="label-text text-[10px] font-black uppercase opacity-40">Sample Text Excerpt</span>
                  </label>
                  <textarea
                    v-model="selectedBlock.attributes['data-sample-content']"
                    rows="4"
                    class="textarea textarea-bordered text-xs rounded-xl w-full dark:bg-slate-800"
                    placeholder="Enter chapter text or sample excerpt..."
                  ></textarea>
                </div>

                <div class="form-control">
                  <label class="label p-0 pb-1">
                    <span class="label-text text-[10px] font-black uppercase opacity-40">Link to Store Product (Optional)</span>
                  </label>
                  <input
                    type="text"
                    v-model="selectedBlock.attributes['data-product-id']"
                    class="input input-bordered input-sm text-xs rounded-xl w-full dark:bg-slate-800"
                    placeholder="Product ID for purchase button"
                  />
                </div>
              </div>

              <!-- Input Fields Validation and Details -->
              <div v-if="['input', 'textarea', 'select'].includes(selectedBlock.tagName) || ['input', 'textarea', 'select', 'range'].includes(selectedBlock.type)" class="space-y-3">

                <div class="form-control" v-if="selectedBlock.tagName === 'input'">
                  <label class="label p-0 pb-1">
                    <span class="label-text text-[10px] font-black uppercase opacity-40">Input Field Type</span>
                  </label>
                  <select
                    v-model="selectedBlock.attributes.type"
                    class="select select-bordered select-xs w-full rounded-lg font-bold text-xs dark:bg-slate-800"
                  >
                    <option value="text">Plain Text</option>
                    <option value="email">Email Address</option>
                    <option value="password">Password Secure</option>
                    <option value="number">Numeric Val</option>
                    <option value="tel">Telephone / Phone</option>
                    <option value="date">Date picker</option>
                    <option value="checkbox">Checkbox toggle</option>
                    <option value="radio">Radio selection</option>
                    <option value="range">Range slider</option>
                  </select>
                </div>

                <!-- Required Toggle validation -->
                <div class="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    :checked="selectedBlock.attributes?.required || false"
                    @change="e => {
                      selectedBlock.attributes = selectedBlock.attributes || {};
                      selectedBlock.attributes.required = (e.target as HTMLInputElement).checked;
                      saveHistoryState();
                    }"
                    class="checkbox checkbox-primary rounded-md checkbox-xs"
                    id="validation-required-chk"
                  />
                  <label for="validation-required-chk" class="text-xs font-bold opacity-75 cursor-pointer select-none">
                    Required Field (Validation)
                  </label>
                </div>
              </div>

              <!-- Flex Container Settings -->
              <div v-if="hasClass('flex') || ['row', 'col'].includes(selectedBlock.type)" class="space-y-3 pt-3 border-t border-base-200 dark:border-slate-800">
                <span class="text-[10px] font-black uppercase tracking-widest opacity-40">Flex Box Container</span>

                <!-- Direction & Wrap -->
                <div class="grid grid-cols-2 gap-2">
                  <div class="form-control">
                    <label class="label p-0 pb-1"><span class="label-text text-[9px] font-bold uppercase opacity-50">Direction</span></label>
                    <select
                      :value="['flex-row', 'flex-col', 'flex-row-reverse', 'flex-col-reverse'].find(c => hasClass(c)) || (hasClass('md:flex-row') ? 'flex-row' : (hasClass('md:flex-col') ? 'flex-col' : ''))"
                      @change="e => setExclusiveClass(['flex-row', 'flex-col', 'flex-row-reverse', 'flex-col-reverse', 'md:flex-row', 'md:flex-col', 'md:flex-row-reverse', 'md:flex-col-reverse'], (e.target as HTMLSelectElement).value)"
                      class="select select-bordered select-xs w-full rounded-lg font-bold text-xs dark:bg-slate-800"
                    >
                      <option value="flex-row">Row (Horizontal)</option>
                      <option value="flex-col">Column (Vertical)</option>
                      <option value="flex-row-reverse">Row Reverse</option>
                      <option value="flex-col-reverse">Col Reverse</option>
                    </select>
                  </div>

                  <div class="form-control">
                    <label class="label p-0 pb-1"><span class="label-text text-[9px] font-bold uppercase opacity-50">Wrap</span></label>
                    <select
                      :value="['flex-nowrap', 'flex-wrap', 'flex-wrap-reverse'].find(c => hasClass(c)) || ''"
                      @change="e => setExclusiveClass(['flex-nowrap', 'flex-wrap', 'flex-wrap-reverse'], (e.target as HTMLSelectElement).value)"
                      class="select select-bordered select-xs w-full rounded-lg font-bold text-xs dark:bg-slate-800"
                    >
                      <option value="flex-nowrap">No Wrap</option>
                      <option value="flex-wrap">Wrap</option>
                      <option value="flex-wrap-reverse">Wrap Reverse</option>
                    </select>
                  </div>
                </div>

                <!-- Justify Content & Align Items -->
                <div class="grid grid-cols-2 gap-2">
                  <div class="form-control">
                    <label class="label p-0 pb-1"><span class="label-text text-[9px] font-bold uppercase opacity-50">Justify</span></label>
                    <select
                      :value="['justify-start', 'justify-end', 'justify-center', 'justify-between', 'justify-around', 'justify-evenly'].find(c => hasClass(c)) || ''"
                      @change="e => setExclusiveClass(['justify-start', 'justify-end', 'justify-center', 'justify-between', 'justify-around', 'justify-evenly'], (e.target as HTMLSelectElement).value)"
                      class="select select-bordered select-xs w-full rounded-lg font-bold text-xs dark:bg-slate-800"
                    >
                      <option value="">Default (Start)</option>
                      <option value="justify-start">Start</option>
                      <option value="justify-center">Center</option>
                      <option value="justify-end">End</option>
                      <option value="justify-between">Space Between</option>
                      <option value="justify-around">Space Around</option>
                      <option value="justify-evenly">Space Evenly</option>
                    </select>
                  </div>

                  <div class="form-control">
                    <label class="label p-0 pb-1"><span class="label-text text-[9px] font-bold uppercase opacity-50">Align Items</span></label>
                    <select
                      :value="['items-start', 'items-end', 'items-center', 'items-baseline', 'items-stretch'].find(c => hasClass(c)) || ''"
                      @change="e => setExclusiveClass(['items-start', 'items-end', 'items-center', 'items-baseline', 'items-stretch'], (e.target as HTMLSelectElement).value)"
                      class="select select-bordered select-xs w-full rounded-lg font-bold text-xs dark:bg-slate-800"
                    >
                      <option value="">Default (Stretch)</option>
                      <option value="items-start">Start</option>
                      <option value="items-center">Center</option>
                      <option value="items-end">End</option>
                      <option value="items-stretch">Stretch</option>
                      <option value="items-baseline">Baseline</option>
                    </select>
                  </div>
                </div>

                <!-- Spacing Gap -->
                <div class="form-control w-full">
                  <label class="label p-0 pb-1"><span class="label-text text-[9px] font-bold uppercase opacity-50">Gap (Spacing)</span></label>
                  <select
                    :value="['gap-0', 'gap-1', 'gap-2', 'gap-3', 'gap-4', 'gap-6', 'gap-8', 'gap-12'].find(c => hasClass(c)) || ''"
                    @change="e => setExclusiveClass(['gap-0', 'gap-1', 'gap-2', 'gap-3', 'gap-4', 'gap-6', 'gap-8', 'gap-12'], (e.target as HTMLSelectElement).value)"
                    class="select select-bordered select-xs w-full rounded-lg font-bold text-xs dark:bg-slate-800"
                  >
                    <option value="">No Gap</option>
                    <option value="gap-1">Extra Tight (4px)</option>
                    <option value="gap-2">Tight (8px)</option>
                    <option value="gap-3">Snug (12px)</option>
                    <option value="gap-4">Normal (16px)</option>
                    <option value="gap-6">Medium (24px)</option>
                    <option value="gap-8">Loose (32px)</option>
                    <option value="gap-12">X Loose (48px)</option>
                  </select>
                </div>
              </div>

              <!-- Flex Child Settings (Grow / Basis) -->
              <div class="space-y-3 pt-3 border-t border-base-200 dark:border-slate-800">
                <span class="text-[10px] font-black uppercase tracking-widest opacity-40">Flex Child Alignment</span>
                <div class="grid grid-cols-2 gap-2">
                  <div class="form-control">
                    <label class="label p-0 pb-1"><span class="label-text text-[9px] font-bold uppercase opacity-50">Flex Grow</span></label>
                    <select
                      :value="['grow-0', 'grow'].find(c => hasClass(c)) || ''"
                      @change="e => setExclusiveClass(['grow-0', 'grow'], (e.target as HTMLSelectElement).value)"
                      class="select select-bordered select-xs w-full rounded-lg font-bold text-xs dark:bg-slate-800"
                    >
                      <option value="">Default (Grow 0)</option>
                      <option value="grow">Grow (Fill Space)</option>
                      <option value="grow-0">Don't Grow (0)</option>
                    </select>
                  </div>

                  <div class="form-control">
                    <label class="label p-0 pb-1"><span class="label-text text-[9px] font-bold uppercase opacity-50">Flex Shrink</span></label>
                    <select
                      :value="['shrink-0', 'shrink'].find(c => hasClass(c)) || ''"
                      @change="e => setExclusiveClass(['shrink-0', 'shrink'], (e.target as HTMLSelectElement).value)"
                      class="select select-bordered select-xs w-full rounded-lg font-bold text-xs dark:bg-slate-800"
                    >
                      <option value="">Default (Shrink 1)</option>
                      <option value="shrink">Shrink</option>
                      <option value="shrink-0">Don't Shrink (0)</option>
                    </select>
                  </div>
                </div>

                <div class="form-control w-full">
                  <label class="label p-0 pb-1"><span class="label-text text-[9px] font-bold uppercase opacity-50">Flex Basis</span></label>
                  <select
                    :value="['basis-auto', 'basis-full', 'basis-1/2', 'basis-1/3', 'basis-1/4', 'basis-2/3', 'basis-3/4'].find(c => hasClass(c)) || ''"
                    @change="e => setExclusiveClass(['basis-auto', 'basis-full', 'basis-1/2', 'basis-1/3', 'basis-1/4', 'basis-2/3', 'basis-3/4'], (e.target as HTMLSelectElement).value)"
                    class="select select-bordered select-xs w-full rounded-lg font-bold text-xs dark:bg-slate-800"
                  >
                    <option value="">Default / Auto</option>
                    <option value="basis-full">Full Width (100%)</option>
                    <option value="basis-1/2">Half Width (50%)</option>
                    <option value="basis-1/3">One Third (33.3%)</option>
                    <option value="basis-2/3">Two Thirds (66.6%)</option>
                    <option value="basis-1/4">One Quarter (25%)</option>
                    <option value="basis-3/4">Three Quarters (75%)</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="divider border-base-200 dark:border-slate-800"></div>

            <!-- Typography & Font Styling -->
            <div class="space-y-4">
              <h4 class="text-[10px] font-black uppercase tracking-widest opacity-40">Typography & Font Styling</h4>

              <!-- Font Family Selection -->
              <div class="form-control w-full">
                <label class="label p-0 pb-1">
                  <span class="label-text text-[9px] font-bold uppercase opacity-50">Font Family</span>
                </label>
                <select
                  :value="['font-sans', 'font-serif', 'font-mono'].find(c => hasClass(c)) || ''"
                  @change="e => setExclusiveClass(['font-sans', 'font-serif', 'font-mono'], (e.target as HTMLSelectElement).value)"
                  class="select select-bordered select-xs w-full rounded-lg font-bold text-xs dark:bg-slate-800"
                >
                  <option value="">Default Inherit</option>
                  <option value="font-sans">Sans (Inter/System)</option>
                  <option value="font-serif">Serif (Merriweather)</option>
                  <option value="font-mono">Monospace (Code)</option>
                </select>
              </div>

              <!-- Font Size Selection -->
              <div class="form-control w-full">
                <label class="label p-0 pb-1">
                  <span class="label-text text-[9px] font-bold uppercase opacity-50">Font Size</span>
                </label>
                <select
                  :value="['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'text-6xl'].find(c => hasClass(c)) || ''"
                  @change="e => setExclusiveClass(['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'text-6xl'], (e.target as HTMLSelectElement).value)"
                  class="select select-bordered select-xs w-full rounded-lg font-bold text-xs dark:bg-slate-800"
                >
                  <option value="">Default Inherit</option>
                  <option value="text-xs">Extra Small (XS)</option>
                  <option value="text-sm">Small (SM)</option>
                  <option value="text-base">Base (MD)</option>
                  <option value="text-lg">Large (LG)</option>
                  <option value="text-xl">Extra Large (XL)</option>
                  <option value="text-2xl">2X Large (2XL)</option>
                  <option value="text-3xl">3X Large (3XL)</option>
                  <option value="text-4xl">4X Large (4XL)</option>
                  <option value="text-5xl">5X Large (5XL)</option>
                  <option value="text-6xl">6X Large (6XL)</option>
                </select>
              </div>

              <!-- Font Weight Selection -->
              <div class="form-control w-full">
                <label class="label p-0 pb-1">
                  <span class="label-text text-[9px] font-bold uppercase opacity-50">Font Weight</span>
                </label>
                <select
                  :value="['font-thin', 'font-light', 'font-normal', 'font-medium', 'font-semibold', 'font-bold', 'font-extrabold', 'font-black'].find(c => hasClass(c)) || ''"
                  @change="e => setExclusiveClass(['font-thin', 'font-light', 'font-normal', 'font-medium', 'font-semibold', 'font-bold', 'font-extrabold', 'font-black'], (e.target as HTMLSelectElement).value)"
                  class="select select-bordered select-xs w-full rounded-lg font-bold text-xs dark:bg-slate-800"
                >
                  <option value="">Default Inherit</option>
                  <option value="font-thin">Thin</option>
                  <option value="font-light">Light</option>
                  <option value="font-normal">Normal</option>
                  <option value="font-medium">Medium</option>
                  <option value="font-semibold">Semi Bold</option>
                  <option value="font-bold">Bold</option>
                  <option value="font-extrabold">Extra Bold</option>
                  <option value="font-black">Black</option>
                </select>
              </div>

              <!-- Line Height Selection -->
              <div class="form-control w-full">
                <label class="label p-0 pb-1">
                  <span class="label-text text-[9px] font-bold uppercase opacity-50">Line Height</span>
                </label>
                <select
                  :value="['leading-none', 'leading-tight', 'leading-snug', 'leading-normal', 'leading-relaxed', 'leading-loose'].find(c => hasClass(c)) || ''"
                  @change="e => setExclusiveClass(['leading-none', 'leading-tight', 'leading-snug', 'leading-normal', 'leading-relaxed', 'leading-loose'], (e.target as HTMLSelectElement).value)"
                  class="select select-bordered select-xs w-full rounded-lg font-bold text-xs dark:bg-slate-800"
                >
                  <option value="">Default Inherit</option>
                  <option value="leading-none">None</option>
                  <option value="leading-tight">Tight</option>
                  <option value="leading-snug">Snug</option>
                  <option value="leading-normal">Normal</option>
                  <option value="leading-relaxed">Relaxed</option>
                  <option value="leading-loose">Loose</option>
                </select>
              </div>

              <!-- Text Alignment Button Group -->
              <div class="form-control w-full">
                <label class="label p-0 pb-1">
                  <span class="label-text text-[9px] font-bold uppercase opacity-50">Text Alignment</span>
                </label>
                <div class="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    type="button"
                    @click="setExclusiveClass(['text-left', 'text-center', 'text-right', 'text-justify'], 'text-left')"
                    :class="['py-1.5 rounded-lg text-xs flex items-center justify-center transition-all', hasClass('text-left') || (!hasClass('text-center') && !hasClass('text-right') && !hasClass('text-justify')) ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'opacity-60 text-slate-500 dark:text-slate-300']"
                    title="Align Left"
                  >
                    <font-awesome-icon :icon="['fas', 'align-left']" />
                  </button>
                  <button
                    type="button"
                    @click="setExclusiveClass(['text-left', 'text-center', 'text-right', 'text-justify'], 'text-center')"
                    :class="['py-1.5 rounded-lg text-xs flex items-center justify-center transition-all', hasClass('text-center') ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'opacity-60 text-slate-500 dark:text-slate-300']"
                    title="Align Center"
                  >
                    <font-awesome-icon :icon="['fas', 'align-center']" />
                  </button>
                  <button
                    type="button"
                    @click="setExclusiveClass(['text-left', 'text-center', 'text-right', 'text-justify'], 'text-right')"
                    :class="['py-1.5 rounded-lg text-xs flex items-center justify-center transition-all', hasClass('text-right') ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'opacity-60 text-slate-500 dark:text-slate-300']"
                    title="Align Right"
                  >
                    <font-awesome-icon :icon="['fas', 'align-right']" />
                  </button>
                  <button
                    type="button"
                    @click="setExclusiveClass(['text-left', 'text-center', 'text-right', 'text-justify'], 'text-justify')"
                    :class="['py-1.5 rounded-lg text-xs flex items-center justify-center transition-all', hasClass('text-justify') ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'opacity-60 text-slate-500 dark:text-slate-300']"
                    title="Align Justify"
                  >
                    <font-awesome-icon :icon="['fas', 'align-justify']" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Layout & Spacing Controls -->
            <div class="space-y-4 border-t border-base-200 dark:border-slate-800 pt-4">
              <div class="flex justify-between items-center">
                <span class="text-[10px] font-black uppercase tracking-widest opacity-40">Spacing & Layout</span>
                <button
                  type="button"
                  @click.stop="isSpacingIndividual = !isSpacingIndividual"
                  class="btn btn-ghost text-[9px] font-bold text-primary hover:bg-primary/5 py-1 px-2 h-auto min-h-0 rounded-lg uppercase"
                >
                  {{ isSpacingIndividual ? 'Use Uniform' : 'Custom Sides' }}
                </button>
              </div>

              <!-- UNIFORM SPACING VIEW -->
              <div v-if="!isSpacingIndividual" class="space-y-4">
                <!-- Padding All -->
                <div class="form-control w-full">
                  <label class="label p-0 pb-1">
                    <span class="label-text text-[9px] font-bold uppercase opacity-50">Padding (All Sides)</span>
                  </label>
                  <select
                    :value="['p-0', 'p-1', 'p-2', 'p-3', 'p-4', 'p-6', 'p-8', 'p-10', 'p-12', 'p-16', 'p-20'].find(c => hasClass(c)) || ''"
                    @change="e => setExclusiveClass(['p-0', 'p-1', 'p-2', 'p-3', 'p-4', 'p-6', 'p-8', 'p-10', 'p-12', 'p-16', 'p-20'], (e.target as HTMLSelectElement).value)"
                    class="select select-bordered select-xs w-full rounded-lg font-bold text-xs dark:bg-slate-800"
                  >
                    <option value="">Default/None</option>
                    <option value="p-1">Extra Tight (4px)</option>
                    <option value="p-2">Tight (8px)</option>
                    <option value="p-3">Snug (12px)</option>
                    <option value="p-4">Normal (16px)</option>
                    <option value="p-6">Medium (24px)</option>
                    <option value="p-8">Loose (32px)</option>
                    <option value="p-10">X Loose (40px)</option>
                    <option value="p-12">2X Loose (48px)</option>
                    <option value="p-16">3X Loose (64px)</option>
                    <option value="p-20">4X Loose (80px)</option>
                  </select>
                </div>

                <!-- Margin All -->
                <div class="form-control w-full">
                  <label class="label p-0 pb-1">
                    <span class="label-text text-[9px] font-bold uppercase opacity-50">Margin (Outer Spacing)</span>
                  </label>
                  <select
                    :value="['m-0', 'm-1', 'm-2', 'm-3', 'm-4', 'm-6', 'm-8', 'm-10', 'mx-auto'].find(c => hasClass(c)) || ''"
                    @change="e => setExclusiveClass(['m-0', 'm-1', 'm-2', 'm-3', 'm-4', 'm-6', 'm-8', 'm-10', 'mx-auto'], (e.target as HTMLSelectElement).value)"
                    class="select select-bordered select-xs w-full rounded-lg font-bold text-xs dark:bg-slate-800"
                  >
                    <option value="">Default/None</option>
                    <option value="m-1">Extra Tight (4px)</option>
                    <option value="m-2">Tight (8px)</option>
                    <option value="m-3">Snug (12px)</option>
                    <option value="m-4">Normal (16px)</option>
                    <option value="m-6">Medium (24px)</option>
                    <option value="m-8">Loose (32px)</option>
                    <option value="m-10">X Loose (40px)</option>
                    <option value="mx-auto">Center Align (mx-auto)</option>
                  </select>
                </div>
              </div>

              <!-- INDIVIDUAL SPACING VIEW -->
              <div v-else class="space-y-4">
                <!-- Padding Grid (Top, Right, Bottom, Left) -->
                <div class="space-y-2">
                  <span class="text-[9px] font-black opacity-45 uppercase tracking-wider">Padding (Inner Spacing)</span>
                  <div class="grid grid-cols-2 gap-2">
                    <div class="form-control">
                      <label class="label p-0 pb-1"><span class="label-text text-[8px] font-bold uppercase opacity-50">Top</span></label>
                      <select
                        :value="['pt-0', 'pt-1', 'pt-2', 'pt-3', 'pt-4', 'pt-6', 'pt-8', 'pt-10', 'pt-12', 'pt-16', 'pt-20'].find(c => hasClass(c)) || ''"
                        @change="e => setExclusiveClass(['pt-0', 'pt-1', 'pt-2', 'pt-3', 'pt-4', 'pt-6', 'pt-8', 'pt-10', 'pt-12', 'pt-16', 'pt-20'], (e.target as HTMLSelectElement).value)"
                        class="select select-bordered select-xs rounded-lg text-xs font-bold dark:bg-slate-800"
                      >
                        <option value="">Inherit</option>
                        <option value="pt-0">0px</option>
                        <option value="pt-1">4px</option>
                        <option value="pt-2">8px</option>
                        <option value="pt-3">12px</option>
                        <option value="pt-4">16px</option>
                        <option value="pt-6">24px</option>
                        <option value="pt-8">32px</option>
                        <option value="pt-10">40px</option>
                        <option value="pt-12">48px</option>
                      </select>
                    </div>

                    <div class="form-control">
                      <label class="label p-0 pb-1"><span class="label-text text-[8px] font-bold uppercase opacity-50">Right</span></label>
                      <select
                        :value="['pr-0', 'pr-1', 'pr-2', 'pr-3', 'pr-4', 'pr-6', 'pr-8', 'pr-10', 'pr-12', 'pr-16', 'pr-20'].find(c => hasClass(c)) || ''"
                        @change="e => setExclusiveClass(['pr-0', 'pr-1', 'pr-2', 'pr-3', 'pr-4', 'pr-6', 'pr-8', 'pr-10', 'pr-12', 'pr-16', 'pr-20'], (e.target as HTMLSelectElement).value)"
                        class="select select-bordered select-xs rounded-lg text-xs font-bold dark:bg-slate-800"
                      >
                        <option value="">Inherit</option>
                        <option value="pr-0">0px</option>
                        <option value="pr-1">4px</option>
                        <option value="pr-2">8px</option>
                        <option value="pr-3">12px</option>
                        <option value="pr-4">16px</option>
                        <option value="pr-6">24px</option>
                        <option value="pr-8">32px</option>
                        <option value="pr-10">40px</option>
                        <option value="pr-12">48px</option>
                      </select>
                    </div>

                    <div class="form-control">
                      <label class="label p-0 pb-1"><span class="label-text text-[8px] font-bold uppercase opacity-50">Bottom</span></label>
                      <select
                        :value="['pb-0', 'pb-1', 'pb-2', 'pb-3', 'pb-4', 'pb-6', 'pb-8', 'pb-10', 'pb-12', 'pb-16', 'pb-20'].find(c => hasClass(c)) || ''"
                        @change="e => setExclusiveClass(['pb-0', 'pb-1', 'pb-2', 'pb-3', 'pb-4', 'pb-6', 'pb-8', 'pb-10', 'pb-12', 'pb-16', 'pb-20'], (e.target as HTMLSelectElement).value)"
                        class="select select-bordered select-xs rounded-lg text-xs font-bold dark:bg-slate-800"
                      >
                        <option value="">Inherit</option>
                        <option value="pb-0">0px</option>
                        <option value="pb-1">4px</option>
                        <option value="pb-2">8px</option>
                        <option value="pb-3">12px</option>
                        <option value="pb-4">16px</option>
                        <option value="pb-6">24px</option>
                        <option value="pb-8">32px</option>
                        <option value="pb-10">40px</option>
                        <option value="pb-12">48px</option>
                      </select>
                    </div>

                    <div class="form-control">
                      <label class="label p-0 pb-1"><span class="label-text text-[8px] font-bold uppercase opacity-50">Left</span></label>
                      <select
                        :value="['pl-0', 'pl-1', 'pl-2', 'pl-3', 'pl-4', 'pl-6', 'pl-8', 'pl-10', 'pl-12', 'pl-16', 'pl-20'].find(c => hasClass(c)) || ''"
                        @change="e => setExclusiveClass(['pl-0', 'pl-1', 'pl-2', 'pl-3', 'pl-4', 'pl-6', 'pl-8', 'pl-10', 'pl-12', 'pl-16', 'pl-20'], (e.target as HTMLSelectElement).value)"
                        class="select select-bordered select-xs rounded-lg text-xs font-bold dark:bg-slate-800"
                      >
                        <option value="">Inherit</option>
                        <option value="pl-0">0px</option>
                        <option value="pl-1">4px</option>
                        <option value="pl-2">8px</option>
                        <option value="pl-3">12px</option>
                        <option value="pl-4">16px</option>
                        <option value="pl-6">24px</option>
                        <option value="pl-8">32px</option>
                        <option value="pl-10">40px</option>
                        <option value="pl-12">48px</option>
                      </select>
                    </div>
                  </div>
                </div>

                <!-- Margin Grid (Top, Right, Bottom, Left) -->
                <div class="space-y-2">
                  <span class="text-[9px] font-black opacity-45 uppercase tracking-wider">Margin (Outer Spacing)</span>
                  <div class="grid grid-cols-2 gap-2">
                    <div class="form-control">
                      <label class="label p-0 pb-1"><span class="label-text text-[8px] font-bold uppercase opacity-50">Top</span></label>
                      <select
                        :value="['mt-0', 'mt-1', 'mt-2', 'mt-3', 'mt-4', 'mt-6', 'mt-8', 'mt-10'].find(c => hasClass(c)) || ''"
                        @change="e => setExclusiveClass(['mt-0', 'mt-1', 'mt-2', 'mt-3', 'mt-4', 'mt-6', 'mt-8', 'mt-10'], (e.target as HTMLSelectElement).value)"
                        class="select select-bordered select-xs rounded-lg text-xs font-bold dark:bg-slate-800"
                      >
                        <option value="">Inherit</option>
                        <option value="mt-0">0px</option>
                        <option value="mt-1">4px</option>
                        <option value="mt-2">8px</option>
                        <option value="mt-3">12px</option>
                        <option value="mt-4">16px</option>
                        <option value="mt-6">24px</option>
                        <option value="mt-8">32px</option>
                        <option value="mt-10">40px</option>
                      </select>
                    </div>

                    <div class="form-control">
                      <label class="label p-0 pb-1"><span class="label-text text-[8px] font-bold uppercase opacity-50">Right</span></label>
                      <select
                        :value="['mr-0', 'mr-1', 'mr-2', 'mr-3', 'mr-4', 'mr-6', 'mr-8', 'mr-10'].find(c => hasClass(c)) || ''"
                        @change="e => setExclusiveClass(['mr-0', 'mr-1', 'mr-2', 'mr-3', 'mr-4', 'mr-6', 'mr-8', 'mr-10'], (e.target as HTMLSelectElement).value)"
                        class="select select-bordered select-xs rounded-lg text-xs font-bold dark:bg-slate-800"
                      >
                        <option value="">Inherit</option>
                        <option value="mr-0">0px</option>
                        <option value="mr-1">4px</option>
                        <option value="mr-2">8px</option>
                        <option value="mr-3">12px</option>
                        <option value="mr-4">16px</option>
                        <option value="mr-6">24px</option>
                        <option value="mr-8">32px</option>
                        <option value="mr-10">40px</option>
                      </select>
                    </div>

                    <div class="form-control">
                      <label class="label p-0 pb-1"><span class="label-text text-[8px] font-bold uppercase opacity-50">Bottom</span></label>
                      <select
                        :value="['mb-0', 'mb-1', 'mb-2', 'mb-3', 'mb-4', 'mb-6', 'mb-8', 'mb-10'].find(c => hasClass(c)) || ''"
                        @change="e => setExclusiveClass(['mb-0', 'mb-1', 'mb-2', 'mb-3', 'mb-4', 'mb-6', 'mb-8', 'mb-10'], (e.target as HTMLSelectElement).value)"
                        class="select select-bordered select-xs rounded-lg text-xs font-bold dark:bg-slate-800"
                      >
                        <option value="">Inherit</option>
                        <option value="mb-0">0px</option>
                        <option value="mb-1">4px</option>
                        <option value="mb-2">8px</option>
                        <option value="mb-3">12px</option>
                        <option value="mb-4">16px</option>
                        <option value="mb-6">24px</option>
                        <option value="mb-8">32px</option>
                        <option value="mb-10">40px</option>
                      </select>
                    </div>

                    <div class="form-control">
                      <label class="label p-0 pb-1"><span class="label-text text-[8px] font-bold uppercase opacity-50">Left</span></label>
                      <select
                        :value="['ml-0', 'ml-1', 'ml-2', 'ml-3', 'ml-4', 'ml-6', 'ml-8', 'ml-10'].find(c => hasClass(c)) || ''"
                        @change="e => setExclusiveClass(['ml-0', 'ml-1', 'ml-2', 'ml-3', 'ml-4', 'ml-6', 'ml-8', 'ml-10'], (e.target as HTMLSelectElement).value)"
                        class="select select-bordered select-xs rounded-lg text-xs font-bold dark:bg-slate-800"
                      >
                        <option value="">Inherit</option>
                        <option value="ml-0">0px</option>
                        <option value="ml-1">4px</option>
                        <option value="ml-2">8px</option>
                        <option value="ml-3">12px</option>
                        <option value="ml-4">16px</option>
                        <option value="ml-6">24px</option>
                        <option value="ml-8">32px</option>
                        <option value="ml-10">40px</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Borders & Roundedness -->
              <div class="grid grid-cols-2 gap-2">
                <!-- Border Width -->
                <div class="form-control">
                  <label class="label p-0 pb-1">
                    <span class="label-text text-[9px] font-bold uppercase opacity-50">Border Width</span>
                  </label>
                  <select
                    :value="['border-0', 'border', 'border-2', 'border-4', 'border-8'].find(c => hasClass(c)) || ''"
                    @change="e => setExclusiveClass(['border-0', 'border', 'border-2', 'border-4', 'border-8'], (e.target as HTMLSelectElement).value)"
                    class="select select-bordered select-xs w-full rounded-lg font-bold text-xs dark:bg-slate-800"
                  >
                    <option value="">None</option>
                    <option value="border">Thin (1px)</option>
                    <option value="border-2">Medium (2px)</option>
                    <option value="border-4">Thick (4px)</option>
                    <option value="border-8">X Thick (8px)</option>
                  </select>
                </div>

                <!-- Border Style -->
                <div class="form-control">
                  <label class="label p-0 pb-1">
                    <span class="label-text text-[9px] font-bold uppercase opacity-50">Border Style</span>
                  </label>
                  <select
                    :value="['border-solid', 'border-dashed', 'border-dotted', 'border-double', 'border-none'].find(c => hasClass(c)) || ''"
                    @change="e => setExclusiveClass(['border-solid', 'border-dashed', 'border-dotted', 'border-double', 'border-none'], (e.target as HTMLSelectElement).value)"
                    class="select select-bordered select-xs w-full rounded-lg font-bold text-xs dark:bg-slate-800"
                  >
                    <option value="">Solid</option>
                    <option value="border-dashed">Dashed</option>
                    <option value="border-dotted">Dotted</option>
                    <option value="border-double">Double</option>
                  </select>
                </div>
              </div>

              <!-- Corner Radius (Rounded) -->
              <div class="form-control w-full">
                <label class="label p-0 pb-1">
                  <span class="label-text text-[9px] font-bold uppercase opacity-50">Corner Radius (Rounded)</span>
                </label>
                <select
                  :value="['rounded-none', 'rounded-sm', 'rounded', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-3xl', 'rounded-full'].find(c => hasClass(c)) || ''"
                  @change="e => setExclusiveClass(['rounded-none', 'rounded-sm', 'rounded', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-3xl', 'rounded-full'], (e.target as HTMLSelectElement).value)"
                  class="select select-bordered select-xs w-full rounded-lg font-bold text-xs dark:bg-slate-800"
                >
                  <option value="">Sharp Corners</option>
                  <option value="rounded-sm">Tight (Rounded SM)</option>
                  <option value="rounded">Normal (Rounded MD)</option>
                  <option value="rounded-lg">Large (Rounded LG)</option>
                  <option value="rounded-xl">Extra Large (XL)</option>
                  <option value="rounded-2xl">2X Large (2XL)</option>
                  <option value="rounded-3xl">3X Large (3XL)</option>
                  <option value="rounded-full">Pill / Circle (Full)</option>
                </select>
              </div>
            </div>

                <!-- Unified Style Color Picker (Text / Bg / Border) -->
                <div class="space-y-3 pt-3 border-t border-base-200 dark:border-slate-800">
                  <span class="text-[10px] font-black uppercase tracking-widest opacity-40">Colors & Borders</span>
                  
                  <!-- Color Type Tabs Selector -->
                  <div class="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      type="button"
                      @click="activeColorTab = 'color'"
                      :class="['flex-1 text-[9px] font-black py-1.5 rounded-lg uppercase tracking-wider text-center transition-all', activeColorTab === 'color' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'opacity-50 text-slate-600 dark:text-slate-300']"
                    >
                      Text
                    </button>
                    <button
                      type="button"
                      @click="activeColorTab = 'background-color'"
                      :class="['flex-1 text-[9px] font-black py-1.5 rounded-lg uppercase tracking-wider text-center transition-all', activeColorTab === 'background-color' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'opacity-50 text-slate-600 dark:text-slate-300']"
                    >
                      Bg
                    </button>
                    <button
                      type="button"
                      @click="activeColorTab = 'border-color'"
                      :class="['flex-1 text-[9px] font-black py-1.5 rounded-lg uppercase tracking-wider text-center transition-all', activeColorTab === 'border-color' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'opacity-50 text-slate-600 dark:text-slate-300']"
                    >
                      Border
                    </button>
                  </div>

                  <!-- Swatches Palette Grid -->
                  <div class="space-y-1.5">
                    <span class="text-[9px] font-bold opacity-50 uppercase">Tailwind Color Palette</span>
                    <div class="grid grid-cols-10 gap-1.5">
                      <button
                        v-for="swatch in tailwindSwatches"
                        :key="swatch.hex"
                        type="button"
                        @click="applyCustomStyleColor(activeColorTab, hexToRgba(swatch.hex, getOpacityFromRgba(selectedBlock?.styles?.[activeColorTab] || '')))"
                        class="w-5 h-5 rounded-full border border-base-content/10 shadow-sm hover:scale-110 active:scale-95 transition-transform flex items-center justify-center relative"
                        :style="{ backgroundColor: swatch.hex }"
                        :title="swatch.name"
                      >
                        <span
                          v-if="selectedBlock?.styles?.[activeColorTab] && getHexFromRgba(selectedBlock.styles[activeColorTab]) === swatch.hex.toLowerCase()"
                          class="absolute inset-0 flex items-center justify-center text-[9px] text-white mix-blend-difference font-bold"
                        >✓</span>
                      </button>
                    </div>
                  </div>

                  <!-- Custom HEX / RGB Color Input Picker -->
                  <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg border border-base-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex items-center justify-center shrink-0">
                      <input
                        type="color"
                        :value="selectedBlock?.styles?.[activeColorTab] ? getHexFromRgba(selectedBlock.styles[activeColorTab]) : '#ffffff'"
                        @input="e => applyCustomStyleColor(activeColorTab, hexToRgba((e.target as HTMLInputElement).value, getOpacityFromRgba(selectedBlock?.styles?.[activeColorTab] || '')))"
                        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div
                        class="w-5 h-5 rounded-md border border-base-content/10"
                        :style="{ backgroundColor: selectedBlock?.styles?.[activeColorTab] ? getHexFromRgba(selectedBlock.styles[activeColorTab]) : '#ffffff' }"
                      ></div>
                    </div>
                    
                    <input
                      type="text"
                      placeholder="#HEX or rgb()"
                      :value="selectedBlock?.styles?.[activeColorTab] || ''"
                      @change="e => applyCustomStyleColor(activeColorTab, (e.target as HTMLInputElement).value)"
                      class="input input-bordered input-xs rounded-lg font-mono text-[10px] flex-1 dark:bg-slate-800"
                    />

                    <button
                      v-if="selectedBlock?.styles?.[activeColorTab]"
                      type="button"
                      @click="applyCustomStyleColor(activeColorTab, '')"
                      class="btn btn-xs btn-ghost text-rose-500 rounded-lg"
                      title="Clear style"
                    >Clear</button>
                  </div>

                  <!-- Opacity Range Slider -->
                  <div class="space-y-1">
                    <div class="flex justify-between items-center text-[9px] font-bold opacity-50 uppercase">
                      <span>Opacity</span>
                      <span>{{ getOpacityFromRgba(selectedBlock?.styles?.[activeColorTab] || '') }}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      :value="getOpacityFromRgba(selectedBlock?.styles?.[activeColorTab] || '')"
                      @input="e => {
                        const targetColor = selectedBlock?.styles?.[activeColorTab] ? getHexFromRgba(selectedBlock.styles[activeColorTab]) : '#3b82f6';
                        applyCustomStyleColor(activeColorTab, hexToRgba(targetColor, parseInt((e.target as HTMLInputElement).value)));
                      }"
                      class="range range-xs range-primary"
                    />
                  </div>

                  <!-- Recently Used Colors -->
                  <div v-if="recentColors.length > 0" class="space-y-1">
                    <span class="text-[9px] font-bold opacity-50 uppercase">Recent Colors</span>
                    <div class="flex flex-wrap gap-1.5">
                      <button
                        v-for="color in recentColors"
                        :key="color"
                        type="button"
                        @click="applyCustomStyleColor(activeColorTab, color)"
                        class="w-5 h-5 rounded-md border border-base-content/10 hover:scale-110 active:scale-95 transition-all"
                        :style="{ backgroundColor: getHexFromRgba(color) }"
                        :title="color"
                      ></button>
                    </div>
                  </div>

                </div>

                <!-- Background Image Settings -->
                <div class="space-y-3 pt-3 border-t border-base-200 dark:border-slate-800">
                  <span class="text-[10px] font-black uppercase tracking-widest opacity-40">Background Image</span>
                  
                  <!-- Background Image Source URL -->
                  <div class="form-control">
                    <label class="label p-0 pb-1 flex justify-between items-center">
                      <span class="label-text text-[9px] font-bold uppercase opacity-50">Image URL</span>
                      <button
                        type="button"
                        @click.stop="openGalleryPicker('bgImage')"
                        class="text-[9px] font-bold text-primary uppercase hover:underline"
                      >Choose</button>
                    </label>
                    <div class="flex gap-2">
                      <input
                        type="text"
                        placeholder="https://example.com/bg.jpg"
                        :value="getBgImageUrl(selectedBlock)"
                        @change="e => {
                          const url = (e.target as HTMLInputElement).value.trim();
                          selectedBlock.styles = selectedBlock.styles || {};
                          if (url) {
                            selectedBlock.styles['background-image'] = `url('${url}')`;
                            selectedBlock.styles['background-repeat'] = 'no-repeat';
                          } else {
                            delete selectedBlock.styles['background-image'];
                            delete selectedBlock.styles['background-repeat'];
                            delete selectedBlock.styles['background-size'];
                            delete selectedBlock.styles['background-position'];
                          }
                          saveHistoryState();
                        }"
                        class="input input-bordered input-xs rounded-lg text-[10px] flex-1 dark:bg-slate-800"
                      />
                      <button
                        v-if="selectedBlock?.styles?.['background-image']"
                        type="button"
                        @click.stop="() => {
                          delete selectedBlock.styles['background-image'];
                          delete selectedBlock.styles['background-repeat'];
                          delete selectedBlock.styles['background-size'];
                          delete selectedBlock.styles['background-position'];
                          saveHistoryState();
                        }"
                        class="btn btn-xs btn-ghost text-rose-500 rounded-lg"
                      >Clear</button>
                    </div>
                  </div>

                  <!-- Background Image Sizing (Size / Display Style) -->
                  <div v-if="selectedBlock?.styles?.['background-image']" class="grid grid-cols-2 gap-2">
                    <div class="form-control">
                      <label class="label p-0 pb-1">
                        <span class="label-text text-[9px] font-bold uppercase opacity-50">Sizing / Fit</span>
                      </label>
                      <select
                        :value="selectedBlock.styles['background-size'] || 'cover'"
                        @change="e => {
                          selectedBlock.styles['background-size'] = (e.target as HTMLSelectElement).value;
                          saveHistoryState();
                        }"
                        class="select select-bordered select-xs w-full rounded-lg font-bold text-xs dark:bg-slate-800"
                      >
                        <option value="cover">Cover (Fill)</option>
                        <option value="contain">Contain (Fit)</option>
                        <option value="100% 100%">Stretch (Distort)</option>
                        <option value="auto">Auto (Original)</option>
                      </select>
                    </div>

                    <!-- Background Image Positioning -->
                    <div class="form-control">
                      <label class="label p-0 pb-1">
                        <span class="label-text text-[9px] font-bold uppercase opacity-50">Position</span>
                      </label>
                      <select
                        :value="selectedBlock.styles['background-position'] || 'center'"
                        @change="e => {
                          selectedBlock.styles['background-position'] = (e.target as HTMLSelectElement).value;
                          saveHistoryState();
                        }"
                        class="select select-bordered select-xs w-full rounded-lg font-bold text-xs dark:bg-slate-800"
                      >
                        <option value="center">Center</option>
                        <option value="top">Top</option>
                        <option value="bottom">Bottom</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                        <option value="top left">Top Left</option>
                        <option value="top right">Top Right</option>
                        <option value="bottom left">Bottom Left</option>
                        <option value="bottom right">Bottom Right</option>
                      </select>
                    </div>
                  </div>

                </div>

            <div class="divider border-base-200 dark:border-slate-800"></div>

            <!-- Tailwind utility classes list and autocomplete manager -->
            <div class="space-y-4">
              <h4 class="text-[10px] font-black uppercase tracking-widest opacity-40">Tailwind Utility Classes</h4>
              
              <!-- Autocomplete Search Input -->
              <div class="relative w-full">
                <input
                  type="text"
                  placeholder="Search classes or type custom and hit Enter..."
                  v-model="classSearch"
                  @focus="showAutocomplete = true"
                  @keydown.enter.prevent="addCustomClassFromSearch"
                  class="input input-bordered input-sm rounded-xl w-full text-xs focus:outline-none dark:bg-slate-800"
                />
                
                <div v-show="showAutocomplete && filteredClasses.length > 0" class="absolute left-0 right-0 top-9 bg-white dark:bg-slate-800 border border-base-200 dark:border-slate-700 shadow-xl rounded-xl z-50 max-h-48 overflow-y-auto">
                  <div
                    v-for="c in filteredClasses"
                    :key="c"
                    @click="addStyleClass(c)"
                    class="px-4 py-2 hover:bg-primary hover:text-white cursor-pointer text-xs font-mono select-none"
                  >
                    {{ c }}
                  </div>
                </div>
              </div>

              <!-- List of Active Classes -->
              <div class="flex flex-wrap gap-1.5 pt-2">
                <span
                  v-for="c in selectedBlock.classes"
                  :key="c"
                  class="badge bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/10 hover:text-rose-500 border border-base-200 dark:border-slate-800 text-[10px] font-mono py-2.5 rounded-lg select-none flex items-center gap-1.5 cursor-pointer"
                  @click="removeStyleClass(c)"
                >
                  {{ c }}
                  <font-awesome-icon :icon="['fas', 'xmark']" class="w-3 h-3 opacity-50" />
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- SEO Settings Modal -->
    <div v-if="showSeoModal" class="modal modal-open z-50">
      <div class="modal-box rounded-3xl border border-base-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 p-8 max-w-lg">
        <h3 class="font-black text-2xl tracking-tight">SEO & Search Metadata</h3>
        <p class="text-xs opacity-50 mb-6">Customize title details and page descriptions loaded by search indexes.</p>
        
        <div class="space-y-4">
          <div class="form-control">
            <label class="label font-bold text-xs uppercase text-slate-400">SEO Title Tag</label>
            <input type="text" v-model="seoTitle" placeholder="e.g. My Website Home Page" class="input input-bordered rounded-xl w-full dark:bg-slate-800" />
          </div>

          <div class="form-control">
            <label class="label font-bold text-xs uppercase text-slate-400">Meta Description</label>
            <textarea v-model="seoDescription" placeholder="A rich description summary used in search results..." class="textarea textarea-bordered rounded-xl w-full h-24 dark:bg-slate-800"></textarea>
          </div>
        </div>

        <div class="modal-action mt-6">
          <button @click="showSeoModal = false" class="btn btn-primary rounded-xl font-bold px-8 text-white">Done</button>
        </div>
      </div>
    </div>

    <!-- Gallery Picker Modal -->
    <div v-if="showGalleryModal" class="modal modal-open z-50 animate-in fade-in duration-200">
      <div class="modal-box rounded-3xl border border-base-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 max-w-2xl p-8">
        <h3 class="font-black text-2xl tracking-tight">Select Asset</h3>
        <p class="text-xs opacity-50 mb-6">Choose an image from your uploaded assets.</p>
        
        <div v-if="loadingAssets" class="flex justify-center py-10">
          <span class="loading loading-spinner loading-md text-primary"></span>
        </div>
        <div v-else-if="assetsList.length === 0" class="text-center py-10 opacity-55 text-xs font-bold uppercase tracking-wider">
          No assets uploaded yet. You can upload them in the Gallery view.
        </div>
        <div v-else class="grid grid-cols-3 gap-4 max-h-60 overflow-y-auto pr-1">
          <div
            v-for="asset in assetsList"
            :key="asset.key"
            @click.stop="selectAsset(asset.url)"
            class="cursor-pointer border border-base-200 dark:border-slate-800 hover:border-primary dark:hover:border-primary rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-800/40 flex flex-col items-center p-2.5 text-center gap-2 group transition-all"
          >
            <div class="h-20 w-full flex items-center justify-center bg-slate-200 dark:bg-slate-700/50 rounded-xl overflow-hidden relative">
              <img :src="asset.url" class="object-cover h-full w-full group-hover:scale-105 transition-all" />
            </div>
            <span class="text-[10px] font-bold truncate w-full opacity-70">{{ asset.name }}</span>
          </div>
        </div>

        <div class="modal-action mt-6">
          <button type="button" @click.stop="showGalleryModal = false" class="btn btn-ghost rounded-xl font-bold">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Reusable custom Modal for alerts/confirms -->
    <div v-if="modal.show" class="modal modal-open z-50 animate-in fade-in duration-200">
      <div class="modal-box rounded-3xl border border-base-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 p-8 max-w-sm">
        <h3 class="font-black text-2xl tracking-tight text-slate-900 dark:text-white">{{ modal.title }}</h3>
        <p class="text-xs opacity-60 mt-2 mb-6 text-slate-700 dark:text-slate-300 leading-relaxed">{{ modal.message }}</p>
        <div class="modal-action mt-6">
          <button type="button" @click="modal.show = false" class="btn btn-ghost rounded-xl font-bold">
            {{ modal.type === 'confirm' ? 'Cancel' : 'Ok' }}
          </button>
          <button type="button" v-if="modal.type === 'confirm'" @click="modal.onConfirm?.(); modal.show = false" class="btn btn-primary rounded-xl font-bold px-6 text-white">
            Confirm
          </button>
        </div>
      </div>
    </div>

    <!-- Floating Text Selection Toolbar -->
    <div
      v-if="floatingToolbar.show"
      class="fixed z-50 flex items-center bg-slate-900 border border-slate-700 text-white rounded-xl shadow-2xl p-1.5 gap-1 select-none animate-in zoom-in-95 duration-100"
      :style="{ left: `${floatingToolbar.x}px`, top: `${floatingToolbar.y}px`, transform: 'translateX(-50%)' }"
    >
      <button
        @click="formatInline('bold')"
        class="btn btn-xs btn-ghost text-white font-black hover:bg-white/10 w-8 h-8 rounded-lg flex items-center justify-center"
        title="Bold Selection"
      >
        <font-awesome-icon :icon="['fas', 'bold']" />
      </button>
      <button
        @click="formatInline('italic')"
        class="btn btn-xs btn-ghost text-white italic hover:bg-white/10 w-8 h-8 rounded-lg flex items-center justify-center"
        title="Italic Selection"
      >
        <font-awesome-icon :icon="['fas', 'italic']" />
      </button>
      <button
        @click="formatInline('underline')"
        class="btn btn-xs btn-ghost text-white underline hover:bg-white/10 w-8 h-8 rounded-lg flex items-center justify-center"
        title="Underline Selection"
      >
        <font-awesome-icon :icon="['fas', 'underline']" />
      </button>
      <button
        @click="formatInline('strikeThrough')"
        class="btn btn-xs btn-ghost text-white line-through hover:bg-white/10 w-8 h-8 rounded-lg flex items-center justify-center"
        title="Strikethrough Selection"
      >
        <font-awesome-icon :icon="['fas', 'strikethrough']" />
      </button>
      <div class="w-px h-5 bg-white/10 mx-1"></div>
      <button
        @click="formatInline('removeFormat')"
        class="btn btn-xs btn-ghost text-rose-400 hover:bg-white/10 w-8 h-8 rounded-lg flex items-center justify-center"
        title="Clear Selection Formatting"
      >
        <font-awesome-icon :icon="['fas', 'eraser']" />
      </button>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import DesignerBlock from "../components/DesignerBlock.vue";
import DesignerTreeItem from "../components/DesignerTreeItem.vue";
import type { CMSPage, CMSSettings } from "swiftbase-cms-shared";

const props = defineProps<{ id: string }>();

// States
const page = ref<CMSPage | null>(null);
const settings = ref<CMSSettings | null>(null);
const saving = ref(false);
const generating = ref(false);
const showSeoModal = ref(false);
const seoTitle = ref("");
const seoDescription = ref("");
const isFullScreen = ref(false);
const activeTab = ref<"blocks" | "ai">("blocks");

const modal = ref({
  show: false,
  title: "",
  message: "",
  type: "alert" as "alert" | "confirm",
  onConfirm: null as (() => void) | null,
});

const lastSavedState = ref<string>("");
const hasUnsavedChanges = computed(() => {
  return lastSavedState.value !== (JSON.stringify(blocks.value) + "||" + seoTitle.value + "||" + seoDescription.value);
});

const showAlert = (title: string, message: string) => {
  modal.value = { show: true, title, message, type: "alert", onConfirm: null };
};

const showConfirm = (title: string, message: string, onConfirm: () => void) => {
  modal.value = { show: true, title, message, type: "confirm", onConfirm };
};
const aiPrompt = ref("");

// Canvas Configs
const activeSize = ref("desktop");
const isPreviewDark = ref(false);
const showOutlines = ref(true);

const screenSizes = [
  { id: "desktop", name: "Desktop Monitor View", icon: ["fas", "desktop"] },
  { id: "tablet", name: "Tablet Screen View", icon: ["fas", "tablet-screen-button"] },
  { id: "mobile", name: "Mobile Device View", icon: ["fas", "mobile-screen-button"] }
];

const canvasWidth = computed(() => {
  if (activeSize.value === "tablet") return "768px";
  if (activeSize.value === "mobile") return "380px";
  return "100%";
});

const scopedGlobalStyles = computed(() => {
  if (!settings.value?.globalStyles) return "";
  const css = settings.value.globalStyles;
  return css.replace(/(^|,\s*)([a-zA-Z0-9_\-\.\#\*\[\]\:\(\)\>\+\~\s]+)(?=\s*\{)/g, (match, prefix, selector) => {
    const trimmed = selector.trim();
    if (trimmed === ":root") {
      return `${prefix}:root, ${prefix}#designer-canvas-frame`;
    }
    if (trimmed.startsWith('@') || /^\d+%$/.test(trimmed) || trimmed === 'from' || trimmed === 'to') {
      return match;
    }
    return `${prefix}#designer-canvas-frame ${trimmed}`;
  });
});

// Blocks Model Store
const blocks = ref<any[]>([]);
const selectedBlock = ref<any | null>(null);

const activeColorTab = ref<"color" | "background-color" | "border-color">("color");
const isSpacingIndividual = ref(false);
const showGalleryModal = ref(false);
const galleryPickerTarget = ref<"bgImage" | "imageBlock" | "">("");
const assetsList = ref<any[]>([]);
const loadingAssets = ref(false);
const recentColors = ref<string[]>(["#3b82f6", "#10b981", "#ef4444", "#ffffff", "#000000"]);

const tailwindSwatches = [
  { name: "Slate", hex: "#64748b" },
  { name: "Red", hex: "#ef4444" },
  { name: "Orange", hex: "#f97316" },
  { name: "Amber", hex: "#f59e0b" },
  { name: "Yellow", hex: "#eab308" },
  { name: "Lime", hex: "#84cc16" },
  { name: "Green", hex: "#22c55e" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Teal", hex: "#14b8a6" },
  { name: "Cyan", hex: "#06b6d4" },
  { name: "Sky", hex: "#0ea5e9" },
  { name: "Blue", hex: "#3b82f6" },
  { name: "Indigo", hex: "#6366f1" },
  { name: "Violet", hex: "#8b5cf6" },
  { name: "Purple", hex: "#a855f7" },
  { name: "Fuchsia", hex: "#d946ef" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Rose", hex: "#f43f5e" },
  { name: "White", hex: "#ffffff" },
  { name: "Black", hex: "#000000" }
];

const applyCustomStyleColor = (attr: string, colorValue: string) => {
  if (!selectedBlock.value) return;
  selectedBlock.value.styles = selectedBlock.value.styles || {};
  if (!colorValue) {
    delete selectedBlock.value.styles[attr];
  } else {
    selectedBlock.value.styles[attr] = colorValue;
    if (!recentColors.value.includes(colorValue)) {
      recentColors.value.unshift(colorValue);
      recentColors.value = recentColors.value.slice(0, 8);
      try {
        localStorage.setItem("sbcms_recent_colors", JSON.stringify(recentColors.value));
      } catch (err) {}
    }
  }
  saveHistoryState();
};

const hexToRgba = (hex: string, opacity: number): string => {
  if (!hex) return "";
  if (hex.startsWith("rgb")) {
    const cleanRgb = hex.replace(/rgba?\((.*?)\)/, "$1").split(",");
    const r = parseInt(cleanRgb[0]) || 0;
    const g = parseInt(cleanRgb[1]) || 0;
    const b = parseInt(cleanRgb[2]) || 0;
    return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
  }
  let clean = hex.replace("#", "");
  if (clean.length === 3) {
    clean = clean.split("").map(c => c + c).join("");
  }
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
};

const getHexFromRgba = (rgba: string): string => {
  if (!rgba) return "#000000";
  if (rgba.startsWith("#")) return rgba;
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return "#000000";
  const r = parseInt(match[1]).toString(16).padStart(2, "0");
  const g = parseInt(match[2]).toString(16).padStart(2, "0");
  const b = parseInt(match[3]).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
};

const getOpacityFromRgba = (rgba: string): number => {
  if (!rgba) return 100;
  if (rgba.startsWith("#")) return 100;
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match || match[4] === undefined) return 100;
  return Math.round(parseFloat(match[4]) * 100);
};

// Floating Text Selection Toolbar State
const floatingToolbar = ref({
  show: false,
  x: 0,
  y: 0,
});

// History Stacks for Undo / Redo
const historyStack = ref<string[]>([]);
const redoStack = ref<string[]>([]);
let isHistoryAction = false;

const saveHistoryState = () => {
  if (!blocks.value) return;
  const stateStr = JSON.stringify(blocks.value);
  if (historyStack.value.length > 0 && historyStack.value[historyStack.value.length - 1] === stateStr) {
    return;
  }
  historyStack.value.push(stateStr);
  if (historyStack.value.length > 50) {
    historyStack.value.shift();
  }
  redoStack.value = [];
};

const undo = () => {
  if (historyStack.value.length <= 1) return;
  // Pop the current state and put it on redo stack
  const currentState = historyStack.value.pop()!;
  redoStack.value.push(currentState);
  
  // Set the previous state
  const prevStateStr = historyStack.value[historyStack.value.length - 1];
  isHistoryAction = true;
  blocks.value = JSON.parse(prevStateStr);
  selectedBlock.value = null;
};

const redo = () => {
  if (redoStack.value.length === 0) return;
  const nextStateStr = redoStack.value.pop()!;
  historyStack.value.push(nextStateStr);
  
  isHistoryAction = true;
  blocks.value = JSON.parse(nextStateStr);
  selectedBlock.value = null;
};

watch(
  blocks,
  () => {
    if (isHistoryAction) {
      isHistoryAction = false;
      return;
    }
    saveHistoryState();
  },
  { deep: true }
);

const formatInline = (command: string) => {
  if (command === "removeFormat") {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const plainText = range.toString();
      
      range.deleteContents();
      const textNode = document.createTextNode(plainText);
      range.insertNode(textNode);
      
      // Re-select the plain text node
      const newRange = document.createRange();
      newRange.selectNode(textNode);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  } else {
    document.execCommand(command, false, undefined);
  }
  
  if (selectedBlock.value) {
    const el = document.querySelector(`[data-block-id="${selectedBlock.value.id}"]`) as HTMLElement;
    if (el) {
      selectedBlock.value.content = el.innerHTML;
      saveHistoryState();
    }
  }
};

const updateRatingIcon = (newIcon: string) => {
  if (!selectedBlock.value || selectedBlock.value.type !== "rating") return;
  selectedBlock.value.attributes = selectedBlock.value.attributes || {};
  selectedBlock.value.attributes.icon = newIcon;
  if (selectedBlock.value.children) {
    selectedBlock.value.children.forEach((child: any) => {
      child.attributes = child.attributes || {};
      child.attributes.icon = newIcon;
    });
  }
};

const getBgImageUrl = (block: any): string => {
  if (!block?.styles?.["background-image"]) return "";
  const imgUrl = block.styles["background-image"];
  const match = imgUrl.match(/^url\(['"]?(.+?)['"]?\)$/);
  return match ? match[1] : "";
};

const openGalleryPicker = async (target: "bgImage" | "imageBlock") => {
  galleryPickerTarget.value = target;
  showGalleryModal.value = true;
  loadingAssets.value = true;
  try {
    const res = await fetch("/api/assets");
    if (res.ok) {
      assetsList.value = await res.json();
    }
  } catch (err) {
    console.error("Failed to load assets:", err);
  } finally {
    loadingAssets.value = false;
  }
};

const selectAsset = (url: string) => {
  if (!selectedBlock.value) return;
  const cacheBustedUrl = `${url}?v=${Date.now()}`;
  if (galleryPickerTarget.value === "bgImage") {
    selectedBlock.value.styles = selectedBlock.value.styles || {};
    selectedBlock.value.styles["background-image"] = `url('${cacheBustedUrl}')`;
    selectedBlock.value.styles["background-repeat"] = "no-repeat";
  } else if (galleryPickerTarget.value === "imageBlock") {
    selectedBlock.value.attributes = selectedBlock.value.attributes || {};
    selectedBlock.value.attributes.src = cacheBustedUrl;
  }
  saveHistoryState();
  showGalleryModal.value = false;
  galleryPickerTarget.value = "";
};

const handleSelectionChange = () => {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.toString().trim() === "") {
    floatingToolbar.value.show = false;
    return;
  }
  try {
    const range = selection.getRangeAt(0);
    const commonAncestor = range.commonAncestorContainer;
    const isInsideCanvas = document.getElementById("designer-canvas-frame")?.contains(commonAncestor);
    if (!isInsideCanvas) {
      floatingToolbar.value.show = false;
      return;
    }
    const rect = range.getBoundingClientRect();
    // Offset relative to viewport
    floatingToolbar.value.x = rect.left + rect.width / 2;
    floatingToolbar.value.y = rect.top - 45;
    floatingToolbar.value.show = true;
  } catch (err) {
    floatingToolbar.value.show = false;
  }
};

const handleGlobalKeydown = (e: KeyboardEvent) => {
  const isMeta = e.metaKey || e.ctrlKey;
  if (isMeta && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (e.shiftKey) {
      redo();
    } else {
      undo();
    }
  } else if (isMeta && e.key.toLowerCase() === "y") {
    e.preventDefault();
    redo();
  }
};

// Autocomplete Tailwind styles
const showAutocomplete = ref(false);
const classSearch = ref("");

const TAILWIND_CLASSES = [
  "flex", "grid", "grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4", "grid-cols-6", "grid-cols-12", "gap-2", "gap-4", "gap-6", "gap-8", "gap-12", "flex-col", "flex-row", "justify-between", "justify-center", "items-center", "items-start", "items-end",
  "p-0", "p-1", "p-2", "p-3", "p-4", "p-6", "p-8", "p-10", "p-12", "p-16", "p-20", "px-2", "px-4", "px-6", "px-8", "px-10", "px-12", "py-2", "py-4", "py-6", "py-8", "py-10", "py-12",
  "m-0", "m-1", "m-2", "m-3", "m-4", "m-6", "m-8", "m-10", "mx-auto", "my-auto", "mt-2", "mt-4", "mt-6", "mt-8", "mb-2", "mb-4", "mb-6", "mb-8",
  "text-xs", "text-sm", "text-base", "text-lg", "text-xl", "text-2xl", "text-3xl", "text-4xl", "text-5xl", "text-6xl", "text-7xl", "font-light", "font-normal", "font-medium", "font-semibold", "font-bold", "font-extrabold", "font-black", "italic", "underline", "line-through", "tracking-tight", "tracking-wider", "leading-none", "leading-tight", "leading-relaxed",
  "text-left", "text-center", "text-right", "text-justify",
  "text-white", "text-slate-900", "text-slate-500", "text-slate-400", "text-slate-300", "text-primary", "text-secondary", "text-accent", "text-rose-500", "text-emerald-500",
  "bg-white", "bg-transparent", "bg-slate-50", "bg-slate-100", "bg-slate-200", "bg-slate-800", "bg-slate-900", "bg-slate-950", "bg-primary", "bg-secondary", "bg-rose-500", "bg-emerald-500",
  "dark:bg-slate-950", "dark:bg-slate-900", "dark:bg-slate-800", "dark:text-white", "dark:text-slate-300", "dark:border-slate-800",
  "border", "border-2", "border-4", "border-dashed", "border-base-200", "border-slate-200", "border-slate-300", "border-primary", "rounded-none", "rounded", "rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl", "rounded-3xl", "rounded-full",
  "shadow-sm", "shadow", "shadow-md", "shadow-lg", "shadow-xl", "shadow-2xl", "shadow-inner", "opacity-25", "opacity-50", "opacity-75", "opacity-80", "opacity-90", "opacity-100",
  "block", "inline-block", "inline", "hidden", "w-full", "w-1/2", "w-1/3", "w-2/3", "w-1/4", "w-3/4", "h-auto", "h-full", "h-64", "h-48", "h-32",
  "object-cover", "object-contain", "object-fill", "object-scale-down"
];

const filteredClasses = computed(() => {
  if (!classSearch.value) return [];
  const search = classSearch.value.toLowerCase();
  return TAILWIND_CLASSES.filter(c => c.toLowerCase().includes(search) && !selectedBlock.value?.classes.includes(c)).slice(0, 8);
});

const categories = computed(() => [
  {
    name: "Layout Elements",
    items: [
      { id: "row-flex", label: "Flex Row", icon: ["fas", "left-right"], template: { type: "row", tagName: "div", classes: ["flex", "flex-col", "md:flex-row", "gap-6", "p-4"], children: [] } },
      { id: "column-flex", label: "Flex Col", icon: ["fas", "up-down"], template: { type: "column", tagName: "div", classes: ["flex-1", "p-4", "border", "border-dashed", "border-slate-200", "dark:border-slate-800"], children: [] } },
      { id: "section-layout", label: "Section", icon: ["fas", "layer-group"], template: { type: "section", tagName: "section", classes: ["py-16", "px-6", "bg-slate-50", "dark:bg-slate-900"], children: [] } },
      { id: "card-layout", label: "Card", icon: ["fas", "square"], template: { type: "card", tagName: "div", classes: ["card", "p-6", "bg-white", "dark:bg-slate-800", "border", "border-base-200", "dark:border-slate-800", "rounded-2xl", "shadow-sm"], children: [] } }
    ]
  },
  {
    name: "Basic Elements",
    items: [
      { id: "heading-1", label: "Heading 1", icon: ["fas", "heading"], template: { type: "heading", tagName: "h1", classes: ["text-4xl", "font-black", "tracking-tight", "mb-4"], content: "Main Header Title" } },
      { id: "heading-2", label: "Heading 2", icon: ["fas", "heading"], template: { type: "heading", tagName: "h2", classes: ["text-2xl", "font-black", "tracking-tight", "mb-3"], content: "Secondary Heading" } },
      { id: "paragraph", label: "Paragraph", icon: ["fas", "paragraph"], template: { type: "text", tagName: "p", classes: ["text-sm", "opacity-80", "leading-relaxed", "mb-3"], content: "Describe layout details and product values here..." } },
      { id: "link-element", label: "Link Tag", icon: ["fas", "link"], template: { type: "text", tagName: "a", classes: ["text-primary", "font-bold", "hover:underline"], content: "Explore details", attributes: { href: "#" } } },
      { id: "button-element", label: "Button", icon: ["fas", "hand-pointer"], template: { type: "button", tagName: "button", classes: ["btn", "btn-primary", "rounded-xl", "font-bold", "text-xs", "uppercase", "px-6", "py-2.5", "text-white"], content: "Get Started" } },
      { id: "image-element", label: "Image Block", icon: ["fas", "image"], template: { type: "image", tagName: "img", classes: ["rounded-2xl", "max-w-full", "h-auto", "shadow-sm"], attributes: { src: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=600", alt: "Preview asset" } } },
      { id: "custom-code-element", label: "HTML Block", icon: ["fas", "code"], template: { type: "html", tagName: "div", classes: ["p-4", "bg-slate-900/50", "rounded-xl", "border", "border-base-300/40"], content: "<div class='text-center p-4 text-xs font-mono text-slate-400'>Custom raw HTML content goes here...</div>" } }
    ]
  },
  {
    name: "Form Controls",
    items: [
      { id: "form-box", label: "Form Box", icon: ["fas", "rectangle-list"], template: { type: "form", tagName: "form", classes: ["space-y-4", "p-8", "bg-slate-50", "dark:bg-slate-800/40", "border", "border-base-200", "dark:border-slate-800", "rounded-3xl", "max-w-md", "mx-auto"], children: [] } },
      { id: "form-group", label: "Form Group", icon: ["fas", "circle-info"], template: { type: "form-group", tagName: "div", classes: ["form-control", "w-full", "space-y-1.5"], children: [
        { id: `block-lbl-${Math.random().toString(36).substring(2, 9)}`, type: "text", tagName: "label", classes: ["label-text", "font-bold", "text-xs", "text-slate-500", "dark:text-slate-400"], content: "Label Text" },
        { id: `block-inp-${Math.random().toString(36).substring(2, 9)}`, type: "input", tagName: "input", classes: ["input", "input-bordered", "rounded-xl", "w-full", "text-xs", "p-3", "dark:bg-slate-800"], attributes: { type: "text", placeholder: "Enter input..." } },
        { id: `block-hlp-${Math.random().toString(36).substring(2, 9)}`, type: "text", tagName: "span", classes: ["text-[10px]", "opacity-50"], content: "Helper text or hints go here." }
      ] } },
      { id: "input-field", label: "Input Field", icon: ["fas", "keyboard"], template: { type: "input", tagName: "input", classes: ["input", "input-bordered", "rounded-xl", "w-full", "text-xs", "p-3", "dark:bg-slate-800"], attributes: { type: "text", placeholder: "e.g. your name" } } },
      { id: "textarea-field", label: "Textarea", icon: ["fas", "align-justify"], template: { type: "textarea", tagName: "textarea", classes: ["textarea", "textarea-bordered", "rounded-xl", "w-full", "text-xs", "p-3", "h-24", "dark:bg-slate-800"], attributes: { placeholder: "e.g. comments detail..." } } },
      { id: "select-field", label: "Select List", icon: ["fas", "list"], template: { type: "select", tagName: "select", classes: ["select", "select-bordered", "rounded-xl", "w-full", "text-xs", "p-2.5", "dark:bg-slate-800"], children: [
        { id: `block-opt-1-${Math.random().toString(36).substring(2, 9)}`, type: "option", tagName: "option", classes: [], content: "Option 1" },
        { id: `block-opt-2-${Math.random().toString(36).substring(2, 9)}`, type: "option", tagName: "option", classes: [], content: "Option 2" }
      ] } },
      { id: "checkbox-field", label: "Checkbox", icon: ["fas", "square-check"], template: { type: "checkbox", tagName: "div", classes: ["flex", "items-center", "gap-2"], children: [
        { id: `block-chk-${Math.random().toString(36).substring(2, 9)}`, type: "input", tagName: "input", classes: ["checkbox", "checkbox-primary", "rounded-md"], attributes: { type: "checkbox" } },
        { id: `block-lbl-${Math.random().toString(36).substring(2, 9)}`, type: "text", tagName: "label", classes: ["text-xs", "font-bold"], content: "Accept terms" }
      ] } },
      { id: "radio-field", label: "Radio Button", icon: ["fas", "circle-dot"], template: { type: "radio", tagName: "div", classes: ["flex", "items-center", "gap-2"], children: [
        { id: `block-rad-${Math.random().toString(36).substring(2, 9)}`, type: "input", tagName: "input", classes: ["radio", "radio-primary"], attributes: { type: "radio", name: "radio-group" } },
        { id: `block-lbl-${Math.random().toString(36).substring(2, 9)}`, type: "text", tagName: "label", classes: ["text-xs", "font-bold"], content: "Radio selection" }
      ] } },
      { id: "toggle-field", label: "Toggle Switch", icon: ["fas", "toggle-on"], template: { type: "toggle", tagName: "div", classes: ["flex", "items-center", "gap-2"], children: [
        { id: `block-tgl-${Math.random().toString(36).substring(2, 9)}`, type: "input", tagName: "input", classes: ["toggle", "toggle-primary"], attributes: { type: "checkbox" } },
        { id: `block-lbl-${Math.random().toString(36).substring(2, 9)}`, type: "text", tagName: "label", classes: ["text-xs", "font-bold"], content: "Enable switch" }
      ] } },
      { id: "range-field", label: "Range Slider", icon: ["fas", "sliders"], template: { type: "range", tagName: "input", classes: ["range", "range-xs", "range-primary", "w-full"], attributes: { type: "range", min: "0", max: "100" } } },
      { id: "rating-field", label: "Rating Stars", icon: ["fas", "star"], template: { type: "rating", tagName: "div", classes: ["flex", "items-center", "gap-1", "text-amber-400"], attributes: { icon: "star" }, children: [
        { id: `block-str-1-${Math.random().toString(36).substring(2, 9)}`, type: "icon", tagName: "font-awesome-icon", classes: ["cursor-pointer"], attributes: { icon: "star" } },
        { id: `block-str-2-${Math.random().toString(36).substring(2, 9)}`, type: "icon", tagName: "font-awesome-icon", classes: ["cursor-pointer"], attributes: { icon: "star" } },
        { id: `block-str-3-${Math.random().toString(36).substring(2, 9)}`, type: "icon", tagName: "font-awesome-icon", classes: ["cursor-pointer"], attributes: { icon: "star" } },
        { id: `block-str-4-${Math.random().toString(36).substring(2, 9)}`, type: "icon", tagName: "font-awesome-icon", classes: ["cursor-pointer"], attributes: { icon: "star" } },
      ] } }
    ]
  },
  {
    name: "Dynamic Blocks",
    items: [
      {
        id: "recent-posts",
        label: "Recent Blog Entries",
        icon: ["fas", "newspaper"],
        template: {
          type: "recent-posts",
          tagName: "div",
          classes: ["recent-posts-block", "py-8", "space-y-4"],
          attributes: {
            limit: "5",
            tags: ""
          },
          children: []
        }
      },
      ...(settings.value?.isStoreEnabled ? [{
        id: "products-widget",
        label: "Store Products",
        icon: ["fas", "cart-shopping"],
        template: {
          type: "products-widget",
          tagName: "div",
          classes: ["cms-products-widget", "py-8", "space-y-6"],
          attributes: {
            limit: "6",
            defaultCategory: "",
            defaultInStockOnly: "false",
            showSearch: "true",
            showCategories: "true"
          },
          children: []
        }
      }] : []),
      {
        id: "ebook-preview-widget",
        label: "E-book Sample Preview",
        icon: ["fas", "book-open"],
        template: {
          type: "ebook-preview-widget",
          tagName: "div",
          classes: ["cms-ebook-preview-widget", "my-8"],
          attributes: {
            "data-book-title": "Sample Book Preview",
            "data-author": "Author Name",
            "data-cover-image": "",
            "data-sample-content": "Chapter 1: The Beginning\n\nThe morning mist hung low over the quiet valley as the ancient library doors slowly creaked open. Inside, rows upon rows of forgotten tales waited in silence...",
            "data-product-id": ""
          },
          children: []
        }
      }
    ]
  }
]);


// Fetch parameters
const fetchSettings = async () => {
  try {
    const res = await fetch("/api/settings");
    if (res.ok) {
      settings.value = await res.json();
    }
  } catch (err) {
    console.error("Failed to load settings:", err);
  }
};

const fetchPage = async () => {
  if (props.id === "navbar") {
    page.value = {
      id: "navbar",
      projectId: "swiftbase",
      slug: "global-navbar",
      title: "Global Navbar Designer",
      layoutHtml: settings.value?.navbarHtml || "",
      layoutCss: settings.value?.navbarCss || "",
      layoutComponents: settings.value?.navbarComponents || [],
      layoutStyles: settings.value?.navbarStyles || [],
      seoMetadata: { title: "", description: "" },
      isPublished: true,
    };
  } else if (props.id === "footer") {
    page.value = {
      id: "footer",
      projectId: "swiftbase",
      slug: "global-footer",
      title: "Global Footer Designer",
      layoutHtml: settings.value?.footerHtml || "",
      layoutCss: settings.value?.footerCss || "",
      layoutComponents: settings.value?.footerComponents || [],
      layoutStyles: settings.value?.footerStyles || [],
      seoMetadata: { title: "", description: "" },
      isPublished: true,
    };
  } else {
    try {
      const res = await fetch(`/api/pages/${props.id}`);
      if (res.ok) {
        page.value = await res.json();
        if (page.value) {
          seoTitle.value = page.value.seoMetadata?.title || "";
          seoDescription.value = page.value.seoMetadata?.description || "";
        }
      }
    } catch (err) {
      console.error("Failed to load page data:", err);
    }
  }

  // Load components into canvas
  if (page.value) {
    const raw = page.value.layoutComponents;
    const comps = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(comps) && comps.length > 0) {
      blocks.value = comps;
    } else if (page.value.layoutHtml) {
      blocks.value = parseHtmlToBlocks(page.value.layoutHtml);
    } else {
      blocks.value = [
        {
          id: `block-${Math.random().toString(36).substring(2, 9)}`,
          type: "section",
          tagName: "section",
          classes: ["py-20", "px-6", "bg-slate-50", "dark:bg-slate-950", "text-center"],
          children: [
            { id: `block-${Math.random().toString(36).substring(2, 9)}`, type: "heading", tagName: "h1", classes: ["text-5xl", "font-black", "tracking-tight", "mb-4"], content: "Welcome to Page Designer" },
            { id: `block-${Math.random().toString(36).substring(2, 9)}`, type: "text", tagName: "p", classes: ["text-sm", "opacity-60", "max-w-md", "mx-auto", "leading-relaxed"], content: "Start dragging widgets from the sidebar to assemble gorgeous pages." }
          ]
        }
      ];
    }
  }
  lastSavedState.value = JSON.stringify(blocks.value) + "||" + seoTitle.value + "||" + seoDescription.value;
};

// HTML Parser & Generators
function parseHtmlToBlocks(htmlString: string): any[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");
  const result: any[] = [];

  function mapNode(node: Element): any {
    const tagName = node.tagName.toLowerCase();
    const id = `block-${Math.random().toString(36).substring(2, 9)}`;
    const classes = Array.from(node.classList);
    
    const attributes: Record<string, string> = {};
    for (const attr of Array.from(node.attributes)) {
      if (attr.name !== "class") {
        attributes[attr.name] = attr.value;
      }
    }

    let type = "div";
    if (tagName === "header" || classes.includes("navbar")) type = "navbar";
    else if (tagName === "footer") type = "footer";
    else if (tagName === "section") type = "section";
    else if (tagName === "form") type = "form";
    else if (tagName === "button") type = "button";
    else if (tagName === "img") type = "image";
    else if (tagName === "input") type = "input-field";
    else if (tagName === "textarea") type = "textarea-field";
    else if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tagName)) type = "heading";
    else if (["p", "span", "a", "label"].includes(tagName)) type = "text";
    else if (classes.includes("card")) type = "card";
    else if (classes.includes("grid") || classes.includes("flex")) type = "row";
    else if (classes.includes("flex-1") || classes.includes("col-span")) type = "column";
    else if (classes.includes("recent-posts-block")) type = "recent-posts";
    else if (classes.includes("cms-products-widget")) {
      type = "products-widget";
      if (attributes["data-limit"]) attributes.limit = attributes["data-limit"];
      if (attributes["data-default-category"]) attributes.defaultCategory = attributes["data-default-category"];
      if (attributes["data-exclude-category"]) attributes.excludeCategory = attributes["data-exclude-category"];
      if (attributes["data-default-instock"]) attributes.defaultInStockOnly = attributes["data-default-instock"];
      if (attributes["data-show-search"]) attributes.showSearch = attributes["data-show-search"];
      if (attributes["data-show-categories"]) attributes.showCategories = attributes["data-show-categories"];
    }
    else if (classes.includes("cms-ebook-preview-widget")) {
      type = "ebook-preview-widget";
      if (attributes["data-sample-content"]) {
        try {
          attributes["data-sample-content"] = decodeURIComponent(attributes["data-sample-content"]);
        } catch {}
      }
    }


    const children: any[] = [];
    let content = "";
    
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        children.push(mapNode(child as Element));
      } else if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
        content = child.textContent.trim();
      }
    }

    const block: any = {
      id,
      type,
      tagName,
      classes,
      attributes
    };

    if (children.length > 0) {
      block.children = children;
    } else {
      block.content = content;
    }

    return block;
  }

  for (const child of Array.from(doc.body.children)) {
    result.push(mapNode(child));
  }

  return result;
}

function generateCleanHtml(blockList: any[]): string {
  function renderBlock(block: any, depth = 0): string {
    const indent = "  ".repeat(depth);
    const classes = Array.isArray(block.classes) ? block.classes.join(" ") : block.classes || "";
    const classAttr = classes ? ` class="${classes}"` : "";
    
    let attrs = "";
    if (block.attributes) {
      attrs = Object.entries(block.attributes)
        .map(([key, val]) => ` ${key}="${val}"`)
        .join("");
    }
    if (block.styles && Object.keys(block.styles).length > 0) {
      const stylesStr = Object.entries(block.styles)
        .map(([key, val]) => `${key}: ${val};`)
        .join(" ");
      attrs += ` style="${stylesStr}"`;
    }

    if (block.type === 'html') {
      return `${indent}<!-- Custom HTML Block -->\n${indent}${block.content}\n`;
    }

    if (block.type === 'recent-posts') {
      const limit = block.attributes?.limit || "5";
      const tags = block.attributes?.tags || "";
      let styleAttr = "";
      if (block.styles && Object.keys(block.styles).length > 0) {
        const stylesStr = Object.entries(block.styles)
          .map(([key, val]) => `${key}: ${val};`)
          .join(" ");
        styleAttr = ` style="${stylesStr}"`;
      }
      return `${indent}<div class="${classes} recent-posts-block"${styleAttr} data-limit="${limit}" data-tags="${tags}"></div>\n`;
    }

    if (block.type === 'products-widget') {
      const limit = block.attributes?.limit || "6";
      const defaultCategory = block.attributes?.defaultCategory || "";
      const excludeCategory = block.attributes?.excludeCategory || "";
      const defaultInStockOnly = block.attributes?.defaultInStockOnly === "true" ? "true" : "false";
      const showSearch = block.attributes?.showSearch !== "false" ? "true" : "false";
      const showCategories = block.attributes?.showCategories !== "false" ? "true" : "false";
      let widgetClasses = classes;
      if (!widgetClasses.includes("cms-products-widget")) {
        widgetClasses = (widgetClasses + " cms-products-widget").trim();
      }
      let styleAttr = "";
      if (block.styles && Object.keys(block.styles).length > 0) {
        const stylesStr = Object.entries(block.styles)
          .map(([key, val]) => `${key}: ${val};`)
          .join(" ");
        styleAttr = ` style="${stylesStr}"`;
      }
      const excludeAttr = excludeCategory ? ` data-exclude-category="${excludeCategory}"` : "";
      return `${indent}<div class="${widgetClasses}"${styleAttr} data-limit="${limit}" data-default-category="${defaultCategory}"${excludeAttr} data-default-instock="${defaultInStockOnly}" data-show-search="${showSearch}" data-show-categories="${showCategories}"></div>\n`;
    }

    if (block.type === 'ebook-preview-widget') {
      const bookTitle = block.attributes?.['data-book-title'] || "Sample Book Title";
      const author = block.attributes?.['data-author'] || "Author Name";
      const coverImage = block.attributes?.['data-cover-image'] || "";
      const productId = block.attributes?.['data-product-id'] || "";
      const sample = block.attributes?.['data-sample-content'] || "Chapter 1: The Beginning\n\nSample preview text...";
      const encodedSample = encodeURIComponent(sample);
      let widgetClasses = classes;
      if (!widgetClasses.includes("cms-ebook-preview-widget")) {
        widgetClasses = (widgetClasses + " cms-ebook-preview-widget").trim();
      }
      return `${indent}<div class="${widgetClasses}" data-book-title="${bookTitle}" data-author="${author}" data-cover-image="${coverImage}" data-product-id="${productId}" data-sample-content="${encodedSample}"></div>\n`;
    }


    if (block.tagName === 'img') {
      return `${indent}<img${classAttr}${attrs} />\n`;
    }

    if (block.tagName === 'input') {
      return `${indent}<input${classAttr}${attrs} />\n`;
    }

    if (block.tagName === 'textarea') {
      return `${indent}<textarea${classAttr}${attrs}></textarea>\n`;
    }

    const openTag = `<${block.tagName}${classAttr}${attrs}>`;
    const closeTag = `</${block.tagName}>`;

    if (block.children && block.children.length > 0) {
      const childrenHtml = block.children.map((c: any) => renderBlock(c, depth + 1)).join("");
      return `${indent}${openTag}\n${childrenHtml}${indent}${closeTag}\n`;
    }

    return `${indent}${openTag}${block.content || ""}${closeTag}\n`;
  }

  return blockList.map(b => renderBlock(b, 0)).join("");
}

// Sidebar Drag handlers
const activeDraggingSidebarItem = ref<any | null>(null);

const onDragStartSidebar = (e: DragEvent, item: any) => {
  activeDraggingSidebarItem.value = item;
  if (e.dataTransfer) {
    e.dataTransfer.setData("sidebarId", item.id);
  }
};

const onDropCanvasRoot = (e: DragEvent) => {
  const sidebarId = e.dataTransfer?.getData("sidebarId");
  if (sidebarId && activeDraggingSidebarItem.value) {
    const blockCopy = JSON.parse(JSON.stringify(activeDraggingSidebarItem.value.template));
    blockCopy.id = `block-${Math.random().toString(36).substring(2, 9)}`;
    if (blockCopy.children) {
      const tagIds = (nodes: any[]) => {
        nodes.forEach(n => {
          n.id = `block-${Math.random().toString(36).substring(2, 9)}`;
          if (n.children) tagIds(n.children);
        });
      };
      tagIds(blockCopy.children);
    }
    blocks.value.push(blockCopy);
    onSelectBlock(blockCopy);
  }
  activeDraggingSidebarItem.value = null;
};

// Canvas selections and manipulations
const onSelectBlock = (block: any) => {
  selectedBlock.value = block;
};

const onUpdateBlockContent = (data: { id: string; content: string }) => {
  const updateNode = (nodes: any[]) => {
    for (const n of nodes) {
      if (n.id === data.id) {
        n.content = data.content;
        return true;
      }
      if (n.children && updateNode(n.children)) return true;
    }
    return false;
  };
  updateNode(blocks.value);
};

const onRemoveBlock = (blockId: string) => {
  if (selectedBlock.value?.id === blockId) {
    selectedBlock.value = null;
  }
  const removeNode = (nodes: any[]): boolean => {
    const idx = nodes.findIndex(n => n.id === blockId);
    if (idx !== -1) {
      nodes.splice(idx, 1);
      return true;
    }
    for (const n of nodes) {
      if (n.children && removeNode(n.children)) return true;
    }
    return false;
  };
  removeNode(blocks.value);
};

const onDuplicateBlock = (blockId: string) => {
  const duplicateNode = (nodes: any[]): boolean => {
    const idx = nodes.findIndex(n => n.id === blockId);
    if (idx !== -1) {
      const copy = JSON.parse(JSON.stringify(nodes[idx]));
      copy.id = `block-${Math.random().toString(36).substring(2, 9)}`;
      const tagIds = (inner: any[]) => {
        inner.forEach(n => {
          n.id = `block-${Math.random().toString(36).substring(2, 9)}`;
          if (n.children) tagIds(n.children);
        });
      };
      if (copy.children) tagIds(copy.children);
      nodes.splice(idx + 1, 0, copy);
      return true;
    }
    for (const n of nodes) {
      if (n.children && duplicateNode(n.children)) return true;
    }
    return false;
  };
  duplicateNode(blocks.value);
};

const onDragBlockReorder = (data: { sourceId?: string; sidebarId?: string; targetId: string; position: 'before' | 'after' | 'inside'; isNew?: boolean }) => {
  let draggedNode: any = null;

  if (data.isNew && data.sidebarId) {
    let templateItem = null;
    for (const cat of categories.value) {
      const match = cat.items.find(i => i.id === data.sidebarId);
      if (match) {
        templateItem = match;
        break;
      }
    }
    if (!templateItem) return;

    draggedNode = JSON.parse(JSON.stringify(templateItem.template));
    draggedNode.id = `block-${Math.random().toString(36).substring(2, 9)}`;
    if (draggedNode.children) {
      const tagIds = (nodes: any[]) => {
        nodes.forEach(n => {
          n.id = `block-${Math.random().toString(36).substring(2, 9)}`;
          if (n.children) tagIds(n.children);
        });
      };
      tagIds(draggedNode.children);
    }
  } else if (data.sourceId) {
    const removeNode = (nodes: any[]): boolean => {
      const idx = nodes.findIndex(n => n.id === data.sourceId);
      if (idx !== -1) {
        draggedNode = nodes.splice(idx, 1)[0];
        return true;
      }
      for (const n of nodes) {
        if (n.children && removeNode(n.children)) return true;
      }
      return false;
    };
    removeNode(blocks.value);
  }

  if (!draggedNode) return;

  const insertNode = (nodes: any[]): boolean => {
    const targetIdx = nodes.findIndex(n => n.id === data.targetId);
    if (targetIdx !== -1) {
      if (data.position === "before") {
        nodes.splice(targetIdx, 0, draggedNode);
      } else if (data.position === "after") {
        nodes.splice(targetIdx + 1, 0, draggedNode);
      } else if (data.position === "inside") {
        if (!nodes[targetIdx].children) {
          nodes[targetIdx].children = [];
        }
        nodes[targetIdx].children.push(draggedNode);
      }
      return true;
    }

    for (const n of nodes) {
      if (n.children && insertNode(n.children)) return true;
    }
    return false;
  };

  insertNode(blocks.value);
  onSelectBlock(draggedNode);
};

// Autocomplete actions
const addStyleClass = (className: string) => {
  if (selectedBlock.value && !selectedBlock.value.classes.includes(className)) {
    selectedBlock.value.classes.push(className);
  }
  classSearch.value = "";
  showAutocomplete.value = false;
};

const addCustomClassFromSearch = () => {
  const className = classSearch.value.trim();
  if (className && selectedBlock.value) {
    const classesToAdd = className.split(/\s+/);
    classesToAdd.forEach(cls => {
      if (cls && !selectedBlock.value.classes.includes(cls)) {
        selectedBlock.value.classes.push(cls);
      }
    });
  }
  classSearch.value = "";
  showAutocomplete.value = false;
};

const removeStyleClass = (className: string) => {
  if (selectedBlock.value) {
    selectedBlock.value.classes = selectedBlock.value.classes.filter((c: string) => c !== className);
  }
};

const hasClass = (className: string) => {
  return selectedBlock.value?.classes.includes(className) || false;
};

const toggleStyleClass = (className: string) => {
  if (hasClass(className)) {
    removeStyleClass(className);
  } else {
    addStyleClass(className);
  }
};

const setExclusiveClass = (exclusiveList: string[], className: string) => {
  if (selectedBlock.value) {
    selectedBlock.value.classes = selectedBlock.value.classes.filter((c: string) => !exclusiveList.includes(c));
    addStyleClass(className);
  }
};

// AI design layout generation handler
const generateLayout = async () => {
  if (!aiPrompt.value.trim()) return;
  generating.value = true;
  
  const currentHtml = generateCleanHtml(blocks.value);

  try {
    const res = await fetch("/api/ai/design", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        prompt: aiPrompt.value,
        currentHtml
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.html) {
        blocks.value = parseHtmlToBlocks(data.html);
        aiPrompt.value = "";
        activeTab.value = "blocks";
      }
    }
  } catch (err) {
    console.error("Failed to generate layout via AI:", err);
  } finally {
    generating.value = false;
  }
};

// Save logic
const savePage = async (silent = false) => {
  if (!page.value) return;
  saving.value = true;
  try {
    const html = generateCleanHtml(blocks.value);
    const css = "";

    if (props.id === "navbar" || props.id === "footer") {
      const latestRes = await fetch("/api/settings");
      let currentSettings = latestRes.ok ? await latestRes.json() : (settings.value || {});
      
      if (props.id === "navbar") {
        currentSettings.navbarHtml = html;
        currentSettings.navbarCss = css;
        currentSettings.navbarComponents = blocks.value;
      } else {
        currentSettings.footerHtml = html;
        currentSettings.footerCss = css;
        currentSettings.footerComponents = blocks.value;
      }

      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentSettings),
      });
    } else {
      const updatedData: Partial<CMSPage> = {
        layoutHtml: html,
        layoutCss: css,
        layoutComponents: blocks.value,
        layoutStyles: [],
        seoMetadata: {
          title: seoTitle.value,
          description: seoDescription.value,
        },
      };

      await fetch(`/api/pages/${props.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });
    }
    
    lastSavedState.value = JSON.stringify(blocks.value) + "||" + seoTitle.value + "||" + seoDescription.value;
    if (!silent) {
      showAlert("Layout Saved", "Your layout changes have been saved successfully.");
    }
  } catch (err) {
    console.error("Failed to save layout:", err);
  } finally {
    saving.value = false;
  }
};

const publishing = ref(false);
const publishPage = async () => {
  if (!page.value) return;
  
  const proceedWithPublish = async (shouldSaveFirst: boolean) => {
    publishing.value = true;
    try {
      if (shouldSaveFirst) {
        await savePage(true);
      }
      const res = await fetch(`/api/pages/${props.id}/publish`, { method: "POST" });
      if (res.ok) {
        showAlert("Published", "Your page layout has been successfully compiled and published live.");
        await fetchPage();
      } else {
        const data = await res.json();
        showAlert("Publish Failed", data.message || 'Unknown error occurred while compiling page.');
      }
    } catch (err: any) {
      showAlert("Publish Error", err.message);
    } finally {
      publishing.value = false;
    }
  };

  if (hasUnsavedChanges.value) {
    showConfirm(
      "Unsaved Changes",
      "You have unsaved changes. Would you like to save and publish them?",
      () => proceedWithPublish(true)
    );
  } else {
    await proceedWithPublish(false);
  }
};

onMounted(async () => {
  await fetchSettings();
  await fetchPage();
  
  // Set initial state in history stack
  historyStack.value = [JSON.stringify(blocks.value)];
  
  document.addEventListener("selectionchange", handleSelectionChange);
  window.addEventListener("keydown", handleGlobalKeydown);
});

onUnmounted(() => {
  document.removeEventListener("selectionchange", handleSelectionChange);
  window.removeEventListener("keydown", handleGlobalKeydown);
});
</script>

<style scoped>
.canvas-container {
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}
</style>
