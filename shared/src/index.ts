export interface CMSSettings {
  id: string;
  projectId: string;
  siteTitle: string;
  siteDomain?: string;
  isBlogEnabled: boolean;
  isStoreEnabled: boolean;
  stripePublishableKey?: string;
  stripeWebhookSecret?: string;
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
  createdAt?: string;
  updatedAt?: string;
}

export interface CMSPurchase {
  id: string;
  projectId: string;
  productId: string;
  stripeSessionId: string;
  customerEmail: string;
  amountTotalCents: number;
  status: 'pending' | 'completed' | 'refunded';
  createdAt?: string;
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
