"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, ArrowRight, Shield } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "sonner";

const schema = z.object({
    email: z.string().email("Valid email required"),
    password: z.string().min(1, "Password is required"),
});
type Form = z.infer<typeof schema>;

export default function ModeratorLoginPage() {
    const router = useRouter();
    const [showPw, setShowPw] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<Form>({ resolver: zodResolver(schema) });

    const onSubmit = async (data: Form) => {
        try {
            const res = await fetch("/api/moderator/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
                credentials: "include",
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Login failed");
            toast.success("Welcome back!");
            if (json.data?.isVerified === true) {
                router.push("/moderator/panel");
            } else {
                router.push("/moderator/pending");
            }
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Invalid credentials",
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
                        Moderator Sign In
                    </h1>
                    <p className="text-sm text-[var(--text-3)] mt-1">
                        Access the iFind moderator panel
                    </p>
                </div>

                <div className="plasma-card p-6 space-y-4">
                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className="space-y-4"
                    >
                        <Input
                            label="Email"
                            type="email"
                            placeholder="moderator@example.com"
                            {...register("email")}
                            error={errors.email?.message}
                            autoComplete="email"
                        />
                        <Input
                            label="Password"
                            type={showPw ? "text" : "password"}
                            placeholder="Your password"
                            {...register("password")}
                            error={errors.password?.message}
                            autoComplete="current-password"
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

                        <Button
                            type="submit"
                            loading={isSubmitting}
                            className="w-full gap-2"
                            size="md"
                        >
                            Sign In <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                    </form>
                </div>

                <div className="flex items-center justify-between mt-5 text-sm text-[var(--text-3)]">
                    <span>
                        Don&apos;t have an account?{" "}
                        <Link
                            href="/moderator/register"
                            className="text-[var(--primary)] font-medium hover:underline"
                        >
                            Register
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
