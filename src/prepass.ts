// Tracked-changes pre-pass: rewrites word/document.xml with a real XML parser before mammoth sees it.
// mammoth silently accepts w:ins and drops w:del; this makes both visible (or picks accept / reject),
// and turns comment references into sentinel text so comments can be rendered as Obsidian footnotes.
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

export type TrackedMode = "mark" | "accept" | "reject";

export interface Change {
  id: number;
  type: "insert" | "delete";
  moved: boolean;
  author: string;
  date: string;
}

export interface DocComment {
  id: string;
  author: string;
  date: string;
  text: string;
  /** id of the comment this one replies to, when the file says so. */
  parentId?: string;
  /** Word's "Resolve" flag (w15:done) on the thread. */
  resolved?: boolean;
}

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const W14 = "http://schemas.microsoft.com/office/word/2010/wordml";
const W15 = "http://schemas.microsoft.com/office/word/2012/wordml";
export const OPEN = (kind: string, id: number | string) => `⟦${kind}${id}⟧`;
export const CLOSE = (kind: string, id: number | string) => `⟦/${kind}${id}⟧`;

const parse = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");
const wAttr = (el: Element, n: string) => el.getAttributeNS(W, n) ?? el.getAttribute(`w:${n}`) ?? "";
const kids = (el: Node): Node[] => (el.childNodes ? Array.from({ length: el.childNodes.length }, (_, i) => el.childNodes[i]) : []);
const isW = (n: Node, local: string): n is Element => n.nodeType === 1 && (n as Element).namespaceURI === W && (n as Element).localName === local;

function textRun(doc: Document, text: string): Element {
  const r = doc.createElementNS(W, "w:r");
  const t = doc.createElementNS(W, "w:t");
  t.setAttribute("xml:space", "preserve");
  t.appendChild(doc.createTextNode(text));
  r.appendChild(t);
  return r;
}

function delTextToText(doc: Document, root: Element) {
  const found: Element[] = [];
  const walk = (n: Node) => {
    kids(n).forEach((c) => {
      if (isW(c, "delText")) found.push(c);
      else walk(c);
    });
  };
  walk(root);
  for (const d of found) {
    const t = doc.createElementNS(W, "w:t");
    t.setAttribute("xml:space", "preserve");
    kids(d).forEach((c) => t.appendChild(c));
    d.parentNode!.replaceChild(t, d);
  }
}

const KINDS: Record<string, { added: boolean; moved: boolean }> = {
  ins: { added: true, moved: false },
  moveTo: { added: true, moved: true },
  del: { added: false, moved: false },
  moveFrom: { added: false, moved: true },
};

/**
 * Rewrites tracked changes in a parsed document. Only run-level changes are handled
 * (w:ins, w:del, w:moveFrom, w:moveTo with content). Paragraph-mark changes, formatting changes
 * (w:rPrChange, w:pPrChange) and w:ins inside w:del are documented limits; see README.
 */
export function rewriteTrackedChanges(doc: Document, mode: TrackedMode): Change[] {
  const changes: Change[] = [];
  let n = 0;
  const visit = (parent: Node, insideDel: boolean) => {
    for (const c of kids(parent)) {
      if (c.nodeType !== 1) continue;
      const el = c as Element;
      const local = el.localName;
      if (el.namespaceURI === W && KINDS[local] && el.childNodes.length > 0 && parent.nodeName !== "w:rPr" && parent.nodeName !== "w:trPr") {
        const { added, moved } = KINDS[local];
        const parentNode = el.parentNode!;
        // An insertion inside a deletion (a reviewer deleted another reviewer's insertion) is
        // gone whether you accept the deletion or reject the insertion: drop it in accept/reject.
        const nestedIns = added && insideDel;
        if (mode === "accept" && (!added || nestedIns)) { parentNode.removeChild(el); continue; }
        if (mode === "reject" && (added || nestedIns)) { parentNode.removeChild(el); continue; }
        if (mode !== "mark" || nestedIns) {
          // unwrap, keep content (rejected deletions become normal text)
          if (!added) delTextToText(doc, el);
          visit(el, insideDel || !added);
          kids(el).forEach((k) => parentNode.insertBefore(k, el));
          parentNode.removeChild(el);
          continue;
        }
        const id = ++n;
        changes.push({ id, type: added ? "insert" : "delete", moved, author: wAttr(el, "author"), date: wAttr(el, "date") });
        if (!added) delTextToText(doc, el);
        visit(el, !added);
        const kind = added ? "INS" : "DEL";
        parentNode.insertBefore(textRun(doc, OPEN(kind, id)), el);
        kids(el).forEach((k) => parentNode.insertBefore(k, el));
        parentNode.insertBefore(textRun(doc, CLOSE(kind, id)), el);
        parentNode.removeChild(el);
        continue;
      }
      visit(el, insideDel);
    }
  };
  visit(doc.documentElement, false);
  return changes;
}

