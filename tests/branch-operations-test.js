#!/usr/bin/env node

/**
 * TinaCMS Branch Operations Cache Test
 * 
 * Focused test for branch creation and immediate listing
 * to verify GitHub API branch operations have no cache delays
 */

require('dotenv').config({ path: '../.env' });
const { Octokit } = require('@octokit/rest');
const fs = require('fs');

class BranchOperationsTest {
  constructor() {
    this.config = {
      github: {
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_REPO,
        token: process.env.GITHUB_PERSONAL_ACCESS_TOKEN,
        branch: process.env.GITHUB_BRANCH || 'main'
      }
    };
    
    this.octokit = new Octokit({
      auth: this.config.github.token,
    });

    this.testResults = {
      timestamp: new Date().toISOString(),
      repository: `${this.config.github.owner}/${this.config.github.repo}`,
      baseBranch: this.config.github.branch,
      tests: [],
      summary: {}
    };
  }

  // Get initial branch count
  async getInitialBranchCount() {
    try {
      const branches = await this.octokit.request('GET /repos/{owner}/{repo}/branches', {
        owner: this.config.github.owner,
        repo: this.config.github.repo
      });
      return branches.data.length;
    } catch (error) {
      console.error('❌ Failed to get initial branch count:', error.message);
      return 0;
    }
  }

  // Create a test branch
  async createTestBranch(testId) {
    const branchName = `test-branch-${testId}-${Date.now()}`;
    
    try {
      const startTime = Date.now();
      
      // Get the main branch reference
      const mainBranch = await this.octokit.request('GET /repos/{owner}/{repo}/branches/{branch}', {
        owner: this.config.github.owner,
        repo: this.config.github.repo,
        branch: this.config.github.branch
      });

      // Create new branch
      await this.octokit.request('POST /repos/{owner}/{repo}/git/refs', {
        owner: this.config.github.owner,
        repo: this.config.github.repo,
        ref: `refs/heads/${branchName}`,
        sha: mainBranch.data.commit.sha
      });

      const createTime = Date.now() - startTime;
      
      console.log(`✅ Created branch "${branchName}" in ${createTime}ms`);

      return {
        success: true,
        branchName,
        createTime,
        baseSha: mainBranch.data.commit.sha
      };

    } catch (error) {
      console.error(`❌ Failed to create branch ${branchName}:`, error.message);
      return {
        success: false,
        branchName,
        error: error.message
      };
    }
  }

  // Test immediate branch listing after creation
  async testImmediateBranchListing(createdBranches, testId) {
    console.log(`\n🔄 Testing Immediate Branch Listing (Test ${testId})...`);
    
    const delays = [50, 100, 500, 1000, 2000]; // Test at different intervals
    const results = [];

    for (const delay of delays) {
      console.log(`   Testing after ${delay}ms delay...`);
      
      await this.sleep(delay);
      
      try {
        const startTime = Date.now();
        
        // List all branches
        const branches = await this.octokit.request('GET /repos/{owner}/{repo}/branches', {
          owner: this.config.github.owner,
          repo: this.config.github.repo
        });

        const listTime = Date.now() - startTime;
        
        // Check if all created branches are found
        const foundBranches = createdBranches.filter(cb => 
          cb.success && branches.data.some(b => b.name === cb.branchName)
        );
        
        const allFound = foundBranches.length === createdBranches.filter(cb => cb.success).length;

        results.push({
          delay,
          listTime,
          totalBranches: branches.data.length,
          expectedBranches: createdBranches.filter(cb => cb.success).length,
          foundBranches: foundBranches.length,
          allFound,
          foundBranchNames: foundBranches.map(fb => fb.branchName)
        });

        const status = allFound ? '✅ ALL FOUND' : '❌ MISSING';
        console.log(`   ${status} after ${delay}ms: ${foundBranches.length}/${createdBranches.filter(cb => cb.success).length} branches in ${listTime}ms`);

      } catch (error) {
        results.push({
          delay,
          listTime: null,
          error: error.message,
          allFound: false
        });
        console.log(`   ❌ ${delay}ms delay: ERROR - ${error.message}`);
      }
    }

    return results;
  }

