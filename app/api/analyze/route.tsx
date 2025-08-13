// app/api/analyze/route.tsx
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import cheerio from 'cheerio';
import pLimit from 'p-limit';

export const runtime = 'nodejs';

interface TechStack {
  cms?: string;
  javascriptFrameworks?: string[];
  cssFrameworks?: string[];
  server?: string;
  webServer?: string;
  analytics?: string[];
  buildTools?: string[];
  compression?: string[];
  isWordPress?: boolean;
  cdn?: string[];
  hosting?: string;
  payments?: string[];
  marketing?: string[];
  monitoring?: string[];
}

const AXIOS_TIMEOUT_MS = 6000;
const MAX_SCRIPT_REQUESTS = 12;
const limit = pLimit(6);

const http = axios.create({
  timeout: AXIOS_TIMEOUT_MS,
  maxContentLength: 500_000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
});

const serverHeaderAliases: Array<[needle: RegExp, label: string]> = [
  [/gws|ESF|google frontend|google front end|server:\s*ESF/i, 'Google Frontend'],
  [/apache/i, 'Apache HTTP Server'],
  [/nginx/i, 'NGINX'],
  [/cloudflare/i, 'Cloudflare'],
  [/cloudfront/i, 'Amazon CloudFront'],
  [/iis|microsoft-iis/i, 'Microsoft IIS'],
  [/vercel/i, 'Vercel'],
  [/awselb|elastic load balancer/i, 'AWS Elastic Load Balancer'],
  [/gunicorn/i, 'Gunicorn'],
  [/caddy/i, 'Caddy'],
  [/lighttpd/i, 'lighttpd'],
  [/fastly/i, 'Fastly (edge)'],
  [/akamai/i, 'Akamai (edge)'],
];

const mapServerHeader = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  for (const [rx, label] of serverHeaderAliases) {
    if (rx.test(raw)) return label;
  }
  return raw;
};

// Prefer module scripts and same-origin scripts; cap total
const pickTopScripts = ($: cheerio.Root, baseUrl: string): string[] => {
  const baseHost = new URL(baseUrl).host;
  const nodes = $('script[src],link[rel="preload"][as="script"][href]').toArray();
  const candidates = nodes
    .map((el) => {
      const isLink = $(el).is('link');
      const srcAttr = isLink ? 'href' : 'src';
      const raw = ($(el).attr(srcAttr) || '').trim();
      if (!raw) return null;
      try {
        const url = new URL(raw, baseUrl).href;
        const u = new URL(url);
        const sameOrigin = u.host === baseHost;
        const isModule = (($(el).attr('type') || '').toLowerCase() === 'module');
        const priority = (isModule ? 0 : 1) + (sameOrigin ? 0 : 1);
        return { url, priority, sameOrigin, isModule };
      } catch {
        return null;
      }
    })
    .filter(
      (x): x is { url: string; priority: number; sameOrigin: boolean; isModule: boolean } => !!x
    );

  candidates.sort((a, b) => a.priority - b.priority);
  return candidates.slice(0, MAX_SCRIPT_REQUESTS).map((c) => c.url);
};

const fetchText = async (url: string): Promise<string | null> => {
  try {
    const { data } = await http.get(url);
    return typeof data === 'string' ? data : JSON.stringify(data);
  } catch {
    return null;
  }
};

const containsInScripts = async (
  $: cheerio.Root,
  baseUrl: string,
  matcher: (text: string) => boolean
): Promise<boolean> => {
  const scriptUrls = pickTopScripts($, baseUrl);
  const results = await Promise.all(
    scriptUrls.map((u) =>
      limit(async () => {
        const text = await fetchText(u);
        return text ? matcher(text) : false;
      })
    )
  );
  return results.some(Boolean);
};

const dedupeEdgeVsOrigin = (tech: TechStack) => {
  if (!tech.server) return;

  const ensureCdn = (name: string) => {
    const list = tech.cdn ?? [];
    if (!list.some((c) => c.toLowerCase() === name.toLowerCase())) list.push(name);
    tech.cdn = list;
  };

  const s = tech.server.toLowerCase();

  // Cloudflare
  if (s.includes('cloudflare')) {
    ensureCdn('Cloudflare');
    tech.server = undefined;
    return;
  }
  // Fastly
  if (s.includes('fastly')) {
    ensureCdn('Fastly');
    tech.server = undefined;
    return;
  }
  // Akamai
  if (s.includes('akamai')) {
    ensureCdn('Akamai');
    tech.server = undefined;
    return;
  }
  // CloudFront
  if (s.includes('cloudfront')) {
    ensureCdn('Amazon CloudFront');
    tech.server = undefined;
    return;
  }
  // Google edge (gws/ESF)
  if (s.includes('google frontend') || s.includes('gws') || s.includes('esf')) {
    ensureCdn('Google Frontend');
    tech.server = undefined;
    return;
  }
  // Vercel: if we already infer Vercel Edge or hosting Vercel, hide "Server: Vercel"
  if (s.includes('vercel')) {
    // prefer to show in CDN/hosting buckets
    if (!(tech.cdn ?? []).some((c) => /vercel/i.test(c))) ensureCdn('Vercel Edge');
    tech.server = undefined;
  }
};

