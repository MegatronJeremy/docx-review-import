import { describe, expect, it } from "vitest";
import { linkFor, uniquePath } from "../src/paths";

describe("uniquePath", () => {
  it("returns the plain path when free", () => {
    expect(uniquePath(() => false, "att/Doc-image-1", "png")).toBe("att/Doc-image-1.png");
  });
  it("on a collision returns the suffixed path, and the link points at it (re-import)", () => {
    const existing = new Set(["att/Doc-image-1.png"]);
    const p = uniquePath((x) => existing.has(x), "att/Doc-image-1", "png");
    expect(p).toBe("att/Doc-image-1 (1).png");
    expect(linkFor(p)).toBe("att/Doc-image-1%20%281%29.png");
  });
  it("skips paths reserved earlier in the same import", () => {
    const reserved = new Set<string>();
    const a = uniquePath(() => false, "Doc-image-1", "png", reserved);
    const b = uniquePath(() => false, "Doc-image-1", "png", reserved);
    expect(a).not.toBe(b);
  });
});
