"use strict";
/**
 * IPFS Service using Pinata Cloud
 * Handles file uploads to IPFS via Pinata API
 * Documentation: https://docs.pinata.cloud/
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPFSService = void 0;
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const stream_1 = require("stream");
class IPFSService {
    constructor(config) {
        this.pinataApiUrl = 'https://api.pinata.cloud';
        if (!config.apiKey && !config.jwt) {
            throw new Error('Pinata API credentials are required (apiKey/apiSecret or JWT)');
        }
        this.apiKey = config.apiKey;
        this.apiSecret = config.apiSecret;
        this.jwt = config.jwt;
        this.gateway = config.gateway || 'https://gateway.pinata.cloud/ipfs';
    }
    /**
     * Get authorization headers for Pinata API
     */
    getAuthHeaders() {
        if (this.jwt) {
            return {
                'Authorization': `Bearer ${this.jwt}`
            };
        }
        return {
            'pinata_api_key': this.apiKey,
            'pinata_secret_api_key': this.apiSecret
        };
    }
    /**
     * Store content on IPFS via Pinata
     */
    async storeContent(content, filename = 'content.json') {
        try {
            const formData = new form_data_1.default();
            // Convert content to stream
            let stream;
            if (typeof content === 'string') {
                stream = stream_1.Readable.from(Buffer.from(content, 'utf-8'));
            }
            else {
                stream = stream_1.Readable.from(content);
            }
            // Add file to form data
            formData.append('file', stream, {
                filename,
                contentType: filename.endsWith('.json') ? 'application/json' : 'application/octet-stream'
            });
            // Add metadata
            const metadata = JSON.stringify({
                name: filename,
                keyvalues: {
                    type: 'truthchain-content',
                    timestamp: new Date().toISOString()
                }
            });
            formData.append('pinataMetadata', metadata);
            // Add pin options
            const pinataOptions = JSON.stringify({
                cidVersion: 1
            });
            formData.append('pinataOptions', pinataOptions);
            // Upload to Pinata
            const response = await axios_1.default.post(`${this.pinataApiUrl}/pinning/pinFileToIPFS`, formData, {
                headers: {
                    ...this.getAuthHeaders(),
                    ...formData.getHeaders()
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            });
            const { IpfsHash, PinSize } = response.data;
            const cid = IpfsHash;
            const size = PinSize || 0;
            const url = `${this.gateway}/${cid}`;
            const pinataUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
            console.log(`✅ Content stored on IPFS via Pinata: ${cid}`);
            return {
                cid,
                gateway: this.gateway,
                size,
                url,
                pinataUrl
            };
        }
        catch (error) {
            console.error('Error storing content on IPFS via Pinata:', error);
            if (axios_1.default.isAxiosError(error)) {
                const axiosError = error;
                throw new Error(`Pinata API error: ${axiosError.response?.data?.error || axiosError.message}`);
            }
            throw new Error(`Failed to store content on IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Store JSON data on IPFS
     */
    async storeJSON(data, filename = 'data.json') {
        try {
            const jsonString = JSON.stringify(data, null, 2);
            return await this.storeContent(jsonString, filename);
        }
        catch (error) {
            console.error('Error storing JSON on IPFS:', error);
            throw error;
        }
    }
    /**
     * Store tweet/content data with metadata on IPFS
     */
    async storeTweetContent(contentData) {
        try {
            const data = {
                content: contentData.content,
                metadata: {
                    ...contentData.metadata,
                    storedAt: new Date().toISOString(),
                    platform: 'truthchain'
                }
            };
            return await this.storeJSON(data, 'content.json');
        }
        catch (error) {
            console.error('Error storing content on IPFS:', error);
            throw error;
        }
    }
    /**
     * Retrieve content from IPFS
     */
    async retrieveContent(cid) {
        try {
            const url = `${this.gateway}/${cid}`;
            const response = await axios_1.default.get(url, {
                timeout: 10000 // 10 second timeout
            });
            if (typeof response.data === 'object') {
                return JSON.stringify(response.data);
            }
            return response.data;
        }
        catch (error) {
            console.error('Error retrieving content from IPFS:', error);
            throw new Error(`Failed to retrieve content from IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Retrieve JSON data from IPFS
     */
    async retrieveJSON(cid) {
        try {
            const content = await this.retrieveContent(cid);
            return JSON.parse(content);
        }
        catch (error) {
            console.error('Error retrieving JSON from IPFS:', error);
            throw error;
        }
    }
    /**
     * Check if CID is valid
     */
    isValidCID(cid) {
        // Basic CID validation (CIDv0 starts with Qm, CIDv1 starts with ba)
        return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[A-Za-z2-7]{58})/.test(cid);
    }
    /**
     * Get gateway URL for a CID
     */
    getGatewayURL(cid) {
        return `${this.gateway}/${cid}`;
    }
    /**
     * Get multiple gateway URLs for redundancy
     */
    getGatewayURLs(cid) {
        const gateways = [
            'https://gateway.pinata.cloud/ipfs',
            'https://ipfs.io/ipfs',
            'https://dweb.link/ipfs',
            'https://cloudflare-ipfs.com/ipfs'
        ];
        return gateways.map(gateway => `${gateway}/${cid}`);
    }
    /**
     * Test Pinata authentication
     */
    async testAuthentication() {
        try {
            const response = await axios_1.default.get(`${this.pinataApiUrl}/data/testAuthentication`, {
                headers: this.getAuthHeaders()
            });
            return response.data.message === 'Congratulations! You are communicating with the Pinata API!';
        }
        catch (error) {
            console.error('Pinata authentication test failed:', error);
            return false;
        }
    }
    /**
     * Get pinned files list (for monitoring)
     */
    async getPinnedFiles(limit = 10) {
        try {
            const response = await axios_1.default.get(`${this.pinataApiUrl}/data/pinList`, {
                headers: this.getAuthHeaders(),
                params: {
                    status: 'pinned',
                    pageLimit: limit
                }
            });
            return response.data;
        }
        catch (error) {
            console.error('Error getting pinned files:', error);
            throw error;
        }
    }
    /**
     * Unpin a file from Pinata
     */
    async unpinFile(cid) {
        try {
            await axios_1.default.delete(`${this.pinataApiUrl}/pinning/unpin/${cid}`, {
                headers: this.getAuthHeaders()
            });
            console.log(`✅ Unpinned file: ${cid}`);
            return true;
        }
        catch (error) {
            console.error('Error unpinning file:', error);
            return false;
        }
    }
    /**
     * Check storage status
     */
    async getStorageStatus() {
        try {
            const isAuthenticated = await this.testAuthentication();
            return {
                provider: 'Pinata',
                gateway: this.gateway,
                available: isAuthenticated,
                authenticated: isAuthenticated
            };
        }
        catch (error) {
            console.error('Error getting storage status:', error);
            return {
                provider: 'Pinata',
                gateway: this.gateway,
                available: false,
                authenticated: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}
exports.IPFSService = IPFSService;
//# sourceMappingURL=IPFSService.js.map