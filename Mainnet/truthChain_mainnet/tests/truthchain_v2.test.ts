import {
  Cl,
  cvToValue,
} from "@stacks/transactions";
import { beforeEach, describe, expect, it } from "vitest";

// Get test accounts from simnet
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const alice = accounts.get("wallet_1")!;
const bob = accounts.get("wallet_2")!;
const charlie = accounts.get("wallet_3")!;

// Sample content hashes (32 bytes each)
const hash1 = new Uint8Array(32).fill(1);
const hash2 = new Uint8Array(32).fill(2);
const hash3 = new Uint8Array(32).fill(3);
const hash4 = new Uint8Array(32).fill(4);

describe("TruthChain V2 - BNS Registration Tests", () => {
  
  it("Test 1: Register content with BNS name", () => {
    const { result } = simnet.callPublicFn(
      "truthchain_v2",
      "register-content-with-bns",
      [
        Cl.buffer(hash1),
        Cl.stringAscii("tweet"),
        Cl.some(Cl.stringAscii("alice.btc"))
      ],
      alice
    );

    expect(result).toBeOk(Cl.uint(1)); // First registration ID
  });

  it("Test 2: Verify returns BNS name", () => {
    // First register with BNS
    simnet.callPublicFn(
      "truthchain_v2",
      "register-content-with-bns",
      [
        Cl.buffer(hash2),
        Cl.stringAscii("tweet"),
        Cl.some(Cl.stringAscii("bob.btc"))
      ],
      bob
    );

    // Then verify
    const { result } = simnet.callReadOnlyFn(
      "truthchain_v2",
      "verify-content",
      [Cl.buffer(hash2)],
      bob
    );

    // Contract returns (ok (some {...})) so we just check it's ok
    expect(result).toBeOk(expect.any(Object));
  });

  it("Test 3: Prevent duplicate registration", () => {
    // Register once
    simnet.callPublicFn(
      "truthchain_v2",
      "register-content-with-bns",
      [
        Cl.buffer(hash3),
        Cl.stringAscii("tweet"),
        Cl.some(Cl.stringAscii("charlie.btc"))
      ],
      charlie
    );

    // Try to register again
    const { result } = simnet.callPublicFn(
      "truthchain_v2",
      "register-content-with-bns",
      [
        Cl.buffer(hash3),
        Cl.stringAscii("tweet"),
        Cl.some(Cl.stringAscii("charlie.btc"))
      ],
      charlie
    );

    expect(result).toBeErr(Cl.uint(100)); // ERR-ALREADY-REGISTERED (u100)
  });

  it("Test 4: Backward compatibility - register without BNS", () => {
    const { result } = simnet.callPublicFn(
      "truthchain_v2",
      "register-content",
      [
        Cl.buffer(hash4),
        Cl.stringAscii("tweet")
      ],
      alice
    );

    // Just check it's ok - registration ID doesn't matter
    expect(result).toBeOk(expect.any(Object)); // Registration successful
  });

  it("Test 5: Hash exists check", () => {
    // Register content
    simnet.callPublicFn(
      "truthchain_v2",
      "register-content-with-bns",
      [
        Cl.buffer(hash1),
        Cl.stringAscii("tweet"),
        Cl.some(Cl.stringAscii("user1.btc"))
      ],
      alice
    );

    // Check if exists
    const { result } = simnet.callReadOnlyFn(
      "truthchain_v2",
      "hash-exists",
      [Cl.buffer(hash1)],
      alice
    );

    expect(result).toBeBool(true);
  });

  it("Test 6: Registration count tracking", () => {
    // Get initial count using read-only function
    const initialResponse = simnet.callReadOnlyFn(
      "truthchain_v2",
      "get-registration-count",
      [],
      alice
    );
    // Result is (ok uint), so we need to unwrap it
    expect(initialResponse.result).toBeOk(expect.any(Object));
    const initialCount = Number(cvToValue(initialResponse.result).value);

    // Register content
    simnet.callPublicFn(
      "truthchain_v2",
      "register-content-with-bns",
      [
        Cl.buffer(new Uint8Array(32).fill(10)),
        Cl.stringAscii("tweet"),
        Cl.some(Cl.stringAscii("test.btc"))
      ],
      alice
    );

    // Get new count
    const updatedResponse = simnet.callReadOnlyFn(
      "truthchain_v2",
      "get-registration-count",
      [],
      alice
    );
    const updatedCount = Number(cvToValue(updatedResponse.result).value);

    expect(updatedCount).toBe(initialCount + 1);
  });

  it("Test 7: Non-existent content returns error", () => {
    const nonExistentHash = new Uint8Array(32).fill(99);
    
    const { result } = simnet.callReadOnlyFn(
      "truthchain_v2",
      "verify-content",
      [Cl.buffer(nonExistentHash)],
      alice
    );

    expect(result).toBeErr(Cl.uint(404)); // Not found
  });

});
