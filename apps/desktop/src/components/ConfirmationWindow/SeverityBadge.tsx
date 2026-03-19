interface SeverityBadgeProps {
  severity: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  major: 'bg-yellow-500 text-black',
  minor: 'bg-blue-500 text-white',
};

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.minor;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {severity.toUpperCase()}
    </span>
  );
}
