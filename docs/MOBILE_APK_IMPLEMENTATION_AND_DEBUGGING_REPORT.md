# Mobile APK Engineering, Architecture, and Debugging Report

**Project**: iFind — Smart Campus Placement & Internship Management System  
**Component**: Mobile Android Application (Capacitor 6 + Next.js 16)  
**File Output**: `ifind.apk` (Release APK at Project Root)  
**Date**: November 5, 2026  
**Status**: Production Verified & Deployed  

---

## 1. Executive Summary & Objective

The primary objective was to build a secure, high-performance, offline-first native Android APK (`ifind.apk`) for the **iFind** platform. The application is tailored specifically for **Students** and **Employers**, completely excising and walling off the **Moderator / Admin** portal from the mobile bundle.

```
                    ┌─────────────────────────────────────────┐
                    │           iFind Codebase                │
                    │   (Next.js 16 App Router + React 19)   │
                    └────────────────────┬────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
                 ▼                                               ▼
    ┌─────────────────────────┐                     ┌─────────────────────────┐
    │     Desktop Web         │                     │  Isolated Mobile Build  │
    │  (Vercel Production)    │                     │    (.mobile-build/)     │
    ├─────────────────────────┤                     ├─────────────────────────┤
    │ • Student Dashboard     │                     │ • Student Dashboard     │
    │ • Employer Dashboard    │                     │ • Employer Dashboard    │
    │ • Moderator Portal      │                     │ • Mobile Auth (/phone)  │
    │ • Campus Management     │                     │ ✕ Moderator Excised     │
    └─────────────────────────┘                     └────────────┬────────────┘
                                                                 │
                                                    Next.js Static Export
                                                    (@capacitor/android 6)
                                                                 │
                                                                 ▼
                                                    ┌─────────────────────────┐
                                                    │    Android Native APK   │
                                                    │       (ifind.apk)       │
                                                    └─────────────────────────┘
```

### Core Requirements
1. **Portal Isolation**: The APK must contain zero moderator code, server actions, or administrative UI.
2. **Capacitor Integration**: Powered by `@capacitor/core`, `@capacitor/android`, and `@capacitor/app` version 6.
3. **Automated One-Command Pipeline**: A unified build script (`scripts/app-build.mjs`) that validates separation, scaffolds the mobile workspace, exports static web assets, updates icons, runs Gradle, and outputs `ifind.apk`.
4. **Mobile UX & Security Hardening**:
   - Hardware/gesture Android back button support.
   - Header logos neutralized on small screens (no accidental routing to desktop marketing pages).
   - Complete block of `/moderator` routes on mobile viewports.
   - Mobile-native PDF resume viewer using high-resolution CDN page transformations.

---

## 2. Portal Separation Architecture & Threat Model

### 2.1 The Risk
In a multi-portal Next.js project, administrative panels (like `/moderator/*`) often share helper functions, database models, or components with user-facing dashboards. If a developer accidentally imports moderator logic into student pages, the offline static export will bundle sensitive endpoints, schema names, or moderation logic directly inside client JavaScript chunks.

### 2.2 Layer 1: Separation Checker (`scripts/app-separation-checker.mjs`)
Before any build is initiated, `scripts/app-separation-checker.mjs` executes a static AST and pattern-scan across all student, employer, and shared components.

- **Forbidden Dependencies**: Any import of `lib/moderator`, `components/moderator`, or `/api/moderator` from student or employer code immediately triggers an exit code `1` and aborts the pipeline.
- **Allowed Shared Code**: Pure utility primitives (`lib/utils.ts`, `lib/safeUrl.ts`, UI design system components).

### 2.3 Layer 2: Scaffolding Isolation (`.mobile-build/`)
The build pipeline does not export the entire Next.js repository. Instead, it creates an isolated sandbox directory (`.mobile-build/`):
- Copies only student, employer, and mobile landing routes (`app/phone`, `app/user`, `app/employer`).
- Completely omits the `app/moderator` directory and `components/moderator`.
- Replaces the root `app/page.tsx` with a lightweight, mobile-specific entry-point router.