// === Primary analyzer ===
const detectTechStack = async (
  html: string,
  headers: Record<string, string>,
  baseUrl: string
): Promise<TechStack> => {
  const $ = cheerio.load(html);
  const tech: TechStack = {};

  // --- CMS ---
if (isShopify($)) {
  tech.cms = 'Shopify';
} else if (isSquarespace($)) {
  tech.cms = 'Squarespace';
} else if (isWix($)) {
  tech.cms = 'Wix';
} else if (isWordPress($) || (await isWordPressViaAPI(baseUrl))) {
  tech.cms = 'WordPress';
  tech.isWordPress = true;
} else if (isDrupal($)) {
  tech.cms = 'Drupal';
} else if (isJoomla($)) {
  tech.cms = 'Joomla';
} else {
  const generatorContent = $('meta[name="generator"]').attr('content');
  if (generatorContent) tech.cms = generatorContent;
}


  // --- JS frameworks ---
  const jsSet = new Set<string>();
  const jsDetections: Array<[string, Promise<boolean>]> = [
    ['React', containsReact($, baseUrl)],
    ['Vue.js', containsVue($, baseUrl)],
    ['Angular', containsAngular($, baseUrl)],
    ['Next.js', containsNextJs($, baseUrl)],
    ['Gatsby', containsGatsby($, baseUrl)],
    ['Svelte', containsSvelte($, baseUrl)],
    ['Ember.js', containsEmber($, baseUrl)],
    ['Nuxt.js', containsNuxtJs($, baseUrl)],
    ['Polymer', containsPolymer($, baseUrl)],
    ['jQuery', containsjQuery($, baseUrl)],
    ['Backbone.js', containsBackbone($, baseUrl)],
    ['Dojo', containsDojo($, baseUrl)],
    ['Meteor', containsMeteor($, baseUrl)],
    ['Astro', containsAstro($, baseUrl)],
    ['Remix', containsRemix($, baseUrl)],
    ['Alpine.js', Promise.resolve(containsAlpine($))],
    ['HTMX', Promise.resolve(containsHTMX($))],
  ];

  const jsResults = await Promise.all(jsDetections.map(([, p]) => p));
  jsResults.forEach((hit, i) => hit && jsSet.add(jsDetections[i][0]));
  if (jsSet.size) tech.javascriptFrameworks = Array.from(jsSet);

  // --- CSS frameworks (tightened; no more class-only matches) ---
  if (!tech.isWordPress) {
    const css: string[] = [];
    if (containsBootstrap($)) css.push('Bootstrap');
    if (containsTailwindClasses($)) css.push('Tailwind CSS');
    if (containsBulma($)) css.push('Bulma');
    if (containsFoundation($)) css.push('Foundation');
    if (await containsMaterialUI($, baseUrl)) css.push('Material UI');
    if (await containsSemanticUI($, baseUrl)) css.push('Semantic UI');
    if (await containsMaterializeCSS($, baseUrl)) css.push('Materialize CSS');
    if (css.length) tech.cssFrameworks = css;
  }

  // --- Analytics / marketing / monitoring / payments ---
  const analytics: string[] = [];
  if (await containsGoogleAnalytics($, baseUrl)) analytics.push('Google Analytics / gtag.js');
  if (await containsGoogleTagManager($, baseUrl)) analytics.push('Google Tag Manager');
  if (await containsMatomo($, baseUrl)) analytics.push('Matomo');
  if (await containsPlausible($, baseUrl)) analytics.push('Plausible');
  if (await containsMixpanel($, baseUrl)) analytics.push('Mixpanel');
  if (await containsAmplitude($, baseUrl)) analytics.push('Amplitude');
  if (await containsSegment($, baseUrl)) analytics.push('Segment');
  if (analytics.length) tech.analytics = analytics;

  const marketing: string[] = [];
  if (containsHubspot($)) marketing.push('HubSpot');
  if (containsMailchimp($)) marketing.push('Mailchimp');
  if (containsIntercom($)) marketing.push('Intercom');
  if (containsDrift($)) marketing.push('Drift');
  if (containsHotjar($)) marketing.push('Hotjar');
  if (marketing.length) tech.marketing = marketing;

  const monitoring: string[] = [];
  if (containsSentry($)) monitoring.push('Sentry');
  if (containsDatadog($)) monitoring.push('Datadog RUM');
  if (containsNewRelic($)) monitoring.push('New Relic');
  if (monitoring.length) tech.monitoring = monitoring;

  const payments: string[] = [];
  if (containsStripe($)) payments.push('Stripe');
  if (containsBraintree($)) payments.push('Braintree');
  if (containsPaypal($)) payments.push('PayPal');
  if (payments.length) tech.payments = payments;

  // --- Build tools ---
  const build = new Set<string>();
  const lowerHtml = html.toLowerCase();
  const addIf = (cond: boolean, label: string) => cond && build.add(label);

  addIf(lowerHtml.includes('webpack'), 'Webpack');
  addIf(lowerHtml.includes('gulp'), 'Gulp');
  addIf(lowerHtml.includes('grunt'), 'Grunt');

  if (await containsInScripts($, baseUrl, (t) => /vite|import\.meta/.test(t))) build.add('Vite');
  if (await containsInScripts($, baseUrl, (t) => /parcelRequire/.test(t))) build.add('Parcel');
  if (await containsInScripts($, baseUrl, (t) => /__ROLLUP__|rollup/i.test(t))) build.add('Rollup');

  if (build.size) tech.buildTools = Array.from(build);

  // --- Compression ---
  const enc = (headers['content-encoding'] || '').toLowerCase();
  const compression: string[] = [];
  if (enc.includes('br')) compression.push('Brotli');
  if (enc.includes('gzip')) compression.push('Gzip');
  if (enc.includes('deflate')) compression.push('Deflate');
  if (compression.length) tech.compression = compression;

  // --- Server / web platform ---
  if (headers['server']) tech.server = mapServerHeader(headers['server']) || headers['server'];
  if (headers['x-powered-by']) {
    const xp = headers['x-powered-by'].toLowerCase();
    if (xp.includes('next.js')) jsSet.add('Next.js');
    if (xp.includes('nuxt.js')) jsSet.add('Nuxt.js');
    if (!/next\.js|nuxt\.js/.test(xp)) tech.webServer = headers['x-powered-by'];
  }
  if (jsSet.size) tech.javascriptFrameworks = Array.from(jsSet);

  // --- CDN / Hosting inference from headers ---
  const cdn = inferCDN(headers);
  if (cdn.length) tech.cdn = cdn;
  const hosting = inferHosting(headers);
  if (hosting) tech.hosting = hosting;

  dedupeEdgeVsOrigin(tech);

  return tech;
};


