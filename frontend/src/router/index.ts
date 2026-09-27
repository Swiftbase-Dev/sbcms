import { createRouter, createWebHistory } from "vue-router";
import Dashboard from "../views/Dashboard.vue";
import Pages from "../views/Pages.vue";
import PageDesigner from "../views/PageDesigner.vue";
import Blog from "../views/Blog.vue";
import BlogEditor from "../views/BlogEditor.vue";
import Store from "../views/Store.vue";
import Settings from "../views/Settings.vue";
import Profile from "../views/Profile.vue";
import Gallery from "../views/Gallery.vue";
import Extensions from "../views/Extensions.vue";
import EbookDownload from "../views/EbookDownload.vue";

const routes = [
  { path: "/", redirect: "/dashboard" },
  { path: "/dashboard", component: Dashboard },
  { path: "/pages", component: Pages },
  { path: "/pages/edit/:id", component: PageDesigner, props: true },
  { path: "/blog", component: Blog },
  { path: "/blog/edit/:id", component: BlogEditor, props: true },
  { path: "/store", component: Store },
  { path: "/extensions", component: Extensions },
  { path: "/download/:token", component: EbookDownload },
  { path: "/redeem", component: EbookDownload },
  { path: "/settings/edit-navbar", component: PageDesigner, props: { id: "navbar" } },
  { path: "/settings/edit-footer", component: PageDesigner, props: { id: "footer" } },
  { path: "/settings", component: Settings },
  { path: "/profile", component: Profile },
  { path: "/gallery", component: Gallery },
];


export const router = createRouter({
  history: createWebHistory("/admin"),
  routes,
});
