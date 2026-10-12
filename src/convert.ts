import mammoth from "mammoth";
import TurndownService from "turndown";
import { prepassDocx, type Change, type DocComment, type TrackedMode } from "./prepass";

export type MarkupStyle = "plain" | "critic";

export interface ConvertOptions {
  /** "mark" shows changes as marked-up text; "accept" / "reject" resolve them. Free build always uses "accept". */
  tracked: TrackedMode;
  comments: boolean;
  /**
   * "plain": ==ins== / ~~del~~ with an HTML comment for author and date, comments as footnotes.
   * "critic": CriticMarkup ({++ins++}, {--del--}, {~~old~>new~~}, {==text==}{>>comment<<}) with author="" date="" prefixes.
   * Default "plain".
   */
  style?: MarkupStyle;
  /** Link text to put in the markdown for an extracted image (the caller saves the bytes). */
  imageLink: (index: number, ext: string) => string;
}

export interface ExtractedImage {
  index: number;
  ext: string;
  contentType: string;
  data: Uint8Array;
}

export interface ConvertResult {
  markdown: string;
  changes: Change[];
  comments: DocComment[];
  images: ExtractedImage[];
  warnings: string[];
}

const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced" });
td.keep(["sup", "sub"]);
td.addRule("strike", { filter: ["s", "del", "strike"] as unknown as ["s"], replacement: (c) => (c.trim() ? `~~${c.trim()}~~` : "") });
// Tables: mammoth emits <table><tr><td> (header rows become <thead> only when marked); write a GFM table, first row as header.
td.addRule("table", {
  filter: "table",
  replacement: (_c, node) => {
    const rows = Array.from((node as HTMLElement).querySelectorAll("tr")).map((tr) =>
      Array.from(tr.children).map((cell) => td.turndown((cell as HTMLElement).innerHTML).trim().replace(/\n+/g, " <br> ").replace(/\|/g, "\\|")),
    );
    if (!rows.length) return "";
    const n = Math.max(...rows.map((r) => r.length));
    const line = (r: string[]) => `| ${Array.from({ length: n }, (_, i) => r[i] ?? "").join(" | ")} |`;
    return `\n\n${line(rows[0])}\n| ${Array(n).fill("---").join(" | ")} |\n${rows.slice(1).map(line).join("\n")}\n\n`;
  },
});

const toArrayBuffer = (u: Uint8Array): ArrayBuffer => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
const b64ToBytes = (b64: string): Uint8Array => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
/** Keep author text from closing the HTML comment we put it in. */
const safe = (s: string) => s.replace(/--+/g, "-").replace(/[<>\r\n]/g, " ").trim();
const extFor = (ct: string) => ({ "image/jpeg": "jpg", "image/svg+xml": "svg" } as Record<string, string>)[ct] ?? (ct.split("/")[1] || "png").replace(/[^a-z0-9]/gi, "");

