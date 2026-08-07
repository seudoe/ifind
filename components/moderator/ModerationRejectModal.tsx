"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface ModerationRejectModalProps {
    open: boolean;
    internshipName: string;
    onConfirm: (reason: string) => void;
    onClose: () => void;
}

export function ModerationRejectModal({
    open,
    internshipName,
    onConfirm,
    onClose,
}: ModerationRejectModalProps) {
    const [reason, setReason] = useState("");

    // Reset reason when modal opens/closes
    useEffect(() => {
        if (!open) setReason("");
    }, [open]);

    const handleConfirm = () => {
        if (reason.trim()) {
            onConfirm(reason.trim());
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Reject Internship"
            size="md"
        >
            <div className="space-y-4">
                <p className="text-sm text-[var(--text-2)]">
                    You are about to reject{" "}
                    <span className="font-semibold text-[var(--text)]">
                        {internshipName}
                    </span>
                    . Please provide a reason.
                </p>

                <div>
                    <label
                        htmlFor="rejection-reason"
                        className="block text-xs font-medium text-[var(--text-2)] mb-1.5"
                    >
                        Rejection Reason{" "}
                        <span className="text-[var(--danger)]">*</span>
                    </label>
                    <textarea
                        id="rejection-reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Describe why this listing is being rejected..."
                        rows={4}
                        className="w-full px-3 py-2 text-sm rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--text-3)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-colors"
                    />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                    <Button variant="secondary" size="sm" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="danger"
                        size="sm"
                        disabled={!reason.trim()}
                        onClick={handleConfirm}
                    >
                        Confirm Rejection
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
