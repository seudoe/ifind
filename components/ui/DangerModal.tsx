"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { TriangleAlert } from "lucide-react";

interface Props {
    open: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

/**
 * Big red warning dialog for actions with consequences. Unlike Modal it is NOT dismissed by clicking outside (a stray
 * click must not look like a decision); Escape and the explicit Cancel button close it.
 */
export function DangerModal({ open, onClose, title, children }: Props) {
    return (
        <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--overlay)] backdrop-blur-xs" />
                <Dialog.Content
                    onInteractOutside={(e) => e.preventDefault()}
                    className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[var(--radius)] border-2 border-[var(--danger)] bg-[var(--surface)] shadow-[var(--shadow-lg)] focus:outline-none"
                >
                    <div className="flex items-center gap-3 bg-[var(--danger)] px-5 py-4 text-white">
                        <TriangleAlert className="h-6 w-6 shrink-0" />
                        <Dialog.Title className="text-base font-bold">{title}</Dialog.Title>
                    </div>
                    <Dialog.Description className="sr-only">This action has consequences. Read them before you continue.</Dialog.Description>
                    <div className="p-5">{children}</div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