export async function convertDocx(input: Uint8Array, opts: ConvertOptions): Promise<ConvertResult> {
  const { buffer, changes, comments } = await prepassDocx(input, opts.tracked);
  const images: ExtractedImage[] = [];
  const result = await mammoth.convertToHtml(
    // node (tests) reads `buffer`, the browser build (Obsidian) reads `arrayBuffer`
    { arrayBuffer: toArrayBuffer(buffer), buffer } as unknown as { arrayBuffer: ArrayBuffer },
    {
      convertImage: mammoth.images.imgElement(async (img) => {
        const ext = extFor(img.contentType);
        const index = images.length + 1;
        images.push({ index, ext, contentType: img.contentType, data: b64ToBytes(await img.read("base64")) });
        return { src: opts.imageLink(index, ext), alt: (img as { altText?: string }).altText || "" };
      }),
    },
  );

  // Footnotes: mammoth emits <sup><a href="#footnote-N" id="footnote-ref-N">[k]</a></sup> and an <ol> of <li id="footnote-N">.
  const footnotes: { id: string; html: string }[] = [];
  let html = result.value.replace(/<ol>\s*((?:<li id="footnote-\d+">[\s\S]*?<\/li>\s*)+)<\/ol>/g, (_all, items: string) => {
    for (const m of items.matchAll(/<li id="footnote-(\d+)">([\s\S]*?)<\/li>/g)) {
      footnotes.push({ id: m[1], html: m[2].replace(/\s*<a href="#footnote-ref-\d+">[^<]*<\/a>/g, "") });
    }
    return "";
  });
  const order: string[] = [];
  html = html.replace(/<sup><a href="#footnote-(\d+)" id="footnote-ref-\d+">\[\d+\]<\/a><\/sup>/g, (_a, id: string) => {
    if (!order.includes(id)) order.push(id);
    return `⟦FN${id}⟧`;
  });

  let md = td.turndown(html);

  const byId = new Map(changes.map((c) => [c.id, c]));
  const used: DocComment[] = [];
  const defs: string[] = [];
  const fnLabel = new Map(order.map((id, i) => [id, String(i + 1)]));
  md = md.replace(/⟦FN(\d+)⟧/g, (_m: string, id: string) => `[^${fnLabel.get(id)}]`);
  for (const id of order) {
    const f = footnotes.find((x) => x.id === id);
    if (f) defs.push(`[^${fnLabel.get(id)}]: ${td.turndown(f.html).trim().replace(/\n+/g, " ")}`);
  }

  if ((opts.style ?? "plain") === "critic") {
    md = criticMarkup(md, byId, comments, opts.comments, used);
  } else {
    md = plainMarkup(md, byId, comments, opts.comments, used, defs);
  }

  if (defs.length) md = md.trimEnd() + "\n\n" + defs.join("\n") + "\n";
  return { markdown: md.trimEnd() + "\n", changes, comments: used, images, warnings: result.messages.map((m) => m.message) };
}

const STRAY = /⟦\/?(?:INS|DEL|CMS|CMT|FN)\d+⟧/g;

function plainMarkup(md: string, byId: Map<number, Change>, comments: DocComment[], withComments: boolean, used: DocComment[], defs: string[]): string {
  const meta = (c: Change) => ` <!-- ${c.type}${c.moved ? " (moved)" : ""}: ${safe(c.author) || "unknown"}${c.date ? ", " + safe(c.date) : ""} -->`;
  md = md
    .replace(/⟦INS(\d+)⟧([\s\S]*?)⟦\/INS\1⟧/g, (_m: string, id: string, t: string) => `==${t.trim()}==${meta(byId.get(+id)!)}`)
    .replace(/⟦DEL(\d+)⟧([\s\S]*?)⟦\/DEL\1⟧/g, (_m: string, id: string, t: string) => `~~${t.trim()}~~${meta(byId.get(+id)!)}`)
    .replace(/⟦\/?CMS\d+⟧/g, "");
  const cLabel = (id: string) => `c${comments.findIndex((x) => x.id === id) + 1}`;
  md = md.replace(/⟦CMT(\d+)⟧/g, (_all: string, id: string) => {
    const c = comments.find((x) => x.id === id);
    if (!withComments || !c) return "";
    used.push(c);
    return `[^${cLabel(id)}]`;
  });
  for (const c of used) {
    const who = safe(c.author) || "unknown";
    const reply = c.parentId ? `reply to [^${cLabel(c.parentId)}], ` : "";
    defs.push(`[^${cLabel(c.id)}]: Comment (${c.resolved ? "resolved, " : ""}${reply}${who}${c.date ? ", " + safe(c.date) : ""}): ${c.text.replace(/\s*\n\s*/g, " ")}`);
  }
  return md.replace(STRAY, "");
}

