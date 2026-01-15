import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

// Test hash generator
const generateTestHash = (seed: string): string => {
  const hash = new Uint8Array(32);
  for (let i = 0; i < seed.length && i < 32; i++) {
    hash[i] = seed.charCodeAt(i);
  }
  return `0x${Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('')}`;
};

Clarinet.test({
  name: "Test 1: Register content with BNS name successfully",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const testHash = generateTestHash("test-tweet-1");
    
    let block = chain.mineBlock([
      Tx.contractCall(
        'truthchain_v3',
        'register-content-with-bns',
        [
          types.buff(Buffer.from(testHash.slice(2), 'hex')),
          types.ascii("tweet"),
          types.some(types.ascii("alice.btc"))
        ],
        deployer.address
      )
    ]);
    
    block.receipts[0].result.expectOk();
    assertEquals(block.receipts[0].result.expectOk().indexOf('registration-id') > 0, true);
  },
});

Clarinet.test({
  name: "Test 2: Register content without BNS name successfully",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    const testHash = generateTestHash("test-tweet-2");
    
    let block = chain.mineBlock([
      Tx.contractCall(
        'truthchain_v3',
        'register-content',
        [
          types.buff(Buffer.from(testHash.slice(2), 'hex')),
          types.ascii("tweet")
        ],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectOk();
  },
});

Clarinet.test({
  name: "Test 3: Verify registered content returns complete data",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const testHash = generateTestHash("test-tweet-3");
    
    let block = chain.mineBlock([
      Tx.contractCall(
        'truthchain_v3',
        'register-content-with-bns',
        [
          types.buff(Buffer.from(testHash.slice(2), 'hex')),
          types.ascii("tweet"),
          types.some(types.ascii("bob.btc"))
        ],
        deployer.address
      ),
      Tx.contractCall(
        'truthchain_v3',
        'verify-content',
        [types.buff(Buffer.from(testHash.slice(2), 'hex'))],
        deployer.address
      )
    ]);
    
    block.receipts[1].result.expectOk();
    const result = block.receipts[1].result.expectOk();
    assertEquals(result.indexOf('bob.btc') > 0, true);
    assertEquals(result.indexOf('tweet') > 0, true);
  },
});

Clarinet.test({
  name: "Test 4: Reject duplicate hash registration",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const testHash = generateTestHash("test-tweet-4");
    
    let block = chain.mineBlock([
      Tx.contractCall(
        'truthchain_v3',
        'register-content',
        [
          types.buff(Buffer.from(testHash.slice(2), 'hex')),
          types.ascii("tweet")
        ],
        deployer.address
      ),
      Tx.contractCall(
        'truthchain_v3',
        'register-content',
        [
          types.buff(Buffer.from(testHash.slice(2), 'hex')),
          types.ascii("tweet")
        ],
        deployer.address
      )
    ]);
    
    block.receipts[0].result.expectOk();
    block.receipts[1].result.expectErr(types.uint(100)); // ERR-HASH-EXISTS
  },
});

Clarinet.test({
  name: "Test 5: Reject invalid content type",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const testHash = generateTestHash("test-tweet-5");
    
    let block = chain.mineBlock([
      Tx.contractCall(
        'truthchain_v3',
        'register-content',
        [
          types.buff(Buffer.from(testHash.slice(2), 'hex')),
          types.ascii("invalid_type")
        ],
        deployer.address
      )
    ]);
    
    block.receipts[0].result.expectErr(types.uint(102)); // ERR-INVALID-CONTENT-TYPE
  },
});

Clarinet.test({
  name: "Test 6: Hash exists check works correctly",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const testHash = generateTestHash("test-tweet-6");
    const nonExistentHash = generateTestHash("nonexistent");
    
    let block = chain.mineBlock([
      Tx.contractCall(
        'truthchain_v3',
        'register-content',
        [
          types.buff(Buffer.from(testHash.slice(2), 'hex')),
          types.ascii("tweet")
        ],
        deployer.address
      ),
      Tx.contractCall(
        'truthchain_v3',
        'hash-exists',
        [types.buff(Buffer.from(testHash.slice(2), 'hex'))],
        deployer.address
      ),
      Tx.contractCall(
        'truthchain_v3',
        'hash-exists',
        [types.buff(Buffer.from(nonExistentHash.slice(2), 'hex'))],
        deployer.address
      )
    ]);
    
    assertEquals(block.receipts[1].result, 'true');
    assertEquals(block.receipts[2].result, 'false');
  },
});