  // Test multiple branch creation in sequence
  async testSequentialBranchCreation() {
    console.log('\n🌿 Test 1: Sequential Branch Creation & Immediate Listing');
    
    const testBranches = [];
    const numberOfBranches = 3;
    
    // Create branches one by one
    for (let i = 1; i <= numberOfBranches; i++) {
      console.log(`\n📝 Creating branch ${i}/${numberOfBranches}...`);
      const branch = await this.createTestBranch(`seq-${i}`);
      testBranches.push(branch);
      
      // Small delay between creations
      await this.sleep(200);
    }

    // Test immediate listing
    const listingResults = await this.testImmediateBranchListing(testBranches, 1);
    
    return {
      test: 'sequential_branch_creation',
      branches: testBranches,
      listingResults,
      success: listingResults.every(r => r.allFound)
    };
  }

  // Test batch branch creation
  async testBatchBranchCreation() {
    console.log('\n🌿 Test 2: Batch Branch Creation & Immediate Listing');
    
    const numberOfBranches = 2;
    const branchPromises = [];
    
    // Create branches simultaneously
    console.log(`\n📝 Creating ${numberOfBranches} branches simultaneously...`);
    for (let i = 1; i <= numberOfBranches; i++) {
      branchPromises.push(this.createTestBranch(`batch-${i}`));
    }
    
    const testBranches = await Promise.all(branchPromises);
    
    // Test immediate listing
    const listingResults = await this.testImmediateBranchListing(testBranches, 2);
    
    return {
      test: 'batch_branch_creation',
      branches: testBranches,
      listingResults,
      success: listingResults.every(r => r.allFound)
    };
  }

  // Performance comparison: Creation vs Listing
  async testPerformanceComparison(allBranches) {
    console.log('\n⚡ Performance Analysis...');
    
    const creationTimes = allBranches
      .filter(b => b.success && b.createTime)
      .map(b => b.createTime);
    
    const allListingResults = this.testResults.tests
      .flatMap(t => t.listingResults)
      .filter(r => r.listTime);
    
    const listingTimes = allListingResults.map(r => r.listTime);
    
    const avgCreationTime = Math.round(creationTimes.reduce((a, b) => a + b, 0) / creationTimes.length);
    const avgListingTime = Math.round(listingTimes.reduce((a, b) => a + b, 0) / listingTimes.length);
    
    console.log(`✅ Average branch creation time: ${avgCreationTime}ms`);
    console.log(`✅ Average branch listing time: ${avgListingTime}ms`);
    console.log(`✅ Creation vs Listing ratio: ${(avgCreationTime / avgListingTime).toFixed(2)}x`);
    
    return {
      avgCreationTime,
      avgListingTime,
      creationToListingRatio: avgCreationTime / avgListingTime,
      totalBranchesCreated: creationTimes.length,
      totalListingTests: listingTimes.length
    };
  }

  // Clean up test branches
  async cleanup(allBranches) {
    console.log('\n🧹 Cleaning up test branches...');
    
    let cleanedCount = 0;
    
    for (const branch of allBranches) {
      if (branch.success) {
        try {
          await this.octokit.request('DELETE /repos/{owner}/{repo}/git/refs/{ref}', {
            owner: this.config.github.owner,
            repo: this.config.github.repo,
            ref: `heads/${branch.branchName}`
          });
          cleanedCount++;
          console.log(`✅ Deleted: ${branch.branchName}`);
        } catch (error) {
          console.log(`⚠️ Could not delete ${branch.branchName}: ${error.message}`);
        }
      }
    }
    
    console.log(`✅ Cleaned up ${cleanedCount} test branches`);
  }

  // Helper method
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Main test runner
  async runBranchOperationsTest() {
    console.log('🚀 GitHub Branch Operations Cache Test');
    console.log('='.repeat(60));
    console.log(`Repository: ${this.testResults.repository}`);
    console.log(`Base Branch: ${this.testResults.baseBranch}`);
    console.log(`Timestamp: ${this.testResults.timestamp}`);
    
    const initialBranchCount = await this.getInitialBranchCount();
    console.log(`📊 Initial branch count: ${initialBranchCount}`);
    
    const allBranches = [];
    
    try {
      // Test 1: Sequential branch creation
      const sequentialTest = await this.testSequentialBranchCreation();
      this.testResults.tests.push(sequentialTest);
      allBranches.push(...sequentialTest.branches);
      
      // Test 2: Batch branch creation  
      const batchTest = await this.testBatchBranchCreation();
      this.testResults.tests.push(batchTest);
      allBranches.push(...batchTest.branches);
      
      // Performance analysis
      const performance = await this.testPerformanceComparison(allBranches);
      this.testResults.performance = performance;
      
      // Generate final report
      this.generateBranchTestReport(allBranches);
      
      return this.testResults;

    } catch (error) {
      console.error('\n❌ Branch operations test failed:', error.message);
      return { error: error.message, timestamp: new Date().toISOString() };
    } finally {
      // Always cleanup
      await this.cleanup(allBranches);
    }
  }

