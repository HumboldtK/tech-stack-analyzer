import axios from 'axios';
import cheerio from 'cheerio';
import type { NextApiRequest, NextApiResponse } from 'next';

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

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).end(); // Method Not Allowed
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const response = await axios.get(url);
    const headers = Object.fromEntries(
      Object.entries(response.headers).map(([key, value]) => [key, value?.toString() || ''])
    );
    const techStack = detectTechStack(response.data, headers);

    res.status(200).json(techStack);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error analyzing the website' });
  }
};
