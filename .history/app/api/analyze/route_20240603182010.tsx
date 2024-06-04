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
  if (html.includes('react') || await containsInScripts($, 'react', baseUrl)) jsFrameworks.add('React');
  if (html.includes('vue') || await containsInScripts($, 'vue', baseUrl)) jsFrameworks.add('Vue');
  if (html.includes('angular') || await containsInScripts($, 'angular', baseUrl)) jsFrameworks.add('Angular');
  if (containsNextJs($) || await containsInScripts($, 'next', baseUrl)) jsFrameworks.add('Next.js');
  if (html.includes('gatsby') || await containsInScripts($, 'gatsby', baseUrl)) jsFrameworks.add('Gatsby');
  if (html.includes('svelte') || await containsInScripts($, 'svelte', baseUrl)) jsFrameworks.add('Svelte');
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
  if (headers['x-powered-by']) {
    techStack.webServer = headers['x-powered-by'];
  }

  return techStack;
};

const containsInScripts = async ($: cheerio.Root, keyword: string, baseUrl: string): Promise<boolean> => {
  const scripts = $('script[src]');
  for (const script of scripts.toArray()) {
    const src = $(script).attr('src');
    if (src) {
      const absoluteUrl = new URL(src, baseUrl).href;
      try {
        const { data } = await axios.get(absoluteUrl);
        if (data.includes(keyword)) {
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
  return classes.some(cls => /\b(tw-|tailwind|flex|grid|container|bg|text|rounded|shadow)\b/.test(cls));
};

const containsNextJs = ($: cheerio.Root): boolean => {;
  const nextJsComment = $('html').html()?.includes('<!-- This is a generated file by Next.js -->') || false;
  return nextJsComment;
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
