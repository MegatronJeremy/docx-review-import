// Builds samples/sample-review.docx: a tiny synthetic "reviewed" document (invented reviewers, not saved by Word).
import JSZip from "jszip";
import { writeFileSync, mkdirSync } from "node:fs";
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"';
const H = (t) => `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${t}</w:t></w:r></w:p>`;
const body = `
${H("Project update")}
<w:p><w:r><w:t xml:space="preserve">The launch is planned for </w:t></w:r><w:del w:id="1" w:author="Sam Reviewer" w:date="2026-09-01T10:00:00Z"><w:r><w:delText>March</w:delText></w:r></w:del><w:ins w:id="2" w:author="Sam Reviewer" w:date="2026-09-01T10:00:00Z"><w:r><w:t>May</w:t></w:r></w:ins><w:r><w:t xml:space="preserve"> and the budget is </w:t></w:r><w:commentRangeStart w:id="0"/><w:r><w:t>on track</w:t></w:r><w:commentRangeEnd w:id="0"/><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="0"/></w:r><w:r><w:t>.</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">Next step: send the plan to the team</w:t></w:r><w:ins w:id="3" w:author="Sam Reviewer" w:date="2026-09-01T10:05:00Z"><w:r><w:t xml:space="preserve"> by Friday</w:t></w:r></w:ins><w:r><w:t>.</w:t></w:r></w:p>`;
const z = new JSZip();
z.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
z.file("_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
z.file("word/_rels/document.xml.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdC" Type="${R}/comments" Target="comments.xml"/><Relationship Id="rIdS" Type="${R}/styles" Target="styles.xml"/></Relationships>`);
z.file("word/styles.xml", `<?xml version="1.0"?><w:styles ${NS}><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style><w:style w:type="character" w:styleId="CommentReference"><w:name w:val="annotation reference"/></w:style></w:styles>`);
z.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?><w:document ${NS}><w:body>${body}</w:body></w:document>`);
z.file("word/comments.xml", `<?xml version="1.0"?><w:comments ${NS}><w:comment w:id="0" w:author="Alex Reviewer" w:date="2026-09-02T08:00:00Z" w:initials="AR"><w:p><w:r><w:t>Can you add the Q3 figure here?</w:t></w:r></w:p></w:comment></w:comments>`);
mkdirSync("samples", { recursive: true });
writeFileSync("samples/sample-review.docx", await z.generateAsync({ type: "uint8array", compression: "DEFLATE" }));
console.log("wrote samples/sample-review.docx");
