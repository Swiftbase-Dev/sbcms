export interface CMSSettings {
  id: string;
  projectId: string;
  siteTitle: string;
  siteDomain?: string;
  isBlogEnabled: boolean;
  isStoreEnabled: boolean;
  stripePublishableKey?: string;
  stripeWebhookSecret?: string;
  postmarkApiToken?: string;
  postmarkFromEmail?: string;
  postmarkNotifyOnOrder?: boolean;
  postmarkNotifyStaffOnOrder?: boolean;
  adminNotificationEmails?: string;
  navbarLogo?: string;
  navbarLinks?: Array<{ label: string; url: string }>;
  footerText?: string;
  footerLinks?: Array<{ label: string; url: string }>;
  faviconUrl?: string;
  globalStyles?: string;
  navbarHtml?: string;
  navbarCss?: string;
  navbarComponents?: any;
  navbarStyles?: any;
  footerHtml?: string;
  footerCss?: string;
  footerComponents?: any;
  footerStyles?: any;
  areCommentsEnabledGlobally?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CMSPage {
  id: string;
  projectId: string;
  slug: string;
  title: string;
  layoutHtml?: string;
  layoutCss?: string;
  layoutComponents?: any;
  layoutStyles?: any;
  grapesHtml?: string;
  grapesCss?: string;
  grapesComponents?: any;
  grapesStyles?: any;
  seoMetadata: {
    title?: string;
    description?: string;
    ogImage?: string;
  };
  isPublished: boolean;
  hasUnpublishedChanges?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CMSPost {
  id: string;
  projectId: string;
  slug: string;
  title: string;
  content: string; // QuillJS html
  excerpt?: string;
  tags?: string;
  featureImage?: string;
  status: 'draft' | 'published';
  areCommentsEnabled?: boolean;
  author?: string;
  publishedAuthor?: string;
  seoMetadata: {
    title?: string;
    description?: string;
    ogImage?: string;
  };
  publishedAt?: string;
  hasUnpublishedChanges?: boolean;
  publishedTitle?: string;
  publishedContent?: string;
  publishedExcerpt?: string;
  publishedTags?: string;
  publishedFeatureImage?: string;
  publishedSeoMetadata?: {
    title?: string;
    description?: string;
    ogImage?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface AffiliateLink {
  sellerName: string;
  url: string;
  priceCents: number;
}

export interface CustomOrderField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'checkbox' | 'select';
  required: boolean;
  options?: string[];
}

export interface ShippingDetails {
  weight?: string;
  dimensions?: string;
  notes?: string;
}

export interface CMSProduct {
  id: string;
  projectId: string;
  slug: string;
  name: string;
  description?: string;
  priceCents: number;
  stripePriceId?: string;
  stripeProductId?: string;
  images: string[];
  affiliateLinks: AffiliateLink[];
  category?: string;
  sku?: string;
  inStock?: boolean;
  stockQuantity?: number | null;
  limitPerOrder?: number | null;
  customOrderFields?: CustomOrderField[];
  isPhysical?: boolean;
  shippingDetails?: ShippingDetails;
  addOnProductIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ShippingAddress {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitAmountCents: number;
  images?: string[];
  customFields?: Record<string, any>;
}

export interface CMSPurchase {
  id: string;
  projectId: string;
  productId?: string;
  stripeSessionId: string;
  customerEmail: string;
  customerName?: string;
  amountTotalCents: number;
  status: 'pending' | 'completed' | 'refunded';
  fulfillmentStatus?: 'unfulfilled' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  trackingNumber?: string;
  carrier?: string;
  trackingUrl?: string;
  shippingAddress?: ShippingAddress;
  items?: OrderItem[];
  notes?: string;
  shippedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AnalyticsEventPayload {
  path: string;
  referrer: string;
  browser: string;
  operatingSystem: string;
  deviceType: 'mobile' | 'desktop' | 'tablet';
  countryCode?: string;
  conversionName?: string;
}

export type ExtensionPermission = 
  | 'storage:upload'
  | 'store:orders:read'
  | 'email:send'
  | 'ui:designer:block'
  | 'routes:public';

export interface ExtensionAdminPage {
  id: string;
  label: string;
  icon?: string;
  tag: string; // Custom Element Web Component tag name, e.g. "ext-ebook-distribution"
  script: string; // Relative path to script bundle, e.g. "dist/admin.js"
}

export interface ExtensionWidget {
  id: string;
  label: string;
  icon?: string | [string, string];
  description?: string;
  tag: string; // Custom Element Web Component tag name, e.g. "ext-ebook-preview"
  script: string; // Relative path to script bundle, e.g. "dist/widget.js"
  defaultAttributes?: Record<string, string>;
}

export interface ExtensionPublicRoute {
  path: string;
  title: string;
  tag: string; // Custom Element Web Component tag name
  script: string;
}

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  permissions: ExtensionPermission[];
  homepage?: string;
  repository?: string;
  main?: string;
  entry?: string;
  files?: string[];
  adminPages?: ExtensionAdminPage[];
  widgets?: ExtensionWidget[];
  publicRoutes?: ExtensionPublicRoute[];
  server?: string;
}

export interface CMSExtension {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  gitUrl: string;
  commitHash?: string;
  enabled: boolean;
  permissions: ExtensionPermission[];
  manifest: ExtensionManifest;
  settings?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}


