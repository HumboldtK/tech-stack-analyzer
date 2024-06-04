import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import cheerio from 'cheerio';

interface TechStack {
  cms?: string;
  javascriptFrameworks?: string[];
  cssFrameworks?: string[];
  server?: string;
  webServer?: string;
}

const detectTechStack = (html: string, headers: Record<string, string>): TechStack => {
  const $ = cheerio.load(html);
  const techStack: TechStack = {};

  // Detecting CMS
  if ($('meta[name="generator"]').attr('content')) {
    techStack.cms = $('meta[name="generator"]').attr('content');
  }

  // Detecting JavaScript frameworks
  if (html.includes('react')) {
    techStack.javascriptFrameworks = techStack.javascriptFrameworks || [];
    techStack.javascriptFrameworks.push('React');
  }
  if (html.includes('vue')) {
    techStack.javascriptFrameworks = techStack.javascriptFrameworks || [];
    techStack.javascriptFrameworks.push('Vue');
  }
  if (html.includes('angular')) {
    techStack.javascriptFrameworks = techStack.javascriptFrameworks || [];
    techStack.javascriptFrameworks.push('Angular');
  }

  // Detecting CSS frameworks
  if (html.includes('bootstrap')) {
    techStack.cssFrameworks = techStack.cssFrameworks || [];
    techStack.cssFrameworks.push('Bootstrap');
  }
  if (html.includes('tailwind')) {
    techStack.cssFrameworks = techStack.cssFrameworks || [];
    techStack.cssFrameworks.push('Tailwind CSS');
  }

  // Detecting Server
  if (headers['server']) {
    techStack.server = headers['server'];
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
      const response = await axios.get(url);
      const headers = Object.fromEntries(
        Object.entries(response.headers).map(([key, value]) => [key, value?.toString() || ''])
      );
      const techStack = detectTechStack(response.data, headers);

      return NextResponse.json(techStack, { status: 200 });
    } catch (error) {
      console.error('Error fetching the URL:', error);
      return NextResponse.json({ error: 'Error analyzing the website' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error parsing request body:', error);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
