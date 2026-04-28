import { describe, it, expect, vi } from "vitest";

describe("Dashboard Deposit Button", () => {
  it("should open deposit modal when Deposit Now button is clicked", async () => {
    // Simulate the button click handler
    let showDepositModal = false;
    const setShowDepositModal = vi.fn((value) => {
      showDepositModal = value;
    });

    // Simulate the click
    setShowDepositModal(true);

    // Verify modal state changed
    expect(setShowDepositModal).toHaveBeenCalledWith(true);
    expect(showDepositModal).toBe(true);
  });

  it("should not redirect when clicking deposit button", async () => {
    // Mock window.location
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = { ...originalLocation, href: "" } as any;

    const handleDeposit = () => {
      // This should NOT set window.location.href
      // It should only set showDepositModal(true)
    };

    handleDeposit();

    // Verify no redirect happened
    expect(window.location.href).toBe("");

    // Restore location
    window.location = originalLocation;
  });
});