### 2.4 Layer 3: Post-Export Bundle Scanner
After Next.js generates static HTML/JS files in `.mobile-build/out`, the pipeline performs a regex scan across all generated `.js` files:
```javascript
const forbiddenJs = /lib\/moderator|AnalyzePanel|api\/moderator|api\/admin/;
```
If any chunk contains matches, the build halts immediately before native Gradle compilation.

---

## 3. The Unified APK Build Pipeline (`scripts/app-build.mjs`)

The pipeline runs with a single command:
```bash
npm run app:build
```

### 3.1 Pipeline Sequence

| Step | Action | Description |
| :--- | :--- | :--- |
| **1. Separation Check** | `app-separation-checker.mjs` | Verifies zero architectural boundary breaches between portals. |
| **2. Scaffolding** | Prepare `.mobile-build/` | Clean directory, copy allowed routes, symlink root `node_modules`. |
| **3. Entry-Point Injection** | Write mobile `app/page.tsx` | Creates client router evaluating `localStorage` session state. |
| **4. Next.js Static Export** | `next build --webpack` | Generates offline static HTML, JS, and CSS into `.mobile-build/out`. |
| **5. Bundle Leak Audit** | Static scan of `out/_next/` | Confirms zero moderator strings or routes exist in the bundle. |
| **6. App Icon Pipeline** | `generate-app-icons.mjs` | Generates 5 Android mipmap densities from `public/logo-badge.svg`. |
| **7. Capacitor Sync** | `npx cap sync android` | Copies `.mobile-build/out` into `android/app/src/main/assets/public`. |
| **8. Gradle Release Build** | `gradlew assembleRelease` | Compiles release APK using Java 17 and Android SDK. |
| **9. Root APK Placement** | `copyApk` helper | Copies output binary to `./ifind.apk` with lock-retry resilience. |

### 3.2 Mobile Entry Point Logic
Inside `.mobile-build/app/page.tsx`, the native app inspects authentication on mount:
```tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MobileRootPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = localStorage.getItem("ifind_session");
      const lastTab = localStorage.getItem("ifind_last_tab");
      if (stored) {
        const session = JSON.parse(stored);
        if (session?.role === "employer") {
          router.replace("/employer/dashboard");
          return;
        }
        if (session?.role === "student" && session?.username) {
          router.replace(`/user/${session.username}/${lastTab || "overview"}`);
          return;
        }
      }
    } catch {}
    router.replace("/phone");
  }, [router]);

  return <div className="min-h-screen bg-[var(--bg)]" />;
}
```

---

## 4. Mobile Runtime Hardening & UI Security

