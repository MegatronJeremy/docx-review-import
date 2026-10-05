import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { convertDocx } from "../src/convert";

const buf = new Uint8Array(readFileSync("samples/sample-review.docx"));
const run = (tracked: "mark" | "accept" | "reject") => convertDocx(buf, { tracked, comments: true, imageLink: (i, e) => `img-${i}.${e}` });

describe("samples/sample-review.docx (README quick start)", () => {
  it("free import: heading, accepted changes, comment as footnote", async () => {
    const { markdown: md } = await run("accept");
    console.log("--- accept ---\n" + md);
    expect(md).toMatch(/^# Project update/m);
    expect(md).toMatch(/planned for May and/);
    expect(md).not.toMatch(/March/);
    expect(md).toMatch(/send the plan to the team by Friday\./);
    expect(md).toMatch(/\[\^c1\]/);
    expect(md).toMatch(/Can you add the Q3 figure here\?/);
  });
  it("Pro mark mode shows the changes", async () => {
    const { markdown: md } = await run("mark");
    console.log("--- mark ---\n" + md);
    expect(md).toMatch(/~~March~~/);
    expect(md).toMatch(/==May==/);
  });
});
