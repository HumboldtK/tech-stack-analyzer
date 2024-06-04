import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import cheerio from 'cheerio';

interface TechStack {
  cms?: string;
  javascriptFrameworks?: string[];
  cssFrameworks?: string[];
  server?: string;
  webServer?: string;
  analytics?: string[];
  buildTools?: string[];
  compression?: string[];
}

const serverHeaderMap: Record<string, string> = {
  'gws': 'Google Web Server',
  'apache': 'Apache HTTP Server',
  'nginx': 'NGINX',
  'cloudflare': 'Cloudflare',
  'iis': 'Microsoft IIS',
  'next.js': 'Next.js',
  'express': 'Express.js',
  'php': 'PHP',
  'envoy': 'Envoy',
  'esf': 'Google Frontend Server'
};

const detectTechStack = async (html: string, headers: Record<string, string>, baseUrl: string): Promise<TechStack> => {
  const $ = cheerio.load(html);
  const techStack: TechStack = {};

  // Detecting CMS
  const generatorContent = $('meta[name="generator"]').attr('content');
  if (generatorContent) {
    techStack.cms = generatorContent;
  }

  // Detecting JavaScript frameworks
  const jsFrameworks = new Set<string>();
  if (await containsReact($, baseUrl)) jsFrameworks.add('React');
  if (await containsVue($, baseUrl)) jsFrameworks.add('Vue.js');
  if (await containsAngular($, baseUrl)) jsFrameworks.add('Angular');
  if (await containsNextJs($, baseUrl)) jsFrameworks.add('Next.js');
  if (await containsGatsby($, baseUrl)) jsFrameworks.add('Gatsby');
  if (await containsSvelte($, baseUrl)) jsFrameworks.add('Svelte');
  if (await containsEmber($, baseUrl)) jsFrameworks.add('Ember.js');
  if (await containsNuxtJs($, baseUrl)) jsFrameworks.add('Nuxt.js');
  if (await containsPolymer($, baseUrl)) jsFrameworks.add('Polymer');
  if (jsFrameworks.size > 0) techStack.javascriptFrameworks = Array.from(jsFrameworks);

  // Detecting CSS frameworks
  const cssFrameworks = [];
  if (containsBootstrap($)) cssFrameworks.push('Bootstrap');
  if (containsTailwindClasses($)) cssFrameworks.push('Tailwind CSS');
  if (html.includes('bulma')) cssFrameworks.push('Bulma');
  if (html.includes('foundation')) cssFrameworks.push('Foundation');
  if (cssFrameworks.length > 0) techStack.cssFrameworks = cssFrameworks;

  // Detecting Analytics
  const analytics = [];
  if (html.includes('google-analytics.com') || await containsInScripts($, 'google-analytics', baseUrl)) analytics.push('Google Analytics');
  if (html.includes('gtag') || await containsInScripts($, 'gtag', baseUrl)) analytics.push('Google Tag Manager');
  if (html.includes('matomo') || await containsInScripts($, 'matomo', baseUrl)) analytics.push('Matomo');
  if (html.includes('plausible.io') || await containsInScripts($, 'plausible', baseUrl)) analytics.push('Plausible');
  if (analytics.length > 0) techStack.analytics = analytics;

  // Detecting Build Tools
  const buildTools = new Set<string>();
  if (html.includes('webpack')) buildTools.add('Webpack');
  if (await containsInScripts($, 'webpack', baseUrl)) buildTools.add('Webpack');
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
    if (!techStack.javascriptFrameworks?.includes('Next.js') && !techStack.javascriptFrameworks?.includes('Nuxt.js')) {
      techStack.webServer = headers['x-powered-by'];
    } else if (xPoweredBy.includes('next.js') && !techStack.javascriptFrameworks?.includes('Next.js')) {
      techStack.javascriptFrameworks?.push('Next.js');
    } else if (xPoweredBy.includes('nuxt.js') && !techStack.javascriptFrameworks?.includes('Nuxt.js')) {
      techStack.javascriptFrameworks?.push('Nuxt.js');
    }
  }

  return techStack;
};

const containsInScripts = async ($: cheerio.Root, keyword: string, baseUrl: string, additionalKeywords: string[] = []): Promise<boolean> => {
  const scripts = $('script[src]');
  for (const script of scripts.toArray()) {
    const src = $(script).attr('src');
    if (src) {
      const absoluteUrl = new URL(src, baseUrl).href;
      try {
        const { data } = await axios.get(absoluteUrl);
        if (data.includes(keyword) || additionalKeywords.some(kw => data.includes(kw))) {
          return true;
        }
      } catch (error) {
        console.error(`Error fetching script ${absoluteUrl}:`, error);
      }
    }
  }
  return false;
};

const containsTailwindClasses = ($: cheerio.Root): boolean => {
  const tailwindClassPattern = /\b(tw-[\w-]+|bg-(red|blue|green|yellow|indigo|purple|pink|gray|white|black|transparent|current)-\d{2,3}|text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl|left|center|right|justify|opacity-\d{1,3})|rounded(-\w+)?|shadow(-\w+)?|p-\d|m-\d|w-\d|h-\d|inline-flex|grid-cols-\d+|gap-\d+|space-(x|y)-\d+|justify-(start|end|center|between|around|evenly)|items-(start|end|center|baseline|stretch))\b/;

  return $('[class]').toArray().some(el => {
    const classList = $(el).attr('class') || '';
    const tailwindMatches = classList.match(tailwindClassPattern);
    return tailwindMatches && tailwindMatches.length > 1;
  });
};

