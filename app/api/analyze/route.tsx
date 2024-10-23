import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import cheerio from 'cheerio';
import pLimit from 'p-limit';

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
}

const serverHeaderMap: Record<string, string> = {
  gws: 'Google Web Server',
  apache: 'Apache HTTP Server',
  nginx: 'NGINX',
  cloudflare: 'Cloudflare',
  iis: 'Microsoft IIS',
  'next.js': 'Next.js',
  express: 'Express.js',
  php: 'PHP',
  envoy: 'Envoy',
  esf: 'Google Frontend Server',
  'awselb/2.0': 'AWS Elastic Load Balancer',
};

const detectTechStack = async (
  html: string,
  headers: Record<string, string>,
  baseUrl: string
): Promise<TechStack> => {
  const $ = cheerio.load(html);
  const techStack: TechStack = {};

  // Detecting CMS
  if (isWordPress($)) {
    techStack.cms = 'WordPress';
    techStack.isWordPress = true;
  } else if (isDrupal($)) {
    techStack.cms = 'Drupal';
  } else if (isJoomla($)) {
    techStack.cms = 'Joomla';
  } else if (isShopify($)) {
    techStack.cms = 'Shopify';
  } else if (isSquarespace($)) {
    techStack.cms = 'Squarespace';
  } else if (isWix($)) {
    techStack.cms = 'Wix';
  } else {
    const generatorContent = $('meta[name="generator"]').attr('content');
    if (generatorContent) {
      techStack.cms = generatorContent;
    }
  }

  // Detecting JavaScript frameworks
  const jsFrameworks = new Set<string>();
  const frameworkDetectors = [
    containsReact($, baseUrl),
    containsVue($, baseUrl),
    containsAngular($, baseUrl),
    containsNextJs($, baseUrl),
    containsGatsby($, baseUrl),
    containsSvelte($, baseUrl),
    containsEmber($, baseUrl),
    containsNuxtJs($, baseUrl),
    containsPolymer($, baseUrl),
    containsjQuery($, baseUrl),
    containsBackbone($, baseUrl),
    containsDojo($, baseUrl),
    containsMeteor($, baseUrl),
  ];
  const frameworkResults = await Promise.all(frameworkDetectors);
  const frameworkNames = [
    'React',
    'Vue.js',
    'Angular',
    'Next.js',
    'Gatsby',
    'Svelte',
    'Ember.js',
    'Nuxt.js',
    'Polymer',
    'jQuery',
    'Backbone.js',
    'Dojo',
    'Meteor',
  ];
  frameworkResults.forEach((result, index) => {
    if (result) jsFrameworks.add(frameworkNames[index]);
  });
  if (jsFrameworks.size > 0) {
    techStack.javascriptFrameworks = Array.from(jsFrameworks);
  }

  // Detecting CSS frameworks
  const cssFrameworks = [];
  if (!techStack.isWordPress) {
    if (containsBootstrap($)) cssFrameworks.push('Bootstrap');
    if (containsTailwindClasses($)) cssFrameworks.push('Tailwind CSS');
    if (containsBulma($)) cssFrameworks.push('Bulma');
    if (containsFoundation($)) cssFrameworks.push('Foundation');
    if (await containsMaterialUI($, baseUrl)) cssFrameworks.push('Material-UI');
    if (await containsSemanticUI($, baseUrl)) cssFrameworks.push('Semantic UI');
    if (await containsMaterializeCSS($, baseUrl)) cssFrameworks.push('Materialize CSS');
    if (cssFrameworks.length > 0) techStack.cssFrameworks = cssFrameworks;
  }

  // Detecting Analytics
  const analytics = [];
  if (await containsGoogleAnalytics($, baseUrl)) analytics.push('Google Analytics');
  if (await containsGoogleTagManager($, baseUrl)) analytics.push('Google Tag Manager');
  if (await containsMatomo($, baseUrl)) analytics.push('Matomo');
  if (await containsPlausible($, baseUrl)) analytics.push('Plausible');
  if (await containsMixpanel($, baseUrl)) analytics.push('Mixpanel');
  if (await containsAmplitude($, baseUrl)) analytics.push('Amplitude');
  if (analytics.length > 0) techStack.analytics = analytics;

  // Detecting Build Tools
  const buildTools = new Set<string>();
  if (html.includes('webpack')) buildTools.add('Webpack');
  if (await containsInScripts($, 'webpack', baseUrl)) buildTools.add('Webpack');
  if (html.includes('gulp')) buildTools.add('Gulp');
  if (html.includes('grunt')) buildTools.add('Grunt');
  if (buildTools.size > 0) techStack.buildTools = Array.from(buildTools);

  // Detecting Compression
  const compression = [];
  if (headers['content-encoding']?.includes('gzip')) compression.push('Gzip');
  if (headers['content-encoding']?.includes('br')) compression.push('Brotli');
  if (headers['content-encoding']?.includes('deflate')) compression.push('Deflate');
  if (compression.length > 0) techStack.compression = compression;

  // Detecting Server
  if (headers['server']) {
    const serverName = headers['server'].toLowerCase();
    techStack.server = serverHeaderMap[serverName] || headers['server'];
  }

  // Detecting Web Server
  if (headers['x-powered-by']) {
    const xPoweredBy = headers['x-powered-by'].toLowerCase();
    if (
      !techStack.javascriptFrameworks?.includes('Next.js') &&
      !techStack.javascriptFrameworks?.includes('Nuxt.js')
    ) {
      techStack.webServer = headers['x-powered-by'];
    } else if (
      xPoweredBy.includes('next.js') &&
      !techStack.javascriptFrameworks?.includes('Next.js')
    ) {
      techStack.javascriptFrameworks?.push('Next.js');
    } else if (
      xPoweredBy.includes('nuxt.js') &&
      !techStack.javascriptFrameworks?.includes('Nuxt.js')
    ) {
      techStack.javascriptFrameworks?.push('Nuxt.js');
    }
  }

  return techStack;
};

