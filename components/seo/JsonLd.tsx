/**
 * Renders schema.org JSON-LD. `<` is escaped so a string inside the data can never close the script tag.
 * Only mark up what is visibly on the page; Google treats mismatched structured data as spam.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029") }}
    />
  );
}
