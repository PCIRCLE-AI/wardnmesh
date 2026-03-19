import { ErrorBoundary } from './components/ErrorBoundary';
import { TrayPanel } from './components/TrayPanel';
import { ConfirmationWindow } from './components/ConfirmationWindow';
import { Dashboard } from './components/Dashboard';

function App() {
  // Determine which view to render based on window label
  const windowLabel = (window as any).__TAURI_INTERNALS__?.metadata?.currentWindow?.label || 'tray-panel';

  if (windowLabel.startsWith('confirm-')) {
    return (
      <ErrorBoundary>
        <ConfirmationWindow />
      </ErrorBoundary>
    );
  }

  if (windowLabel === 'dashboard') {
    return (
      <ErrorBoundary>
        <Dashboard />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <TrayPanel />
    </ErrorBoundary>
  );
}

export default App;