// CMS Detection Functions
const isWordPress = ($: cheerio.Root): boolean => {
  const patterns = [
    /\/wp-content\//,
    /\/wp-includes\//,
    /\/wp-admin\//,
    /wp-embed\.min\.js/,
    /wp-emoji-release\.min\.js/,
    /wp-blog-header\.php/,
    /rel="https:\/\/api\.w\.org\/"/,
    /<link rel='https:\/\/api\.w\.org\/'/,
  ];
  const html = $.html().toLowerCase();
  const matches = patterns.filter((pattern) => pattern.test(html));
  return matches.length >= 1;
};

const isDrupal = ($: cheerio.Root): boolean => {
  const patterns = [/drupal\.js/, /sites\/all\//, /drupal_settings/];
  const html = $.html().toLowerCase();
  const matches = patterns.filter((pattern) => pattern.test(html));
  return matches.length >= 2;
};

const isJoomla = ($: cheerio.Root): boolean => {
  const patterns = [/joomla/, /\/components\/com_/, /\/media\/system\/js\//];
  const html = $.html().toLowerCase();
  const matches = patterns.filter((pattern) => pattern.test(html));
  return matches.length >= 2;
};

const isShopify = ($: cheerio.Root): boolean => {
  const patterns = [/cdn\.shopify\.com/, /shopify\.assets/, /shopify/];
  const html = $.html().toLowerCase();
  const matches = patterns.filter((pattern) => pattern.test(html));
  return matches.length >= 2;
};

const isSquarespace = ($: cheerio.Root): boolean => {
  const patterns = [/static\.squarespace\.com/, /squarespace\.analytics/];
  const html = $.html().toLowerCase();
  const matches = patterns.filter((pattern) => pattern.test(html));
  return matches.length >= 2;
};

const isWix = ($: cheerio.Root): boolean => {
  const patterns = [/static\.wixstatic\.com/, /wix-code/, /wix\.apps/];
  const html = $.html().toLowerCase();
  const matches = patterns.filter((pattern) => pattern.test(html));
  return matches.length >= 2;
};

// Analytics Detection Functions
const containsGoogleAnalytics = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const gaScript = $(
    'script[src*="google-analytics.com/analytics.js"], script[src*="google-analytics.com/ga.js"], script[src*="googletagmanager.com/gtag/js"]'
  );
  const hasGAScript = gaScript.length > 0;

  const inlineScripts = $('script').filter((i, el) => {
    const scriptContent = $(el).html() || '';

    const isUniversalAnalytics =
      scriptContent.includes('ga(') &&
      (scriptContent.includes("ga('create'") ||
        scriptContent.includes('ga("create"') ||
        scriptContent.includes("ga('create'")) &&
      (scriptContent.includes("ga('send'") ||
        scriptContent.includes('ga("send"') ||
        scriptContent.includes("ga('send'"));

    const isGlobalSiteTag =
      scriptContent.includes('gtag(') &&
      scriptContent.includes('config') &&
      (scriptContent.includes('UA-') || scriptContent.includes('G-'));

    return isUniversalAnalytics || isGlobalSiteTag;
  });
  const hasInlineGA = inlineScripts.length > 0;

  const foundInScripts = await containsInScripts($, 'google-analytics', baseUrl, ['ga(', 'gtag(']);

  const conditions = [hasGAScript, hasInlineGA, foundInScripts];
  const trueConditions = conditions.filter(Boolean).length;

  return trueConditions >= 1;
};

const containsGoogleTagManager = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const gtmScript = $('script[src*="googletagmanager.com/gtm.js?id="]');
  const hasGTMScript = gtmScript.length > 0 && gtmScript.attr('src')?.includes('id=GTM-');

  const inlineScripts = $('script').filter((i, el) => {
    const scriptContent = $(el).html() || '';
    return (
      scriptContent.includes('dataLayer') &&
      scriptContent.includes('gtm.start') &&
      scriptContent.includes('GTM-')
    );
  });
  const hasInlineGTM = inlineScripts.length > 0;

  const foundInScripts = await containsInScripts($, 'gtm.start', baseUrl, ['GTM-']);

  const conditions = [hasGTMScript, hasInlineGTM, foundInScripts];
  const trueConditions = conditions.filter(Boolean).length;

  return trueConditions >= 1;
};

