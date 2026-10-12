import { describe, expect, it } from "vitest";
import { buildDocx } from "./fixture";
import { convertDocx } from "../src/convert";

const run = (buf: Uint8Array, tracked: "mark" | "accept" | "reject" = "mark") =>
  convertDocx(buf, { tracked, comments: true, imageLink: (i, ext) => `att/doc-image-${i}.${ext}` });
const cell = (inner: string) => `<w:tc><w:tcPr><w:tcW w:w="2000" w:type="dxa"/></w:tcPr><w:p>${inner}</w:p></w:tc>`;
const t = (s: string) => `<w:r><w:t xml:space="preserve">${s}</w:t></w:r>`;
const ins = (s: string, id = 21) => `<w:ins w:id="${id}" w:author="Ann" w:date="2026-09-01T10:00:00Z"><w:r><w:t>${s}</w:t></w:r></w:ins>`;
const del = (s: string, id = 22) => `<w:del w:id="${id}" w:author="Bob" w:date="2026-09-02T11:00:00Z"><w:r><w:delText>${s}</w:delText></w:r></w:del>`;
const img = `<w:r><w:drawing><wp:inline><wp:extent cx="95250" cy="95250"/><wp:docPr id="7" name="p" descr="a pasted chart"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="7" name="p"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImg"/></pic:blipFill><pic:spPr/></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
const row = (...cells: string[]) => `<w:tr>${cells.map(cell).join("")}</w:tr>`;
const table = (...rows: string[]) => `<w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="2000"/><w:gridCol w:w="2000"/></w:tblGrid>${rows.join("")}</w:tbl>`;

const body = table(
  row(t("Item"), t("Status")),
  row(t("Budget"), t("draft ") + ins("approved") + del(" rejected")),
  row(t("Chart"), img + t(" caption")),
  row(t("Pipe"), t("a|b")),
) + `<w:p>${t("After table")}</w:p>`;

describe("tables and images in a reviewed docx", () => {
  it("mark: a valid GFM table with tracked edits inside cells marked like body edits", async () => {
    const { markdown: md, changes } = await run(await buildDocx(body));
    expect(md).toMatch(/^\| Item \| Status \|\n\| --- \| --- \|\n/m);
    expect(md).toMatch(/\| Budget \| draft ==approved== <!-- insert: Ann, 2026-09-01T10:00:00Z --> ?~~rejected~~ <!-- delete: Bob, 2026-09-02T11:00:00Z --> \|/);
    expect(changes).toHaveLength(2);
    // every table row stays on a single line with the same column count
    const rows = md.split("\n").filter((l) => l.startsWith("|"));
    expect(rows).toHaveLength(5);
    for (const r of rows) expect(r.replace(/\\\|/g, "").split("|").length).toBe(4);
    expect(md).toMatch(/a\\\|b/);
    expect(md).toMatch(/After table/);
  });
  it("accept and reject resolve cell edits without leaving markers", async () => {
    const acc = (await run(await buildDocx(body), "accept")).markdown;
    expect(acc).toMatch(/\| Budget \| draft approved \|/);
    expect(acc).not.toMatch(/==|~~|⟦|rejected/);
    const rej = (await run(await buildDocx(body), "reject")).markdown;
    expect(rej).toMatch(/\| Budget \| draft {1,2}rejected \|/);
    expect(rej).not.toMatch(/==|~~|⟦|approved/);
  });
  it("an image inside a cell is extracted and linked, keeping alt text", async () => {
    const { markdown: md, images } = await run(await buildDocx(body));
    expect(images).toHaveLength(1);
    expect(images[0].ext).toBe("png");
    expect(images[0].data.length).toBeGreaterThan(20);
    expect(md).toMatch(/\| Chart \| !\[a pasted chart\]\(att\/doc-image-1\.png\) caption \|/);
  });
  it("a body image next to a table is linked too", async () => {
    const { markdown: md, images } = await run(await buildDocx(body + `<w:p>${img}</w:p>`));
    expect(images).toHaveLength(2);
    expect(md).toMatch(/!\[a pasted chart\]\(att\/doc-image-2\.png\)/);
  });
  it("a comment inside a cell does not break the row", async () => {
    const b = table(row(t("H1"), t("H2")), row(`<w:commentRangeStart w:id="0"/>${t("x")}<w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r>`, t("y")));
    const { markdown: md } = await run(await buildDocx(b));
    expect(md).toMatch(/^\| x\[\^c1\] \| y \|$/m);
  });
});
