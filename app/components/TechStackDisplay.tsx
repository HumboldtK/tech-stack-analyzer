import React from 'react';

type MaybeArray = string[] | undefined;

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
    cdn?: string[];
    hosting?: string;
    payments?: string[];
    marketing?: string[];
    monitoring?: string[];
  };
}

const Badge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700">
    {children}
  </span>
);

const FieldRow: React.FC<{ label: string; value?: string | MaybeArray; hideIfEmpty?: boolean }> = ({
  label,
  value,
  hideIfEmpty = true,
}) => {
  if (hideIfEmpty && (!value || (Array.isArray(value) && value.length === 0))) return null;

  const content =
    Array.isArray(value) ? (
      <div className="flex flex-wrap gap-2">
        {value.map((v) => (
          <Badge key={v}>{v}</Badge>
        ))}
      </div>
    ) : (
      <Badge>{value}</Badge>
    );

  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-2">{content}</div>
    </div>
  );
};

const TechStackDisplay: React.FC<TechStackProps> = ({ techStack }) => {
  const isWP = !!techStack.isWordPress;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm text-gray-900">
      <h2 className="text-2xl font-bold text-center">Detected Tech</h2>
      <p className="mt-1 text-center text-sm text-gray-500">
        Based on HTML markers, headers, and script signatures.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <FieldRow label="CMS" value={techStack.cms} />

        {!isWP && <FieldRow label="JavaScript Frameworks" value={techStack.javascriptFrameworks} />}
        {!isWP && <FieldRow label="CSS Frameworks" value={techStack.cssFrameworks} />}

        <FieldRow label="Analytics" value={techStack.analytics} />
        <FieldRow label="Build Tools" value={techStack.buildTools} />
        <FieldRow label="Compression" value={techStack.compression} />
        <FieldRow label="Server" value={techStack.server} />
        <FieldRow label="Web Platform" value={techStack.webServer} />
        <FieldRow label="CDN" value={techStack.cdn} />
        <FieldRow label="Hosting" value={techStack.hosting} />
        <FieldRow label="Payments" value={techStack.payments} />
        <FieldRow label="Marketing" value={techStack.marketing} />
        <FieldRow label="Monitoring / Error Tracking" value={techStack.monitoring} />
      </div>

      {isWP && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          WordPress detected — front-end framework detections are skipped to avoid false positives from themes/plugins.
        </div>
      )}
    </div>
  );
};

export default TechStackDisplay;
