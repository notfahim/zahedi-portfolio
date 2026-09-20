import { describe, it, expect } from "vitest";
import { whatsappUrl } from "./contact";

describe("whatsappUrl", () => {
  it("strips everything wa.me will not accept", () => {
    expect(whatsappUrl("+880 1844-000334")).toBe("https://wa.me/8801844000334");
  });

  it("leaves an already-bare number alone", () => {
    expect(whatsappUrl("8801844000334")).toBe("https://wa.me/8801844000334");
  });
});
