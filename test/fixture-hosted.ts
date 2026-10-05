// Synthetic fixtures that mimic the structure of files saved by Google Docs and Word for the web.
// Written from the OOXML structure those apps are known to produce; NOT files saved by those apps (none available here). No real people or text.
import JSZip from "jszip";

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"';
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const MS = "http://schemas.microsoft.com/office/2011/relationships";

export interface Parts {
  body: string;
  comments?: string;
  footnotes?: string;
  extra?: Record<string, string>;
}

export async function buildParts(p: Parts): Promise<Uint8Array> {
  const z = new JSZip();
  const head = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`;
  const ct = (n: string, t: string) => `<Override PartName="/word/${n}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${t}+xml"/>`;
  z.file("[Content_Types].xml", `${head}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${ct("document.xml", "document.main")}${p.comments ? ct("comments.xml", "comments") : ""}${p.footnotes ? ct("footnotes.xml", "footnotes") : ""}</Types>`);
  z.file("_rels/.rels", `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`);
  const rels = [
    p.comments ? `<Relationship Id="rId10" Type="${R}/comments" Target="comments.xml"/>` : "",
    p.footnotes ? `<Relationship Id="rId11" Type="${R}/footnotes" Target="footnotes.xml"/>` : "",
    `<Relationship Id="rId12" Type="${R}/hyperlink" Target="https://example.com/page" TargetMode="External"/>`,
    p.extra?.["word/commentsExtended.xml"] ? `<Relationship Id="rId13" Type="${MS}/commentsExtended" Target="commentsExtended.xml"/>` : "",
    p.extra?.["word/people.xml"] ? `<Relationship Id="rId14" Type="${MS}/people" Target="people.xml"/>` : "",
  ].join("");
  z.file("word/_rels/document.xml.rels", `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`);
  z.file("word/document.xml", `${head}<w:document ${NS}><w:body>${p.body}</w:body></w:document>`);
  if (p.comments) z.file("word/comments.xml", `${head}<w:comments ${NS}>${p.comments}</w:comments>`);
  if (p.footnotes) z.file("word/footnotes.xml", `${head}<w:footnotes ${NS}>${p.footnotes}</w:footnotes>`);
  for (const [path, xml] of Object.entries(p.extra ?? {})) z.file(path, `${head}${xml}`);
  return z.generateAsync({ type: "uint8array" });
}

const sep = `<w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>`;

/**
 * Google Docs style: no commentsExtended, no paraIds, so a reply is just another comment on the same range.
 * Suggestions are w:ins / w:del; text in a w:hyperlink; footnote part with separators; comment runs carry annotationRef.
 */
export const googleDocs = () =>
  buildParts({
    body: `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Quarterly notes</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">We </w:t></w:r><w:del w:id="1" w:author="Gail Editor" w:date="2026-09-10T09:00:00Z"><w:r><w:delText>might</w:delText></w:r></w:del><w:ins w:id="2" w:author="Gail Editor" w:date="2026-09-10T09:00:00Z"><w:r><w:t>will</w:t></w:r></w:ins><w:r><w:t xml:space="preserve"> ship </w:t></w:r><w:commentRangeStart w:id="0"/><w:commentRangeStart w:id="1"/><w:r><w:t>the beta</w:t></w:r><w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r><w:commentRangeEnd w:id="1"/><w:r><w:commentReference w:id="1"/></w:r><w:r><w:t xml:space="preserve"> soon, see </w:t></w:r><w:hyperlink r:id="rId12"><w:ins w:id="3" w:author="Gail Editor" w:date="2026-09-10T09:05:00Z"><w:r><w:t>the page</w:t></w:r></w:ins></w:hyperlink><w:r><w:t>.</w:t></w:r><w:r><w:footnoteReference w:id="1"/></w:r></w:p>`,
    comments: `<w:comment w:id="0" w:author="Gail Editor" w:date="2026-09-10T09:10:00Z"><w:p><w:pPr><w:pStyle w:val="CommentText"/></w:pPr><w:r><w:annotationRef/></w:r><w:r><w:t>Is the date firm?</w:t></w:r></w:p></w:comment><w:comment w:id="1" w:author="Hal Author" w:date="2026-09-10T10:00:00Z"><w:p><w:r><w:annotationRef/></w:r><w:r><w:t>Yes, end of month.</w:t></w:r></w:p></w:comment>`,
    footnotes: `${sep}<w:footnote w:id="1"><w:p><w:r><w:footnoteRef/></w:r><w:r><w:t xml:space="preserve"> Source: internal plan.</w:t></w:r></w:p></w:footnote>`,
  });

/**
 * Word for the web style: paraIds + commentsExtended (threads, resolved flag), people.xml, a multi-paragraph comment,
 * a reply to a reply (Word flattens to one level, but be safe), a comment range across two paragraphs,
 * formatting changes (rPrChange), a paragraph-mark deletion, a deletion inside a hyperlink, a footnote reference inside an insertion.
 */
