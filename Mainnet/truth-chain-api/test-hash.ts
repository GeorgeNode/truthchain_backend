import { HashService } from './src/services/HashService';

// Test the hash service
const testTweet = "Just launched my new startup! 🚀";

console.log('Testing HashService...');
console.log('Tweet content:', testTweet);

const hash = HashService.generateContentHash(testTweet);
const hexHash = HashService.generateContentHashHex(testTweet);

console.log('Generated hash (buffer):', hash);
console.log('Generated hash (hex):', hexHash);
console.log('Hash length:', hash.length, 'bytes');

// Test validation
const isValid = HashService.validateContentHash(testTweet, hash);
console.log('Hash validation:', isValid);

// Test hex conversion
const bufferFromHex = HashService.hexToBuffer(hexHash);
console.log('Hex to buffer conversion works:', bufferFromHex.equals(hash));