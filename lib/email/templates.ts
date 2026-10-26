const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");

/** Absolute URL for an in-app link; null for anything that is not a same-site path. */
export function absoluteLink(link?: string | null): string | null {
    return link && link.startsWith("/") && !link.startsWith("//") ? `${appUrl()}${link}` : null;
}

/** Inline-styled (email clients ignore stylesheets) notification email in the iFind navy / violet look. */
export function notificationEmail(opts: { title: string; body?: string | null; link?: string | null; contextLine?: string }) {
    const url = absoluteLink(opts.link);
    const html = `<!doctype html><html><body style="margin:0;background:#f2efe6;font-family:Inter,Segoe UI,Arial,sans-serif;color:#1e293b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:3px">
    <tr><td style="padding:16px 24px;border-bottom:2px solid #172554"><span style="display:inline-block;background:#172554;color:#ffffff;font-weight:700;font-size:15px;padding:6px 10px;border-radius:2px"><span style="color:#60a5fa">i</span>Find</span></td></tr>
    <tr><td style="padding:24px">
      ${opts.contextLine ? `<p style="margin:0 0 8px;font-family:Consolas,monospace;font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:#64748b">${esc(opts.contextLine)}</p>` : ""}
      <h1 style="margin:0 0 12px;font-size:19px;line-height:1.3;color:#172554">${esc(opts.title)}</h1>
      ${opts.body ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#333f4e">${esc(opts.body)}</p>` : ""}
      ${url ? `<a href="${esc(url)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-family:Consolas,monospace;font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:11px 18px;border-radius:2px">Open in iFind</a>` : ""}
    </td></tr>
    <tr><td style="padding:14px 24px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b">You are receiving this because it is an important update about your iFind account. Everything else waits in your notifications.</td></tr>
  </table>
</td></tr></table></body></html>`;
    const text = [opts.contextLine, opts.title, opts.body, url ? `Open: ${url}` : null].filter(Boolean).join("\n\n");
    return { html, text };
}
