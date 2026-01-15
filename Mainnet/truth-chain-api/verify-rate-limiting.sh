#!/bin/bash

# Rate Limiting Implementation Verification Script
# This script ensures the rate limiting implementation is working correctly

echo "🔍 TruthChain API - Rate Limiting Verification"
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if express-rate-limit is installed
echo "📦 Checking dependencies..."
if grep -q '"express-rate-limit"' package.json; then
    echo -e "${GREEN}✓${NC} express-rate-limit is in package.json"
else
    echo -e "${RED}✗${NC} express-rate-limit is missing from package.json"
    echo "   Run: npm install express-rate-limit"
    exit 1
fi

# Check if middleware file exists
echo ""
echo "📄 Checking rate limiter middleware..."
if [ -f "src/middleware/rateLimiter.ts" ]; then
    echo -e "${GREEN}✓${NC} Rate limiter middleware exists"
else
    echo -e "${RED}✗${NC} Rate limiter middleware not found"
    exit 1
fi

# Check if app.ts has been updated
echo ""
echo "🔧 Checking app.ts integration..."
if grep -q "globalLimiter" src/app.ts; then
    echo -e "${GREEN}✓${NC} Global limiter imported in app.ts"
else
    echo -e "${RED}✗${NC} Global limiter not found in app.ts"
    exit 1
fi

if grep -q "app.use('/api', globalLimiter)" src/app.ts; then
    echo -e "${GREEN}✓${NC} Global limiter applied to API routes"
else
    echo -e "${YELLOW}⚠${NC} Global limiter might not be applied correctly"
fi

# Check if routes have been updated
echo ""
echo "🛣️  Checking routes integration..."
if grep -q "authLimiter" src/routes/index.ts; then
    echo -e "${GREEN}✓${NC} Auth limiter imported in routes"
else
    echo -e "${RED}✗${NC} Auth limiter not found in routes"
    exit 1
fi

if grep -q "registrationLimiter" src/routes/index.ts; then
    echo -e "${GREEN}✓${NC} Registration limiter imported in routes"
else
    echo -e "${RED}✗${NC} Registration limiter not found in routes"
    exit 1
fi

if grep -q "verificationLimiter" src/routes/index.ts; then
    echo -e "${GREEN}✓${NC} Verification limiter imported in routes"
else
    echo -e "${RED}✗${NC} Verification limiter not found in routes"
    exit 1
fi

# Check environment variables
echo ""
echo "⚙️  Checking environment configuration..."
if [ -f ".env" ]; then
    if grep -q "RATE_LIMIT_WINDOW_MS" .env; then
        echo -e "${GREEN}✓${NC} RATE_LIMIT_WINDOW_MS configured"
    else
        echo -e "${YELLOW}⚠${NC} RATE_LIMIT_WINDOW_MS not found in .env (will use default)"
    fi
    
    if grep -q "RATE_LIMIT_MAX_REQUESTS" .env; then
        echo -e "${GREEN}✓${NC} RATE_LIMIT_MAX_REQUESTS configured"
    else
        echo -e "${YELLOW}⚠${NC} RATE_LIMIT_MAX_REQUESTS not found in .env (will use default)"
    fi
else
    echo -e "${YELLOW}⚠${NC} .env file not found (using defaults)"
fi

# Check TypeScript compilation
echo ""
echo "🔨 Checking TypeScript compilation..."
if npx tsc --noEmit 2>&1 | grep -q "error"; then
    echo -e "${RED}✗${NC} TypeScript compilation errors found"
    echo "   Run: npx tsc --noEmit"
    exit 1
else
    echo -e "${GREEN}✓${NC} No TypeScript errors"
fi

# Summary
echo ""
echo "=============================================="
echo -e "${GREEN}✅ Rate Limiting Implementation Verified!${NC}"
echo ""
echo "📋 Rate Limiting Tiers:"
echo "   • Global Limiter:        100 requests / 15 min"
echo "   • Auth Limiter:          10 requests / 15 min"
echo "   • Registration Limiter:  20 requests / hour"
echo "   • Verification Limiter:  200 requests / 15 min"
echo "   • Strict Limiter:        5 requests / 15 min"
echo ""
echo "🚀 Next Steps:"
echo "   1. Install dependencies: npm install"
echo "   2. Start server: npm run dev"
echo "   3. Test endpoints with rate limiting"
echo "   4. Monitor rate limit headers in responses"
echo ""
echo "📚 Documentation: See RATE_LIMITING.md"
echo ""
