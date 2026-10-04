import { describe, expect, it } from "vitest";
import { buildDocx } from "./fixture";
import { convertDocx } from "../src/convert";

const critic = async (buf: Uint8Array, tracked: "mark" | "accept" | "reject" = "mark", comments = true) =>
  convertDocx(buf, { tracked, comments, style: "critic", imageLink: (i, e) => `img-${i}.${e}` });
const doc = await buildDocx();

describe("CriticMarkup style", () => {
  it("insertions, deletions and moves carry author and date", async () => {
    const md = (await critic(doc)).markdown;
    expect(md).toContain('{author="Ann Reviewer" date="2026-09-01T10:00:00Z"++added words++}');
    expect(md).toContain('{author="Bob & Co" date="2026-09-02T11:00:00Z"--removed words--}');
    expect(md).toContain('{author="Ann Reviewer" date="2026-09-03T09:00:00Z"--Moved sentence.--}');
    expect(md).toContain('{author="Ann Reviewer" date="2026-09-03T09:00:00Z"++Moved sentence.++}');
    expect(md).not.toMatch(/⟦|~~|<!--/);
  });
  it("comment: highlighted span, then the comment, then its reply as an adjacent block", async () => {
    const md = (await critic(doc)).markdown;
    expect(md).toContain('{==text==}{author="Ann Reviewer" date="2026-09-04T08:00:00Z">>Please check this<<}{author="Bob -- Co" date="2026-09-04T08:00:00Z">>Reply\u200b: done<<}');
    // the fixture reply starts "Reply:", which Track Changes would read as an author name: a zero-width space keeps it text
    expect(md).not.toMatch(/\[\^c/);
    expect(md).toMatch(/with note\[\^1\]/);
  });
  it("comments off: no comment marks, tracked marks stay", async () => {
    const md = (await critic(doc, "mark", false)).markdown;
    expect(md).not.toMatch(/>>|\{==/);
    expect(md).toContain("++added words++");
  });
  it("accept and reject leave no CriticMarkup change marks", async () => {
    for (const m of ["accept", "reject"] as const) {
      const md = (await critic(doc, m)).markdown;
      expect(md).not.toMatch(/(\+\+|--)\}/);
    }
  });
  it("a deletion directly followed by an insertion by the same reviewer becomes a substitution", async () => {
    const d = await buildDocx(`<w:p><w:r><w:t xml:space="preserve">A </w:t></w:r><w:del w:id="1" w:author="Ann" w:date="2026-09-01T00:00:00Z"><w:r><w:delText>old</w:delText></w:r></w:del><w:ins w:id="2" w:author="Ann" w:date="2026-09-01T00:00:00Z"><w:r><w:t>new</w:t></w:r></w:ins><w:r><w:t xml:space="preserve"> B</w:t></w:r></w:p>`);
    expect((await critic(d)).markdown).toContain('A {author="Ann" date="2026-09-01T00:00:00Z"~~old~>new~~} B');
    const other = await buildDocx(`<w:p><w:del w:id="1" w:author="Ann" w:date="2026-09-01T00:00:00Z"><w:r><w:delText>old</w:delText></w:r></w:del><w:ins w:id="2" w:author="Bob" w:date="2026-09-01T00:00:00Z"><w:r><w:t>new</w:t></w:r></w:ins></w:p>`);
    expect((await critic(other)).markdown).not.toContain("~>");
  });
  it("braces and quotes in names and text cannot end or forge a mark", async () => {
    const d = await buildDocx(`<w:p><w:ins w:id="1" w:author="Eve &quot;}{x" w:date="2026-09-01T00:00:00Z"><w:r><w:t>a ++} {--b--} c</w:t></w:r></w:ins></w:p>`);
    const md = (await critic(d)).markdown;
    expect(md).toMatch(/^\{author="Eve x" date="[^"]*"\+\+/);
    // exactly one mark: the first closing "++}" is the real one
    expect(md.match(/\+\+\}/g)).toHaveLength(1);
    expect(md.match(/--\}/g)).toBeNull();
  });
  it("a comment whose range spans paragraphs still appears, after its reference, without a highlight", async () => {
    const d = await buildDocx(`<w:p><w:commentRangeStart w:id="0"/><w:r><w:t>first</w:t></w:r></w:p><w:p><w:r><w:t>second</w:t></w:r><w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r></w:p>`);
    const md = (await critic(d)).markdown;
    expect(md).toContain('second{author="Ann Reviewer" date="2026-09-04T08:00:00Z">>Please check this<<}');
    expect(md).not.toMatch(/\{==|⟦/);
  });
});

describe("plain style is unchanged by comment ranges", () => {
  it("no stray markers", async () => {
    const md = (await convertDocx(doc, { tracked: "mark", comments: true, imageLink: () => "x.png" })).markdown;
    expect(md).not.toMatch(/⟦/);
    expect(md).toMatch(/Commented text\[\^c1\]\[\^c2\]/);
  });
});