  generateBranchTestReport(allBranches) {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 BRANCH OPERATIONS CACHE TEST RESULTS');
    console.log('='.repeat(60));
    
    const successfulCreations = allBranches.filter(b => b.success).length;
    const totalAttempts = allBranches.length;
    const allTestsPassed = this.testResults.tests.every(t => t.success);
    
    // Analyze listing consistency
    const allListingResults = this.testResults.tests.flatMap(t => t.listingResults);
    const immediateConsistency = allListingResults.every(r => r.allFound);
    const fastestListing = Math.min(...allListingResults.filter(r => r.listTime).map(r => r.listTime));
    const slowestListing = Math.max(...allListingResults.filter(r => r.listTime).map(r => r.listTime));
    
    console.log(`\n📋 Overall Branch Cache Test: ${allTestsPassed ? '✅ SUCCESS' : '❌ ISSUES FOUND'}`);
    console.log(`🌿 Branch Creation Success Rate: ${successfulCreations}/${totalAttempts} (${Math.round(successfulCreations/totalAttempts*100)}%)`);
    console.log(`🔄 Immediate Listing Consistency: ${immediateConsistency ? '✅ YES' : '❌ NO'}`);
    console.log(`⚡ Listing Time Range: ${fastestListing}ms - ${slowestListing}ms`);
    
    if (this.testResults.performance) {
      const perf = this.testResults.performance;
      console.log(`📊 Average Creation Time: ${perf.avgCreationTime}ms`);
      console.log(`📊 Average Listing Time: ${perf.avgListingTime}ms`);
    }
    
    // GitHub cache delay comparison
    const githubCacheDelay = 300000; // 5 minutes
    const avgListingTime = this.testResults.performance?.avgListingTime || 500;
    const improvement = Math.round(((githubCacheDelay - avgListingTime) / githubCacheDelay) * 100);
    
    console.log(`\n🆚 vs GitHub 5-min Cache:`);
    console.log(`   GitHub API Cache Delay: ${githubCacheDelay}ms (5 minutes)`);
    console.log(`   Actual Branch Listing: ${avgListingTime}ms`);
    console.log(`   Performance Improvement: ${improvement}%`);
    
    this.testResults.summary = {
      overallSuccess: allTestsPassed && immediateConsistency,
      branchCreationSuccess: successfulCreations === totalAttempts,
      immediateListingConsistency: immediateConsistency,
      performanceImprovement: improvement,
      avgCreationTime: this.testResults.performance?.avgCreationTime || 0,
      avgListingTime: avgListingTime,
      recommendation: allTestsPassed && immediateConsistency ? 
        'Branch operations work without cache delays - GitHub API is real-time for branches' :
        'Some issues detected with branch operations'
    };

    console.log('\n🎯 Final Conclusion:');
    console.log(`   ${this.testResults.summary.recommendation}`);
    
    if (immediateConsistency) {
      console.log('\n✅ KEY FINDING: GitHub API branch operations are REAL-TIME');
      console.log('✅ NO 5-minute cache delays for branch creation/listing');
      console.log('✅ Branch operations work immediately without caching issues');
    }
    
    // Save detailed report
    fs.writeFileSync(
      '../branch-operations-test-results.json',
      JSON.stringify(this.testResults, null, 2)
    );
    
    console.log('\n📄 Detailed report saved to: branch-operations-test-results.json');
    console.log('✅ Branch operations test completed!');
  }
}

// Run if called directly
if (require.main === module) {
  const test = new BranchOperationsTest();
  test.runBranchOperationsTest().catch(console.error);
}

module.exports = BranchOperationsTest; 