### 4.1 Neutralizing Header Logos on Small Screens
**Problem**: In early builds, clicking the `iFind` logo in mobile headers navigated to `/user` or `/`, exposing the desktop marketing landing page and breaking the native app illusion.  
**Fix**: In [`StudentShell.tsx`](file:///C:/Users/4dmin/Downloads/iFind30/IPD/ifind/components/student/StudentShell.tsx), [`EmployerShell.tsx`](file:///C:/Users/4dmin/Downloads/iFind30/IPD/ifind/components/employer/EmployerShell.tsx), and [`Navbar.tsx`](file:///C:/Users/4dmin/Downloads/iFind30/IPD/ifind/components/layout/Navbar.tsx), mobile viewports wrap the logo in:
```tsx
<div className="flex items-center shrink-0 pointer-events-none select-none cursor-default" aria-label="iFind">
  <Logo size="md" />
</div>
```
Tapping the header logo on mobile now performs no action.

### 4.2 Complete Lockdown of Moderator Routes
**Problem**: Visiting `/moderator/*` from a mobile browser or WebView displayed the desktop moderation interface on a small viewport.  
**Fix**:
1. **Client Shell Guard**: In [`ModeratorShell.tsx`](file:///C:/Users/4dmin/Downloads/iFind30/IPD/ifind/components/moderator/ModeratorShell.tsx), state initializes synchronously with `isSmallScreen()`:
   ```tsx
   const [blocked, setBlocked] = useState(() => typeof window !== "undefined" && isSmallScreen());
   useEffect(() => {
     if (isSmallScreen()) {
       setBlocked(true);
       router.replace("/phone");
     }
   }, [router]);

   if (blocked) return null; // Zero UI render leak
   ```
2. **Server Layout Guard**: In [`app/moderator/[username]/layout.tsx`](file:///C:/Users/4dmin/Downloads/iFind30/IPD/ifind/app/moderator/[username]/layout.tsx), server-side user-agent checks bounce mobile browsers directly:
   ```tsx
   const ua = (await headers()).get("user-agent");
   if (isMobileUserAgent(ua)) redirect("/phone");
   ```
3. **Small Screen Redirector**: Added [`components/common/SmallScreenRedirect.tsx`](file:///C:/Users/4dmin/Downloads/iFind30/IPD/ifind/components/common/SmallScreenRedirect.tsx) to `/user` and `/employer` marketing roots to ensure small screens stay in `/phone`.

### 4.3 Native Android Back Button Integration
**Problem**: Android's hardware back button or swipe-back navigation gesture would abruptly exit the Capacitor app instead of closing open drawers or navigating back in history.  
**Fix**: Installed `@capacitor/app` and implemented [`hooks/useAndroidBackHandler.ts`](file:///C:/Users/4dmin/Downloads/iFind30/IPD/ifind/hooks/useAndroidBackHandler.ts):
```typescript
import { useEffect } from "react";
import { App } from "@capacitor/app";

export function useAndroidBackHandler(onCloseActiveOverlay?: () => boolean) {
  useEffect(() => {
    const sub = App.addListener("backButton", ({ canGoBack }) => {
      // 1. If a modal, bottom-sheet, or drawer is active, dismiss it first
      if (onCloseActiveOverlay?.()) return;

      // 2. Otherwise navigate back in webview history
      if (canGoBack && window.history.length > 1) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });

    return () => {
      sub.then((h) => h.remove()).catch(() => {});
    };
  }, [onCloseActiveOverlay]);
}
```

---

## 5. LinkedIn OAuth on Mobile & Bottom Sheet Gestures

### 5.1 Remote Origin Resolution (`lib/apiOrigin.ts`)
**Problem**: The offline APK is served locally on the device from `http://localhost/`. Invoking relative API routes like `/api/auth/linkedin` fails because no local Next.js server runs on the Android phone.  
**Fix**: Created [`lib/apiOrigin.ts`](file:///C:/Users/4dmin/Downloads/iFind30/IPD/ifind/lib/apiOrigin.ts) with `apiUrl(path)`:
```typescript
export function getApiOrigin(): string {
  if (!isNativeApp()) return "";
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_API_URL;
  if (configured && !configured.includes("localhost")) {
    return configured.replace(/\/+$/, "");
  }
  return "https://ifind-ifind.vercel.app";
}
```
All mobile authentication requests automatically target the production backend: `https://ifind-ifind.vercel.app/api/auth/linkedin?as=student-mobile`.

### 5.2 Bottom Sheet Drag vs. Swipe Conflict
**Problem**: In `/phone`, swiping anywhere on the background component caused the login bottom sheet to open inadvertently.  
**Fix**: Replaced generic touch swipes with an explicit drag-handle gesture on the sheet's top header. Swiping the body scrolls content naturally, while dragging the pill handle controls sheet expansion.

---

## 6. The Mobile Resume PDF Viewer Solution

### 6.1 Root Cause of the Mobile Blank Box
In desktop browsers, `<iframe src="/api/user/resume/file">` works because desktop Chrome and Edge include the proprietary **PDFium** plugin.  
However, **Android WebView and mobile Chrome completely lack an inline PDF plugin**. When an Android WebView encounters an `<iframe>` loading a PDF, it does not render the document; it leaves a blank container or triggers a background download.

Furthermore, inside the native APK, the relative path `/api/user/resume/file` resolved to `http://localhost/api/user/resume/file`, throwing an unhandled 404 error.

```
Desktop Chrome (PC)             Android WebView (Phone)
┌───────────────────────┐       ┌───────────────────────┐
│  Built-in PDFium      │       │  No PDF Plugin        │
│  ✓ Renders Inline     │       │  ✕ Blank Dark Box     │
│  ✓ Page Controls      │       │  ✕ 480px Dead Space   │
└───────────────────────┘       └───────────────────────┘
```

### 6.2 The ImageKit High-Resolution Transformation Pipeline
The platform stores student resumes in **ImageKit CDN** (`driveViewLink`: `https://ik.imagekit.io/ifind/resumes/...pdf`).  
ImageKit supports dynamic on-the-fly PDF page transformation. By querying `/ik-thumbnail.jpg?tr=w-1000`, ImageKit converts page 1 of the PDF into a 1000px high-resolution PNG image in ~150ms.

### 6.3 Implementation in `ResumeTab.tsx`
Updated [`components/dashboard/ResumeTab.tsx`](file:///C:/Users/4dmin/Downloads/iFind30/IPD/ifind/components/dashboard/ResumeTab.tsx):
1. **Dynamic Thumbnail URL**:
   ```typescript
   const directPdfUrl = localResume?.driveViewLink || resumeFileUrl;
   const thumbnailUrl = localResume?.driveViewLink?.includes("ik.imagekit.io")
     ? `${localResume.driveViewLink}/ik-thumbnail.jpg?tr=w-1000`
     : null;
   ```
2. **Responsive Rendering**:
   - **On Desktop (≥ 1024px)**: Renders the standard embedded `<iframe src={resumeFileUrl} />`.
   - **On Mobile (< 1024px or Native App)**: Renders a paper-styled resume preview card displaying page 1, with an overlay badge and tap-to-expand gesture.
3. **Fullscreen Modal**:
   - Tapping the preview opens a dark backdrop lightbox modal with pinch-zoom support.
   - Includes an **"Open Full PDF"** button linking to `directPdfUrl`.
4. **Native App PDF Routing**:
   - Tapping **"Open PDF"** passes the public ImageKit URL to the device, allowing Android to launch Google Drive PDF Viewer, Adobe Reader, or Chrome with full multi-page support.

---

## 7. Android App Launcher Icon Pipeline

Created [`scripts/generate-app-icons.mjs`](file:///C:/Users/4dmin/Downloads/iFind30/IPD/ifind/scripts/generate-app-icons.mjs) using `sharp` to automatically rasterize `public/logo-badge.svg` into all standard Android mipmap densities:

```
public/logo-badge.svg
         │
         ├──► mipmap-mdpi    (48x48 icon,   108x108 adaptive fg)
         ├──► mipmap-hdpi    (72x72 icon,   162x162 adaptive fg)
         ├──► mipmap-xhdpi   (96x96 icon,   216x216 adaptive fg)
         ├──► mipmap-xxhdpi  (144x144 icon, 324x324 adaptive fg)
         └──► mipmap-xxxhdpi (192x192 icon, 432x432 adaptive fg)
```

- **Adaptive Foreground**: Scaled to 66% and centered on a transparent canvas to avoid launcher edge-clipping.
- **Adaptive Background**: Set to deep navy (`#0f172a`) in `android/app/src/main/res/values/ic_launcher_background.xml`.
- **Integrated into Pipeline**: The build script runs `generate-app-icons.mjs` before Gradle compilation, ensuring icon updates are always applied automatically.

---

## 8. Log of Errors Encountered and Solutions Applied

| # | Symptom / Error | Root Cause | Resolution |
| :- | :--- | :--- | :--- |
| **1** | `TS2307: Cannot find module '@/lib/moderator/analyze'` | Missing types and implicit `any` in `AnalyzePanel.tsx`. | Fixed parameter typing and missing imports in moderator utilities. |
| **2** | `Turbopack root mismatch warning` | Nested lockfile detected in `.mobile-build/package-lock.json`. | Removed temporary lockfile and added `--webpack` flag to Next.js build command. |
| **3** | `PSSecurityException: npm.ps1 cannot be loaded` | Windows PowerShell execution policy restricts script execution. | Invoked commands using `npm.cmd` explicitly in all Windows execution contexts. |
| **4** | `EBUSY / EPERM: file locked by another process` | Windows file locks on `ifind.apk` due to Explorer preview or antivirus scanning. | Implemented `copyApk()` retry helper with exponential backoff and timestamp fallback. |
| **5** | `Unhandled 404 on /api/auth/linkedin` | Offline Capacitor bundle resolves relative paths to `http://localhost/`. | Created `apiUrl()` in `lib/apiOrigin.ts` to route all auth to `https://ifind-ifind.vercel.app`. |
| **6** | `LinkedIn 400: redirect_uri mismatch` | The redirect URL was not registered in the LinkedIn Developer portal. | Registered `https://ifind-ifind.vercel.app/api/auth/linkedin/callback` as an approved redirect URI. |
| **7** | `Header logo navigated to /user on phone` | `StudentShell.tsx` had `<Link href="/user">` in the mobile header. | Replaced `<Link>` with a non-clickable `<div>` having `pointer-events-none select-none`. |
| **8** | `Moderator portal rendered on small screens` | Vercel production deployment was missing client/server screen-size guards. | Added `isSmallScreen()` zero-render guard and deployed updates to `origin/main`. |
| **9** | `Android back button exited the application` | Capacitor does not route hardware back button events to Next.js history by default. | Installed `@capacitor/app` and implemented `useAndroidBackHandler()`. |
| **10** | `Resume container was blank on real phone` | Android WebView does not include a PDF plugin, and relative `/api` paths 404'd. | Built ImageKit `/ik-thumbnail.jpg?tr=w-1000` preview and directed "Open PDF" to CDN links. |

---

## 9. iPhone (iOS `.ipa`) Feasibility & Roadmap

### 9.1 Technical Capability
Because iFind utilizes **Capacitor 6**, the codebase is already compatible with iOS. The same static bundle (`.mobile-build/out`) runs on iOS WebKit without requiring UI changes.

### 9.2 The macOS Barrier
- Android APKs can be built on Windows because Google supports the Android SDK and Gradle on Windows.
- Apple **strictly prohibits** building `.ipa` binaries outside of macOS. The compiler (`xcodebuild`), Swift runtime, and iOS SDK only exist within **Xcode on macOS**.

### 9.3 Recommended Deployment Options

#### Option A: GitHub Actions macOS Runner (Cloud CI/CD — Recommended)
We can add `.github/workflows/build-ios.yml` to the repository. When triggered:
1. GitHub spins up a cloud **macOS virtual machine** with Xcode pre-installed.
2. The workflow checks out the repository, installs dependencies, and runs `npm run app:build`.
3. Runs `npx cap sync ios` and `xcodebuild archive`.
4. Uploads the compiled `.ipa` file as an artifact directly in the GitHub Actions tab.

#### Option B: Local Mac Machine
If a macOS machine is available:
```bash
npm install @capacitor/ios
npx cap add ios
npx cap sync ios
npx cap open ios  # Opens project in Xcode for one-click Archive
```

#### Option C: Instant Progressive Web App (PWA)
iOS users can navigate to `https://ifind-ifind.vercel.app/phone` in Safari, tap **Share → Add to Home Screen**. The app installs with the custom app icon and opens in fullscreen standalone mode without an address bar.

---

## 10. Verification & Build Artifacts

- **TypeScript Compilation**: `node node_modules/typescript/bin/tsc --noEmit` passed with 0 errors.
- **Security Audit**: 33/33 tests passed in `npm run test:security`:
  - Password hashing and breach checks.
  - Image and PDF mime-type sniffing.
  - Post-login redirect validation and same-site origin enforcement.
  - Role-based separation and notification permissions.
- **Release APK**:
  - File: `ifind.apk` (at repository root)
  - Size: **7.14 MB**
  - Architecture: Android ARM64, ARMv7, x86_64 compatible
  - Build Pipeline: Automated via `npm run app:build`