export const wordWeb = () =>
  buildParts({
    body: `<w:p w14:paraId="1A000001"><w:r><w:t xml:space="preserve">Intro with </w:t></w:r><w:r><w:rPr><w:b/><w:rPrChange w:id="20" w:author="Ida Reviewer" w:date="2026-09-12T08:00:00Z"><w:rPr/></w:rPrChange></w:rPr><w:t>bold now</w:t></w:r><w:r><w:t xml:space="preserve"> and </w:t></w:r><w:hyperlink r:id="rId12"><w:del w:id="21" w:author="Ida Reviewer" w:date="2026-09-12T08:05:00Z"><w:r><w:delText>old link</w:delText></w:r></w:del><w:ins w:id="22" w:author="Ida Reviewer" w:date="2026-09-12T08:05:00Z"><w:r><w:t>new link</w:t></w:r></w:ins></w:hyperlink><w:r><w:t>.</w:t></w:r></w:p>
<w:p w14:paraId="1A000002"><w:pPr><w:rPr><w:del w:id="23" w:author="Ida Reviewer" w:date="2026-09-12T08:10:00Z"/></w:rPr></w:pPr><w:commentRangeStart w:id="5"/><w:r><w:t xml:space="preserve">First half of a long claim </w:t></w:r></w:p>
<w:p w14:paraId="1A000003"><w:r><w:t>second half of it</w:t></w:r><w:commentRangeEnd w:id="5"/><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="5"/></w:r><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="6"/></w:r><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="7"/></w:r></w:p>
<w:p w14:paraId="1A000004"><w:commentRangeStart w:id="8"/><w:ins w:id="24" w:author="Jo Reviewer" w:date="2026-09-12T09:00:00Z"><w:r><w:t>Inserted and commented</w:t></w:r></w:ins><w:commentRangeEnd w:id="8"/><w:r><w:commentReference w:id="8"/></w:r><w:ins w:id="25" w:author="Jo Reviewer" w:date="2026-09-12T09:01:00Z"><w:r><w:t xml:space="preserve"> with a note</w:t></w:r><w:r><w:footnoteReference w:id="3"/></w:r></w:ins></w:p>`,
    comments: `<w:comment w:id="5" w:author="Ida Reviewer" w:date="2026-09-12T08:20:00Z" w:initials="IR"><w:p w14:paraId="2B000005"><w:r><w:annotationRef/></w:r><w:r><w:t>Needs a source.</w:t></w:r></w:p><w:p w14:paraId="2B000015"><w:r><w:t>Second paragraph of the comment.</w:t></w:r></w:p></w:comment>
<w:comment w:id="6" w:author="Hal Author" w:date="2026-09-12T08:30:00Z" w:initials="HA"><w:p w14:paraId="2B000006"><w:r><w:annotationRef/></w:r><w:r><w:t>Added one.</w:t></w:r></w:p></w:comment>
<w:comment w:id="7" w:author="Ida Reviewer" w:date="2026-09-12T08:40:00Z" w:initials="IR"><w:p w14:paraId="2B000007"><w:r><w:annotationRef/></w:r><w:r><w:t>Thanks, resolved.</w:t></w:r></w:p></w:comment>
<w:comment w:id="8" w:author="Jo Reviewer" w:date="2026-09-12T09:05:00Z" w:initials="JR"><w:p w14:paraId="2B000008"><w:r><w:t>Fine.</w:t></w:r></w:p></w:comment>`,
    footnotes: `${sep}<w:footnote w:id="3"><w:p w14:paraId="3C000003"><w:pPr><w:pStyle w:val="FootnoteText"/></w:pPr><w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteRef/></w:r><w:r><w:t xml:space="preserve"> A web-made footnote.</w:t></w:r></w:p></w:footnote>`,
    extra: {
      "word/commentsExtended.xml": `<w15:commentsEx ${NS}><w15:commentEx w15:paraId="2B000015" w15:done="1"/><w15:commentEx w15:paraId="2B000006" w15:paraIdParent="2B000015" w15:done="1"/><w15:commentEx w15:paraId="2B000007" w15:paraIdParent="2B000006" w15:done="1"/><w15:commentEx w15:paraId="2B000008" w15:done="0"/></w15:commentsEx>`,
      "word/people.xml": `<w15:people ${NS}><w15:person w15:author="Ida Reviewer"><w15:presenceInfo w15:providerId="None" w15:userId="Ida Reviewer"/></w15:person></w15:people>`,
    },
  });

/** Edge cases seen in hand-edited or converted files: comments.xml with no commentRange (reference only), a comment whose id has no entry, an empty author. */
export const looseEnds = () =>
  buildParts({
    body: `<w:p><w:r><w:t xml:space="preserve">Reference only</w:t></w:r><w:r><w:commentReference w:id="0"/></w:r><w:r><w:t xml:space="preserve"> then missing</w:t></w:r><w:r><w:commentReference w:id="99"/></w:r><w:r><w:t>.</w:t></w:r></w:p>`,
    comments: `<w:comment w:id="0" w:date="2026-09-13T00:00:00Z"><w:p><w:r><w:t>No author here.</w:t></w:r></w:p></w:comment>`,
  });
