import { describe, expect, it } from "vitest";
import { convertDocx } from "../src/convert";
import { googleDocs, wordWeb, looseEnds } from "./fixture-hosted";

const run = async (buf: Uint8Array, tracked: "mark" | "accept" | "reject" = "mark", style: "plain" | "critic" = "plain") =>
  convertDocx(buf, { tracked, comments: true, style, imageLink: (i, e) => `i${i}.${e}` });

describe("Google Docs-style file", () => {
  it("heading, suggestions, hyperlink, footnote (separators ignored)", async () => {
    const md = (await run(await googleDocs())).markdown;
    expect(md).toMatch(/^# Quarterly notes/m);
    expect(md).toMatch(/~~might~~ <!-- delete: Gail Editor/);
    expect(md).toMatch(/==will== <!-- insert: Gail Editor/);
    expect(md).toMatch(/\[==the page== <!-- insert: Gail Editor[^\]]*\]\(https:\/\/example\.com\/page\)/);
    expect(md).toMatch(/\[\^1\]: Source: internal plan\.$/m);
    expect(md).not.toMatch(/⟦/);
  });
  it("two comments on one range without commentsExtended are both kept, as separate top-level comments", async () => {
    const md = (await run(await googleDocs())).markdown;
    expect(md).toMatch(/the beta\[\^c1\]\[\^c2\]/);
    expect(md).toMatch(/^\[\^c1\]: Comment \(Gail Editor, [^)]*\): Is the date firm\?$/m);
    expect(md).toMatch(/^\[\^c2\]: Comment \(Hal Author, [^)]*\): Yes, end of month\.$/m);
  });
  it("accept and reject leave no markers", async () => {
    const a = (await run(await googleDocs(), "accept")).markdown;
    expect(a).toMatch(/We will ship/);
    expect(a).not.toMatch(/might|==|~~|⟦/);
    const r = (await run(await googleDocs(), "reject")).markdown;
    expect(r).toMatch(/We might ship/);
    expect(r).not.toMatch(/will|==|~~|⟦/);
  });
});

describe("Word for the web-style file", () => {
  it("formatting change keeps the text, paragraph-mark deletion does not eat text", async () => {
    const md = (await run(await wordWeb())).markdown;
    expect(md).toMatch(/Intro with \*\*bold now\*\* and/);
    expect(md).toMatch(/First half of a long claim/);
    expect(md).toMatch(/second half of it/);
  });
  it("deletion and insertion inside a hyperlink", async () => {
    const md = (await run(await wordWeb())).markdown;
    expect(md).toMatch(/old link/);
    expect(md).toMatch(/new link/);
    expect(md).not.toMatch(/⟦/);
    const acc = (await run(await wordWeb(), "accept")).markdown;
    expect(acc).toMatch(/new link/);
    expect(acc).not.toMatch(/old link/);
  });
  it("multi-paragraph comment, threads from commentsExtended (also reply-to-reply), range across paragraphs", async () => {
    const { markdown: md, comments } = await run(await wordWeb());
    expect(comments.map((c) => c.id).sort()).toEqual(["5", "6", "7", "8"]);
    expect(comments.find((c) => c.id === "6")?.parentId).toBe("5");
    expect(comments.find((c) => c.id === "7")?.parentId).toBe("6");
    expect(md).toMatch(/Needs a source\. Second paragraph of the comment\./);
    expect(md).toMatch(/\[\^c1\]: Comment \(Ida Reviewer/);
    expect(md).toMatch(/\[\^c2\]: Comment \(reply to \[\^c1\], Hal Author/);
    expect(md).toMatch(/\[\^c3\]: Comment \(reply to \[\^c2\], Ida Reviewer/);
    expect(md).toMatch(/Inserted and commented/);
  });
  it("footnote reference inside an insertion", async () => {
    for (const t of ["mark", "accept"] as const) {
      const md = (await run(await wordWeb(), t)).markdown;
      expect(md).toMatch(/with a note\[\^1\]/);
      expect(md).toMatch(/^\[\^1\]: A web-made footnote\.$/m);
    }
  });
  it("critic style: every comment appears once and nothing leaks", async () => {
    const { markdown: md } = await run(await wordWeb(), "mark", "critic");
    for (const t of ["Needs a source.", "Added one.", "Thanks, resolved.", "Fine."]) expect(md.split(t).length - 1).toBe(1);
    expect(md).not.toMatch(/⟦/);
  });
});

describe("loose ends", () => {
  it("comment without range or author, reference to a missing comment", async () => {
    const { markdown: md } = await run(await looseEnds());
    expect(md).toMatch(/Reference only\[\^c1\] then missing\./);
    expect(md).toMatch(/^\[\^c1\]: Comment \(unknown, [^)]*\): No author here\.$/m);
    expect(md).not.toMatch(/⟦|\[\^c2\]/);
  });
});
