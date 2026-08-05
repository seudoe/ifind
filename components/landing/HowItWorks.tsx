import Link from "next/link";
import { UserPlus, Search, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";

const STEPS = [
  {
    num: "01",
    icon: UserPlus,
    title: "Create Your Profile",
    desc: "Sign up and upload your resume. Our AI extracts your skills, education, and experience to build a rich profile automatically.",
    color: "bg-[var(--primary-bg)] text-[var(--primary)]",
  },
  {
    num: "02",
    icon: Search,
    title: "Get Matched",
    desc: "Browse thousands of internships with smart filters. AI recommends the best matches based on your actual resume data.",
    color: "bg-purple-50 text-purple-600",
  },
  {
    num: "03",
    icon: Send,
    title: "Apply & Track",
    desc: "Apply with one click. Track your application statuses in real time and get notified on every update.",
    color: "bg-green-50 text-green-600",
  },
];

export function HowItWorks() {
  return (
    <section className="py-14 bg-[var(--bg)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="text-xl font-bold text-[var(--text)]">How iFind Works</h2>
          <p className="text-sm text-[var(--text-2)] mt-1">Get started in 3 simple steps</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* Connector */}
          <div className="hidden md:block absolute top-12 left-1/3 right-1/3 h-px bg-[var(--border)]" />

          {STEPS.map(({ num, icon: Icon, title, desc, color }) => (
            <div key={num} className="plasma-card p-6 text-center relative">
              <div className="inline-flex justify-center mb-4">
                <div className={`h-16 w-16 rounded-[var(--radius)] ${color} flex items-center justify-center relative`}>
                  <Icon className="h-7 w-7" />
                  <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-[var(--text)] text-white text-[10px] font-bold flex items-center justify-center">
                    {num}
                  </span>
                </div>
              </div>
              <h3 className="font-semibold text-[var(--text)] mb-2">{title}</h3>
              <p className="text-sm text-[var(--text-2)] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link href="/register">
            <Button size="lg" className="px-8">Get Started Free</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
