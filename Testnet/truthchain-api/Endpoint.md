# TruthChain API Endpoints

## Base URL
```
http://localhost:3000/api
```

## Authentication
No authentication required for current endpoints.

## Endpoint Categories

- **🔧 Development/Testing**: Endpoints that include `senderKey` for Postman testing
- **🔒 Secure Frontend**: Endpoints designed for production frontend integration (no private keys)
- **✅ Verification**: Endpoints for content verification (works with both approaches)

---

## 🔧 Development/Testing Endpoints

### 1. Register Tweet (with senderKey)
**POST** `/api/register`

**URL:** `http://localhost:3000/api/register`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "tweetContent": "Just launched my new startup! 🚀",
  "tweetUrl": "https://twitter.com/user/status/123456789",
  "twitterHandle": "@yourhandle",
  "senderKey": "d38623424263b445a0df2......."
}
```

**Expected Response (Success):**
```json
{
  "success": true,
  "message": "Tweet registered successfully",
  "data": {
    "hash": "a1b2c3d4e5f6...",
    "txId": "0x123abc...",
    "registrationId": 1,
    "tweetUrl": "https://twitter.com/user/status/123456789",
    "twitterHandle": "@yourhandle"
  }
}
```

### 2. Check Registration (Pre-validation)
**POST** `/api/check-registration`

**URL:** `http://localhost:3000/api/check-registration`

**Body (JSON):**
```json
{
  "tweetContent": "Just launched my new startup! 🚀"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "hash": "a1b2c3d4e5f6...",
    "exists": false,
    "canRegister": true,
    "message": "Content available for registration"
  }
}
```

### 3. Get Registration by Transaction ID
**GET** `/api/registration/:txId`

**URL:** `http://localhost:3000/api/registration/0x123abc...`

**Expected Response:**
```json
{
  "success": true,
  "message": "Registration lookup by transaction ID",
  "data": {
    "txId": "0x123abc..."
  }
}
```

---

## 🔒 Secure Frontend Endpoints

### 4. Secure Registration (no senderKey)
**POST** `/api/secure/register`

**URL:** `http://localhost:3000/api/secure/register`

**Body (JSON):**
```json
{
  "tweetContent": "Just launched my new startup! 🚀",
  "tweetUrl": "https://twitter.com/user/status/123456789",
  "twitterHandle": "@yourhandle"
}
```

**Expected Response (Success):**
```json
{
  "success": true,
  "message": "Content ready for blockchain registration",
  "data": {
    "hash": "a1b2c3d4e5f6789abcdef...",
    "tweetUrl": "https://twitter.com/user/status/123456789",
    "twitterHandle": "@yourhandle",
    "instructions": "Use this hash with your wallet to register on-chain"
  }
}
```

### 5. Confirm Registration
**POST** `/api/secure/confirm-registration`

**URL:** `http://localhost:3000/api/secure/confirm-registration`

**Body (JSON):**
```json
{
  "tweetContent": "Just launched my new startup! 🚀",
  "txId": "0x123abc..."
}
```

**Expected Response (Success):**
```json
{
  "success": true,
  "message": "Registration confirmed on blockchain",
  "data": {
    "hash": "a1b2c3d4e5f6789abcdef...",
    "txId": "0x123abc...",
    "author": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
    "registeredAt": "2024-01-15T10:30:00.000Z",
    "blockHeight": 12345,
    "registrationId": 1
  }
}
```

---

## ✅ Verification Endpoints

### 6. Verify Tweet Content/Hash
**POST** `/api/verify`

**URL:** `http://localhost:3000/api/verify`

**Body (JSON) - Using Content:**
```json
{
  "tweetContent": "Just launched my new startup! 🚀"
}
```

**Body (JSON) - Using Hash:**
```json
{
  "hash": "a1b2c3d4e5f6789abcdef..."
}
```