const containsMatomo = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const matomoScripts = $('script[src*="matomo"]');
  const hasMatomoScript = matomoScripts.length > 0;

  const inlineMatomoScripts = $('script').filter((i, el) => {
    const scriptContent = $(el).html() || '';
    return scriptContent.includes('Matomo') || scriptContent.includes('_paq.push');
  });
  const hasInlineMatomo = inlineMatomoScripts.length > 0;

  const foundInScripts = await containsInScripts($, 'matomo', baseUrl, ['_paq.push']);

  const conditions = [hasMatomoScript, hasInlineMatomo, foundInScripts];
  const trueConditions = conditions.filter(Boolean).length;

  return trueConditions >= 2;
};

const containsPlausible = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const plausibleScripts = $('script[src*="plausible.io"]');
  const hasPlausibleScript = plausibleScripts.length > 0;

  const inlinePlausibleScripts = $('script').filter((i, el) => {
    const scriptContent = $(el).html() || '';
    return scriptContent.includes('plausible') || scriptContent.includes('data-domain');
  });
  const hasInlinePlausible = inlinePlausibleScripts.length > 0;

  const foundInScripts = await containsInScripts($, 'plausible', baseUrl);

  const conditions = [hasPlausibleScript, hasInlinePlausible, foundInScripts];
  const trueConditions = conditions.filter(Boolean).length;

  return trueConditions >= 2;
};

