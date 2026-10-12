import { describe, expect, it } from "vitest";
import { buildDocx } from "./fixture";
import JSZip from "jszip";
import { convertDocx } from "../src/convert";

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"';
const body = `<w:p><w:r><w:t xml:space="preserve">Start </w:t></w:r><w:ins w:id="1" w:author="Ann" w:date="2026-09-01T10:00:00Z"><w:r><w:t>from Ann</w:t></w:r></w:ins><w:r><w:t xml:space="preserve"> mid </w:t></w:r><w:del w:id="2" w:author="Bob" w:date="2026-09-02T11:00:00Z"><w:r><w:delText>cut by Bob</w:delText></w:r></w:del><w:ins w:id="3" w:author="Bob" w:date="2026-09-02T11:00:00Z"><w:r><w:t>Bob adds</w:t></w:r></w:ins><w:r><w:t xml:space="preserve"> </w:t></w:r><w:del w:id="4" w:author="Ann" w:date="2026-09-03T11:00:00Z"><w:r><w:delText>Ann cuts</w:delText></w:r></w:del></w:p>
<w:p><w:commentRangeStart w:id="0"/><w:r><w:t>threaded</w:t></w:r><w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r><w:r><w:commentReference w:id="1"/></w:r><w:r><w:commentReference w:id="2"/></w:r></w:p>
<w:p><w:commentRangeStart w:id="3"/><w:r><w:t>settled</w:t></w:r><w:commentRangeEnd w:id="3"/><w:r><w:commentReference w:id="3"/></w:r></w:p>`;
const cm = (id: number, a: string, txt: string, pid: string) => `<w:comment w:id="${id}" w:author="${a}" w:date="2026-09-04T08:00:00Z"><w:p w14:paraId="${pid}"><w:r><w:t>${txt}</w:t></w:r></w:p></w:comment>`;

async function build() {
  const z = await JSZip.loadAsync(await buildDocx(body));
  z.file("word/comments.xml", `<?xml version="1.0"?><w:comments ${NS}>${cm(0, "Ann", "Is this right?", "0000000A")}${cm(1, "Bob", "Yes, checked.", "0000000B")}${cm(2, "Cy", "Agreed.", "0000000C")}${cm(3, "Bob", "Typo fixed.", "0000000D")}</w:comments>`);
  z.file("word/commentsExtended.xml", `<?xml version="1.0"?><w15:commentsEx ${NS}><w15:commentEx w15:paraId="0000000A" w15:done="0"/><w15:commentEx w15:paraId="0000000B" w15:paraIdParent="0000000A" w15:done="0"/><w15:commentEx w15:paraId="0000000C" w15:paraIdParent="0000000A" w15:done="0"/><w15:commentEx w15:paraId="0000000D" w15:done="1"/></w15:commentsEx>`);
  return z.generateAsync({ type: "uint8array" });
}
const run = async (style: "plain" | "critic") => convertDocx(await build(), { tracked: "mark", comments: true, style, imageLink: () => "x.png" });

describe("multi-reviewer docx", () => {
  it("plain: each author on their own edits, replies nested, resolved flagged", async () => {
    const { markdown: md } = await run("plain");
    expect(md).toMatch(/==from Ann==\s*<!-- insert: Ann, 2026-09-01/);
    expect(md).toMatch(/~~cut by Bob~~\s*<!-- delete: Bob, 2026-09-02/);
    expect(md).toMatch(/==Bob adds==\s*<!-- insert: Bob/);
    expect(md).toMatch(/~~Ann cuts~~\s*<!-- delete: Ann, 2026-09-03/);
    expect(md).toMatch(/\[\^c1\]: Comment \(Ann, [^)]*\): Is this right\?/);
    expect(md).toMatch(/\[\^c2\]: Comment \(reply to \[\^c1\], Bob, [^)]*\): Yes, checked\./);
    expect(md).toMatch(/\[\^c3\]: Comment \(reply to \[\^c1\], Cy, [^)]*\): Agreed\./);
    expect(md).toMatch(/\[\^c4\]: Comment \(resolved, Bob, [^)]*\): Typo fixed\./);
    expect(md.match(/resolved/g)).toHaveLength(1);
  });
  it("critic: one thread per root in order, resolved marked on the settled thread only", async () => {
    const { markdown: md } = await run("critic");
    expect(md).toMatch(/\{author="Ann" date="2026-09-01T10:00:00Z"\+\+from Ann\+\+\}/);
    expect(md).toMatch(/\{author="Bob"[^}]*~~cut by Bob~>Bob adds~~\}/);
    expect(md).toMatch(/\{author="Ann"[^}]*--Ann cuts--\}/);
    expect(md).toMatch(/\{==threaded==\}\{author="Ann"[^>]*>>Is this right\?<<\}\{author="Bob"[^>]*>>Yes, checked\.<<\}\{author="Cy"[^>]*>>Agreed\.<<\}/);
    expect(md).toMatch(/\{==settled==\}\{author="Bob"[^>]*>>\[resolved\] Typo fixed\.<<\}/);
    expect(md.match(/\[resolved\]/g)).toHaveLength(1);
  });
});