**Expected Response (Verified):**
```json
{
  "success": true,
  "verified": true,
  "message": "Content verified successfully",
  "data": {
    "hash": "a1b2c3d4e5f6...",
    "author": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
    "registeredAt": "2024-01-15T10:30:00.000Z",
    "blockHeight": 12345,
    "registrationId": 1
  }
}
```

### 7. Quick Verify (GET Request)
**GET** `/api/verify/:hash`

**URL:** `http://localhost:3000/api/verify/a1b2c3d4e5f6789abcdef...`

**Expected Response:**
```json
{
  "success": true,
  "verified": true,
  "message": "Content verified",
  "data": {
    "hash": "a1b2c3d4e5f6...",
    "exists": true
  }
}
```

### 8. Batch Verification
**POST** `/api/verify/batch`

**URL:** `http://localhost:3000/api/verify/batch`

**Body (JSON):**
```json
{
  "items": [
    {
      "content": "First tweet content"
    },
    {
      "hash": "a1b2c3d4e5f6789abcdef..."
    },
    {
      "content": "Another tweet to verify"
    }
  ]
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Batch verification completed for 3 items",
  "results": [
    {
      "success": true,
      "verified": true,
      "hash": "hash1...",
      "data": {
        "author": "ST1...",
        "registeredAt": "2024-01-15T10:30:00.000Z",
        "blockHeight": 12345,
        "registrationId": 1
      }
    },
    {
      "success": true,
      "verified": false,
      "hash": "hash2...",
      "data": null
    }
  ]
}
```

---

## 🏥 System Endpoints

### 9. Health Check
**GET** `/api/health`

**URL:** `http://localhost:3000/api/health`

**Expected Response:**
```json
{
  "success": true,
  "message": "TruthChain API is running",
  "blockchain": {
    "connected": true,
    "network": "testnet",
    "contract": "ST3S9E18YKY18RQBR6WVZQ816C19R3FB3K3M0K3XX.Truth-Chain"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 10. API Documentation
**GET** `/`

**URL:** `http://localhost:3000/`

**Expected Response:**
```json
{
  "name": "TruthChain API",
  "version": "1.0.0",
  "description": "Decentralized content verification system for Twitter",
  "endpoints": {
    "health": "/api/health",
    "register": "POST /api/register",
    "checkRegistration": "POST /api/check-registration",
    "secureRegister": "POST /api/secure/register",
    "confirmRegistration": "POST /api/secure/confirm-registration",
    "verify": "POST /api/verify",
    "quickVerify": "GET /api/verify/:hash",
    "batchVerify": "POST /api/verify/batch"
  }
}
```

---

## 🔄 Integration Flows

### For Postman Testing (Development)
1. **Health Check**: `GET /api/health`
2. **Check Registration**: `POST /api/check-registration`
3. **Register Content**: `POST /api/register` (with senderKey)
4. **Verify Content**: `POST /api/verify`

### For Frontend Integration (Production)
1. **Prepare Registration**: `POST /api/secure/register`
2. **Frontend**: Use wallet (Hiro/Xverse) to sign transaction with returned hash
3. **Confirm Registration**: `POST /api/secure/confirm-registration`
4. **Verify Content**: `POST /api/verify`

---

## 📝 Important Notes

- **Content Length**: Tweet content must be ≤ 280 characters
- **Batch Limits**: Maximum 10 items per batch verification request
- **Network**: Currently configured for Stacks testnet
- **Hash Algorithm**: SHA-256 with content normalization (trim + single spaces)
- **Security**: Secure endpoints never handle private keys
- **Auto-Detection**: Frontend can auto-populate `tweetUrl` and `twitterHandle`

---

## 🚨 Security Warning

⚠️ **Development endpoints** (those requiring `senderKey`) should **NEVER** be used in production. They are designed for testing purposes only. Always use the **secure endpoints** for frontend integration.

## 🚀 Quick Start

1. Start the server: `npm run dev`
2. Test health: `GET http://localhost:3000/api/health`
3. For Postman: Use `/api/register` with `senderKey`
4. For Frontend: Use `/api/secure/register` → wallet → `/api/secure/confirm-registration`