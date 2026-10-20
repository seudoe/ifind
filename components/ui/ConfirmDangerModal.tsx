"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface ConfirmDangerModalProps {
  open: boolean;
  title: string;
  /** Body copy explaining what will happen. */
  children: React.ReactNode;
  /** The exact text the user must type before the confirm button enables. */
  confirmPhrase: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDangerModal({
  open,
  title,
  children,
  confirmPhrase,
  confirmLabel = "Confirm",
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDangerModalProps) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === confirmPhrase;

  // Radix keeps no state of its own for the input, so reset on every close path.
  const close = () => {
    setTyped("");
    onClose();
  };

  return (
    <Modal open={open} onClose={close} size="sm">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)]">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </span>
          <h3 className="text-base font-bold text-[var(--text)]">{title}</h3>
        </div>

        <div className="text-sm text-[var(--text-2)] leading-relaxed space-y-2">{children}</div>

        <form
          className="space-y-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (matches && !loading) onConfirm();
          }}
        >
          <label htmlFor="danger-confirm" className="text-xs font-semibold text-[var(--text)]">
            Type <span className="font-mono text-[var(--danger)]">{confirmPhrase}</span> to confirm
          </label>
          <Input
            id="danger-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={confirmPhrase}
            autoComplete="off"
            autoFocus
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)] mt-4">
            <Button variant="outline" size="sm" type="button" onClick={close} disabled={loading}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" type="submit" loading={loading} disabled={!matches}>
              {confirmLabel}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
