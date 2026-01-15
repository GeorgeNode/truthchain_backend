import * as crypto from 'crypto';

export class HashService {
  /**
   * Generate SHA-256 hash from tweet content
   * @param content - The tweet text content
   * @returns 32-byte buffer hash
   */
  static generateContentHash(content: string): Buffer {
    // Clean the content - remove extra whitespace, normalize
    const cleanContent = content.trim().replace(/\s+/g, ' ');
    
    // Generate SHA-256 hash
    const hash = crypto.createHash('sha256');
    hash.update(cleanContent, 'utf8');
    
    return hash.digest();
  }

  /**
   * Generate hash as hex string (for debugging/logging)
   * @param content - The tweet text content  
   * @returns hex string representation
   */
  static generateContentHashHex(content: string): string {
    const buffer = this.generateContentHash(content);
    return buffer.toString('hex');
  }

  /**
   * Validate if provided hash matches content
   * @param content - Original tweet content
   * @param expectedHash - Hash to validate against
   * @returns boolean indicating if hash matches
   */
  static validateContentHash(content: string, expectedHash: Buffer): boolean {
    const computedHash = this.generateContentHash(content);
    return computedHash.equals(expectedHash);
  }

  /**
   * Convert hex string back to buffer (for API inputs)
   * @param hexString - Hex representation of hash
   * @returns Buffer representation
   */
  static hexToBuffer(hexString: string): Buffer {
    // Remove '0x' prefix if present
    const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
    return Buffer.from(cleanHex, 'hex');
  }
}