Clarinet.test({
  name: "Test 7: Get author content by registration ID",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    const testHash1 = generateTestHash("author-tweet-1");
    const testHash2 = generateTestHash("author-tweet-2");
    
    let block = chain.mineBlock([
      Tx.contractCall(
        'truthchain_v3',
        'register-content',
        [
          types.buff(Buffer.from(testHash1.slice(2), 'hex')),
          types.ascii("tweet")
        ],
        wallet1.address
      ),
      Tx.contractCall(
        'truthchain_v3',
        'register-content',
        [
          types.buff(Buffer.from(testHash2.slice(2), 'hex')),
          types.ascii("tweet")
        ],
        wallet1.address
      ),
      Tx.contractCall(
        'truthchain_v3',
        'get-author-content',
        [
          types.principal(wallet1.address),
          types.uint(2)
        ],
        wallet1.address
      )
    ]);
    
    block.receipts[2].result.expectOk();
  },
});

Clarinet.test({
  name: "Test 8: Batch verify multiple hashes",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const hash1 = generateTestHash("batch-1");
    const hash2 = generateTestHash("batch-2");
    const hash3 = generateTestHash("batch-3");
    const nonExistent = generateTestHash("nonexistent");
    
    let block = chain.mineBlock([
      Tx.contractCall(
        'truthchain_v3',
        'register-content',
        [types.buff(Buffer.from(hash1.slice(2), 'hex')), types.ascii("tweet")],
        deployer.address
      ),
      Tx.contractCall(
        'truthchain_v3',
        'register-content',
        [types.buff(Buffer.from(hash2.slice(2), 'hex')), types.ascii("tweet")],
        deployer.address
      ),
      Tx.contractCall(
        'truthchain_v3',
        'register-content',
        [types.buff(Buffer.from(hash3.slice(2), 'hex')), types.ascii("tweet")],
        deployer.address
      ),
      Tx.contractCall(
        'truthchain_v3',
        'batch-verify',
        [
          types.list([
            types.buff(Buffer.from(hash1.slice(2), 'hex')),
            types.buff(Buffer.from(hash2.slice(2), 'hex')),
            types.buff(Buffer.from(nonExistent.slice(2), 'hex'))
          ])
        ],
        deployer.address
      )
    ]);
    
    block.receipts[3].result.expectOk();
  },
});

Clarinet.test({
  name: "Test 9: Get total registrations count",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const hash1 = generateTestHash("count-1");
    const hash2 = generateTestHash("count-2");
    
    let block = chain.mineBlock([
      Tx.contractCall(
        'truthchain_v3',
        'get-total-registrations',
        [],
        deployer.address
      ),
      Tx.contractCall(
        'truthchain_v3',
        'register-content',
        [types.buff(Buffer.from(hash1.slice(2), 'hex')), types.ascii("tweet")],
        deployer.address
      ),
      Tx.contractCall(
        'truthchain_v3',
        'register-content',
        [types.buff(Buffer.from(hash2.slice(2), 'hex')), types.ascii("tweet")],
        deployer.address
      ),
      Tx.contractCall(
        'truthchain_v3',
        'get-total-registrations',
        [],
        deployer.address
      )
    ]);
    
    assertEquals(block.receipts[3].result, 'u2');
  },
});

