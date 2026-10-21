import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "iFind — Find Your Perfect Internship", template: "%s | iFind" },
  description:
    "India's smartest internship platform. AI-powered matching connects students with top companies.",
  keywords: ["internship", "internships in India", "student jobs", "placement", "career"],
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_IN",
    images: [OG_IMAGE],
    title: "iFind — Find Your Perfect Internship",
    description: "AI-powered internship matching for students in India.",
  },
  twitter: {
    card: "summary_large_image",
    images: [OG_IMAGE.url],
    title: "iFind — Find Your Perfect Internship",
    description: "AI-powered internship matching for students in India.",
  },
  // Pages opt out of indexing (X-Robots-Tag in next.config.ts); everything else defaults to indexable.
  robots: { index: true, follow: true },
};

import { VectorizationProgressBar } from "@/components/dashboard/VectorizationProgressBar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        {children}
        <Toaster position="top-right" richColors />
        <VectorizationProgressBar />
      </body>
    </html>
  );
}
