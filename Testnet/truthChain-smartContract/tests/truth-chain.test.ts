import {
  Cl,
  cvToValue,
} from "@stacks/transactions";
import { beforeEach, describe, expect, it } from "vitest";

// Get test accounts from simnet
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const creator1 = accounts.get("wallet_1")!;
const creator2 = accounts.get("wallet_2")!;
const verifier = accounts.get("wallet_3")!;

// Sample content hashes (32 bytes each)
const sampleHash1 = new Uint8Array(32).fill(1); // All 1s
const sampleHash2 = new Uint8Array(32).fill(2); // All 2s
const invalidHash = new Uint8Array(16).fill(3); // Invalid: only 16 bytes
const duplicateHash = new Uint8Array(32).fill(1); // Same as sampleHash1

describe("TruthChain Content Verification Contract", () => {
  
  beforeEach(() => {
    // Contract is deployed fresh for each test
    // Check initial state
    const totalRegistrations = simnet.getDataVar("truth-chain", "total-registrations");
    expect(totalRegistrations).toBeUint(0);
    
    const contractActive = simnet.getDataVar("truth-chain", "contract-active");
    expect(contractActive).toBeBool(true);
  });

  describe("Contract Initialization", () => {
    it("should initialize with correct default values", () => {
      const stats = simnet.callReadOnlyFn(
        "truth-chain",
        "get-contract-stats",
        [],
        deployer
      );
      
      expect(stats.result).toBeOk(
        Cl.tuple({
          "total-registrations": Cl.uint(0),
          "contract-active": Cl.bool(true),
          "contract-owner": Cl.principal(deployer)
        })
      );
    });

    it("should return correct content types", () => {
      const contentTypes = simnet.callReadOnlyFn(
        "truth-chain",
        "get-content-types",
        [],
        deployer
      );
      
      expect(contentTypes.result).toBeOk(
        Cl.tuple({
          "blog-post": Cl.stringAscii("blog_post"),
          "page": Cl.stringAscii("page"),
          "media": Cl.stringAscii("media"),
          "document": Cl.stringAscii("document"),
          "tweet": Cl.stringAscii("tweet")
        })
      );
    });
  });

  describe("Content Registration", () => {
    it("should successfully register new content", () => {
      const result = simnet.callPublicFn(
        "truth-chain",
        "register-content",
        [
          Cl.buffer(sampleHash1),
          Cl.stringAscii("blog_post")
        ],
        creator1
      );

      expect(result.result).toBeOk(
        Cl.tuple({
          "registration-id": Cl.uint(1),
          "hash": Cl.buffer(sampleHash1),
          "author": Cl.principal(creator1),
          "block-height": Cl.uint(3), // Updated to actual block
          "timestamp": Cl.uint(3) // Updated to match actual timestamp
        })
      );

      // Check total registrations updated
      const totalRegistrations = simnet.getDataVar("truth-chain", "total-registrations");
      expect(totalRegistrations).toBeUint(1);
    });

    it("should register content with different content types", () => {
      const contentTypes = ["blog_post", "page", "media", "document"];
      
      contentTypes.forEach((contentType, index) => {
        const hash = new Uint8Array(32).fill(index + 10);
        const result = simnet.callPublicFn(
          "truth-chain",
          "register-content",
          [
            Cl.buffer(hash),
            Cl.stringAscii(contentType)
          ],
          creator1
        );

        expect(result.result).toBeOk(
          Cl.tuple({
            "registration-id": Cl.uint(index + 1),
            "hash": Cl.buffer(hash),
            "author": Cl.principal(creator1),
            "block-height": Cl.uint(index + 3), // Updated block calculation
            "timestamp": Cl.uint(index + 3) // Updated timestamp
          })
        );
      });
    });

    it("should allow different users to register different content", () => {
      // Creator 1 registers content
      const result1 = simnet.callPublicFn(
        "truth-chain",
        "register-content",
        [
          Cl.buffer(sampleHash1),
          Cl.stringAscii("blog_post")
        ],
        creator1
      );
      // Check that result1 is successful - check it's an ok result with data
      expect(result1.result).toBeOk(expect.anything());

      // Creator 2 registers different content
      const result2 = simnet.callPublicFn(
        "truth-chain",
        "register-content",
        [
          Cl.buffer(sampleHash2),
          Cl.stringAscii("page")
        ],
        creator2
      );
      // Check that result2 is also successful
      expect(result2.result).toBeOk(expect.anything());

      // Check both registrations exist
      const totalRegistrations = simnet.getDataVar("truth-chain", "total-registrations");
      expect(totalRegistrations).toBeUint(2);
    });
  });

  describe("Content Registration Validation", () => {
    it("should reject duplicate hash registration", () => {
      // Register content first time
      const firstResult = simnet.callPublicFn(
        "truth-chain",
        "register-content",
        [
          Cl.buffer(sampleHash1),
          Cl.stringAscii("blog_post")
        ],
        creator1
      );
      // Check that first registration is successful
      expect(firstResult.result).toBeOk(expect.anything());

      // Try to register same hash again
      const duplicateResult = simnet.callPublicFn(
        "truth-chain",
        "register-content",
        [
          Cl.buffer(duplicateHash), // Same as sampleHash1
          Cl.stringAscii("page")
        ],
        creator2
      );
      expect(duplicateResult.result).toBeErr(Cl.uint(100)); // ERR-HASH-EXISTS
    });

    it("should reject invalid content types", () => {
      const result = simnet.callPublicFn(
        "truth-chain",
        "register-content",
        [
          Cl.buffer(sampleHash1),
          Cl.stringAscii("invalid_type")
        ],
        creator1
      );
      expect(result.result).toBeErr(Cl.uint(102)); // ERR-INVALID-CONTENT-TYPE
    });

    it("should reject registration when contract is inactive", () => {
      // Deactivate contract (only owner can do this)
      simnet.callPublicFn(
        "truth-chain",
        "toggle-contract-status",
        [],
        deployer
      );

      // Try to register content
      const result = simnet.callPublicFn(
        "truth-chain",
        "register-content",
        [
          Cl.buffer(sampleHash1),
          Cl.stringAscii("blog_post")
        ],
        creator1
      );
      expect(result.result).toBeErr(Cl.uint(103)); // ERR-UNAUTHORIZED
    });
  });

  describe("Content Verification", () => {
    beforeEach(() => {
      // Register sample content for verification tests
      simnet.callPublicFn(
        "truth-chain",
        "register-content",
        [
          Cl.buffer(sampleHash1),
          Cl.stringAscii("blog_post")
        ],
        creator1
      );
    });

    it("should verify existing content correctly", () => {
      const result = simnet.callReadOnlyFn(
        "truth-chain",
        "verify-content",
        [Cl.buffer(sampleHash1)],
        verifier
      );

      expect(result.result).toBeOk(
        Cl.tuple({
          "author": Cl.principal(creator1),
          "block-height": Cl.uint(3),
          "time-stamp": Cl.uint(3), // Changed to match actual contract
          "content-type": Cl.stringAscii("blog_post"),
          "registration-id": Cl.uint(1)
        })
      );
    });

    it("should return error for non-existent content", () => {
      const result = simnet.callReadOnlyFn(
        "truth-chain",
        "verify-content",
        [Cl.buffer(sampleHash2)], // Unregistered hash
        verifier
      );

      expect(result.result).toBeErr(Cl.uint(104)); // ERR-HASH-NOT-FOUND
    });

    it("should check hash existence correctly", () => {
      // Existing hash
      const existsResult = simnet.callReadOnlyFn(
        "truth-chain",
        "hash-exists",
        [Cl.buffer(sampleHash1)],
        verifier
      );
      expect(cvToValue(existsResult.result)).toBe(true);

      // Non-existing hash
      const notExistsResult = simnet.callReadOnlyFn(
        "truth-chain",
        "hash-exists",
        [Cl.buffer(sampleHash2)],
        verifier
      );
      expect(cvToValue(notExistsResult.result)).toBe(false);
    });
  });

  describe("Batch Verification", () => {
    beforeEach(() => {
      // Register multiple content pieces
      simnet.callPublicFn(
        "truth-chain",
        "register-content",
        [Cl.buffer(sampleHash1), Cl.stringAscii("blog_post")],
        creator1
      );
      simnet.callPublicFn(
        "truth-chain",
        "register-content",
        [Cl.buffer(sampleHash2), Cl.stringAscii("page")],
        creator2
      );
    });

    it("should batch verify multiple hashes", () => {
      const unregisteredHash = new Uint8Array(32).fill(99);
      
      const result = simnet.callReadOnlyFn(
        "truth-chain",
        "batch-verify",
        [
          Cl.list([
            Cl.buffer(sampleHash1),    // Exists
            Cl.buffer(sampleHash2),    // Exists
            Cl.buffer(unregisteredHash) // Doesn't exist
          ])
        ],
        verifier
      );

      expect(result.result).toBeOk(
        Cl.list([
          Cl.tuple({
            "hash": Cl.buffer(sampleHash1),
            "exists": Cl.bool(true)
          }),
          Cl.tuple({
            "hash": Cl.buffer(sampleHash2),
            "exists": Cl.bool(true)
          }),
          Cl.tuple({
            "hash": Cl.buffer(unregisteredHash),
            "exists": Cl.bool(false)
          })
        ])
      );
    });
  });

  describe("Author Content Queries", () => {
    beforeEach(() => {
      // Register content from creator1
      simnet.callPublicFn(
        "truth-chain",
        "register-content",
        [Cl.buffer(sampleHash1), Cl.stringAscii("blog_post")],
        creator1
      );
      simnet.callPublicFn(
        "truth-chain",
        "register-content",
        [Cl.buffer(sampleHash2), Cl.stringAscii("page")],
        creator1
      );
    });

    it("should retrieve author content by registration ID", () => {
      const result = simnet.callReadOnlyFn(
        "truth-chain",
        "get-author-content",
        [Cl.principal(creator1), Cl.uint(1)],
        verifier
      );

      expect(result.result).toBeOk(
        Cl.tuple({
          "author": Cl.principal(creator1),
          "block-height": Cl.uint(3),
          "time-stamp": Cl.uint(3), // Changed to match actual contract
          "content-type": Cl.stringAscii("blog_post"),
          "registration-id": Cl.uint(1)
        })
      );
    });

    it("should return error for non-existent author content", () => {
      const result = simnet.callReadOnlyFn(
        "truth-chain",
        "get-author-content",
        [Cl.principal(creator1), Cl.uint(999)], // Non-existent ID
        verifier
      );

      expect(result.result).toBeErr(Cl.uint(104)); // ERR-HASH-NOT-FOUND
    });
  });

  describe("Admin Functions", () => {
    it("should allow owner to toggle contract status", () => {
      // Check initial status
      let contractActive = simnet.getDataVar("truth-chain", "contract-active");
      expect(contractActive).toBeBool(true);

      // Toggle status
      const result = simnet.callPublicFn(
        "truth-chain",
        "toggle-contract-status",
        [],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(false));

      // Check status changed
      contractActive = simnet.getDataVar("truth-chain", "contract-active");
      expect(contractActive).toBeBool(false);

      // Toggle back
      const result2 = simnet.callPublicFn(
        "truth-chain",
        "toggle-contract-status",
        [],
        deployer
      );
      expect(result2.result).toBeOk(Cl.bool(true));
    });

    it("should reject non-owner attempts to toggle contract status", () => {
      const result = simnet.callPublicFn(
        "truth-chain",
        "toggle-contract-status",
        [],
        creator1 // Not the owner
      );
      expect(result.result).toBeErr(Cl.uint(103)); // ERR-UNAUTHORIZED
    });
  });

  describe("Statistics and Metrics", () => {
    it("should track total registrations correctly", () => {
      // Initial count
      let totalRegistrations = simnet.callReadOnlyFn(
        "truth-chain",
        "get-total-registrations",
        [],
        verifier
      );
      expect(totalRegistrations.result).toBeOk(Cl.uint(0));

      // Register some content
      simnet.callPublicFn(
        "truth-chain",
        "register-content",
        [Cl.buffer(sampleHash1), Cl.stringAscii("blog_post")],
        creator1
      );
      simnet.callPublicFn(
        "truth-chain",
        "register-content",
        [Cl.buffer(sampleHash2), Cl.stringAscii("page")],
        creator2
      );

      // Check updated count
      totalRegistrations = simnet.callReadOnlyFn(
        "truth-chain",
        "get-total-registrations",
        [],
        verifier
      );
      expect(totalRegistrations.result).toBeOk(Cl.uint(2));
    });

    it("should provide comprehensive contract stats", () => {
      // Register one content piece
      simnet.callPublicFn(
        "truth-chain",
        "register-content",
        [Cl.buffer(sampleHash1), Cl.stringAscii("blog_post")],
        creator1
      );

      const stats = simnet.callReadOnlyFn(
        "truth-chain",
        "get-contract-stats",
        [],
        verifier
      );

      expect(stats.result).toBeOk(
        Cl.tuple({
          "total-registrations": Cl.uint(1),
          "contract-active": Cl.bool(true),
          "contract-owner": Cl.principal(deployer)
        })
      );
    });
  });
});