export function Settings() {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Settings</h2>
      <div className="space-y-4">
        <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4">
          <h3 className="text-sm font-medium mb-2">Configuration</h3>
          <p className="text-xs text-[var(--color-text-muted)]">
            Edit ~/.wardnmesh/config.json to customize timeouts, severity levels, and audit retention.
          </p>
        </div>
        <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4">
          <h3 className="text-sm font-medium mb-2">Privacy</h3>
          <p className="text-xs text-[var(--color-text-muted)]">
            All data stays local. No telemetry, no cloud sync, no phone-home.
          </p>
        </div>
      </div>
    </div>
  );
}
