import React from 'react';

interface TechStackProps {
  techStack: {
    cms?: string;
    javascriptFrameworks?: string[];
    cssFrameworks?: string[];
    server?: string;
    webServer?: string;
    analytics?: string[];
  };
}

const TechStackDisplay: React.FC<TechStackProps> = ({ techStack }) => {
  return (
    <div className="p-4 border rounded bg-white shadow-lg text-black">
      <h2 className="text-2xl font-semibold mb-4 text-center">Detected Tech Stack</h2>
      <div className="space-y-2">
        <div>
          <strong>CMS:</strong> {techStack.cms || 'Unknown'}
        </div>
        <div>
          <strong>JavaScript Frameworks:</strong> {techStack.javascriptFrameworks?.join(', ') || 'Unknown'}
        </div>
        <div>
          <strong>CSS Frameworks:</strong> {techStack.cssFrameworks?.join(', ') || 'Unknown'}
        </div>
        <div>
          <strong>Analytics:</strong> {techStack.analytics?.join(', ') || 'Unknown'}
        </div>
        <div>
          <strong>Server:</strong> {techStack.server || 'Unknown'}
        </div>
        <div>
          <strong>Web Server:</strong> {techStack.webServer || 'Unknown'}
        </div>
      </div>
    </div>
  );
};

export default TechStackDisplay;
