import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database and payment services
vi.mock("./db", () => ({
  getDb: vi.fn(),
  getWalletsByUserId: vi.fn().mockResolvedValue([]),
  getTransactionsByUserId: vi.fn().mockResolvedValue([]),
  getImplantsByUserId: vi.fn().mockResolvedValue([]),
  getCardsByUserId: vi.fn().mockResolvedValue([]),
  createImplant: vi.fn().mockResolvedValue({
    id: 1,
    userId: 1,
    implantId: "test-implant-123",
    implantType: "Apex Flex",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
}));

vi.mock("./services/unifiedPaymentService", () => ({
  processDeposit: vi.fn().mockResolvedValue({
    success: true,
    transactionId: "txn_test_123",
    amount: 100,
    method: "crypto",
    status: "pending",
    message: "Crypto deposit initiated",
    estimatedCompletion: "10-30 minutes",
    details: { depositAddress: "0xabc123" },
  }),
  processWithdrawal: vi.fn().mockResolvedValue({
    success: true,
    transactionId: "txn_test_456",
    amount: 50,
    method: "crypto",
    status: "pending",
    message: "Crypto withdrawal initiated",
    estimatedCompletion: "10-30 minutes",
    details: {},
  }),
  checkPaymentStatus: vi.fn().mockResolvedValue({
    found: true,
    status: "pending",
    message: "Transaction is being processed",
  }),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-open-id",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("bank router", () => {
  let authCaller: ReturnType<typeof appRouter.createCaller>;
  let unauthCaller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    authCaller = appRouter.createCaller(createAuthContext());
    unauthCaller = appRouter.createCaller(createUnauthContext());
    vi.clearAllMocks();
  });

  describe("bank.getPaymentMethods", () => {
    it("returns available payment methods (public)", async () => {
      const methods = await unauthCaller.bank.getPaymentMethods();
      expect(methods).toHaveLength(3);
      expect(methods.map((m) => m.id)).toEqual(["crypto", "ach", "wire"]);
      expect(methods[0].currencies).toContain("BTC");
      expect(methods[0].currencies).toContain("ETH");
    });
  });

  describe("bank.getTransactions", () => {
    it("returns empty array for new user", async () => {
      const txns = await authCaller.bank.getTransactions();
      expect(txns).toEqual([]);
    });

    it("rejects unauthenticated requests", async () => {
      await expect(unauthCaller.bank.getTransactions()).rejects.toThrow();
    });
  });

  describe("bank.checkStatus", () => {
    it("returns status for a transaction", async () => {
      const status = await authCaller.bank.checkStatus({
        transactionId: "txn_test_123",
      });
      expect(status.found).toBe(true);
      expect(status.status).toBe("pending");
    });

    it("rejects unauthenticated requests", async () => {
      await expect(
        unauthCaller.bank.checkStatus({ transactionId: "txn_test_123" })
      ).rejects.toThrow();
    });
  });
});

describe("implant router", () => {
  let authCaller: ReturnType<typeof appRouter.createCaller>;
  let unauthCaller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    authCaller = appRouter.createCaller(createAuthContext());
    unauthCaller = appRouter.createCaller(createUnauthContext());
    vi.clearAllMocks();
  });

  describe("implant.list", () => {
    it("returns empty array for new user", async () => {
      const implants = await authCaller.implant.list();
      expect(implants).toEqual([]);
    });

    it("rejects unauthenticated requests", async () => {
      await expect(unauthCaller.implant.list()).rejects.toThrow();
    });
  });

  describe("implant.link", () => {
    it("creates a new implant link", async () => {
      const result = await authCaller.implant.link({
        implantId: "test-implant-123",
        implantType: "Apex Flex",
      });
      expect(result.implantId).toBe("test-implant-123");
      expect(result.implantType).toBe("Apex Flex");
      expect(result.status).toBe("active");
    });

    it("rejects unauthenticated requests", async () => {
      await expect(
        unauthCaller.implant.link({
          implantId: "test-implant-123",
        })
      ).rejects.toThrow();
    });
  });
});

describe("card router", () => {
  let authCaller: ReturnType<typeof appRouter.createCaller>;
  let unauthCaller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    authCaller = appRouter.createCaller(createAuthContext());
    unauthCaller = appRouter.createCaller(createUnauthContext());
    vi.clearAllMocks();
  });

  describe("card.list", () => {
    it("returns empty array for new user", async () => {
      const cards = await authCaller.card.list();
      expect(cards).toEqual([]);
    });

    it("rejects unauthenticated requests", async () => {
      await expect(unauthCaller.card.list()).rejects.toThrow();
    });
  });
});

describe("auth router", () => {
  it("auth.me returns user for authenticated context", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const me = await caller.auth.me();
    expect(me).not.toBeNull();
    expect(me?.name).toBe("Test User");
    expect(me?.email).toBe("test@example.com");
  });

  it("auth.me returns null for unauthenticated context", async () => {
    const caller = appRouter.createCaller(createUnauthContext());
    const me = await caller.auth.me();
    expect(me).toBeNull();
  });
});