const containsBootstrap = ($: cheerio.Root): boolean => {
  const bootstrapClassPattern = /\b(container|row|col|btn|card|alert|badge|breadcrumb|carousel|collapse|dropdown|form|input|modal|nav|navbar|pagination|popover|progress|spinner|toast|tooltip|jumbotron|text-center|d-flex|justify-content-between|align-items-center)\b/;

  return $('[class]').toArray().some(el => {
    const classList = $(el).attr('class') || '';
    const bootstrapMatches = classList.match(bootstrapClassPattern);
    return bootstrapMatches && bootstrapMatches.length > 1;
  });
};

const containsNextJs = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const scripts = $('script[src*="/_next/static/"]');
  const inlineScripts = $('script').filter((i, el) => $(el).html()?.includes('next.config.js') ?? false);
  const isNextScriptPresent = scripts.length > 0 || inlineScripts.length > 0;
  const isNextScriptContentPresent = await containsInScripts($, '/_next/static/', baseUrl);
  return isNextScriptPresent || isNextScriptContentPresent;
};

const containsReact = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const reactScripts = $('script[src*="/react"], script[src*="/react-dom"]');
  const inlineReactScripts = $('script').filter((i, el) => $(el).html()?.includes('React.createElement') ?? false);
  const isReactScriptPresent = reactScripts.length > 0 || inlineReactScripts.length > 0;
  const isReactScriptContentPresent = await containsInScripts($, '/react', baseUrl, ['react-dom.production.min.js', '@license React', 'reactjs.org']);
  return isReactScriptPresent || isReactScriptContentPresent;
};

const containsVue = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const vueScripts = $('script[src*="/vue"], script[src*="/vue-router"]');
  const inlineVueScripts = $('script').filter((i, el) => $(el).html()?.includes('Vue.component') ?? false);
  const isVueScriptPresent = vueScripts.length > 0 || inlineVueScripts.length > 0;
  const isVueScriptContentPresent = await containsInScripts($, '/vue', baseUrl, ['Vue.config', 'vuejs.org']);
  return isVueScriptPresent || isVueScriptContentPresent;
};

const containsNuxtJs = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const nuxtScripts = $('script[src*="/_nuxt/"]');
  const inlineNuxtScripts = $('script').filter((i, el) => $(el).html()?.includes('nuxt.config.js') ?? false);
  const isNuxtScriptPresent = nuxtScripts.length > 0 || inlineNuxtScripts.length > 0;
  const isNuxtScriptContentPresent = await containsInScripts($, '/_nuxt/', baseUrl);
  return isNuxtScriptPresent || isNuxtScriptContentPresent;
};

const containsAngular = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const angularSelectors = [
    'script[src*="angular"]',
    'script[src*="@angular"]',
    'script:contains("ngVersion")'
  ];

  const isAngularScriptPresent = angularSelectors.some(selector => $(selector).length > 0);
  if (isAngularScriptPresent) {
    return true;
  }

  const additionalKeywords = ['platformBrowserDynamic', 'angular.io'];
  const isAngularScriptContentPresent = await containsInScripts($, 'angsular', baseUrl, additionalKeywords);

  return isAngularScriptContentPresent;
};

const containsPolymer = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const polymerScripts = $('script[src*="polymer"]');
  const inlinePolymerScripts = $('script').filter((i, el) => {
    const scriptContent = $(el).html();
    return scriptContent ? scriptContent.includes('Polymer') : false;
  });

  const isPolymerScriptPresent = polymerScripts.length > 0 || inlinePolymerScripts.length > 0;
  if (isPolymerScriptPresent) {
    return true;
  }

  const isPolymerScriptContentPresent = await containsInScripts($, 'polymer', baseUrl, ['polymer-project.org', 'webcomponentsjs']);
  
  return isPolymerScriptPresent || isPolymerScriptContentPresent;
};

const containsGatsby = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const gatsbyScripts = $('script[src*="/gatsby"]');
  const inlineGatsbyScripts = $('script').filter((i, el) => $(el).html()?.includes('gatsby') ?? false);
  const isGatsbyScriptPresent = gatsbyScripts.length > 0 || inlineGatsbyScripts.length > 0;
  const isGatsbyScriptContentPresent = await containsInScripts($, '/gatsby', baseUrl);
  return isGatsbyScriptPresent || isGatsbyScriptContentPresent;
};

const containsSvelte = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const svelteScripts = $('script[src*="/svelte"]');
  const inlineSvelteScripts = $('script').filter((i, el) => $(el).html()?.includes('Svelte') ?? false);
  const isSvelteScriptPresent = svelteScripts.length > 0 || inlineSvelteScripts.length > 0;
  const isSvelteScriptContentPresent = await containsInScripts($, '/svelte', baseUrl);
  return isSvelteScriptPresent || isSvelteScriptContentPresent;
};

const containsEmber = async ($: cheerio.Root, baseUrl: string): Promise<boolean> => {
  const emberScripts = $('script[src*="/ember"], script[src*="/ember.debug"], script[src*="/ember.prod"]');
  const inlineEmberScripts = $('script').filter((i, el) => $(el).html()?.includes('Ember.Application.create') ?? false);
  const isEmberScriptPresent = emberScripts.length > 0 || inlineEmberScripts.length > 0;
  const isEmberScriptContentPresent = await containsInScripts($, '/ember', baseUrl, ['Ember.Application.create']);
  return isEmberScriptPresent || isEmberScriptContentPresent;
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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      const headers = Object.fromEntries(
        Object.entries(response.headers).map(([key, value]) => [key, value?.toString() || ''])
      );
      const techStack = await detectTechStack(response.data, headers, url);

      return NextResponse.json(techStack, { status: 200 });
    } catch (error) {
      console.error('Error fetching the URL:', error);
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        return NextResponse.json({ error: 'Access to the URL is forbidden (403).' }, { status: 403 });
      }
      return NextResponse.json({ error: 'Error analyzing the website' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error parsing request body:', error);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
