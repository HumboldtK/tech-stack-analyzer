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
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [techStack, setTechStack] = useState<TechStack | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatUrl = (inputUrl: string) => {
    let formattedUrl = inputUrl;
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }
    return formattedUrl;
  };

  const analyzeTechStack = async () => {
    if (!url) {
      setError('Please enter a URL!');
      return;
    }
    setLoading(true);
    setError('');
    setTechStack(null);
    try {
      const formattedUrl = formatUrl(url);
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: formattedUrl }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: TechStack = await response.json();
      setTechStack(data);
    } catch (err) {
      const error = err as Error;
      if (error.message.includes('403')) {
        setError('Access to the URL is forbidden (403).');
      } else {
        setError('Failed to analyze the website. Please check the URL and try again.');
      }
      console.error('Error analyzing tech stack:', error);
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      analyzeTechStack();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-gray-50">
      <h1 className="text-4xl font-bold mb-8 text-center text-black select-none">Tech Stack Analyzer</h1>
      <div className="flex flex-col items-center">
        <input
          className="mb-4 px-4 py-2 border rounded w-96 text-black"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter website URL"
        />
        <button
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 select-none"
          onClick={analyzeTechStack}
        >
          Analyze
        </button>
      </div>
      <div className="mt-8 w-96">
        {loading ? (
          <Loading />
        ) : error ? (
          <div className="p-4 border rounded bg-red-100 text-red-700">
            {error}
          </div>
        ) : (
          techStack && <TechStackDisplay techStack={techStack} />
        )}
      </div>
    </div>
  );
}