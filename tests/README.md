# TinaCMS POC Test Suite

Comprehensive test suite to validate TinaCMS cache bypass, Git operations, and performance compared to direct GitHub API usage.

## What This Tests

### ✅ **Primary Goal: Cache Bypass Verification**
- **Problem**: GitHub API has a 5-minute cache delay
- **Solution**: TinaCMS uses database caching to bypass this delay
- **Test**: Verify immediate content updates without cache delay

### 🔍 **Test Categories**

1. **Cache Bypass Tests**
   - Content write → immediate read consistency
   - Performance comparison: TinaCMS vs GitHub API
   - Cache consistency verification

2. **Git Operations Tests**
   - Content committing through TinaCMS
   - Branch operations (with known limitations)
   - Commit attribution and messaging

3. **GraphQL API Tests**
   - TinaCMS GraphQL mutations
   - Query performance
   - Real-time content updates

4. **Limitations Documentation**
   - Runtime branch switching limitations
   - Self-hosted vs TinaCloud feature comparison
   - Performance characteristics

## Prerequisites

### Environment Setup
Make sure your `.env` file contains:
```bash
GITHUB_OWNER=your-username
GITHUB_REPO=tina-cms-poc-vida
GITHUB_BRANCH=main
GITHUB_PERSONAL_ACCESS_TOKEN=your-token
NEXTAUTH_SECRET=your-secret
```

### Running Services
Ensure TinaCMS is running in production mode:
```bash
# In the main project directory
pnpm dev:prod
```

## Installation

```bash
# Navigate to tests directory
cd tests

# Install test dependencies
npm install
```

## Running Tests

### All Tests (Recommended)
```bash
npm test
```

### Individual Test Categories
```bash
# Cache bypass tests only
npm run test:cache

# Git operations tests only
npm run test:git

# Performance comparison only
npm run test:performance

# Limitations documentation only
npm run test:limitations

# GraphQL API tests only
node tina-graphql-test.js
```

### Custom Test Runner
```bash
# Run comprehensive test suite with detailed reporting
node run-tests.js
```

## Test Results

Tests generate multiple report files:

- **`comprehensive-test-report.json`** - Complete test results with recommendations
- **`test-results.json`** - Basic cache and performance tests
- **`graphql-test-results.json`** - GraphQL API specific results

## Expected Results

### ✅ **Successful Cache Bypass**
```
✅ Cache Bypass: WORKING
✅ Performance Improvement: 99%+
✅ TinaCMS average read time: <100ms
✅ GitHub API cache delay: 300,000ms (5 minutes)
```

### ⚠️ **Known Limitations**
```
❌ Runtime Branch Switching: Not available in self-hosted mode
❌ Git Backed Media: Requires external media providers
❌ Search Functionality: Not available in self-hosted backend
```

### 🎯 **Key Metrics**
- **Cache bypass effectiveness**: Should show 99%+ improvement
- **Content consistency**: Updates should be immediately visible
- **Commit functionality**: Should create Git commits automatically

## Troubleshooting

### Common Issues

#### Tests Fail with "Unauthorized"
```bash
# Check environment variables
echo $GITHUB_PERSONAL_ACCESS_TOKEN
echo $GITHUB_OWNER
echo $GITHUB_REPO

# Ensure TinaCMS is running in production mode
pnpm dev:prod
```

#### GraphQL Tests Fail
```bash
# Check if TinaCMS GraphQL API is accessible
curl -X POST http://localhost:3000/api/tina/gql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'
```

#### Performance Tests Show No Improvement
- Verify TinaCMS is using database caching (not local mode)
- Check Redis/Vercel KV configuration
- Ensure `TINA_PUBLIC_IS_LOCAL=false`

## Understanding the Results

### Cache Bypass Success Criteria
1. **Write-Read Consistency**: Content updates appear immediately
2. **Performance Improvement**: >90% faster than GitHub API cache
3. **Git Integration**: Changes commit to GitHub automatically

### Performance Comparison
- **TinaCMS (with cache)**: ~50-200ms
- **GitHub API (with cache)**: 300,000ms (5 minutes)
- **Expected Improvement**: 99%+

### Limitations Assessment
The tests document known limitations of self-hosted TinaCMS:
- Branch switching only at build time
- Limited media handling compared to TinaCloud
- No built-in search functionality

## Contributing to Tests

### Adding New Tests
1. Create test file in `/tests` directory
2. Follow existing patterns for error handling and reporting
3. Update `run-tests.js` to include new test category
4. Document expected results in this README

### Test Structure
```javascript
class YourTest {
  constructor() {
    this.results = [];
  }

  async testSomething() {
    try {
      // Test implementation
      this.results.push({
        test: 'test_name',
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.results.push({
        test: 'test_name',
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}
```

## POC Decision Criteria

Based on test results, TinaCMS is suitable for your use case if:

✅ **Cache bypass shows 90%+ improvement**
✅ **Content commits work reliably**
✅ **GraphQL API responds consistently**
⚠️ **Branch switching limitations are acceptable**

The primary goal (bypassing GitHub's 5-minute cache) should be clearly validated by these tests. 