import {
  Bell, Bookmark, FileText, Home, MessageSquare, Search, Send, Settings, Sparkles, User, Wrench,
  type LucideIcon,
} from "lucide-react";

export interface NavLink {
  label: string;
  /** path under /user/[username]/ */
  path: string;
  icon: LucideIcon;
  /** page title when it differs from the label */
  title?: string;
  /** reachable but not listed in the menus */
  hidden?: boolean;
}

export interface NavGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  links: NavLink[];
}

/** UI grouping only: every link keeps its own URL. A single-link group (Home) navigates directly. */
export const NAV_GROUPS: NavGroup[] = [
  { key: "home", label: "Home", icon: Home, links: [{ label: "Home", path: "overview", icon: Home, title: "Overview" }] },
  {
    key: "internships", label: "Internships", icon: Search,
    links: [
      { label: "Browse", path: "browse", icon: Search, title: "Browse Internships" },
      { label: "Applied", path: "applied-internships", icon: Send, title: "Applied Internships" },
      { label: "Saved", path: "saved", icon: Bookmark },
    ],
  },
  {
    key: "tools", label: "Tools", icon: Wrench,
    links: [
      { label: "Resume Analyzer", path: "resume", icon: FileText },
      { label: "Career Assistant", path: "career", icon: Sparkles },
      { label: "Chat", path: "chat", icon: MessageSquare, title: "Resume Chat" },
      { label: "Internship Match", path: "internship-match", icon: Search, hidden: true },
    ],
  },
  {
    key: "system", label: "System", icon: Settings,
    links: [
      { label: "Profile", path: "profile", icon: User, title: "My Profile" },
      { label: "Settings", path: "settings", icon: Settings },
      { label: "Notifications", path: "notifications", icon: Bell },
    ],
  },
];

/** The link whose path is the first segment after /user/[username]/, or undefined. */
export function findLink(pathname: string): { group: NavGroup; link: NavLink } | undefined {
  const segment = pathname.split("/")[3];
  for (const group of NAV_GROUPS) {
    const link = group.links.find((l) => l.path === segment);
    if (link) return { group, link };
  }
  return undefined;
}

/** Window event: the notifications page tells the shell to refresh the unread badge. */
export const NOTIFICATIONS_CHANGED = "student-notifications-changed";