// ======= CMS detection =======
const isWordPress = ($: cheerio.Root): boolean => {
  const html = $.html();

  const signals: RegExp[] = [
    /\/wp-content\//i,
    /\/wp-includes\//i,
    /\/wp-admin\//i,
    /wp-embed(?:\.min)?\.js/i,
    /wp-emoji-release(?:\.min)?\.js/i,
    /wp-blog-header\.php/i,
    /<meta[^>]+name=["']generator["'][^>]+content=["'][^"']*wordpress/i,
    /rel=["']https:\/\/api\.w\.org\/["']/i,
  ];

  let score = 0;
  for (const rx of signals) if (rx.test(html)) score++;
  return score >= 2;
};

const isWordPressViaAPI = async (baseUrl: string): Promise<boolean> => {
  try {
    const u = new URL('/wp-json', baseUrl).href;
    const res = await http.get(u, {
      validateStatus: () => true,
      headers: { Accept: 'application/json' },
      maxRedirects: 2,
    });

    if (res.status < 200 || res.status >= 300) return false;
    const ct = String(res.headers['content-type'] || '').toLowerCase();
    if (!ct.includes('application/json')) return false;

    const data = res.data;
    if (!data || typeof data !== 'object') return false;

    const hasNamespaces = Array.isArray((data as any).namespaces);
    const hasRoutes =
      data && typeof (data as any).routes === 'object' && (data as any).routes !== null &&
      Object.keys((data as any).routes).length > 0;

    const hasWpHeader = Object.keys(res.headers).some((h) => h.toLowerCase().startsWith('x-wp-'));

    return (hasNamespaces && hasRoutes) || hasWpHeader;
  } catch {
    return false;
  }
};


const isDrupal = ($: cheerio.Root): boolean => {
  const html = $.html().toLowerCase();
  const patterns = [/drupal\.js/i, /sites\/(default|all)\//i, /drupal_settings|drupalSettings/i];
  return patterns.filter((rx) => rx.test(html)).length >= 2;
};

const isJoomla = ($: cheerio.Root): boolean => {
  const html = $.html().toLowerCase();
  const patterns = [/joomla/i, /\/components\/com_/i, /\/media\/system\/js\//i];
  return patterns.filter((rx) => rx.test(html)).length >= 2;
};

const isShopify = ($: cheerio.Root): boolean => {
  const html = $.html();
  const signals: RegExp[] = [
    /cdn\.shopify\.com/i,
    /shopifycloud/i,
    /data-shopify/i,
    /window\.Shopify/i,
    /shopify\.assets/i,
  ];
  let score = 0;
  for (const rx of signals) if (rx.test(html)) score++;
  return score >= 2;
};


const isSquarespace = ($: cheerio.Root): boolean => {
  const html = $.html().toLowerCase();
  const patterns = [/static\.squarespace\.com/i, /squarespace\.analytics/i];
  return patterns.filter((rx) => rx.test(html)).length >= 1;
};

const isWix = ($: cheerio.Root): boolean => {
  const html = $.html().toLowerCase();
  const patterns = [/static\.wixstatic\.com/i, /wix-code|wixsite/i, /wix\.apps/i];
  return patterns.filter((rx) => rx.test(html)).length >= 2;
};

// ======= Analytics / marketing / monitoring / payments =======
const containsGoogleAnalytics = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const gaScript = $('script[src*="google-analytics.com/analytics.js"], script[src*="google-analytics.com/ga.js"], script[src*="googletagmanager.com/gtag/js"]');
  const hasGAScript = gaScript.length > 0;

  const inline = $('script').filter((i, el) => {
    const c = $(el).html() || '';
    const ua = /ga\((['"])create\1/.test(c) && /ga\((['"])send\1/.test(c);
    const gtag = /gtag\(/.test(c) && /config/.test(c) && /(UA-|G-)/.test(c);
    return ua || gtag;
  }).length > 0;

  const inScripts = await containsInScripts($, baseUrl, (t) => /gtag\(|ga\(/.test(t));
  return hasGAScript || inline || inScripts;
};

const containsGoogleTagManager = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const gtmScript = $('script[src*="googletagmanager.com/gtm.js"]');
  const has = gtmScript.length > 0 || $('noscript iframe[src*="googletagmanager.com/ns.html"]').length > 0;
  const inline = $('script').filter((i, el) => /dataLayer/.test($(el).html() || '') && /GTM-/.test($(el).html() || '')).length > 0;
  const inScripts = await containsInScripts($, baseUrl, (t) => /gtm\.start|GTM-/.test(t));
  return has || inline || inScripts;
};

const containsMatomo = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const s = $('script[src*="matomo"], script[src*="piwik"]');
  const inline = $('script').filter((i, el) => /_paq\.push|Matomo/i.test($(el).html() || '')).length > 0;
  const inScripts = await containsInScripts($, baseUrl, (t) => /_paq\.push|Matomo/i.test(t));
  return (s.length > 0 ? 1 : 0) + (inline ? 1 : 0) + (inScripts ? 1 : 0) >= 2;
};

const containsPlausible = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const s = $('script[src*="plausible.io"]');
  const inline = $('script').filter((i, el) => /plausible|data-domain/i.test($(el).html() || '')).length > 0;
  const inScripts = await containsInScripts($, baseUrl, (t) => /plausible/i.test(t));
  return (s.length > 0 ? 1 : 0) + (inline ? 1 : 0) + (inScripts ? 1 : 0) >= 2;
};

const containsMixpanel = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const s = $('script[src*="mixpanel"]');
  const inline = $('script').filter((i, el) => /mixpanel(\.init|\.)/i.test($(el).html() || '')).length > 0;
  const inScripts = await containsInScripts($, baseUrl, (t) => /mixpanel/i.test(t));
  return (s.length > 0 ? 1 : 0) + (inline ? 1 : 0) + (inScripts ? 1 : 0) >= 2;
};

const containsAmplitude = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const s = $('script[src*="amplitude.com"]');
  const inline = $('script').filter((i, el) => /amplitude\.getInstance\(\)\.init/.test($(el).html() || '')).length > 0;
  const inScripts = await containsInScripts($, baseUrl, (t) => /amplitude\.getInstance\(\)\.init/.test(t));
  return (s.length > 0 ? 1 : 0) + (inline ? 1 : 0) + (inScripts ? 1 : 0) >= 2;
};

const containsSegment = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const s = $('script[src*="segment.com"], script[src*="cdn.segment.com"]');
  const inScripts = await containsInScripts($, baseUrl, (t) => /analytics\.load|SegmentSnip/i.test(t));
  return s.length > 0 || inScripts;
};

const containsHotjar = ($: cheerio.Root): boolean => {
  return $('script[src*="static.hotjar.com"], script[src*="script.hotjar.com"]').length > 0 ||
    $('script').filter((i, el) => /hjid|Hotjar/i.test($(el).html() || '')).length > 0;
};

const containsHubspot = ($: cheerio.Root): boolean => {
  return $('script[src*="js.hs-scripts.com"], script[src*="js.hs-analytics.net"]').length > 0;
};

const containsMailchimp = ($: cheerio.Root): boolean => {
  return $('script[src*="chimpstatic.com"], script[src*="mcjs"], script[src*="list-manage.com"]').length > 0;
};

const containsIntercom = ($: cheerio.Root): boolean => {
  return $('script[src*="widget.intercom.io"]').length > 0 || $('script').filter((i, el) => /intercomSettings/i.test($(el).html() || '')).length > 0;
};

const containsDrift = ($: cheerio.Root): boolean => {
  return $('script[src*="js.driftt.com"]').length > 0;
};

const containsSentry = ($: cheerio.Root): boolean => {
  return $('script[src*="sentry.io"], script[src*="@sentry"]').length > 0 ||
    $('script').filter((i, el) => /Sentry\.init|@sentry\/browser/i.test($(el).html() || '')).length > 0;
};

const containsDatadog = ($: cheerio.Root): boolean => {
  return $('script[src*="datadoghq"], script[src*="ddrum"]').length > 0;
};

const containsNewRelic = ($: cheerio.Root): boolean => {
  return $('script[src*="nr-data.net"], script[src*="newrelic"]').length > 0;
};

const containsStripe = ($: cheerio.Root): boolean => $('script[src*="js.stripe.com"]').length > 0;
const containsBraintree = ($: cheerio.Root): boolean => $('script[src*="braintree"], script[src*="paypalobjects.com/api/checkout"]').length > 0;
const containsPaypal = ($: cheerio.Root): boolean => $('script[src*="paypal.com/sdk/js"], script[src*="paypalobjects.com"]').length > 0;

// ======= JS frameworks =======
const containsjQuery = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const hasTag = $('script[src*="jquery"]').length > 0;
  const inline = $('script').filter((i, el) => {
    const c = $(el).html() || '';
    return /jQuery|\$\(/.test(c);
  }).length > 0;
  const inScripts = await containsInScripts($, baseUrl, (t) => /jQuery|\$\(/.test(t));
  return (hasTag ? 1 : 0) + (inline ? 1 : 0) + (inScripts ? 1 : 0) >= 2;
};

const containsBackbone = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const hasTag = $('script[src*="backbone"]').length > 0;
  const inline = $('script').filter((i, el) => /Backbone\.Model|Backbone\./.test($(el).html() || '')).length > 0;
  const inScripts = await containsInScripts($, baseUrl, (t) => /Backbone\./.test(t));
  return (hasTag ? 1 : 0) + (inline ? 1 : 0) + (inScripts ? 1 : 0) >= 2;
};

const containsDojo = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const hasTag = $('script[src*="dojo"]').length > 0;
  const inline = $('script').filter((i, el) => /dojo\.require|dojo\./.test($(el).html() || '')).length > 0;
  const inScripts = await containsInScripts($, baseUrl, (t) => /dojo\./i.test(t));
  return (hasTag ? 1 : 0) + (inline ? 1 : 0) + (inScripts ? 1 : 0) >= 2;
};

const containsMeteor = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const hasTag = $('script[src*="meteor"], script[src*="packages/meteor"]').length > 0;
  const inline = $('script').filter((i, el) => /Meteor\.startup|Meteor\./.test($(el).html() || '')).length > 0;
  const hasAttr = $('[id^="meteor"]').length > 0;
  const inScripts = await containsInScripts($, baseUrl, (t) => /Meteor\./.test(t));
  return (hasTag ? 1 : 0) + (inline ? 1 : 0) + (hasAttr ? 1 : 0) + (inScripts ? 1 : 0) >= 2;
};

// ======= CSS Frameworks (tight rules) =======

// Bootstrap
const containsBootstrap = ($: cheerio.Root): boolean => {
  const hasStylesheet =
    $('link[rel~="stylesheet"][href*="bootstrap"]' +
      ',link[href*="cdnjs.cloudflare.com/ajax/libs/bootstrap"]' +
      ',link[href*="cdn.jsdelivr.net/npm/bootstrap"]' +
      ',link[href*="maxcdn.bootstrapcdn.com/bootstrap"]' +
      ',link[href*="unpkg.com/bootstrap"]').length > 0;

  const hasScript =
    $('script[src*="bootstrap.bundle"]' +
      ',script[src*="bootstrap.min.js"]' +
      ',script[src*="cdnjs.cloudflare.com/ajax/libs/bootstrap"]' +
      ',script[src*="cdn.jsdelivr.net/npm/bootstrap"]' +
      ',script[src*="maxcdn.bootstrapcdn.com/bootstrap"]' +
      ',script[src*="unpkg.com/bootstrap"]').length > 0;

  const hasBsVars =
    $('style')
      .toArray()
      .some((el) => /--bs-/.test($(el).html() || '')) ||
    $('[style]')
      .toArray()
      .some((el) => /--bs-/.test($(el).attr('style') || ''));

  const dataBsCount = $(
    '[data-bs-toggle], [data-bs-target], [data-bs-dismiss], [data-bs-spy], [data-bs-slide]'
  ).length;

  if (hasStylesheet || hasScript || hasBsVars) return true;
  if (dataBsCount >= 2 && (hasStylesheet || hasScript || hasBsVars)) return true;

  return false;
};

// Bulma: require stylesheet link OR combination of Bulma-specific “is-/has-” + grid components.
const containsBulma = ($: cheerio.Root): boolean => {
  const hasLink =
    $('link[href*="bulma.min.css"], link[href*="bulma.css"], link[href*="cdn.jsdelivr.net/npm/bulma"]').length > 0;

  const gridBits = $('.columns, .column, .hero, .notification, .level, .tile, .message, .navbar').length;
  const modifierBits = $('[class*=" is-"], [class^="is-"], [class*=" has-"], [class^="has-"]').length;

  // Need enough of both to avoid generic class false-positives
  return hasLink || (gridBits >= 3 && modifierBits >= 4);
};

// Foundation: require CSS/JS link OR distinctive data-attributes OR modern grid classes (grid-x/cell) with JS.
const containsFoundation = ($: cheerio.Root): boolean => {
  const hasLink =
    $('link[href*="foundation.min.css"], link[href*="foundation.css"], link[href*="foundation-sites"]').length > 0;
  const hasJs =
    $('script[src*="foundation.min.js"], script[src*="foundation.js"]').length > 0;

  const hasDataAttrs = $(
    '[data-accordion], [data-dropdown], [data-reveal], [data-tabs], [data-off-canvas], [data-sticky], [data-magellan]'
  ).length > 0;

  const modernGrid = $('.grid-x, .cell, .grid-container, .callout, .reveal').length >= 3;

  return hasLink || hasDataAttrs || (hasJs && modernGrid);
};

const containsMaterializeCSS = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const hasTag = $('link[href*="materialize"], script[src*="materialize"]').length > 0;
  const inline = $('script').filter((i, el) => /M\.AutoInit|M\.toast/.test($(el).html() || '')).length > 0;
  const inScripts = await containsInScripts($, baseUrl, (t) => /materialize|M\.AutoInit/.test(t));
  return hasTag || (inline && inScripts);
};

