"use client";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { NextLink } from "@/components/auth/NextLink";

export function AuthShell({
    heading,
    sub,
    switchText,
    switchLink,
    switchLabel,
    children,
}: {
    heading: string;
    sub: string;
    switchText: string;
    switchLink: string;
    switchLabel: string;
    children: React.ReactNode;
}) {
    return (
        <AuthLayout
            variant="student"
            heading={heading}
            sub={sub}
            footer={
                <span>
                    {switchText}{" "}
                    <NextLink href={switchLink} className="text-[var(--primary)] font-medium hover:underline">
                        {switchLabel}
                    </NextLink>
                </span>
            }
        >
            <div className="plasma-card p-6 space-y-4">{children}</div>
        </AuthLayout>
    );
}
