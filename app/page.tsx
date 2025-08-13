'use client';

import { useState } from 'react';
import Loading from './components/loading';
import TechStackDisplay from './components/TechStackDisplay';

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

export default function Home() {
  const [url, setUrl] = useState('');
  const [techStack, setTechStack] = useState<TechStack | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatUrl = (inputUrl: string) => {
    let formattedUrl = inputUrl.trim();
    if (!formattedUrl) return '';
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }
    try {
      const u = new URL(formattedUrl);
      return u.href;
    } catch {
      return formattedUrl;
    }
  };

  const analyzeTechStack = async () => {
    const candidate = formatUrl(url);
    if (!candidate) {
      setError('Please enter a valid URL.');
      return;
    }
    setLoading(true);
    setError('');
    setTechStack(null);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: candidate }),
      });

      if (!response.ok) {
        if (response.status === 403) throw new Error('Access to the URL is forbidden (403).');
        const { error: serverError } = await response.json().catch(() => ({ error: '' }));
        throw new Error(serverError || `HTTP error! status: ${response.status}`);
      }

      const data: TechStack = await response.json();
      setTechStack(data);
    } catch (err) {
      const e = err as Error;
      setError(e.message || 'Failed to analyze the website. Please check the URL and try again.');
      console.error('Error analyzing tech stack:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') analyzeTechStack();
  };

  const exampleChips = [
  'https://nextjs.org',
  'https://react.dev',
  'https://wordpress.org',
];


  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white">
      <header className="py-10">
        <h1 className="text-5xl font-extrabold text-center tracking-tight text-gray-900 select-none">
          Tech Stack <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-fuchsia-600">Analyzer</span>
        </h1>
        <p className="mt-3 text-center text-gray-600">Paste a URL to sniff out the stack. No install needed.</p>
      </header>

      <main className="mx-auto max-w-3xl px-4">
        <div className="rounded-2xl border border-gray-200 bg-white/70 backdrop-blur p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 pr-28 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. example.com or https://example.com"
                aria-label="Website URL"
                autoFocus
              />
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <kbd className="hidden sm:inline-block rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-xs text-gray-600">Enter</kbd>
              </div>
            </div>
            <button
              className="rounded-xl px-6 py-3 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              onClick={analyzeTechStack}
              disabled={loading || !url.trim()}
            >
              {loading ? 'Analyzing…' : 'Analyze'}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">Try:</span>
            {exampleChips.map((chip) => (
              <button
                key={chip}
                onClick={() => setUrl(chip)}
                className="text-xs rounded-full border border-gray-200 px-3 py-1 text-gray-700 hover:bg-gray-50"
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <Loading />
                <p className="mt-2 text-sm text-gray-500">Fetching HTML, headers, and linked scripts…</p>
              </div>
            ) : error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                {error}
              </div>
            ) : techStack ? (
              <TechStackDisplay techStack={techStack} />
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-gray-500">
                Results will appear here.
              </div>
            )}
          </div>
        </div>

        <footer className="mt-10 text-center text-xs text-gray-500">
          This tool uses public HTML, headers, and script hints. It won’t log into sites or run JS.
        </footer>
      </main>
    </div>
  );
}