const containsSemanticUI = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const hasLink = $('link[href*="semantic"], link[href*="semantic-ui"]').length > 0;
  const hasScript = $('script[src*="semantic"]').length > 0;
  const inline = $('script').filter((i, el) => /\$\.fn\.dropdown|\$\.fn\.modal/.test($(el).html() || '')).length > 0;
  const inScripts = await containsInScripts($, baseUrl, (t) => /semantic/i.test(t));
  return hasLink || hasScript || (inline && inScripts);
};

// Tailwind can stay a bit permissive (utility class soup is distinctive) but still check stylesheet too.
const containsTailwindClasses = ($: cheerio.Root): boolean => {
  const rx =
    /\b(bg-(?:red|blue|green|yellow|indigo|purple|pink|gray|white|black|transparent|current)-(?:50|100|200|300|400|500|600|700|800|900)|text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|left|center|right|justify)|rounded(?:-\w+)?|shadow(?:-\w+)?|p-\d+|m-\d+|w-\d\/\d|h-\d+|inline-flex|flex|flex-(?:row|col)|items-(?:start|end|center|baseline|stretch)|justify-(?:start|end|center|between|around|evenly)|gap-\d+|space-(?:x|y)-\d+)\b/;
  const matchesClasses = $('[class]').toArray().some((el) => rx.test($(el).attr('class') || ''));
  const tailwindCss = $('link[href*="tailwind.css"], link[href*="tailwind.min.css"]').length > 0;
  return matchesClasses && tailwindCss ? true : matchesClasses && $('[class*="flex "]').length > 5;
};