const containsMixpanel = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const mixpanelScripts = $('script[src*="mixpanel"]');
  const hasMixpanelScript = mixpanelScripts.length > 0;

  const inlineMixpanelScripts = $('script').filter((i, el) => {
    const scriptContent = $(el).html() || '';
    return scriptContent.includes('mixpanel') || scriptContent.includes('mixpanel.init');
  });
  const hasInlineMixpanel = inlineMixpanelScripts.length > 0;

  const foundInScripts = await containsInScripts($, 'mixpanel', baseUrl);

  const conditions = [hasMixpanelScript, hasInlineMixpanel, foundInScripts];
  const trueConditions = conditions.filter(Boolean).length;

  return trueConditions >= 2;
};

const containsAmplitude = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const amplitudeScript = $('script[src*="amplitude.com"]');
  const hasAmplitudeScript = amplitudeScript.length > 0;

  const inlineScripts = $('script').filter((i, el) => {
    const scriptContent = $(el).html() || '';
    return scriptContent.includes('amplitude.getInstance().init');
  });
  const hasInlineAmplitude = inlineScripts.length > 0;

  const foundInScripts = await containsInScripts($, 'amplitude.getInstance().init', baseUrl);

  const conditions = [hasAmplitudeScript, hasInlineAmplitude, foundInScripts];
  const trueConditions = conditions.filter(Boolean).length;

  return trueConditions >= 2;
};

// JavaScript Framework Detection Functions
const containsjQuery = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const jqueryScripts = $('script[src*="jquery"]');
  const isjQueryPresent = jqueryScripts.length > 0;

  const inlinejQueryScripts = $('script').filter((i, el) => {
    const scriptContent = $(el).html() || '';
    return scriptContent.includes('jQuery') || scriptContent.includes('$(');
  });
  const isInlinejQueryPresent = inlinejQueryScripts.length > 0;

  const isjQueryContentPresent = await containsInScripts($, 'jQuery', baseUrl, ['$(', '$.']);

  const conditions = [isjQueryPresent, isInlinejQueryPresent, isjQueryContentPresent];
  const trueConditions = conditions.filter(Boolean).length;

  return trueConditions >= 2;
};

const containsBackbone = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const backboneScripts = $('script[src*="backbone"]');
  const isBackbonePresent = backboneScripts.length > 0;

  const inlineBackboneScripts = $('script').filter((i, el) => {
    const scriptContent = $(el).html() || '';
    return scriptContent.includes('Backbone') || scriptContent.includes('Backbone.Model');
  });
  const isInlineBackbonePresent = inlineBackboneScripts.length > 0;

  const isBackboneContentPresent = await containsInScripts($, 'Backbone', baseUrl);

  const conditions = [isBackbonePresent, isInlineBackbonePresent, isBackboneContentPresent];
  const trueConditions = conditions.filter(Boolean).length;

  return trueConditions >= 2;
};

const containsDojo = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const dojoScripts = $('script[src*="dojo"]');
  const isDojoPresent = dojoScripts.length > 0;

  const inlineDojoScripts = $('script').filter((i, el) => {
    const scriptContent = $(el).html() || '';
    return scriptContent.includes('dojo') || scriptContent.includes('dojo.require');
  });
  const isInlineDojoPresent = inlineDojoScripts.length > 0;

  const isDojoContentPresent = await containsInScripts($, 'dojo', baseUrl);

  const conditions = [isDojoPresent, isInlineDojoPresent, isDojoContentPresent];
  const trueConditions = conditions.filter(Boolean).length;

  return trueConditions >= 2;
};