/** CriticMarkup bodies end at "++}" / "--}" / "<<}" / "==}" and start at "{": keep user text from forming one. */
const body = (s: string) => s.replace(/\{/g, "{\u200b").replace(/\}/g, "\u200b}");
/** Track Changes reads a leading "Name:" in a comment as its author and hides it; keep a comment that starts that way intact. */
const noAuthorPrefix = (s: string) => s.replace(/^(\s*[A-Za-z][\w.-]{0,29})(\s*:)/, "$1\u200b$2");
/** Metadata values: double-quoted, no quote, brace or newline allowed. */
const attr = (s: string) => s.replace(/["{}\r\n]/g, " ").replace(/\s+/g, " ").trim();
const prefix = (author: string, date: string) => {
  const a = attr(author);
  const d = attr(date);
  return [a ? `author="${a}"` : "", d ? `date="${d}"` : ""].filter(Boolean).join(" ");
};
const mark = (pre: string, sigil: string, inner: string, close: string) => `{${pre}${sigil}${inner}${close}}`;

/**
 * CriticMarkup output, written to the syntax of the Track Changes plugin's parser (philphilphil/obsidian-track-changes 2.2.0, src/parser.ts):
 * {author="A" date="D"++ins++}, {--del--}, {~~old~>new~~}, {==span==}{author="A">>comment<<}; replies are adjacent {>>...<<} blocks.
 */
function criticMarkup(md: string, byId: Map<number, Change>, comments: DocComment[], withComments: boolean, used: DocComment[]): string {
  const cmtAfter = (inner: string) => {
    const refs = inner.match(/⟦CMT\d+⟧/g) ?? [];
    return { inner: inner.replace(/⟦\/?(?:CMT|CMS)\d+⟧/g, ""), refs: refs.join("") };
  };
  const change = (kind: "INS" | "DEL") => (_m: string, id: string, t: string) => {
    const c = byId.get(+id)!;
    const { inner, refs } = cmtAfter(t.trim());
    if (!inner.trim()) return refs;
    const pre = prefix(c.author || "unknown", c.date);
    return mark(pre, kind === "INS" ? "++" : "--", body(inner), kind === "INS" ? "++" : "--") + refs;
  };
  md = md.replace(/⟦INS(\d+)⟧([\s\S]*?)⟦\/INS\1⟧/g, change("INS")).replace(/⟦DEL(\d+)⟧([\s\S]*?)⟦\/DEL\1⟧/g, change("DEL"));
  // A deletion directly followed by an insertion by the same reviewer is one substitution.
  md = md.replace(/\{((?:author="[^"]*")?(?: ?date="[^"]*")?)--([^]*?)--\}\{\1\+\+([^]*?)\+\+\}/g, (_m: string, pre: string, o: string, n: string) => `{${pre}~~${o}~>${n}~~}`);

  const roots = comments.filter((c) => !c.parentId || !comments.some((x) => x.id === c.parentId));
  const rootIds = new Set(roots.map((c) => c.id));
  // A reply to a reply (the file nests deeper than Word's one level) still belongs to its thread's root; a parent cycle is cut.
  const rootOf = (c: DocComment): string => {
    const seen = new Set<string>();
    let cur = c;
    while (cur.parentId && !seen.has(cur.id)) {
      seen.add(cur.id);
      const next = comments.find((x) => x.id === cur.parentId);
      if (!next) break;
      cur = next;
    }
    return cur.id;
  };
  const thread = (root: DocComment) => {
    const all = [root, ...comments.filter((c) => c.id !== root.id && rootOf(c) === root.id)];
    used.push(...all);
    return all.map((c) => `{${prefix(c.author || "unknown", c.date)}>>${c.resolved ? "[resolved] " : ""}${noAuthorPrefix(body(c.text.replace(/\s*\n\s*/g, " ")))}<<}`).join("");
  };
  // Replies share their parent's range; drop their sentinels so only the root's range anchors the thread.
  md = md.replace(/⟦\/?CMS(\d+)⟧/g, (m: string, id: string) => (withComments && rootIds.has(id) ? m : ""));
  const emitted = new Set<string>();
  for (const c of roots) {
    if (!withComments) break;
    const re = new RegExp(`⟦CMS${c.id}⟧([\\s\\S]*?)⟦/CMS${c.id}⟧`);
    md = md.replace(re, (_m: string, inner: string) => {
      emitted.add(c.id);
      const t = thread(c);
      const plain = inner.trim();
      const anchorable = plain && !/[⟦{}\n]/.test(plain);
      return (anchorable ? mark("", "==", plain, "==") : inner) + t;
    });
  }
  md = md.replace(/⟦CMT(\d+)⟧/g, (_m: string, id: string) => {
    const c = comments.find((x) => x.id === id);
    if (!withComments || !c || !rootIds.has(id) || emitted.has(id)) return "";
    emitted.add(id);
    return thread(c);
  });
  return md.replace(STRAY, "");
}
