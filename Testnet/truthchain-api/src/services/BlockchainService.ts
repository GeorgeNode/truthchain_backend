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
     * @param contentHash - SHA-256 hash to verify
     * @returns Promise with verification result
     */
    async verifyTweet(contentHash: Buffer): Promise<TweetRegistration | null> {
      try {
        // First check if hash exists using the working method
        const exists = await this.hashExists(contentHash);
        if (!exists) {
          return null;
        }

        // If hash exists, try to get full details
        try {
          const result = await fetchCallReadOnlyFunction({
            contractAddress: this.config.contractAddress,
            contractName: this.config.contractName,
            functionName: 'verify-content',
            functionArgs: [bufferCV(contentHash)],
            network: this.network,
            senderAddress: this.config.contractAddress,
          });

          // Parse the result
          const jsonResult = cvToJSON(result);
          console.log('Verify content result:', JSON.stringify(jsonResult, null, 2));
          
          if (jsonResult.success && jsonResult.value) {
            const data = jsonResult.value.value;
            return {
              hash: contentHash,
              author: data.author.value,
              blockHeight: parseInt(data['block-height'].value),
              timestamp: parseInt(data['time-stamp'].value),
              registrationId: parseInt(data['registration-id'].value),
            };
          }
        } catch (detailError) {
          console.log('Error getting detailed verification, falling back to basic info:', detailError);
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
        console.error('Error verifying content:', error);
        return null;
      }
    }
  
    /**
     * Check if content hash exists (simple boolean check)
     * @param contentHash - SHA-256 hash to check
     * @returns Promise<boolean>
     */
    async hashExists(contentHash: Buffer): Promise<boolean> {
      try {
        const result = await fetchCallReadOnlyFunction({
          contractAddress: this.config.contractAddress,
          contractName: this.config.contractName,
          functionName: 'hash-exists',
          functionArgs: [bufferCV(contentHash)],
          network: this.network,
          senderAddress: this.config.contractAddress,
        });
  
        const jsonResult = cvToJSON(result);
        return jsonResult.value === true;
      } catch (error) {
        console.error('Error checking hash existence:', error);
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