// ======= Next/React/etc (unchanged) =======
const containsNextJs = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const hasTags = $('script[src*="/_next/static/"]').length > 0 || $('script#__NEXT_DATA__').length > 0;
  const inScripts = await containsInScripts($, baseUrl, (t) => /\/_next\/static\/|__NEXT_DATA__/.test(t));
  const announcer = $('[aria-live="assertive"][id^="__next"]').length > 0 || $('[data-nextjs-router]').length > 0;
  return hasTags || inScripts || announcer;
};

const containsReact = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const attrs = $('[data-reactroot], [data-reactid]').length > 0;
  const hasTags = $('script[src*="react"], script[src*="react-dom"]').length > 0;
  const inline = $('script').filter((i, el) => /React\.createElement|react\.production\.min\.js/.test($(el).html() || '')).length > 0;
  const inScripts = await containsInScripts($, baseUrl, (t) => /React\.createElement|@license React|reactjs\.org/.test(t));
  const blankRoot = $('div#root').length > 0 && (($('div#root').html() || '').trim() === '');
  return [attrs, hasTags, inline, inScripts, blankRoot].some(Boolean);
};

const containsVue = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const hasTags = $('script[src*="vue"], script[src*="vue-router"]').length > 0;
  const inline = $('script').filter((i, el) => /new Vue\(|Vue\.component/.test($(el).html() || '')).length > 0;
  const hasDataV = $('[data-v-]').length > 0;
  const inScripts = await containsInScripts($, baseUrl, (t) => /Vue\.component|Vue\.config|vuejs\.org/.test(t));
  return hasTags || inline || hasDataV || inScripts;
};

