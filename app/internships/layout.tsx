import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function PublicInternshipsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar active="internships" />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
