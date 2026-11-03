import { describe, expect, it } from "vitest";
import { extensionFor, storagePath, validateMedia } from "@/lib/media";

describe("validateMedia", () => {
  it("accepts a normal photo", () => {
    expect(validateMedia("photo", "image/jpeg", 2_000_000)).toBeNull();
  });
  it("refuses a type outside the list", () => {
    expect(validateMedia("photo", "application/pdf", 1000)).toBe("unsupported_type");
  });
  it("refuses empty and oversized files", () => {
    expect(validateMedia("photo", "image/png", 0)).toBe("empty");
    expect(validateMedia("video", "video/mp4", 51 * 1024 * 1024)).toBe("too_large");
  });
  it("caps audio notes at two minutes", () => {
    expect(validateMedia("audio", "audio/webm", 500_000, 120)).toBeNull();
    expect(validateMedia("audio", "audio/webm", 500_000, 121)).toBe("too_long");
  });
});

describe("storage paths", () => {
  it("nests files under user and entry", () => {
    expect(storagePath("u1", "e1", "m1", "image/jpeg")).toBe("u1/e1/m1.jpg");
  });
  it("falls back to bin for unknown types", () => {
    expect(extensionFor("application/x-unknown")).toBe("bin");
  });
});
