// Synthetic OOXML fixtures (no real Word-saved file available: see README).
import JSZip from "jszip";
const NS: string = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"';
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
export const BODY = `
<w:p><w:r><w:t xml:space="preserve">Plain start. </w:t></w:r>
 <w:ins w:id="1" w:author="Ann Reviewer" w:date="2026-09-01T10:00:00Z"><w:r><w:t>added words</w:t></w:r></w:ins>
 <w:r><w:t xml:space="preserve"> and </w:t></w:r>
 <w:del w:id="2" w:author="Bob &amp; Co" w:date="2026-09-02T11:00:00Z"><w:r><w:delText>removed words</w:delText></w:r></w:del>
 <w:r><w:t>.</w:t></w:r></w:p>
<w:p><w:moveFrom w:id="3" w:author="Ann Reviewer" w:date="2026-09-03T09:00:00Z"><w:r><w:t>Moved sentence.</w:t></w:r></w:moveFrom><w:r><w:t xml:space="preserve"> Middle. </w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">Tail. </w:t></w:r><w:moveTo w:id="4" w:author="Ann Reviewer" w:date="2026-09-03T09:00:00Z"><w:r><w:t>Moved sentence.</w:t></w:r></w:moveTo></w:p>
<w:p><w:pPr><w:rPr><w:ins w:id="5" w:author="Ann Reviewer" w:date="2026-09-01T10:00:00Z"/></w:rPr></w:pPr><w:r><w:t xml:space="preserve">Commented </w:t></w:r>
 <w:commentRangeStart w:id="0"/><w:r><w:t>text</w:t></w:r><w:commentRangeEnd w:id="0"/><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="0"/></w:r>
 <w:commentRangeStart w:id="1"/><w:commentRangeEnd w:id="1"/><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="1"/></w:r>
 <w:r><w:t xml:space="preserve"> with note</w:t></w:r><w:r><w:footnoteReference w:id="2"/></w:r></w:p>
<w:p><w:r><w:drawing><wp:inline><wp:extent cx="95250" cy="95250"/><wp:docPr id="1" name="p" descr="tiny"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="p"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImg"/></pic:blipFill><pic:spPr/></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;

export async function buildDocx(body: string = BODY): Promise<Uint8Array> {
  const z = new JSZip();
  z.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/><Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
  z.file("_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  z.file("word/_rels/document.xml.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdC" Type="${R}/comments" Target="comments.xml"/><Relationship Id="rIdF" Type="${R}/footnotes" Target="footnotes.xml"/><Relationship Id="rIdS" Type="${R}/styles" Target="styles.xml"/><Relationship Id="rIdImg" Type="${R}/image" Target="media/p.png"/></Relationships>`);
  z.file("word/styles.xml", `<?xml version="1.0"?><w:styles ${NS}><w:style w:type="character" w:styleId="CommentReference"><w:name w:val="annotation reference"/></w:style></w:styles>`);
  z.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?><w:document ${NS}><w:body>${body}</w:body></w:document>`);
  const cm = (id: number, auth: string, txt: string, pid: string) => `<w:comment w:id="${id}" w:author="${auth}" w:date="2026-09-04T08:00:00Z" w:initials="X"><w:p w14:paraId="${pid}"><w:r><w:t>${txt}</w:t></w:r></w:p></w:comment>`;
  z.file("word/comments.xml", `<?xml version="1.0"?><w:comments ${NS}>${cm(0, "Ann Reviewer", "Please check this", "0000000A")}${cm(1, "Bob -- Co", "Reply: done", "0000000B")}</w:comments>`);
  z.file("word/footnotes.xml", `<?xml version="1.0"?><w:footnotes ${NS}><w:footnote w:id="2"><w:p><w:r><w:t>The footnote text.</w:t></w:r></w:p></w:footnote></w:footnotes>`);
  z.file("word/commentsExtended.xml", `<?xml version="1.0"?><w15:commentsEx xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"><w15:commentEx w15:paraId="0000000A" w15:done="0"/><w15:commentEx w15:paraId="0000000B" w15:paraIdParent="0000000A" w15:done="0"/></w15:commentsEx>`);
  z.file("word/media/p.png", PNG);
  return z.generateAsync({ type: "uint8array" });
}
