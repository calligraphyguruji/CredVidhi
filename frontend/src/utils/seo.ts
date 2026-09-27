/**
 * CredVidhi Production SEO & Dynamic Metadata Manager
 * Domain: https://credvidhi.vercel.app
 */

export const BASE_PRODUCTION_URL = 'https://credvidhi.vercel.app';

export interface RouteSEOMetadata {
  title: string;
  description: string;
  canonicalPath: string;
  robots: string;
  isPublic: boolean;
  ogTitle?: string;
  ogDescription?: string;
}

export const ROUTE_SEO_MAP: Record<string, RouteSEOMetadata> = {
  landing: {
    title: 'CredVidhi — Enterprise Loan Processing & Approval Management System',
    description:
      'Institutional digital loan processing and deterministic underwriting platform featuring automated KYC verification, mathematical DTI calculations, and immutable audit compliance.',
    canonicalPath: '/',
    robots: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
    isPublic: true,
    ogTitle: 'CredVidhi — Enterprise Loan Processing & Approval Management System',
    ogDescription:
      'Deterministic credit underwriting sanctioned in minutes. Automated document verification, transparent risk rules, and audit-ready operations.',
  },
  login: {
    title: 'Sign In | CredVidhi Lending Staff & Borrower Portal',
    description:
      'Secure single sign-on access to CredVidhi Loan Processing Platform for loan officers, risk underwriters, compliance auditors, and applicants.',
    canonicalPath: '/login',
    robots: 'index, follow',
    isPublic: true,
    ogTitle: 'Sign In | CredVidhi Lending Staff & Borrower Portal',
    ogDescription:
      'Access the CredVidhi institutional lending console for officer queues, risk underwriting, and borrower applications.',
  },
  'officer-queue': {
    title: 'Loan Officer Application Queue | CredVidhi Workspace',
    description: 'Internal triage and queue management for active retail and commercial credit applications.',
    canonicalPath: '/officer-queue',
    robots: 'noindex, nofollow',
    isPublic: false,
  },
  'document-workbench': {
    title: 'KYC Document Verification Workbench | CredVidhi Workspace',
    description: 'Internal KYC and proof of income verification workbench with optical inspection.',
    canonicalPath: '/document-workbench',
    robots: 'noindex, nofollow',
    isPublic: false,
  },
  'underwriting-cockpit': {
    title: 'Deterministic Underwriting Cockpit | CredVidhi Workspace',
    description: 'Mathematical risk assessment and credit decisioning console with transparent DTI scoring.',
    canonicalPath: '/underwriting-cockpit',
    robots: 'noindex, nofollow',
    isPublic: false,
  },
  'borrower-portal': {
    title: 'Borrower Application Portal | CredVidhi Workspace',
    description: 'Self-service loan origination, document upload, and real-time lifecycle tracking.',
    canonicalPath: '/borrower-portal',
    robots: 'noindex, nofollow',
    isPublic: false,
  },
  'compliance-audit': {
    title: 'Compliance Audit Ledger | CredVidhi Admin',
    description: 'Immutable chronological audit log with cryptographic timestamps and actor attribution.',
    canonicalPath: '/compliance-audit',
    robots: 'noindex, nofollow',
    isPublic: false,
  },
  'loan-products': {
    title: 'Loan Product Configuration Matrix | CredVidhi Admin',
    description: 'Institutional lending parameter catalog, APR boundaries, and underwriting rule thresholds.',
    canonicalPath: '/loan-products',
    robots: 'noindex, nofollow',
    isPublic: false,
  },
};

/**
 * Dynamically updates DOM head elements based on current view.
 * Ensures search crawlers and client transitions reflect accurate metadata.
 */
export function applyRouteSEO(viewName: string, syncHistory = true): void {
  const meta = ROUTE_SEO_MAP[viewName] || ROUTE_SEO_MAP.landing;

  // 1. Update Title
  document.title = meta.title;

  // 2. Update Meta Description
  let descTag = document.querySelector('meta[name="description"]');
  if (!descTag) {
    descTag = document.createElement('meta');
    descTag.setAttribute('name', 'description');
    document.head.appendChild(descTag);
  }
  descTag.setAttribute('content', meta.description);

  // 3. Update Robots Directive (Guarantees private views are noindex, nofollow)
  let robotsTag = document.querySelector('meta[name="robots"]');
  if (!robotsTag) {
    robotsTag = document.createElement('meta');
    robotsTag.setAttribute('name', 'robots');
    document.head.appendChild(robotsTag);
  }
  robotsTag.setAttribute('content', meta.robots);

  // 4. Update Canonical URL (Trailing slash only on root domain per sitemap.xml)
  const canonicalUrl =
    meta.canonicalPath === '/' ? `${BASE_PRODUCTION_URL}/` : `${BASE_PRODUCTION_URL}${meta.canonicalPath}`;
  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute('href', canonicalUrl);

  // 5. Update Open Graph & Twitter dynamic tags
  const ogTitleTag = document.querySelector('meta[property="og:title"]');
  if (ogTitleTag) {
    ogTitleTag.setAttribute('content', meta.ogTitle || meta.title);
  }
  const ogDescTag = document.querySelector('meta[property="og:description"]');
  if (ogDescTag) {
    ogDescTag.setAttribute('content', meta.ogDescription || meta.description);
  }
  const ogUrlTag = document.querySelector('meta[property="og:url"]');
  if (ogUrlTag) {
    ogUrlTag.setAttribute('content', canonicalUrl);
  }

  const twitterTitleTag = document.querySelector('meta[name="twitter:title"]');
  if (twitterTitleTag) {
    twitterTitleTag.setAttribute('content', meta.ogTitle || meta.title);
  }
  const twitterDescTag = document.querySelector('meta[name="twitter:description"]');
  if (twitterDescTag) {
    twitterDescTag.setAttribute('content', meta.ogDescription || meta.description);
  }

  // 6. Synchronize URL bar for SPA deep-linking without page reload
  if (syncHistory && typeof window !== 'undefined' && window.history) {
    const currentPath = window.location.pathname;
    const targetPath = meta.canonicalPath;
    if (currentPath !== targetPath && currentPath !== `${targetPath}/`) {
      window.history.pushState({ view: viewName }, meta.title, targetPath);
    }
  }
}

/**
 * Resolves initial activeView from window.location.pathname on load or popstate
 */
export function resolveViewFromUrl(): string {
  if (typeof window === 'undefined') return 'landing';

  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  for (const [view, meta] of Object.entries(ROUTE_SEO_MAP)) {
    if (meta.canonicalPath === path) {
      return view;
    }
  }
  return 'landing';
}
