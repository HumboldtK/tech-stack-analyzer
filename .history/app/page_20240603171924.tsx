'use client';

import { useState } from 'react';
import Loading from './loading';

export default function Home() {
  const [url, setUrl] = useState('');
  const [techStack, setTechStack] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const analyzeTechStack = async () => {
    if (!url) return;

    setLoading(true);
    setError('');
    setTechStack(null);
    try {
      const response = await fetch('/api/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setTechStack(data);
    } catch (error) {
      setError('Failed to analyze the website. Please check the URL and try again.');
      console.error('Error analyzing tech stack:', error);
    }
    setLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      analyzeTechStack();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-gray-50">
      <h1 className="text-4xl font-bold mb-8 text-center">Tech Stack Analyzer</h1>
      <div className="flex flex-col items-center">
        <input
          className="mb-4 px-4 py-2 border rounded w-96 text-black"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Enter website URL"
        />
        <button
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={analyzeTechStack}
        >
          Analyze
        </button>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <div className="mt-8 p-4 border rounded bg-red-100 text-red-700 w-96">
          {error}
        </div>
      ) : (
        techStack && (
          <div className="mt-8 p-4 border rounded bg-white shadow-lg w-96">
            <h2 className="text-2xl font-semibold mb-4 text-center">Detected Tech Stack:</h2>
            <pre className="bg-gray-800 text-white p-4 rounded">{JSON.stringify(techStack, null, 2)}</pre>
          </div>
        )
      )}
    </div>
  );
}