const containsMeteor = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const meteorScripts = $('script[src*="meteor"], script[src*="packages/meteor"]');
  const isMeteorPresent = meteorScripts.length > 0;

  const inlineMeteorScripts = $('script').filter((i, el) => {
    const scriptContent = $(el).html() || '';
    return scriptContent.includes('Meteor') || scriptContent.includes('Meteor.startup');
  });
  const isInlineMeteorPresent = inlineMeteorScripts.length > 0;

  const hasMeteorAttributes = $('[id^="meteor"]').length > 0;

  const isMeteorContentPresent = await containsInScripts($, 'Meteor', baseUrl);

  const conditions = [
    isMeteorPresent,
    isInlineMeteorPresent,
    hasMeteorAttributes,
    isMeteorContentPresent,
  ];
  const trueConditions = conditions.filter(Boolean).length;

  return trueConditions >= 2;
};

// CSS Framework Detection Functions
const containsMaterializeCSS = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const materializeScripts = $('link[href*="materialize"], script[src*="materialize"]');
  const isMaterializePresent = materializeScripts.length > 0;

  const inlineMaterialize = $('script').filter((i, el) => {
    const scriptContent = $(el).html() || '';
    return scriptContent.includes('M.AutoInit') || scriptContent.includes('M.toast');
  });
  const hasInlineMaterialize = inlineMaterialize.length > 0;

  const isMaterializeContentPresent = await containsInScripts($, 'materialize', baseUrl);

  const conditions = [isMaterializePresent, hasInlineMaterialize, isMaterializeContentPresent];
  const trueConditions = conditions.filter(Boolean).length;

  return trueConditions >= 2;
};

const containsSemanticUI = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const semanticUIScripts = $('link[href*="semantic"], script[src*="semantic"]');
  const isSemanticUIPresent = semanticUIScripts.length > 0;

  const inlineSemanticUI = $('script').filter((i, el) => {
    const scriptContent = $(el).html() || '';
    return scriptContent.includes('$.fn.dropdown') || scriptContent.includes('$.fn.modal');
  });
  const hasInlineSemanticUI = inlineSemanticUI.length > 0;

  const isSemanticUIContentPresent = await containsInScripts($, 'semantic', baseUrl);

  const conditions = [isSemanticUIPresent, hasInlineSemanticUI, isSemanticUIContentPresent];
  const trueConditions = conditions.filter(Boolean).length;

  return trueConditions >= 2;
};

// Existing Detection Functions (adjusted for improved accuracy)
const containsInScripts = async (
  $: cheerio.Root,
  keyword: string,
  baseUrl: string,
  additionalKeywords: string[] = []
): Promise<boolean> => {
  const scripts = $('script[src]');
  const limit = pLimit(5);
  const scriptContents = await Promise.all(
    scripts
      .toArray()
      .map((script) => {
        const src = $(script).attr('src');
        if (src) {
          const absoluteUrl = new URL(src, baseUrl).href;
          return limit(async () => {
            try {
              const { data } = await axios.get(absoluteUrl);
              return (
                data.includes(keyword) ||
                additionalKeywords.some((kw) => data.includes(kw))
              );
            } catch (error) {
              console.error(`Error fetching script ${absoluteUrl}:`, error);
              return false;
            }
          });
        }
        return false;
      })
  );
  return scriptContents.some((result) => result);
};

const containsTailwindClasses = ($: cheerio.Root): boolean => {
  const tailwindClassPattern =
    /\b(bg-(red|blue|green|yellow|indigo|purple|pink|gray|white|black|transparent|current)-(50|100|200|300|400|500|600|700|800|900)|text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl|left|center|right|justify|opacity-\d{1,3})|rounded(-\w+)?|shadow(-\w+)?|p-\d+|m-\d+|w-\d\/\d|h-\d+|inline-flex|flex|flex-(row|col)|items-(start|end|center|baseline|stretch)|justify-(start|end|center|between|around|evenly)|gap-\d+|space-(x|y)-\d+)\b/;

  const matchesTailwindClass = $('[class]')
    .toArray()
    .some((el) => {
      const classList = $(el).attr('class') || '';
      const tailwindMatches = classList.match(tailwindClassPattern);
      return tailwindMatches !== null && tailwindMatches.length > 0;
    });

  const tailwindCss = $('link[href*="tailwind.css"], link[href*="tailwind.min.css"]').length > 0;

  const conditions = [matchesTailwindClass, tailwindCss];
  const trueConditions = conditions.filter(Boolean).length;

  return trueConditions >= 2;
};

