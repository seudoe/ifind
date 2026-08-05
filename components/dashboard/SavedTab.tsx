import { Bookmark } from "lucide-react";

export function SavedTab() {
  return (
    <div className="plasma-card p-10 text-center max-w-md mx-auto">
      <div className="h-12 w-12 rounded-full bg-[var(--surface-2)] flex items-center justify-center mx-auto mb-3">
        <Bookmark className="h-5 w-5 text-[var(--text-3)]" />
      </div>
      <p className="text-sm font-medium text-[var(--text)]">No saved internships yet</p>
      <p className="text-xs text-[var(--text-2)] mt-1 leading-relaxed">
        Browse internships and click the bookmark icon to save them here for later.
      </p>
    </div>
  );
}
