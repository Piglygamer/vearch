import { describe, it, expect } from "vitest";
import { vivoKeyService } from "./services/vivoKeyService";

describe("Vivo Key Service", () => {
  it("should validate Vivo Key credentials", async () => {
    const isValid = await vivoKeyService.validateVivoKeyCredentials();
    expect(isValid).toBe(true);
  });

  it("should get Vivo Key statistics", async () => {
    const stats = await vivoKeyService.getVivoKeyStats();
    expect(stats).toHaveProperty("credentialsConfigured");
    expect(stats.credentialsConfigured).toBe(true);
  });
});
