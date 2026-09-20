import { describe, it, expect, vi } from "vitest";
import { uploadDerivative, contentTypeFor } from "./r2-client.mjs";
import { DERIVATIVE_FORMATS } from "../../shared/media-config.mjs";

describe("uploadDerivative", () => {
  it("sends a PutObjectCommand with the right bucket, key, body, and content type", async () => {
    const send = vi.fn().mockResolvedValue({});
    const fakeClient = { send };

    await uploadDerivative(fakeClient, {
      bucket: "zahedi-portfolio-media",
      key: "photography/neon-shadows-tokyo-1280.webp",
      body: Buffer.from("fake-image-bytes"),
      contentType: "image/webp",
    });

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0][0];
    expect(command.input).toMatchObject({
      Bucket: "zahedi-portfolio-media",
      Key: "photography/neon-shadows-tokyo-1280.webp",
      ContentType: "image/webp",
    });
    expect(command.input.Body).toBeInstanceOf(Buffer);
  });
});

describe("contentTypeFor", () => {
  it("maps every configured derivative format", () => {
    for (const format of DERIVATIVE_FORMATS) {
      expect(contentTypeFor(format)).toMatch(/^image\//);
    }
  });

  it("throws on an unmapped format rather than uploading an undefined content type", () => {
    expect(() => contentTypeFor("jpg")).toThrow(/No content type mapped/);
  });
});
