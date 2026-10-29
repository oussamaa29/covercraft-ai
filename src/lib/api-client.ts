// Browser-side helpers shared by the dashboard's client components.

/**
 * fetch + JSON with the API's `{ error }` surfaced as a thrown Error. The
 * JSON content type goes on bodyless requests too: the API's CSRF guard
 * refuses anything else.
 */
export async function sendJson(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong");
  return data;
}

/** "Cover letter - Frontend Engineer - Northwind Labs.txt", minus unsafe characters. */
export function letterFileName(jobTitle: string, company: string, ext: string): string {
  const safe = `Cover letter - ${jobTitle} - ${company}`.replace(/[\\/:*?"<>|]+/g, "").trim();
  return `${safe.slice(0, 120)}.${ext}`;
}

export function downloadText(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: fileName });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