Clarinet.test({
  name: "Test 10: Toggle contract status (admin only)",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;
    const testHash = generateTestHash("admin-test");
    
    let block = chain.mineBlock([
      // Deployer can toggle
      Tx.contractCall(
        'truthchain_v3',
        'toggle-contract-status',
        [],
        deployer.address
      ),
      // Try to register while paused
      Tx.contractCall(
        'truthchain_v3',
        'register-content',
        [types.buff(Buffer.from(testHash.slice(2), 'hex')), types.ascii("tweet")],
        wallet1.address
      ),
      // Non-deployer cannot toggle
      Tx.contractCall(
        'truthchain_v3',
        'toggle-contract-status',
        [],
        wallet1.address
      ),
      // Deployer re-enables
      Tx.contractCall(
        'truthchain_v3',
        'toggle-contract-status',
        [],
        deployer.address
      ),
      // Now registration works
      Tx.contractCall(
        'truthchain_v3',
        'register-content',
        [types.buff(Buffer.from(testHash.slice(2), 'hex')), types.ascii("tweet")],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectOk(); // Toggle success
    block.receipts[1].result.expectErr(types.uint(103)); // ERR-UNAUTHORIZED (paused)
    block.receipts[2].result.expectErr(types.uint(103)); // ERR-UNAUTHORIZED (not owner)
    block.receipts[3].result.expectOk(); // Toggle success
    block.receipts[4].result.expectOk(); // Registration success
  },
});

Clarinet.test({
  name: "Test 11: Get contract stats",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const testHash = generateTestHash("stats-test");
    
    let block = chain.mineBlock([
      Tx.contractCall(
        'truthchain_v3',
        'register-content',
        [types.buff(Buffer.from(testHash.slice(2), 'hex')), types.ascii("tweet")],
        deployer.address
      ),
      Tx.contractCall(
        'truthchain_v3',
        'get-contract-stats',
        [],
        deployer.address
      )
    ]);
    
    block.receipts[1].result.expectOk();
    const stats = block.receipts[1].result.expectOk();
    assertEquals(stats.indexOf('total-registrations') > 0, true);
    assertEquals(stats.indexOf('contract-active') > 0, true);
  },
});

Clarinet.test({
  name: "Test 12: Get supported content types",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    
    let block = chain.mineBlock([
      Tx.contractCall(
        'truthchain_v3',
        'get-content-types',
        [],
        deployer.address
      )
    ]);
    
    const result = block.receipts[0].result.expectOk();
    assertEquals(result.indexOf('tweet') > 0, true);
    assertEquals(result.indexOf('blog_post') > 0, true);
    assertEquals(result.indexOf('media') > 0, true);
  },
});

Clarinet.test({
  name: "Test 13: Get author registration count",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    const hash1 = generateTestHash("author-count-1");
    const hash2 = generateTestHash("author-count-2");
    const hash3 = generateTestHash("author-count-3");
    
    let block = chain.mineBlock([
      Tx.contractCall(
        'truthchain_v3',
        'register-content',
        [types.buff(Buffer.from(hash1.slice(2), 'hex')), types.ascii("tweet")],
        wallet1.address
      ),
      Tx.contractCall(
        'truthchain_v3',
        'register-content',
        [types.buff(Buffer.from(hash2.slice(2), 'hex')), types.ascii("tweet")],
        wallet1.address
      ),
      Tx.contractCall(
        'truthchain_v3',
        'register-content',
        [types.buff(Buffer.from(hash3.slice(2), 'hex')), types.ascii("tweet")],
        wallet1.address
      ),
      Tx.contractCall(
        'truthchain_v3',
        'get-author-registration-count',
        [types.principal(wallet1.address)],
        wallet1.address
      )
    ]);
    
    assertEquals(block.receipts[3].result, 'u3');
  },
});

Clarinet.test({
  name: "Test 14: Verify returns error for non-existent hash",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const nonExistentHash = generateTestHash("does-not-exist");
    
    let block = chain.mineBlock([
      Tx.contractCall(
        'truthchain_v3',
        'verify-content',
        [types.buff(Buffer.from(nonExistentHash.slice(2), 'hex'))],
        deployer.address
      )
    ]);
    
    block.receipts[0].result.expectErr(types.uint(104)); // ERR-HASH-NOT-FOUND
  },
});

Clarinet.test({
  name: "Test 15: Multiple authors can register same content type",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    const wallet2 = accounts.get('wallet_2')!;
    const hash1 = generateTestHash("multi-author-1");
    const hash2 = generateTestHash("multi-author-2");
    
    let block = chain.mineBlock([
      Tx.contractCall(
        'truthchain_v3',
        'register-content-with-bns',
        [
          types.buff(Buffer.from(hash1.slice(2), 'hex')),
          types.ascii("tweet"),
          types.some(types.ascii("user1.btc"))
        ],
        wallet1.address
      ),
      Tx.contractCall(
        'truthchain_v3',
        'register-content-with-bns',
        [
          types.buff(Buffer.from(hash2.slice(2), 'hex')),
          types.ascii("tweet"),
          types.some(types.ascii("user2.btc"))
        ],
        wallet2.address
      )
    ]);
    
    block.receipts[0].result.expectOk();
    block.receipts[1].result.expectOk();
  },
});
