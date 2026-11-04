import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
export function useHistory<T>(initial: () => T) {
  const [value, setValue] = useState(initial);
  const past = useRef<T[]>([]),
    future = useRef<T[]>([]);
  const [, refresh] = useState(0);
  const current = useRef(value);
  current.current = value;
  const commit = (next: T | ((old: T) => T), remember = true) => {
    const old = current.current;
    const result = typeof next === 'function' ? (next as (old: T) => T)(old) : next;
    if (result === old) return;
    if (remember) {
      past.current = [...past.current.slice(-39), old];
      future.current = [];
    }
    current.current = result;
    setValue(result);
    refresh((n) => n + 1);
  };
  const undo = () => {
    if (!past.current.length) return;
    future.current.push(current.current);
    const next = past.current.pop()!;
    current.current = next;
    setValue(next);
    refresh((n) => n + 1);
  };
  const redo = () => {
    if (!future.current.length) return;
    past.current.push(current.current);
    const next = future.current.pop()!;
    current.current = next;
    setValue(next);
    refresh((n) => n + 1);
  };
  return {
    value,
    commit,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
export function Icon({
  name,
  size = 18,
}: {
  name:
    | 'plus'
    | 'trash'
    | 'undo'
    | 'redo'
    | 'close'
    | 'fit'
    | 'minus'
    | 'search'
    | 'branch'
    | 'skill'
    | 'check'
    | 'arrow'
    | 'download';
  size?: number;
}) {
  const paths: Record<string, ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    trash: (
      <>
        <path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" />
      </>
    ),
    undo: (
      <>
        <path d="M8 4 3 9l5 5M3 9h10a7 7 0 0 1 0 14" />
      </>
    ),
    redo: (
      <>
        <path d="m16 4 5 5-5 5M21 9H11a7 7 0 0 0 0 14" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    fit: (
      <>
        <path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" />
        <rect x="8" y="8" width="8" height="8" rx="1" />
      </>
    ),
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 6 6" />
      </>
    ),
    branch: (
      <>
        <path d="M6 4v11a4 4 0 0 0 8 0v-3a4 4 0 0 1 4-4" />
        <circle cx="6" cy="3" r="2" />
        <circle cx="18" cy="6" r="2" />
        <circle cx="14" cy="20" r="2" />
      </>
    ),
    skill: (
      <>
        <path d="m12 2 9 5v10l-9 5-9-5V7ZM12 2v20M3 7l18 10M21 7 3 17" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const focused = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      focused?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`editor-dialog ${wide ? 'wide' : ''}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
      aria-labelledby={titleId}
    >
      <div className="dialog-heading">
        <div>
          <span className="eyebrow">ESTÚDIO INFERUS</span>
          <h2 id={titleId}>{title}</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Fechar janela">
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function DeleteDialog({
  title,
  description,
  onConfirm,
  onClose,
  undoable = true,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  onClose: () => void;
  undoable?: boolean;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="dialog-description">{description}</p>
      {undoable && <p className="help-text">Você pode desfazer esta ação pelo botão Desfazer.</p>}
      <div className="dialog-actions">
        <button className="quiet" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="danger-button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          <Icon name="trash" />
          Confirmar exclusão
        </button>
      </div>
    </Modal>
  );
}
export function HistoryButtons({
  history,
}: {
  history: { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean };
}) {
  return (
    <div className="history-controls">
      <button
        className="icon-btn"
        aria-label="Desfazer"
        title="Desfazer"
        disabled={!history.canUndo}
        onClick={history.undo}
      >
        <Icon name="undo" />
      </button>
      <button
        className="icon-btn"
        aria-label="Refazer"
        title="Refazer"
        disabled={!history.canRedo}
        onClick={history.redo}
      >
        <Icon name="redo" />
      </button>
    </div>
  );
}
export function downloadJSON(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
