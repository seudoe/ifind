"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, ArrowRight, Check, Shield } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "sonner";

const schema = z.object({
    name: z.string().min(2, "At least 2 characters"),
    email: z.string().email("Valid email required"),
    password: z
        .string()
        .min(8, "Minimum 8 characters")
        .regex(/[A-Z]/, "Needs uppercase")
        .regex(/[0-9]/, "Needs number"),
});
type Form = z.infer<typeof schema>;

export default function ModeratorRegisterPage() {
    const router = useRouter();
    const [showPw, setShowPw] = useState(false);

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<Form>({ resolver: zodResolver(schema) });

    const pw = watch("password", "");
    const checks = {
        length: pw.length >= 8,
        uppercase: /[A-Z]/.test(pw),
        number: /[0-9]/.test(pw),
    };

    const onSubmit = async (data: Form) => {
        try {
            const res = await fetch("/api/moderator/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
                credentials: "include",
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Registration failed");
            toast.success("Account created! Awaiting verification.");
            router.push("/moderator/pending");
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Registration failed",
            );
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
            <Link
                href="/"
                className="fixed top-4 left-4 text-sm text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
            >
                ← iFind
            </Link>

            <div className="w-full max-w-sm">
                <div className="text-center mb-7">
                    <div className="inline-flex h-10 w-10 rounded-[var(--radius-sm)] bg-[var(--primary)] items-center justify-center shadow-sm mb-3">
                        <Shield className="h-4.5 w-4.5 text-white" />
                    </div>
                    <h1 className="text-lg font-bold text-[var(--text)]">
                        Become a Moderator
                    </h1>
                    <p className="text-sm text-[var(--text-3)] mt-1">
                        Register for the iFind moderator panel
                    </p>
                </div>

                <div className="plasma-card p-6 space-y-4">
                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className="space-y-3"
                    >
                        <Input
                            label="Full Name"
                            placeholder="Jane Smith"
                            {...register("name")}
                            error={errors.name?.message}
                            autoComplete="name"
                        />
                        <Input
                            label="Email"
                            type="email"
                            placeholder="moderator@example.com"
                            {...register("email")}
                            error={errors.email?.message}
                            autoComplete="email"
                        />

                        <div>
                            <Input
                                label="Password"
                                type={showPw ? "text" : "password"}
                                placeholder="Min 8, 1 uppercase, 1 number"
                                {...register("password")}
                                error={errors.password?.message}
                                autoComplete="new-password"
                                rightIcon={
                                    <button
                                        type="button"
                                        onClick={() => setShowPw(!showPw)}
                                        className="text-[var(--text-3)] hover:text-[var(--text)]"
                                    >
                                        {showPw ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                }
                            />
                            {pw && (
                                <div className="mt-2 space-y-1">
                                    {(
                                        [
                                            ["length", "8+ chars"],
                                            ["uppercase", "Uppercase"],
                                            ["number", "Number"],
                                        ] as [keyof typeof checks, string][]
                                    ).map(([k, l]) => (
                                        <div
                                            key={k}
                                            className="flex items-center gap-1.5"
                                        >
                                            <Check
                                                className={`h-3 w-3 ${
                                                    checks[k]
                                                        ? "text-green-500"
                                                        : "text-[var(--border-2)]"
                                                }`}
                                            />
                                            <span
                                                className={`text-xs ${
                                                    checks[k]
                                                        ? "text-green-600"
                                                        : "text-[var(--text-3)]"
                                                }`}
                                            >
                                                {l}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <Button
                            type="submit"
                            loading={isSubmitting}
                            className="w-full gap-2"
                            size="md"
                        >
                            Create Account{" "}
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                    </form>
                </div>

                <div className="flex items-center justify-between mt-5 text-sm text-[var(--text-3)]">
                    <span>
                        Already have an account?{" "}
                        <Link
                            href="/moderator/login"
                            className="text-[var(--primary)] font-medium hover:underline"
                        >
                            Sign in
                        </Link>
                    </span>
                    <Link
                        href="/user/login"
                        className="text-xs hover:text-[var(--primary)] transition-colors"
                    >
                        Student portal →
                    </Link>
                </div>
            </div>
        </div>
    );
}
