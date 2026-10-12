import { describe, expect, it } from "vitest";
import { buildDocx } from "./fixture";
import { convertDocx } from "../src/convert";
import { FreeGate, UnlockedGate } from "../src/pro";

const link = (i: number, ext: string) => `img-${i}.${ext}`;
const run = async (buf: Uint8Array, tracked: "mark" | "accept" | "reject" = "mark", comments = true) =>
  convertDocx(buf, { tracked, comments, imageLink: link });
const doc = await buildDocx();

describe("tracked changes", () => {
  it("mark: insert and delete with author and date", async () => {
    const { markdown: md, changes } = await run(doc);
    expect(md).toMatch(/==added words== <!-- insert: Ann Reviewer, 2026-09-01T10:00:00Z -->/);
    expect(md).toMatch(/~~removed words~~ <!-- delete: Bob & Co, 2026-09-02T11:00:00Z -->/);
    expect(changes).toHaveLength(4); // ins, del, moveFrom, moveTo; the paragraph-mark ins is ignored
  });
  it("moved text is a deletion at the source and an insertion at the target", async () => {
    const { markdown: md } = await run(doc);
    expect(md).toMatch(/~~Moved sentence\.~~ <!-- delete \(moved\)/);
    expect(md).toMatch(/==Moved sentence\.== <!-- insert \(moved\)/);
  });
  it("accept keeps insertions, drops deletions, leaves no markers", async () => {
    const { markdown: md } = await run(doc, "accept");
    expect(md).toMatch(/Plain start\. added words and \./);
    expect(md).not.toMatch(/removed words|==|~~|⟦/);
    expect(md.match(/Moved sentence\./g)).toHaveLength(1);
  });
  it("reject restores deletions, drops insertions", async () => {
    const { markdown: md } = await run(doc, "reject");
    expect(md).toMatch(/Plain start\. {1,2}and removed words\./);
    expect(md).not.toMatch(/added words|==|~~|⟦/);
    expect(md.match(/Moved sentence\./g)).toHaveLength(1);
  });
  const nested = `<w:p><w:r><w:t xml:space="preserve">Keep </w:t></w:r><w:del w:id="9" w:author="Cy" w:date="2026-09-05T00:00:00Z"><w:ins w:id="8" w:author="Di" w:date="2026-09-04T00:00:00Z"><w:r><w:delText>vanishing</w:delText></w:r></w:ins></w:del><w:r><w:t xml:space="preserve"> tail.</w:t></w:r></w:p>`;
  it("an insertion deleted by another reviewer is shown once as a deletion (mark) and gone in accept and reject", async () => {
    const d = await buildDocx(nested);
    const mark = (await run(d)).markdown;
    expect(mark).toMatch(/~~vanishing~~ <!-- delete: Cy/);
    expect(mark).not.toMatch(/==/);
    expect((await run(d, "accept")).markdown).not.toMatch(/vanishing/);
    expect((await run(d, "reject")).markdown).not.toMatch(/vanishing/);
  });
  it("an author name cannot break out of the HTML comment", async () => {
    const d = await buildDocx(`<w:p><w:ins w:id="1" w:author="Eve --&gt; &lt;b&gt;x" w:date="2026-09-01T00:00:00Z"><w:r><w:t>hi</w:t></w:r></w:ins></w:p>`);
    const md = (await run(d)).markdown;
    expect(md).toMatch(/==hi== <!-- insert: [^>]*-->/);
    expect(md.match(/-->/g)).toHaveLength(1);
  });
  it("bold text inside an insertion keeps its formatting inside the markers", async () => {
    const d = await buildDocx(`<w:p><w:ins w:id="1" w:author="Ann" w:date="2026-09-01T00:00:00Z"><w:r><w:rPr><w:b/></w:rPr><w:t>strong</w:t></w:r></w:ins></w:p>`);
    expect((await run(d)).markdown).toMatch(/==\*\*strong\*\*== <!-- insert: Ann/);
  });
  it("an empty document converts to empty markdown without errors, in every mode", async () => {
    const d = await buildDocx("");
    for (const mode of ["mark", "accept", "reject"] as const) {
      const { markdown, changes } = await run(d, mode);
      expect(markdown.trim()).toBe("");
      expect(changes).toHaveLength(0);
    }
  });
  it("a document without tracked changes is unchanged", async () => {
    const { markdown, changes } = await run(await buildDocx(`<w:p><w:r><w:t>Hello</w:t></w:r></w:p>`));
    expect(markdown.trim()).toBe("Hello");
    expect(changes).toHaveLength(0);
  });
});

describe("comments, footnotes, images", () => {
  it("comments become footnotes with author and date; the reply is linked to its parent", async () => {
    const { markdown: md, comments } = await run(doc);
    expect(comments).toHaveLength(2);
    expect(md).toMatch(/Commented text\[\^c1\]\[\^c2\]/);
    expect(md).toMatch(/^\[\^c1\]: Comment \(Ann Reviewer, 2026-09-04T08:00:00Z\): Please check this$/m);
    expect(md).toMatch(/^\[\^c2\]: Comment \(reply to \[\^c1\], Bob - Co, 2026-09-04T08:00:00Z\): Reply: done$/m);
  });
  it("comments can be switched off", async () => {
    const { markdown: md } = await run(doc, "mark", false);
    expect(md).not.toMatch(/Please check this|\[\^c/);
  });
  it("footnotes become Obsidian [^n] footnotes", async () => {
    const md = (await run(doc)).markdown;
    expect(md).toMatch(/with note\[\^1\]/);
    expect(md).toMatch(/^\[\^1\]: The footnote text\.$/m);
    expect(md).not.toMatch(/#footnote|⟦/);
  });
  it("images are extracted with bytes and linked", async () => {
    const { images, markdown } = await run(doc);
    expect(images).toHaveLength(1);
    expect(images[0].ext).toBe("png");
    expect(Array.from(images[0].data.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(markdown).toMatch(/!\[tiny\]\(img-1\.png\)/);
  });
  it("rejects a file that is not a docx", async () => {
    await expect(run(new Uint8Array([1, 2, 3]))).rejects.toThrow();
  });
});

describe("batch (free)", () => {
  it("several files convert independently (the plugin loops over these calls)", async () => {
    const a = await buildDocx(`<w:p><w:r><w:t>First</w:t></w:r></w:p>`);
    const b = await buildDocx(`<w:p><w:r><w:t>Second</w:t></w:r></w:p>`);
    const out = await Promise.all([a, b, doc].map((f) => run(f)));
    expect(out.map((o) => o.markdown.split("\n")[0])).toEqual(["First", "Second", expect.stringContaining("Plain start")]);
  });
});

describe("pro gate", () => {
  it("free gate locks the Pro feature (tracked changes), unlocked gate opens it", () => {
    for (const f of ["trackedChanges"] as const) {
      expect(new FreeGate().has(f)).toBe(false);
      expect(new UnlockedGate().has(f)).toBe(true);
    }
  });
});