/**
 * Replace each w:commentReference by sentinel text so it survives mammoth and turndown.
 * A comment range (commentRangeStart .. commentRangeEnd) becomes a CMS sentinel pair when both
 * ends sit in the same paragraph; otherwise the range is dropped and the comment stays at its reference.
 */
function markCommentReferences(doc: Document) {
  const refs = Array.from(doc.getElementsByTagNameNS(W, "commentReference"));
  for (const r of refs) {
    const run = r.parentNode as Element;
    const id = wAttr(r, "id");
    run.replaceChild(textRun(doc, OPEN("CMT", id)).firstChild!, r);
  }
  const paragraphOf = (n: Node): Node | null => {
    for (let p = n.parentNode; p; p = p.parentNode) if (isW(p, "p")) return p;
    return null;
  };
  const ends = new Map<string, Element>();
  for (const e of Array.from(doc.getElementsByTagNameNS(W, "commentRangeEnd"))) ends.set(wAttr(e, "id"), e);
  for (const s of Array.from(doc.getElementsByTagNameNS(W, "commentRangeStart"))) {
    const id = wAttr(s, "id");
    const e = ends.get(id);
    const p = paragraphOf(s);
    if (e && p && p === paragraphOf(e) && s.parentNode && e.parentNode) {
      s.parentNode.replaceChild(textRun(doc, OPEN("CMS", id)), s);
      e.parentNode.replaceChild(textRun(doc, CLOSE("CMS", id)), e);
    } else {
      s.parentNode?.removeChild(s);
      e?.parentNode?.removeChild(e);
    }
  }
}

const paraText = (p: Element) =>
  Array.from(p.getElementsByTagNameNS(W, "t")).map((t) => t.textContent ?? "").join("");

export async function readComments(zip: JSZip): Promise<DocComment[]> {
  const f = zip.file("word/comments.xml");
  if (!f) return [];
  const doc = parse(await f.async("string"));
  const paraIdOf = new Map<string, string>(); // w14:paraId of a comment's last paragraph -> comment id
  const out: DocComment[] = [];
  for (const c of Array.from(doc.getElementsByTagNameNS(W, "comment"))) {
    const paras = Array.from(c.getElementsByTagNameNS(W, "p"));
    const last = paras[paras.length - 1];
    const pid = last?.getAttributeNS(W14, "paraId");
    const id = wAttr(c, "id");
    if (pid) paraIdOf.set(pid, id);
    out.push({ id, author: wAttr(c, "author"), date: wAttr(c, "date"), text: paras.map(paraText).join("\n").trim() });
  }
  const ext = zip.file("word/commentsExtended.xml");
  if (ext) {
    const ed = parse(await ext.async("string"));
    for (const e of Array.from(ed.getElementsByTagNameNS(W15, "commentEx"))) {
      const parent = e.getAttributeNS(W15, "paraIdParent");
      const self = paraIdOf.get(e.getAttributeNS(W15, "paraId") ?? "");
      const pid = parent ? paraIdOf.get(parent) : undefined;
      const mine = out.find((c) => c.id === self);
      if (mine && pid) mine.parentId = pid;
      if (mine && e.getAttributeNS(W15, "done") === "1") mine.resolved = true;
    }
  }
  return out;
}

export async function prepassDocx(buf: ArrayBuffer | Uint8Array, mode: TrackedMode) {
  const zip = await JSZip.loadAsync(buf);
  const f = zip.file("word/document.xml");
  if (!f) throw new Error("Not a .docx file: word/document.xml is missing.");
  const doc = parse(await f.async("string"));
  const changes = rewriteTrackedChanges(doc, mode);
  markCommentReferences(doc);
  zip.file("word/document.xml", new XMLSerializer().serializeToString(doc));
  const comments = await readComments(zip);
  const buffer = await zip.generateAsync({ type: "uint8array" });
  return { buffer, changes, comments };
}
