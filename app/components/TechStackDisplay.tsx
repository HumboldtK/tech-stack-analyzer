import React from 'react';

interface TechStackProps {
  techStack: {
    cms?: string;
    javascriptFrameworks?: string[];
    cssFrameworks?: string[];
    server?: string;
    webServer?: string;
    analytics?: string[];
    buildTools?: string[];
    compression?: string[];
    isWordPress?: boolean;
  };
}

const TechStackDisplay: React.FC<TechStackProps> = ({ techStack }) => {
  return (
    <div className="p-4 border rounded bg-white shadow-lg text-black">
      <h2 className="text-2xl font-semibold mb-4 text-center">Detected Tech Stacks</h2>
      <div className="space-y-2">
        {techStack.cms && (
          <div>
            <strong>CMS:</strong> {techStack.cms}
          </div>
        )}
        {!techStack.isWordPress && techStack.javascriptFrameworks && (
          <div>
            <strong>JavaScript Frameworks:</strong> {techStack.javascriptFrameworks.join(', ')}
          </div>
        )}
        {!techStack.isWordPress && techStack.cssFrameworks && (
          <div>
            <strong>CSS Frameworks:</strong> {techStack.cssFrameworks.join(', ')}
          </div>
        )}
        {techStack.analytics && (
          <div>
            <strong>Analytics:</strong> {techStack.analytics.join(', ')}
          </div>
        )}
        {techStack.server && (
          <div>
            <strong>Server:</strong> {techStack.server}
          </div>
        )}
        {techStack.webServer && (
          <div>
            <strong>Web Server:</strong> {techStack.webServer}
          </div>
        )}
        {techStack.buildTools && (
          <div>
            <strong>Build Tools:</strong> {techStack.buildTools.join(', ')}
          </div>
        )}
        {techStack.compression && (
          <div>
            <strong>Compression:</strong> {techStack.compression.join(', ')}
          </div>
        )}
      </div>
    </div>
  );
};

export default TechStackDisplay;
