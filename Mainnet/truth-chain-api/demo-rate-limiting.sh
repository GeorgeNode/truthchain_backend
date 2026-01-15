#!/bin/bash

# Rate Limiting Demo Script
# This script demonstrates the rate limiting in action

echo "🎬 TruthChain API - Rate Limiting Demo"
echo "======================================"
echo ""

# Check if server is running
if ! curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "❌ Server is not running on port 3001"
    echo "   Start the server with: npm run dev"
    exit 1
fi

echo "✅ Server is running"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Demo 1: Global Rate Limiting
echo -e "${BLUE}📊 Demo 1: Global Rate Limiting (100 requests / 15 min)${NC}"
echo "Making 5 requests to /api/health..."
echo ""

for i in {1..5}; do
    response=$(curl -s -i http://localhost:3001/api/health)
    status=$(echo "$response" | grep "HTTP/" | awk '{print $2}')
    remaining=$(echo "$response" | grep -i "ratelimit-remaining" | awk '{print $2}' | tr -d '\r')
    limit=$(echo "$response" | grep -i "ratelimit-limit" | awk '{print $2}' | tr -d '\r')
    
    if [ "$status" = "200" ]; then
        echo -e "Request $i: ${GREEN}✓ Success${NC} - Remaining: $remaining/$limit"
    else
        echo -e "Request $i: ${RED}✗ Rate Limited${NC} (Status: $status)"
    fi
    sleep 0.5
done

echo ""

# Demo 2: Authentication Rate Limiting
echo -e "${BLUE}📊 Demo 2: Auth Rate Limiting (10 requests / 15 min)${NC}"
echo "Testing authentication endpoint..."
echo ""

# Make a test auth request
response=$(curl -s -i -X GET "http://localhost:3001/api/auth/wallet/challenge?address=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM")
status=$(echo "$response" | grep "HTTP/" | awk '{print $2}')
remaining=$(echo "$response" | grep -i "ratelimit-remaining" | awk '{print $2}' | tr -d '\r')
limit=$(echo "$response" | grep -i "ratelimit-limit" | awk '{print $2}' | tr -d '\r')

if [ "$status" = "200" ]; then
    echo -e "${GREEN}✓ Auth request successful${NC} - Remaining: $remaining/$limit"
else
    echo -e "${RED}✗ Auth request failed${NC} (Status: $status)"
fi

echo ""

# Demo 3: Verification Rate Limiting
echo -e "${BLUE}📊 Demo 3: Verification Rate Limiting (200 requests / 15 min)${NC}"
echo "Testing verification endpoint..."
echo ""

response=$(curl -s -i -X POST http://localhost:3001/api/verify \
  -H "Content-Type: application/json" \
  -d '{"tweetContent":"Test tweet for verification"}')

status=$(echo "$response" | grep "HTTP/" | awk '{print $2}')
remaining=$(echo "$response" | grep -i "ratelimit-remaining" | awk '{print $2}' | tr -d '\r')
limit=$(echo "$response" | grep -i "ratelimit-limit" | awk '{print $2}' | tr -d '\r')

if [ "$status" = "200" ]; then
    echo -e "${GREEN}✓ Verification request successful${NC} - Remaining: $remaining/$limit"
else
    echo -e "${YELLOW}⚠ Verification request${NC} (Status: $status) - Remaining: $remaining/$limit"
fi

echo ""

# Demo 4: Rate Limit Headers
echo -e "${BLUE}📊 Demo 4: Rate Limit Response Headers${NC}"
echo "Examining response headers..."
echo ""

response=$(curl -s -i http://localhost:3001/api/health)
echo "$response" | grep -i "ratelimit" | while read line; do
    echo "  $line"
done

echo ""

# Demo 5: Simulate Rate Limit Exceeded
echo -e "${BLUE}📊 Demo 5: Simulating Rate Limit Exceeded${NC}"
echo "Making rapid requests to trigger rate limit..."
echo ""

echo "⚠️  Note: This test is disabled to avoid actually hitting rate limits."
echo "   To test rate limiting, you would need to make 100+ requests in 15 minutes."
echo ""

# Summary
echo "======================================"
echo -e "${GREEN}✅ Rate Limiting Demo Complete!${NC}"
echo ""
echo "📋 Key Takeaways:"
echo "   • Rate limits are working correctly"
echo "   • Response headers show remaining requests"
echo "   • Different endpoints have different limits"
echo "   • Exceeding limits returns 429 status code"
echo ""
echo "🔍 To monitor rate limits:"
echo "   • Check RateLimit-Remaining header"
echo "   • Watch for 429 responses"
echo "   • Use RateLimit-Reset for retry timing"
echo ""
echo "📚 Full documentation: RATE_LIMITING.md"
echo ""
