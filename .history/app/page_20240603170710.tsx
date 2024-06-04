import { useState } from 'react';


export default function Home() {
  const [url, setUrl] = useState('');
  const [techStack, setTechStack] = useState(null);

  const analyzeTechStack = async () => {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });
    const data = await response.json();
    setTechStack(data);
  };

  return (
    <div>
      <h1>Tech Stack Analyzer</h1>
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Enter website URL"
      />
      <button onClick={analyzeTechStack}>Analyze</button>
      {techStack && (
        <div>
          <h2>Detected Tech Stack:</h2>
          <pre>{JSON.stringify(techStack, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
