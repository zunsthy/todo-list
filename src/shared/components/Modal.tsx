import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

export const Modal = ({
  title,
  busy = false,
  onClose,
  children,
}: {
  title: string;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={dialogRef}
      className="app-modal"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="app-modal-heading">
        <h2>{title}</h2>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="关闭面板"
          title="关闭"
        >
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
};