const containsNuxtJs = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const hasTags = $('script[src*="/_nuxt/"]').length > 0 || $('script#nuxt-config').length > 0;
  const inScripts = await containsInScripts($, baseUrl, (t) => /\/_nuxt\//.test(t));
  return hasTags || inScripts;
};

const containsAngular = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const hasTags = $('script[src*="main.js"], script[src*="polyfills.js"]').length > 0 || $('[ng-app]').length > 0;
  const inScripts = await containsInScripts($, baseUrl, (t) => /platformBrowserDynamic|@angular/.test(t));
  return hasTags || inScripts;
};

const containsPolymer = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const hasTag = $('script[src*="polymer"]').length > 0 || $('[is]').length > 0;
  const inline = $('script').filter((i, el) => /Polymer.*customElements/.test($(el).html() || '')).length > 0;
  const inScripts = await containsInScripts($, baseUrl, (t) => /Polymer|polymer-project\.org|webcomponentsjs/.test(t));
  return hasTag || inline || inScripts;
};

const containsGatsby = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const hasTags = $('script[src*="/gatsby"], script[src*="webpack-runtime"]').length > 0 || $('link[rel="gatsby"]').length > 0;
  const inline = $('script').filter((i, el) => /gatsby/i.test($(el).html() || '')).length > 0;
  const inScripts = await containsInScripts($, baseUrl, (t) => /gatsby/i.test(t));
  return hasTags || inline || inScripts;
};

