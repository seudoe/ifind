import LogoSlider from "@/components/ui/logo-slider";

// Company logos / trust strip — merged from Internshala + Cutshort pattern
const COMPANIES = [
  "Razorpay", "Swiggy", "CRED", "Zepto", "Meesho",
  "PhonePe", "Groww", "Ola", "Zomato", "Flipkart",
];

export function TrustBar() {
  return (
    <section className="py-8 bg-[var(--surface)] border-t border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-xs text-center text-[var(--text-2)] uppercase tracking-widest mb-3">
          Internships from top companies
        </p>
        <LogoSlider
          speed={40}
          pauseOnHover
          logos={COMPANIES.map((name) => (
            <span key={name} className="text-base font-semibold text-[var(--text-2)]">
              {name}
            </span>
          ))}
        />
      </div>
    </section>
  );
}