const containsBootstrap = ($: cheerio.Root): boolean => {
  const bootstrapClassPattern =
    /\b((col-(xs|sm|md|lg|xl|xxl)-\d+)|(btn-(primary|secondary|success|danger|warning|info|light|dark|link))|navbar|breadcrumb|carousel|collapse|dropdown|modal|alert|badge|spinner|progress|toast|tooltip|jumbotron|pagination|popover|d-(none|inline|block|flex|grid|table)|justify-content-(start|end|center|between|around)|align-items-(start|end|center|stretch))\b/;

  const matchesBootstrapClass = $('[class]')
    .toArray()
    .some((el) => {
      const classList = $(el).attr('class') || '';
      const bootstrapMatches = classList.match(bootstrapClassPattern);
      return bootstrapMatches !== null && bootstrapMatches.length > 0;
    });

  const bootstrapCss = $('link[href*="bootstrap.min.css"], link[href*="bootstrap.css"]').length > 0;
  const bootstrapJs = $('script[src*="bootstrap.min.js"], script[src*="bootstrap.js"]').length > 0;

  const conditions = [matchesBootstrapClass, bootstrapCss, bootstrapJs];
  const trueConditions = conditions.filter(Boolean).length;

  return trueConditions >= 2;
};

const containsBulma = ($: cheerio.Root): boolean => {
  const bulmaCss = $('link[href*="bulma.css"], link[href*="bulma.min.css"]').length > 0;

  const bulmaClassPattern = /\b(container|notification|button|columns|column|is-\w+|has-\w+)\b/;

  const matchesBulmaClass = $('[class]')
    .toArray()
    .some((el) => {
      const classList = $(el).attr('class') || '';
      const bulmaMatches = classList.match(bulmaClassPattern);
      return bulmaMatches !== null && bulmaMatches.length > 0;
    });

  const conditions = [bulmaCss, matchesBulmaClass];
  const trueConditions = conditions.filter(Boolean).length;

  return trueConditions >= 2;
};

const containsFoundation = ($: cheerio.Root): boolean => {
  const foundationCss = $('link[href*="foundation.css"], link[href*="foundation.min.css"]').length > 0;

  const foundationClassPattern = /\b(row|column|columns|button|alert-box|radius|round|has-\w+)\b/;

  const matchesFoundationClass = $('[class]')
    .toArray()
    .some((el) => {
      const classList = $(el).attr('class') || '';
      const foundationMatches = classList.match(foundationClassPattern);
      return foundationMatches !== null && foundationMatches.length > 0;
    });

  const conditions = [foundationCss, matchesFoundationClass];
  const trueConditions = conditions.filter(Boolean).length;

  return trueConditions >= 2;
};

const containsNextJs = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const scripts = $('script[src*="/_next/static/"]');
  const inlineScripts = $('script').filter(
    (i, el) => $(el).html()?.includes('__NEXT_DATA__') ?? false
  );
  const isNextScriptPresent = scripts.length > 0 || inlineScripts.length > 0;
  const isNextScriptContentPresent = await containsInScripts($, '/_next/static/', baseUrl);

  const hasNextData = $('script#__NEXT_DATA__').length > 0;

  const conditions = [isNextScriptPresent, isNextScriptContentPresent, hasNextData];
  const trueConditions = conditions.filter(Boolean).length;

  return trueConditions >= 2;
};

