/** First free path "base.ext", "base (1).ext", ... Paths in `reserved` count as taken (files chosen but not yet written). */
export function uniquePath(exists: (path: string) => boolean, base: string, ext: string, reserved: Set<string> = new Set()): string {
  const taken = (p: string) => reserved.has(p) || exists(p);
  let path = `${base}.${ext}`;
  let n = 1;
  while (taken(path)) path = `${base} (${n++}).${ext}`;
  reserved.add(path);
  return path;
}

/** Markdown link target for a vault path: each segment URI-encoded, parentheses too (turndown backslash-escapes raw ones and Obsidian then cannot find the file). */
export const linkFor = (path: string): string => path.split("/").map((s) => encodeURIComponent(s).replace(/\(/g, "%28").replace(/\)/g, "%29")).join("/");