const containsSvelte = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const hasTags = $('script[src*="svelte"]').length > 0 || $('svelte-head').length > 0;
  const inline = $('script').filter((i, el) => /SvelteComponent/.test($(el).html() || '')).length > 0;
  const inScripts = await containsInScripts($, baseUrl, (t) => /SvelteComponent/.test(t));
  return hasTags || inline || inScripts;
};

const containsEmber = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const hasTags = $('script[src*="ember"]').length > 0 || $('[id^="ember"]').length > 0;
  const inline = $('script').filter((i, el) => /Ember\.Application\.create/.test($(el).html() || '')).length > 0;
  const inScripts = await containsInScripts($, baseUrl, (t) => /Ember\.Application\.create/.test(t));
  return hasTags || inline || inScripts;
};

const containsMaterialUI = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const hasTag = $('script[src*="material-ui"], script[src*="mui"]').length > 0 || $('[class*="Mui"]').length > 0;
  const inScripts = await containsInScripts($, baseUrl, (t) => /@mui|MuiSvgIcon|muiName/.test(t));
  return hasTag || inScripts;
};

// Newer/lightweight libs
const containsAstro = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const hasIslands = $('astro-island, [data-astro-cid]').length > 0;
  const inScripts = await containsInScripts($, baseUrl, (t) => /astro\/client|astro-island|astro\.client/i.test(t));
  return hasIslands || inScripts;
};
const containsRemix = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const hasTag = $('script[data-remix-run], script[type="module"][src*="/build/"]').length > 0;
  const inScripts = await containsInScripts($, baseUrl, (t) => /__remixManifest|remix:/i.test(t));
  return hasTag || inScripts;
};
const containsAlpine = ($: cheerio.Root): boolean => {
  const hasAttrs = $('[x-data], [x-init], [x-show], [x-on\\:], [x-bind\\:]').length > 0;
  const hasScript = $('script[src*="alpinejs"]').length > 0;
  return hasAttrs || hasScript;
};
const containsHTMX = ($: cheerio.Root): boolean => {
  const hasAttrs = $('[hx-get], [hx-post], [hx-target], [hx-swap]').length > 0;
  const hasScript = $('script[src*="htmx.org"]').length > 0;
  return hasAttrs || hasScript;
};

