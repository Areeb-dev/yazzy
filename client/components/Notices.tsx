import { useEffect } from 'react';

export function ConnectionBanner({ connected }: { connected: boolean }) {
  if (connected) return null;
  return (
    <div role="status" className="conn">
      Connection lost. Reconnecting…
    </div>
  );
}

export function ErrorToast({ message, onClose }: { message: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [message, onClose]);
  if (!message) return null;
  return (
    <div role="alert" className="toast">
      <span>{message}</span>
      <button type="button" onClick={onClose}>
        OK
      </button>
    </div>
  );
}
