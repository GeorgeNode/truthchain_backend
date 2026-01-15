import {
    makeContractCall,
    // makeContractNonFungiblePostCondition,
    broadcastTransaction,
    AnchorMode,
    PostConditionMode,
    bufferCV,
    stringAsciiCV,
    listCV,
    fetchCallReadOnlyFunction,
    cvToJSON
  } from '@stacks/transactions';
  import { STACKS_TESTNET, STACKS_MAINNET, StacksNetwork } from '@stacks/network';
  
  export interface ContractConfig {
    contractAddress: string;
    contractName: string;
    network: 'testnet' | 'mainnet';
  }
  
  export interface TweetRegistration {
    hash: Buffer;
    author: string;
    bnsName?: string;  // NEW: BNS name from contract
    blockHeight: number;
    timestamp: number;
    registrationId: number;
  }
  
  export interface RegistrationResult {
    success: boolean;
    txId?: string;
    error?: string;
    registrationId?: number;
  }
  
  export class BlockchainService {
    private config: ContractConfig;
    private network: StacksNetwork;
    // v2 contract for fallback verification (BNS-only registrations)
    private contractAddressV2: string = 'SPVQ61FEWR6M4HVAT3BNE07D4BNW6A1C2ACCNQ6F';
    private contractNameV2: string = 'truthchain_v2';
    // v1 contract for fallback verification (backward compatibility)
    private contractAddressV1: string = 'SP1S7KX8TVSAWJ8CVJZQSFERBQ8BNCDXYFHXT21Z9';
    private contractNameV1: string = 'truthchain_v1';
  
    constructor(config: ContractConfig) {
      this.config = config;
      this.network = config.network === 'mainnet' 
        ? STACKS_MAINNET 
        : STACKS_TESTNET;
    }
   
    /**
     * Register tweet content on the blockchain
     * @param contentHash - SHA-256 hash of tweet content
     * @param senderKey - Private key of the sender
     * @returns Promise with registration result
     */
    async registerTweet(
      contentHash: Buffer, 
      senderKey: string
    ): Promise<RegistrationResult> {
      try {
        // Create the contract call transaction
        const txOptions = {
          contractAddress: this.config.contractAddress,
          contractName: this.config.contractName,
          functionName: 'register-content',
          functionArgs: [
            bufferCV(contentHash),
            stringAsciiCV('tweet') // content type
          ],
          senderKey,
          network: this.network,
          anchorMode: AnchorMode.Any,
          postConditionMode: PostConditionMode.Allow,
        };
  
        const transaction = await makeContractCall(txOptions);
        
        // Broadcast the transaction
        const broadcastResponse = await broadcastTransaction({ transaction });
        
        if ('error' in broadcastResponse) {
          return {
            success: false,
            error: broadcastResponse.error,
          };
        }
  
        return {
          success: true,
          txId: broadcastResponse.txid,
        };
  
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  
    /**
     * Verify if content exists on blockchain
     * Checks v2 first (with BNS), falls back to v1 (without BNS)
     * @param contentHash - SHA-256 hash to verify
     * @returns Promise with verification result
     */
    async verifyTweet(contentHash: Buffer): Promise<TweetRegistration | null> {
      try {
        console.log('🔍 Verifying content on blockchain (v3 + v2 + v1 fallback)');
        
        // Try v3 first (all features + BNS support)
        const v3Result = await this.verifyOnContract(
          this.config.contractAddress,
          this.config.contractName,
          contentHash
        );
        if (v3Result) {
          console.log('✅ Found in v3 with BNS:', v3Result.bnsName || 'none');
          return v3Result;
        }

        // Fallback to v2 (BNS-only) - only on mainnet
        if (this.config.network === 'mainnet') {
          console.log('⏭️  Not found in v3, checking v2...');
          const v2Result = await this.verifyOnContract(
            this.contractAddressV2,
            this.contractNameV2,
            contentHash
          );
          if (v2Result) {
            console.log('✅ Found in v2 (BNS-only)');
            return v2Result;
          }

          console.log('⏭️  Not found in v2, checking v1...');
          const v1Result = await this.verifyOnContract(
            this.contractAddressV1,
            this.contractNameV1,
            contentHash
          );
          if (v1Result) {
            console.log('✅ Found in v1 (no BNS)');
            return v1Result;
          }
        }

        console.log('❌ Not found in v3, v2, or v1');
        return null;
      } catch (error) {
        console.error('❌ Error verifying content:', error);
        return null;
      }
    }

    /**
     * Verify content on a specific contract
     * @param contractAddress - Contract address to check
     * @param contractName - Contract name to check
     * @param contentHash - SHA-256 hash to verify
     * @returns Promise with verification result or null
     */
    private async verifyOnContract(
      contractAddress: string,
      contractName: string,
      contentHash: Buffer
    ): Promise<TweetRegistration | null> {
      try {
        // First check if hash exists using the working method
        const exists = await this.hashExistsOnContract(contractAddress, contractName, contentHash);
        if (!exists) {
          return null;
        }

        // If hash exists, try to get full details
        try {
          const result = await fetchCallReadOnlyFunction({
            contractAddress: contractAddress,
            contractName: contractName,
            functionName: 'verify-content',
            functionArgs: [bufferCV(contentHash)],
            network: this.network,
            senderAddress: contractAddress,
          });

          // Parse the result
          const jsonResult = cvToJSON(result);
          
          if (jsonResult.success && jsonResult.value) {
            const data = jsonResult.value.value;
            
            // Extract BNS name if present (it's optional in contract)
            let bnsName: string | undefined;
            if (data['bns-name'] && data['bns-name'].type === 'some') {
              bnsName = data['bns-name'].value.value;
            }
            
            return {
              hash: contentHash,
              author: data.author.value,
              bnsName: bnsName,  // Include BNS name from contract
              blockHeight: parseInt(data['block-height'].value),
              timestamp: parseInt(data['time-stamp'].value),
              registrationId: parseInt(data['registration-id'].value),
            };
          }
        } catch (detailError) {
          console.log(`Error getting detailed verification from ${contractName}, falling back to basic info:`, detailError);
        }

        // Fallback: if hash exists but we can't get details, return basic info
        return {
          hash: contentHash,
          author: 'unknown',
          blockHeight: 0,
          timestamp: Date.now() / 1000,
          registrationId: 0,
        };

      } catch (error) {
        console.error(`Error verifying on ${contractName}:`, error);
        return null;
      }
    }
  
    /**
     * Check if content hash exists (simple boolean check)
     * @param contentHash - SHA-256 hash to check
     * @returns Promise<boolean>
     */
    async hashExists(contentHash: Buffer): Promise<boolean> {
      return this.hashExistsOnContract(this.config.contractAddress, this.config.contractName, contentHash);
    }

    /**
     * Check if content hash exists on a specific contract
     * @param contractAddress - Contract address to check
     * @param contractName - Contract name to check
     * @param contentHash - SHA-256 hash to check
     * @returns Promise<boolean>
     */
    private async hashExistsOnContract(
      contractAddress: string,
      contractName: string,
      contentHash: Buffer
    ): Promise<boolean> {
      try {
        const result = await fetchCallReadOnlyFunction({
          contractAddress: contractAddress,
          contractName: contractName,
          functionName: 'hash-exists',
          functionArgs: [bufferCV(contentHash)],
          network: this.network,
          senderAddress: contractAddress,
        });
  
        const jsonResult = cvToJSON(result);
        return jsonResult.value === true;
      } catch (error) {
        console.error(`Error checking hash existence on ${contractName}:`, error);
        return false;
      }
    }
  
    /**
     * Get contract statistics
     * @returns Promise with contract stats
     */
    async getContractStats(): Promise<any> {
      try {
        const result = await fetchCallReadOnlyFunction({
          contractAddress: this.config.contractAddress,
          contractName: this.config.contractName,
          functionName: 'get-contract-stats',
          functionArgs: [],
          network: this.network,
          senderAddress: this.config.contractAddress,
        });
  
        return cvToJSON(result);
      } catch (error) {
        console.error('Error getting contract stats:', error);
        return null;
      }
    }
  
    /**
     * Batch verify multiple hashes
     * @param hashes - Array of content hashes to verify
     * @returns Promise with batch verification results
     */
    async batchVerify(hashes: Buffer[]): Promise<any> {
      try {
        const hashCVs = hashes.map(hash => bufferCV(hash));
        
        const result = await fetchCallReadOnlyFunction({
          contractAddress: this.config.contractAddress,
          contractName: this.config.contractName,
          functionName: 'batch-verify',
          functionArgs: [listCV(hashCVs)],
          network: this.network,
          senderAddress: this.config.contractAddress,
        });
  
        return cvToJSON(result);
      } catch (error) {
        console.error('Error in batch verification:', error);
        return null;
      }
    }
  }