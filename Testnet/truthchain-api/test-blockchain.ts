import { BlockchainService } from './src/services/BlockchainService';
import { HashService } from './src/services/HashService';

// Test configuration - UPDATE WITH YOUR CONTRACT DETAILS
const config = {
  contractAddress: 'ST3S9E18YKY18RQBR6WVZQ816C19R3FB3K3M0K3XX', // Replace with your address
  contractName: 'truth-chain', // Replace with your contract name
  network: 'testnet' as const
};

async function testBlockchainService() {
  console.log('Testing BlockchainService...');
  
  const blockchainService = new BlockchainService(config);
  const testTweet = "Just launched my new startup! 🚀";
  const contentHash = HashService.generateContentHash(testTweet);
  
  console.log('Tweet content:', testTweet);
  console.log('Content hash:', HashService.generateContentHashHex(testTweet));
  
  try {
    // Test 1: Check if hash exists (should be false initially)
    console.log('\n--- Testing hash existence ---');
    const exists = await blockchainService.hashExists(contentHash);
    console.log('Hash exists:', exists);
    
    // Test 2: Get contract stats
    console.log('\n--- Testing contract stats ---');
    const stats = await blockchainService.getContractStats();
    console.log('Contract stats:', stats);
    
    // Test 3: Verify content (should return null if not registered)
    console.log('\n--- Testing content verification ---');
    const verification = await blockchainService.verifyTweet(contentHash);
    console.log('Verification result:', verification);
    
    console.log('\n✅ BlockchainService tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing BlockchainService:', error);
  }
}

// Run the test
testBlockchainService();