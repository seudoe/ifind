// Company logos / trust strip — merged from Internshala + Cutshort pattern
const COMPANIES = [
  "Razorpay", "Swiggy", "CRED", "Zepto", "Meesho",
  "PhonePe", "Groww", "Ola", "Zomato", "Flipkart",
];

export function TrustBar() {
  return (
    <section className="py-8 bg-[var(--surface)] border-t border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-xs text-center text-[var(--text-3)] uppercase tracking-widest mb-5">
          Internships from top companies
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {COMPANIES.map((name) => (
            <span
              key={name}
              className="text-sm font-semibold text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors duration-[var(--transition)] cursor-default"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
