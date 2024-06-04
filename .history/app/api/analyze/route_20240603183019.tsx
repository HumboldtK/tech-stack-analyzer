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
}

const serverHeaderMap: Record<string, string> = {
  'gws': 'Google Web Server',
  'apache': 'Apache HTTP Server',
  'nginx': 'NGINX',
  'cloudflare': 'Cloudflare',
  'iis': 'Microsoft IIS',
  'next.js': 'Next.js',
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
  if (containsReact($) || await containsInScripts($, 'react', baseUrl, ['react-dom.production.min.js', '@license React', 'reactjs.org'])) jsFrameworks.add('React.js');
  if (containsVue($)) jsFrameworks.add('Vue');
  if (containsAngular($)) jsFrameworks.add('Angular');
  if (containsNextJs($) || await containsInScripts($, '_next/static/', baseUrl)) jsFrameworks.add('Next.js');
  if (containsGatsby($) || await containsInScripts($, 'gatsby', baseUrl)) jsFrameworks.add('Gatsby');
  if (containsSvelte($) || await containsInScripts($, 'svelte', baseUrl)) jsFrameworks.add('Svelte');
  if (jsFrameworks.size > 0) techStack.javascriptFrameworks = Array.from(jsFrameworks);

  // Detecting CSS frameworks
  const cssFrameworks = [];
  if (html.includes('bootstrap')) cssFrameworks.push('Bootstrap');
  if (containsTailwindClasses($)) cssFrameworks.push('Tailwind CSS');
  if (html.includes('bulma')) cssFrameworks.push('Bulma');
  if (html.includes('foundation')) cssFrameworks.push('Foundation');
  if (cssFrameworks.length > 0) techStack.cssFrameworks = cssFrameworks;

  // Detecting Analytics
  const analytics = [];
  if (html.includes('google-analytics.com') || await containsInScripts($, 'google-analytics', baseUrl)) analytics.push('Google Analytics');
  if (html.includes('gtag') || await containsInScripts($, 'gtag', baseUrl)) analytics.push('Google Tag Manager');
  if (html.includes('matomo') || await containsInScripts($, 'matomo', baseUrl)) analytics.push('Matomo');
  if (analytics.length > 0) techStack.analytics = analytics;

  // Detecting Server
  if (headers['server']) {
    techStack.server = serverHeaderMap[headers['server'].toLowerCase()] || headers['server'];
  }

  // Detecting Web Server
  if (headers['x-powered-by'] && !techStack.javascriptFrameworks?.includes('Next.js')) {
    techStack.webServer = headers['x-powered-by'];
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
  const classes = $('[class]').toArray().map(el => $(el).attr('class') || '');
  return classes.some(cls => /\b(tw-|flex|grid|container|bg|text|rounded|shadow)\b/.test(cls));
};

const containsNextJs = ($: cheerio.Root): boolean => {
  const scripts = $('script[src*="_next/static/"]');
  const inlineScripts = $('script').filter((i, el) => $(el).html()?.includes('next.config.js') ?? false);
  return scripts.length > 0 || inlineScripts.length > 0;
};

const containsReact = ($: cheerio.Root): boolean => {
  const dataReact = $('[data-reactroot], [data-reactid]');
  const reactScripts = $('script[src*="react"]');
  const inlineReactScripts = $('script').filter((i, el) => $(el).html()?.includes('React.createElement') ?? false);
  return dataReact.length > 0 || reactScripts.length > 0 || inlineReactScripts.length > 0;
};


const containsVue = ($: cheerio.Root): boolean => {
  return $('div[id="app"], template').length > 0 || $('script[src*="vue"]').length > 0;
};

const containsAngular = ($: cheerio.Root): boolean => {
  return $('script[src*="angular"]').length > 0;
};

const containsGatsby = ($: cheerio.Root): boolean => {
  return $('script[src*="gatsby"]').length > 0;
};

const containsSvelte = ($: cheerio.Root): boolean => {
  return $('script[src*="svelte"]').length > 0;
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