const containsReact = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const hasDataReactAttribute = $('[data-reactroot], [data-reactid]').length > 0;

  const reactScripts = $('script[src*="react"], script[src*="react-dom"]');
  const isReactScriptPresent = reactScripts.length > 0;

  const inlineReactScripts = $('script').filter((i, el) => {
    const scriptContent = $(el).html() || '';
    return (
      scriptContent.includes('React.createElement') ||
      scriptContent.includes('react.production.min.js')
    );
  });
  const isInlineReactPresent = inlineReactScripts.length > 0;

  const isReactScriptContentPresent = await containsInScripts(
    $,
    'React.createElement',
    baseUrl,
    ['react.production.min.js', '@license React', 'reactjs.org']
  );

  const hasBlankRootDiv = $('div#root').length > 0 && ($('div#root').html()?.trim() || '') === '';

  const conditions = [
    hasDataReactAttribute,
    isReactScriptPresent,
    isInlineReactPresent,
    isReactScriptContentPresent,
    hasBlankRootDiv,
  ];
  const trueConditions = conditions.filter(Boolean).length;

  return trueConditions >= 2;
};


const containsVue = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const vueScripts = $('script[src*="vue"], script[src*="vue-router"]');
  const isVueScriptPresent = vueScripts.length > 0;

  const inlineVueScripts = $('script').filter((i, el) => {
    const scriptContent = $(el).html() || '';
    return scriptContent.includes('new Vue(') || scriptContent.includes('Vue.component');
  });
  const isInlineVuePresent = inlineVueScripts.length > 0;

  const hasDataVAttributes = $('[data-v-]').length > 0;

  const isVueScriptContentPresent = await containsInScripts(
    $,
    'Vue.component',
    baseUrl,
    ['Vue.config', 'vuejs.org']
  );

  const conditions = [
    isVueScriptPresent,
    isInlineVuePresent,
    hasDataVAttributes,
    isVueScriptContentPresent,
  ];
  const trueConditions = conditions.filter(Boolean).length;

  return trueConditions >= 2;
};

const containsNuxtJs = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const nuxtScripts = $('script[src*="/_nuxt/"]');
  const isNuxtScriptPresent = nuxtScripts.length > 0;

  const inlineNuxtScripts = $('script').filter(
    (i, el) => $(el).html()?.includes('nuxt.config.js') ?? false
  );
  const isInlineNuxtPresent = inlineNuxtScripts.length > 0;

  const isNuxtScriptContentPresent = await containsInScripts($, '/_nuxt/', baseUrl);

  const hasNuxtData = $('script#nuxt-config').length > 0;

  const conditions = [isNuxtScriptPresent, isInlineNuxtPresent, isNuxtScriptContentPresent, hasNuxtData];
  const trueConditions = conditions.filter(Boolean).length;

  return trueConditions >= 2;
};

const containsAngular = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const angularScripts = $('script[src*="main.js"], script[src*="polyfills.js"]');
  const hasNgApp = $('[ng-app]').length > 0;
  const isAngularScriptContentPresent = await containsInScripts(
    $,
    'platformBrowserDynamic',
    baseUrl,
    ['@angular']
  );

  const conditions = [angularScripts.length > 0, hasNgApp, isAngularScriptContentPresent];
  const trueConditions = conditions.filter(Boolean).length;

  return trueConditions >= 2;
};

const containsPolymer = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const polymerScripts = $('script[src*="polymer"]');
  const hasPolymerElements = $('[is]').length > 0;

  const inlinePolymerScripts = $('script').filter((i, el) => {
    const scriptContent = $(el).html() || '';
    return scriptContent.includes('Polymer') && scriptContent.includes('customElements');
  });
  const isInlinePolymerPresent = inlinePolymerScripts.length > 0;

  const isPolymerScriptContentPresent = await containsInScripts(
    $,
    'Polymer',
    baseUrl,
    ['polymer-project.org', 'webcomponentsjs']
  );

  const conditions = [
    polymerScripts.length > 0,
    hasPolymerElements,
    isInlinePolymerPresent,
    isPolymerScriptContentPresent,
  ];
  const trueConditions = conditions.filter(Boolean).length;

  return trueConditions >= 2;
};

