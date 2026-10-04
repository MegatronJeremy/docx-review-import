import { describe, expect, it } from "vitest";
import { GUMROAD_VERIFY_URL, HOW_TO_GET_PRO_URL } from "../src/config";

describe("config", () => {
  it("uses the Gumroad verify endpoint and links to a README section, not a checkout", () => {
    expect(GUMROAD_VERIFY_URL).toBe("https://api.gumroad.com/v2/licenses/verify");
    expect(HOW_TO_GET_PRO_URL).toMatch(/github\.com\/.*#buying-and-activating-pro$/);
  });
});
