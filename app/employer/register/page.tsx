"use client";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, ArrowRight, Check, Building2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input }  from "@/components/ui/Input";
import { toast }  from "sonner";
import { LinkedInButton } from "@/components/auth/LinkedInButton";

const schema = z.object({
  name:        z.string().min(2, "Name required").max(100),
  designation: z.string().max(80).optional(),
  email:       z.string().email("Valid email required"),
  password:    z.string().min(8).regex(/[A-Z]/, "Needs uppercase").regex(/[0-9]/, "Needs number"),
});
type Form = z.infer<typeof schema>;

export default function EmployerRegisterPage() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema) });

  const pw = watch("password", "");
  const checks = { length: pw.length >= 8, uppercase: /[A-Z]/.test(pw), number: /[0-9]/.test(pw) };

  const onSubmit = async (data: Form) => {
    try {
      const res  = await fetch("/api/employer/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Registration failed");
      toast.success("Account created!");
      router.push("/employer/companies");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    }
  };

  return (
    <AuthLayout
      variant="employer"
      heading="Create employer account"
      sub="Start hiring top student talent"
      back={{ href: "/employer", label: "Employer portal" }}
      footer={
        <span>
          Already registered? <Link href="/employer/login" className="text-[var(--primary)] font-medium hover:underline">Sign in</Link>
        </span>
      }
    >
      <div className="plasma-card p-6">
          <form method="POST" onSubmit={(e) => { e.preventDefault(); handleSubmit(onSubmit)(e); }} className="space-y-3">
            <Input label="Your Name"        placeholder="Jane Doe"            {...register("name")} error={errors.name?.message} autoComplete="name" />
            <Input label="Designation (optional)" placeholder="HR Manager"     {...register("designation")} error={errors.designation?.message} />
            <Input label="Work Email"        placeholder="hr@acmecorp.com"     type="email" {...register("email")} error={errors.email?.message} autoComplete="email" />

            <div>
              <Input
                label="Password"
                type={showPw ? "text" : "password"}
                placeholder="Min 8, 1 uppercase, 1 number"
                {...register("password")}
                error={errors.password?.message}
                autoComplete="new-password"
                rightIcon={
                  <button type="button" onClick={() => setShowPw(!showPw)} className="text-[var(--text-3)] hover:text-[var(--text)]">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
              {pw && (
                <div className="mt-2 space-y-1">
                  {([["length","8+ chars"],["uppercase","Uppercase"],["number","Number"]] as [keyof typeof checks, string][]).map(([k, l]) => (
                    <div key={k} className="flex items-center gap-1.5">
                      <Check className={`h-3 w-3 ${checks[k] ? "text-green-500" : "text-[var(--border-2)]"}`} />
                      <span className={`text-xs ${checks[k] ? "text-green-600" : "text-[var(--text-3)]"}`}>{l}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button type="submit" loading={isSubmitting} className="w-full gap-2 mt-1" size="md">
              Create Account <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </form>
          <div className="flex items-center gap-3 my-4 text-xs text-[var(--text-3)]">
            <span className="h-px flex-1 bg-[var(--border)]" />or<span className="h-px flex-1 bg-[var(--border)]" />
          </div>
          <LinkedInButton as="employer" text="Sign up with LinkedIn" />

          <p className="text-xs text-[var(--text-3)] text-center mt-4">
            By registering you agree to our{" "}
            <Link href="#" className="text-[var(--primary)] hover:underline">Terms</Link> &{" "}
            <Link href="#" className="text-[var(--primary)] hover:underline">Privacy Policy</Link>.
          </p>
        </div>
    </AuthLayout>
  );
}
