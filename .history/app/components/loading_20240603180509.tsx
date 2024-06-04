import React from 'react';

const Loading: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-24">
      <div className="animate-spin inline-block w-8 h-8 border-4 border-t-4 border-t-blue-600 border-blue-200 rounded-full" role="status">
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
};

export default Loading;
