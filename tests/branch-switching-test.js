#!/usr/bin/env node

/**
 * TinaCMS Branch Switching Test
 * 
 * Tests branch switching capabilities with TinaCMS
 * Includes SHA handling and attempts to work around documented limitations
 */

require('dotenv').config({ path: '../.env' });
const { Octokit } = require('@octokit/rest');
const fetch = require('node-fetch');
const fs = require('fs');

class BranchSwitchingTest {
  constructor() {
    this.config = {
      github: {
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_REPO,
        token: process.env.GITHUB_PERSONAL_ACCESS_TOKEN,
        branch: process.env.GITHUB_BRANCH || 'main'
      },
      tina: {
        baseUrl: 'http://localhost:3000',
        apiUrl: 'http://localhost:3000/api/tina/gql'
      }
    };
    
    this.octokit = new Octokit({
      auth: this.config.github.token,
    });

    this.testResults = {
      timestamp: new Date().toISOString(),
      repository: `${this.config.github.owner}/${this.config.github.repo}`,
      tests: [],
      summary: {}
    };
  }

  // Create test branches with different content
  async createTestBranches() {
    console.log('\n🌿 Creating Test Branches with Different Content...');
    
    const branches = [];
    const branchNames = ['test-switch-1', 'test-switch-2'];
    
    for (let i = 0; i < branchNames.length; i++) {
      const branchName = branchNames[i];
      const testContent = `---
title: Branch ${i + 1} Content
branch: ${branchName}
timestamp: ${new Date().toISOString()}
---

# Branch ${i + 1} Test Content

This content is unique to branch ${branchName}.

**Branch ID**: ${branchName}
**Created**: ${new Date().toISOString()}
**Content**: This is branch-specific content for testing switching.
`;

      try {
        const startTime = Date.now();
        
        // Get main branch SHA
        const mainBranch = await this.octokit.request('GET /repos/{owner}/{repo}/branches/{branch}', {
          owner: this.config.github.owner,
          repo: this.config.github.repo,
          branch: this.config.github.branch
        });

        // Create branch
        const branchResponse = await this.octokit.request('POST /repos/{owner}/{repo}/git/refs', {
          owner: this.config.github.owner,
          repo: this.config.github.repo,
          ref: `refs/heads/${branchName}`,
          sha: mainBranch.data.commit.sha
        });

        // Create unique content file in this branch
        const fileResponse = await this.octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
          owner: this.config.github.owner,
          repo: this.config.github.repo,
          path: `content/pages/branch-${i + 1}.md`,
          message: `Add branch ${i + 1} content to ${branchName}`,
          content: Buffer.from(testContent).toString('base64'),
          branch: branchName
        });

        const createTime = Date.now() - startTime;
        
        console.log(`✅ Created branch "${branchName}" with content in ${createTime}ms`);
        console.log(`   SHA: ${branchResponse.data.object.sha.substring(0, 8)}`);
        console.log(`   File: content/pages/branch-${i + 1}.md`);

        branches.push({
          name: branchName,
          sha: branchResponse.data.object.sha,
          filePath: `content/pages/branch-${i + 1}.md`,
          createTime,
          success: true
        });

      } catch (error) {
        console.error(`❌ Failed to create branch ${branchName}:`, error.message);
        branches.push({
          name: branchName,
          error: error.message,
          success: false
        });
      }
    }

    return branches;
  }

  // Test TinaCMS GraphQL with branch parameter
  async testTinaCMSBranchQuery(branchName, branchSha) {
    console.log(`\n🔍 Testing TinaCMS GraphQL with branch: ${branchName}`);
    
    const query = `
      query getPage($relativePath: String!, $branch: String) {
        page(relativePath: $relativePath, branch: $branch) {
          __typename
          title
          branch
          _sys {
            filename
            path
            relativePath
          }
        }
      }
    `;

    try {
      const startTime = Date.now();
      
      const response = await fetch(this.config.tina.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: {
            relativePath: `branch-${branchName.split('-')[2]}.md`,
            branch: branchName
          }
        })
      });

      const result = await response.json();
      const queryTime = Date.now() - startTime;

      console.log(`✅ GraphQL query completed in ${queryTime}ms`);
      console.log(`   Response status: ${response.status}`);
      
      if (result.data && result.data.page) {
        console.log(`   ✅ Found content: ${result.data.page.title}`);
        console.log(`   ✅ Branch: ${result.data.page.branch}`);
        return {
          success: true,
          queryTime,
          data: result.data.page,
          found: true
        };
      } else {
        console.log(`   ❌ No content found for branch ${branchName}`);
        console.log(`   Errors: ${JSON.stringify(result.errors || 'None')}`);
        return {
          success: false,
          queryTime,
          errors: result.errors,
          found: false
        };
      }

    } catch (error) {
      console.error(`❌ TinaCMS GraphQL query failed:`, error.message);
      return {
        success: false,
        error: error.message,
        found: false
      };
    }
  }

  // Test direct GitHub API branch switching
  async testGitHubBranchSwitching(branches) {
    console.log('\n🔄 Testing Direct GitHub API Branch Switching...');
    
    const results = [];
    
    for (const branch of branches.filter(b => b.success)) {
      console.log(`\n📂 Switching to branch: ${branch.name}`);
      
      try {
        const startTime = Date.now();
        
        // Get content from specific branch
        const contentResponse = await this.octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
          owner: this.config.github.owner,
          repo: this.config.github.repo,
          path: branch.filePath,
          ref: branch.name
        });

        const switchTime = Date.now() - startTime;
        const content = Buffer.from(contentResponse.data.content, 'base64').toString('utf8');
        
        console.log(`✅ Switched to ${branch.name} in ${switchTime}ms`);
        console.log(`   Content preview: ${content.split('\n')[1]?.substring(0, 50)}...`);
        
        results.push({
          branch: branch.name,
          success: true,
          switchTime,
          contentFound: true,
          contentPreview: content.split('\n')[1]
        });

      } catch (error) {
        console.error(`❌ Failed to switch to ${branch.name}:`, error.message);
        results.push({
          branch: branch.name,
          success: false,
          error: error.message,
          contentFound: false
        });
      }
    }

    return results;
  }

  // Test SHA-based content retrieval
  async testSHABasedRetrieval(branches) {
    console.log('\n🔑 Testing SHA-Based Content Retrieval...');
    
    const results = [];
    
    for (const branch of branches.filter(b => b.success)) {
      console.log(`\n📋 Testing SHA retrieval for branch: ${branch.name}`);
      
      try {
        const startTime = Date.now();
        
        // Get content using SHA
        const contentResponse = await this.octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
          owner: this.config.github.owner,
          repo: this.config.github.repo,
          path: branch.filePath,
          ref: branch.sha
        });

        const retrievalTime = Date.now() - startTime;
        const content = Buffer.from(contentResponse.data.content, 'base64').toString('utf8');
        
        console.log(`✅ SHA-based retrieval completed in ${retrievalTime}ms`);
        console.log(`   SHA: ${branch.sha.substring(0, 8)}`);
        console.log(`   Content found: ${content.includes(branch.name) ? 'YES' : 'NO'}`);
        
        results.push({
          branch: branch.name,
          sha: branch.sha,
          success: true,
          retrievalTime,
          contentFound: content.includes(branch.name),
          method: 'sha_based'
        });

      } catch (error) {
        console.error(`❌ SHA-based retrieval failed:`, error.message);
        results.push({
          branch: branch.name,
          sha: branch.sha,
          success: false,
          error: error.message,
          method: 'sha_based'
        });
      }
    }

    return results;
  }

  // Clean up test branches
  async cleanup(branches) {
    console.log('\n🧹 Cleaning up test branches...');
    
    let cleanedCount = 0;
    
    for (const branch of branches.filter(b => b.success)) {
      try {
        // Delete the branch
        await this.octokit.request('DELETE /repos/{owner}/{repo}/git/refs/{ref}', {
          owner: this.config.github.owner,
          repo: this.config.github.repo,
          ref: `heads/${branch.name}`
        });
        
        cleanedCount++;
        console.log(`✅ Cleaned up branch: ${branch.name}`);
        
      } catch (error) {
        console.log(`⚠️ Could not clean up ${branch.name}: ${error.message}`);
      }
    }
    
    console.log(`✅ Cleaned up ${cleanedCount} test branches`);
  }

  // Main test runner
  async runBranchSwitchingTest() {
    console.log('🚀 TinaCMS Branch Switching Test');
    console.log('='.repeat(60));
    console.log(`Repository: ${this.testResults.repository}`);
    console.log(`Timestamp: ${this.testResults.timestamp}`);
    
    const branches = await this.createTestBranches();
    const successfulBranches = branches.filter(b => b.success);
    
    if (successfulBranches.length === 0) {
      console.log('❌ No branches created successfully - cannot test switching');
      return;
    }

    try {
      // Test 1: TinaCMS GraphQL branch parameter
      console.log('\n🧪 Test 1: TinaCMS GraphQL Branch Parameter');
      const tinaResults = [];
      for (const branch of successfulBranches) {
        const result = await this.testTinaCMSBranchQuery(branch.name, branch.sha);
        tinaResults.push({ branch: branch.name, ...result });
      }
      this.testResults.tests.push({
        test: 'tinacms_graphql_branch_param',
        results: tinaResults,
        success: tinaResults.some(r => r.success && r.found)
      });

      // Test 2: Direct GitHub API switching
      console.log('\n🧪 Test 2: Direct GitHub API Branch Switching');
      const githubResults = await this.testGitHubBranchSwitching(successfulBranches);
      this.testResults.tests.push({
        test: 'github_api_branch_switching',
        results: githubResults,
        success: githubResults.every(r => r.success)
      });

      // Test 3: SHA-based retrieval
      console.log('\n🧪 Test 3: SHA-Based Content Retrieval');
      const shaResults = await this.testSHABasedRetrieval(successfulBranches);
      this.testResults.tests.push({
        test: 'sha_based_retrieval',
        results: shaResults,
        success: shaResults.every(r => r.success)
      });

      // Generate report
      this.generateBranchSwitchingReport();

      return this.testResults;

    } catch (error) {
      console.error('\n❌ Branch switching test failed:', error.message);
      return { error: error.message, timestamp: new Date().toISOString() };
    } finally {
      // Always cleanup
      await this.cleanup(branches);
    }
  }

  generateBranchSwitchingReport() {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 BRANCH SWITCHING TEST RESULTS');
    console.log('='.repeat(60));
    
    const tests = this.testResults.tests;
    
    console.log(`\n📋 Test Results:`);
    tests.forEach(test => {
      const status = test.success ? '✅' : '❌';
      console.log(`${status} ${test.test}: ${test.success ? 'SUCCESS' : 'FAILED'}`);
      
      if (test.results) {
        test.results.forEach(result => {
          if (result.success) {
            console.log(`   ✅ ${result.branch}: ${result.queryTime || result.switchTime || result.retrievalTime}ms`);
          } else {
            console.log(`   ❌ ${result.branch}: ${result.error}`);
          }
        });
      }
    });

    // Analyze workarounds
    const tinaSuccess = tests.find(t => t.test === 'tinacms_graphql_branch_param')?.success || false;
    const githubSuccess = tests.find(t => t.test === 'github_api_branch_switching')?.success || false;
    const shaSuccess = tests.find(t => t.test === 'sha_based_retrieval')?.success || false;

    console.log(`\n🎯 Branch Switching Analysis:`);
    console.log(`❌ TinaCMS GraphQL Branch Param: ${tinaSuccess ? 'WORKS' : 'FAILED (as documented)'}`);
    console.log(`✅ Direct GitHub API Switching: ${githubSuccess ? 'WORKS' : 'FAILED'}`);
    console.log(`🔑 SHA-Based Retrieval: ${shaSuccess ? 'WORKS' : 'FAILED'}`);

    this.testResults.summary = {
      tinacmsBranchParam: tinaSuccess,
      githubApiSwitching: githubSuccess,
      shaBasedRetrieval: shaSuccess,
      recommendation: this.generateRecommendation(tinaSuccess, githubSuccess, shaSuccess)
    };

    console.log('\n💡 Recommendation:');
    console.log(`   ${this.testResults.summary.recommendation}`);
    
    // Save detailed report
    fs.writeFileSync(
      '../branch-switching-test-results.json',
      JSON.stringify(this.testResults, null, 2)
    );
    
    console.log('\n📄 Detailed report saved to: branch-switching-test-results.json');
    console.log('✅ Branch switching test completed!');
  }

  generateRecommendation(tinaSuccess, githubSuccess, shaSuccess) {
    if (tinaSuccess) {
      return 'TinaCMS branch switching works! Use GraphQL branch parameter.';
    } else if (githubSuccess && shaSuccess) {
      return 'Use direct GitHub API with SHA-based retrieval for branch switching.';
    } else {
      return 'Branch switching limitations confirmed - consider alternative approaches.';
    }
  }
}

// Run if called directly
if (require.main === module) {
  const test = new BranchSwitchingTest();
  test.runBranchSwitchingTest().catch(console.error);
}

module.exports = BranchSwitchingTest;
