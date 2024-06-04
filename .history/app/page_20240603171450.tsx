'use client';

import { useState } from 'react';
import Loading from './loading';

export default function Home() {
  const [url, setUrl] = useState('');
  const [techStack, setTechStack] = useState(null);
  const [loading, setLoading] = useState(false);

  const analyzeTechStack = async () => {
    setLoading(true);
    const response = await fetch('/api/index', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });
    const data = await response.json();
    setTechStack(data);
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <h1 className="text-4xl font-bold mb-8">Tech Stack Analyzer</h1>
      <div className="flex flex-col items-center">
        <input
          className="mb-4 px-4 py-2 border rounded w-96 text-black"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter website URL"
        />
        <button
          className="px-6 py-2 bg-blue-600 text-white rounded"
          onClick={analyzeTechStack}
        >
          Analyze
        </button>
      </div>
      {loading ? (
        <Loading />
      ) : (
        techStack && (
          <div className="mt-8 p-4 border rounded bg-gray-100 w-96">
            <h2 className="text-2xl font-semibold mb-4">Detected Tech Stack:</h2>
            <pre className="bg-gray-800 text-white p-4 rounded">{JSON.stringify(techStack, null, 2)}</pre>
          </div>
        )
      )}
    </div>
  );
}
