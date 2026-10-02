import { describe, it, expect } from "vitest";
import { isSafePublicUrl } from "./fetch";

describe("isSafePublicUrl", () => {
  it("allows public https hosts", () => {
    expect(isSafePublicUrl("https://help.netflix.com/en/node/24926")).toBe(true);
  });
  it("blocks loopback, private ranges, and non-http schemes", () => {
    for (const bad of ["http://localhost:3000/", "http://127.0.0.1/", "http://10.0.0.5/", "http://192.168.1.1/", "http://172.16.0.1/", "http://169.254.169.254/latest", "file:///etc/passwd", "ftp://example.com/", "http://intranet/", "http://[::1]/"]) {
      expect(isSafePublicUrl(bad), bad).toBe(false);
    }
  });
});
