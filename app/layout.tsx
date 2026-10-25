import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "iFind — Find Your Perfect Internship",
  description:
    "India's smartest internship platform. AI-powered matching connects students with top companies.",
  keywords: ["internship", "jobs", "students", "placement", "career"],
};

import { ThemeProvider, THEME_INIT_SCRIPT } from "@/components/theme/ThemeProvider";
import { AppToaster } from "@/components/theme/AppToaster";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { VectorizationProgressBar } from "@/components/dashboard/VectorizationProgressBar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <ThemeProvider>
          {children}
          <AppToaster />
          <AnalyticsProvider />
          <VectorizationProgressBar />
        </ThemeProvider>
      </body>
    </html>
  );
}