const containsGatsby = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const gatsbyScripts = $('script[src*="/gatsby"], script[src*="webpack-runtime"]');
  const isGatsbyScriptPresent = gatsbyScripts.length > 0;

  const inlineGatsbyScripts = $('script').filter(
    (i, el) => $(el).html()?.includes('gatsby') ?? false
  );
  const isInlineGatsbyPresent = inlineGatsbyScripts.length > 0;

  const isGatsbyScriptContentPresent = await containsInScripts($, 'gatsby', baseUrl);

  const hasGatsbyData = $('link[rel="gatsby"]').length > 0;

  const conditions = [
    isGatsbyScriptPresent,
    isInlineGatsbyPresent,
    isGatsbyScriptContentPresent,
    hasGatsbyData,
  ];
  const trueConditions = conditions.filter(Boolean).length;

  return trueConditions >= 2;
};

const containsSvelte = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const svelteScripts = $('script[src*="svelte"]');
  const isSvelteScriptPresent = svelteScripts.length > 0;

  const inlineSvelteScripts = $('script').filter(
    (i, el) => $(el).html()?.includes('SvelteComponent') ?? false
  );
  const isInlineSveltePresent = inlineSvelteScripts.length > 0;

  const isSvelteScriptContentPresent = await containsInScripts($, 'SvelteComponent', baseUrl);

  const hasSvelteData = $('svelte-head').length > 0;

  const conditions = [
    isSvelteScriptPresent,
    isInlineSveltePresent,
    isSvelteScriptContentPresent,
    hasSvelteData,
  ];
  const trueConditions = conditions.filter(Boolean).length;

  return trueConditions >= 2;
};

const containsEmber = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const emberScripts = $(
    'script[src*="ember"], script[src*="ember.debug"], script[src*="ember.prod"]'
  );
  const isEmberScriptPresent = emberScripts.length > 0;

  const inlineEmberScripts = $('script').filter((i, el) =>
    $(el).html()?.includes('Ember.Application.create') ?? false
  );
  const isInlineEmberPresent = inlineEmberScripts.length > 0;

  const isEmberScriptContentPresent = await containsInScripts(
    $,
    'Ember.Application.create',
    baseUrl
  );

  const hasEmberData = $('[id^="ember"]').length > 0;

  const conditions = [
    isEmberScriptPresent,
    isInlineEmberPresent,
    isEmberScriptContentPresent,
    hasEmberData,
  ];
  const trueConditions = conditions.filter(Boolean).length;

  return trueConditions >= 2;
};

const containsMaterialUI = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const muiScripts = $(
    'script[src*="material-ui"], script[src*="mui"], script[src*="MuiSvgIcon"], script[src*="muiName"]'
  );
  const isMUIScriptPresent = muiScripts.length > 0;

  const isMUIScriptContentPresent = await containsInScripts(
    $,
    '@mui',
    baseUrl,
    ['MuiSvgIcon', 'muiName']
  );

  const hasMuiClasses = $('[class*="Mui"]').length > 0;

  const conditions = [isMUIScriptPresent, isMUIScriptContentPresent, hasMuiClasses];
  const trueConditions = conditions.filter(Boolean).length;

  return trueConditions >= 2;
};

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        },
      });
      const headers = Object.fromEntries(
        Object.entries(response.headers).map(([key, value]) => [key, value?.toString() || ''])
      );
      const techStack = await detectTechStack(response.data, headers, url);

      return NextResponse.json(techStack, { status: 200 });
    } catch (error) {
      console.error('Error fetching the URL:', error);
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        return NextResponse.json(
          { error: 'Access to the URL is forbidden (403).' },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: 'Error analyzing the website' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error parsing request body:', error);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
