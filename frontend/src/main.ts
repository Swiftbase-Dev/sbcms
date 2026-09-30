import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { router } from "./router/index.js";
import { initializeSdk, isLoggedIn, handleRedirectCallback, loginWithRedirect, getAccessToken } from "swiftbase-sdk";
import "./style.css";

import { library } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { fas } from "@fortawesome/free-solid-svg-icons";
import { far } from "@fortawesome/free-regular-svg-icons";

// Configure fontawesome
library.add(fas, far);

const bootstrap = async () => {
  let authorityUrl = "https://api.swiftbase.io";
  let projectId = "";

  try {
    const res = await fetch("/api/auth-config");
    if (res.ok) {
      const data = await res.json();
      if (data.authorityUrl) authorityUrl = data.authorityUrl;
      if (data.projectId) projectId = data.projectId;
    }
  } catch (err) {
    console.warn("Could not retrieve dynamic auth configurations:", err);
  }

  if (!projectId) {
    console.error("Missing configuration: projectId is required to initialize Swiftbase SDK.");
    // We cannot proceed without a project ID.
    return;
  }

  // Initialize SDK
  initializeSdk(projectId, { baseUrl: authorityUrl });

  // Handle callback if query has OIDC redirect params
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("code") && urlParams.has("state")) {
    try {
      await handleRedirectCallback();
      // Strip code from browser URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      console.error("Callback authentication error:", err);
    }
  }

  // Setup route authentication guard
  router.beforeEach(async (to, from, next) => {
    const isPublicRoute =
      to.path.startsWith("/download") ||
      to.path.startsWith("/redeem") ||
      to.path.startsWith("/ext-public") ||
      window.location.pathname.startsWith("/download") ||
      window.location.pathname.startsWith("/redeem") ||
      window.location.pathname.startsWith("/ext-public");
    if (isPublicRoute) {
      return next();
    }

    const params = new URLSearchParams(window.location.search);
    const isOidcCallback = params.has("code") && params.has("state");

    if (!isLoggedIn() && !isOidcCallback) {
      try {
        await loginWithRedirect({
          redirectUri: window.location.origin + to.fullPath,
          prompt: "login",
        });
        return; // Pause navigation
      } catch (err) {
        console.error("Failed to trigger OIDC login redirect:", err);
      }
    }
    next();
  });

  // Force OIDC redirect check on initial boot if not authenticated, not callback, and not public route
  const isPublicPath =
    window.location.pathname.startsWith("/download") ||
    window.location.pathname.startsWith("/redeem") ||
    window.location.pathname.startsWith("/ext-public");
  const initialParams = new URLSearchParams(window.location.search);
  const isInitialCallback = initialParams.has("code") && initialParams.has("state");
  if (!isLoggedIn() && !isInitialCallback && !isPublicPath) {
    try {
      await loginWithRedirect({
        redirectUri: window.location.origin + window.location.pathname,
        prompt: "login",
      });
      return;
    } catch (err) {
      console.error("Initial OIDC redirect failed:", err);
    }
  }


  // Intercept fetch requests to automatically append access token headers
  const token = await getAccessToken();
  if (token) {
    const originalFetch = window.fetch;
    window.fetch = function (input, init) {
      init = init || {};
      init.headers = init.headers || {};
      if (init.headers instanceof Headers) {
        init.headers.set("Authorization", `Bearer ${token}`);
      } else if (Array.isArray(init.headers)) {
        init.headers.push(["Authorization", `Bearer ${token}`]);
      } else {
        (init.headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
      }
      return originalFetch(input, init);
    };
  }

  const app = createApp(App);
  app.component("font-awesome-icon", FontAwesomeIcon);
  app.use(createPinia());
  app.use(router);
  app.mount("#app");
};

bootstrap();
