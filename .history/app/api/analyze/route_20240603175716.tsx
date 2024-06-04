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
};

const detectTechStack = (html: string, headers: Record<string, string>): TechStack => {
  const $ = cheerio.load(html);
  const techStack: TechStack = {};

  // Detecting CMS
  const generatorContent = $('meta[name="generator"]').attr('content');
  if (generatorContent) {
    techStack.cms = generatorContent;
  }

  // Detecting JavaScript frameworks
  const jsFrameworks = [];
  if (html.includes('react')) jsFrameworks.push('React');
  if (html.includes('vue')) jsFrameworks.push('Vue');
  if (html.includes('angular')) jsFrameworks.push('Angular');
  if (html.includes('next')) jsFrameworks.push('Next.js');
  if (html.includes('gatsby')) jsFrameworks.push('Gatsby');
  if (jsFrameworks.length > 0) techStack.javascriptFrameworks = jsFrameworks;

  // Detecting CSS frameworks
  const cssFrameworks = [];
  if (html.includes('bootstrap')) cssFrameworks.push('Bootstrap');
  if (html.includes('tailwind')) cssFrameworks.push('Tailwind CSS');
  if (html.includes('bulma')) cssFrameworks.push('Bulma');
  if (cssFrameworks.length > 0) techStack.cssFrameworks = cssFrameworks;

  // Detecting Analytics
  const analytics = [];
  if (html.includes('google-analytics.com')) analytics.push('Google Analytics');
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
      const techStack = detectTechStack(response.data, headers);

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
