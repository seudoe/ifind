"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  size = "md",
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-200" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "w-full max-h-[90vh] overflow-y-auto bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-2xl p-6",
            "focus:outline-none transition-all duration-200",
            sizeClasses[size],
            className
          )}
        >
          {(title || description) && (
            <div className="flex items-start justify-between pb-4 border-b border-[var(--border)] mb-4">
              <div>
                {title && (
                  <Dialog.Title className="text-base font-bold text-[var(--text)]">
                    {title}
                  </Dialog.Title>
                )}
                {description && (
                  <Dialog.Description className="mt-1 text-xs text-[var(--text-3)]">
                    {description}
                  </Dialog.Description>
                )}
              </div>
              <Dialog.Close
                onClick={onClose}
                className="ml-4 rounded-[var(--radius-sm)] p-1.5 text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors"
              >
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>
          )}
          {!title && !description && (
            <Dialog.Close
              onClick={onClose}
              className="absolute right-4 top-4 rounded-[var(--radius-sm)] p-1.5 text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors z-10"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          )}
          <div className="text-[var(--text)]">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