// ======= CDN / hosting inference =======
const inferCDN = (headers: Record<string, string>): string[] => {
  const h: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) h[k.toLowerCase()] = String(v || '');
  const out = new Set<string>();

  if (h['cf-ray'] || h['cf-cache-status'] || /cloudflare/i.test(h['server'] || '')) out.add('Cloudflare');
  if (h['x-amz-cf-pop'] || h['via']?.toLowerCase().includes('cloudfront')) out.add('Amazon CloudFront');
  if (h['x-served-by']?.toLowerCase().includes('fastly') || /fastly/i.test(h['server'] || '')) out.add('Fastly');
  if (/akamai/i.test(h['server'] || '') || h['x-akamai-transformed'] || h['x-akamai-staging']) out.add('Akamai');
  if (h['server']?.toLowerCase().includes('vercel') || h['x-vercel-id']) out.add('Vercel Edge');
  if (h['x-cache']?.toLowerCase().includes('cache') && h['x-azure-ref']) out.add('Azure CDN/Front Door');
  return Array.from(out);
};

const inferHosting = (headers: Record<string, string>): string | undefined => {
  const h: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) h[k.toLowerCase()] = String(v || '');
  if (h['x-vercel-id'] || /vercel/i.test(h['server'] || '')) return 'Vercel';
  if (h['x-nf-request-id'] || /netlify/i.test(h['server'] || '')) return 'Netlify';
  if (h['x-github-request-id'] || /github\.com/i.test(h['server'] || '')) return 'GitHub Pages';
  if (h['fly-request-id'] || /fly\.io/i.test(h['server'] || '')) return 'Fly.io';
  if (h['x-render-origin-server'] || /render/i.test(h['server'] || '')) return 'Render';
  if (h['server']?.toLowerCase().includes('azure')) return 'Azure';
  if (h['server']?.toLowerCase().includes('google')) return 'Google Cloud';
  return undefined;
};

// ======= API Route =======
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    let response;
    try {
      response = await http.get(url, {
        validateStatus: () => true,
      });
    } catch (e) {
      console.error('Network error fetching URL:', e);
      return NextResponse.json({ error: 'Error fetching the URL' }, { status: 502 });
    }

    if (response.status === 403) {
      return NextResponse.json({ error: 'Access to the URL is forbidden (403).' }, { status: 403 });
    }
    if (response.status >= 400) {
      return NextResponse.json({ error: `Target responded with ${response.status}` }, { status: 400 });
    }

    const headers: Record<string, string> = Object.fromEntries(
      Object.entries(response.headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(', ') : String(v ?? '')])
    );

    const tech = await detectTechStack(String(response.data || ''), headers, url);
    return NextResponse.json(tech, { status: 200 });
  } catch (error) {
    console.error('Error parsing request body:', error);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
