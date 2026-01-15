/**
 * IPFS Service using Pinata Cloud
 * Handles file uploads to IPFS via Pinata API
 * Documentation: https://docs.pinata.cloud/
 */
export interface IPFSUploadResult {
    cid: string;
    gateway: string;
    size: number;
    url: string;
    pinataUrl?: string;
}
export interface IPFSConfig {
    apiKey: string;
    apiSecret: string;
    jwt?: string;
    gateway?: string;
}
export interface IPFSContent {
    content: string;
    metadata?: {
        originalUrl?: string;
        author?: string;
        timestamp?: string;
        [key: string]: any;
    };
}
export declare class IPFSService {
    private apiKey;
    private apiSecret;
    private jwt?;
    private gateway;
    private pinataApiUrl;
    constructor(config: IPFSConfig);
    /**
     * Get authorization headers for Pinata API
     */
    private getAuthHeaders;
    /**
     * Store content on IPFS via Pinata
     */
    storeContent(content: string | Buffer, filename?: string): Promise<IPFSUploadResult>;
    /**
     * Store JSON data on IPFS
     */
    storeJSON(data: any, filename?: string): Promise<IPFSUploadResult>;
    /**
     * Store tweet/content data with metadata on IPFS
     */
    storeTweetContent(contentData: IPFSContent): Promise<IPFSUploadResult>;
    /**
     * Retrieve content from IPFS
     */
    retrieveContent(cid: string): Promise<string>;
    /**
     * Retrieve JSON data from IPFS
     */
    retrieveJSON(cid: string): Promise<any>;
    /**
     * Check if CID is valid
     */
    isValidCID(cid: string): boolean;
    /**
     * Get gateway URL for a CID
     */
    getGatewayURL(cid: string): string;
    /**
     * Get multiple gateway URLs for redundancy
     */
    getGatewayURLs(cid: string): string[];
    /**
     * Test Pinata authentication
     */
    testAuthentication(): Promise<boolean>;
    /**
     * Get pinned files list (for monitoring)
     */
    getPinnedFiles(limit?: number): Promise<any>;
    /**
     * Unpin a file from Pinata
     */
    unpinFile(cid: string): Promise<boolean>;
    /**
     * Check storage status
     */
    getStorageStatus(): Promise<any>;
}
//# sourceMappingURL=IPFSService.d.ts.map