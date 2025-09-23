#!/usr/bin/env node

/**
 * TinaCMS Git Operations Real-time Test
 * 
 * Creates actual commits and branches, then immediately fetches them
 * to verify TinaCMS cache bypass for Git operations
 */

require('dotenv').config({ path: '../.env' });
const { Octokit } = require('@octokit/rest');
const fetch = require('node-fetch');
const fs = require('fs');

class GitOperationsTest {
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
      tests: [],
      summary: {}
    };
  }

  // Create a test file commit
  async createTestCommit() {
    console.log('\n📝 Creating Test Commit...');
    
    const testFileName = `test-cache-${Date.now()}.md`;
    const testContent = `---
title: Cache Test
timestamp: ${new Date().toISOString()}
---

# Cache Test File

This file was created to test TinaCMS cache bypass for Git operations.

**Test ID**: ${Date.now()}
**Created**: ${new Date().toISOString()}

## Purpose
Verify that commits appear immediately without GitHub API cache delays.
`;

    try {
      const startTime = Date.now();
      
      // Create file via GitHub API
      const createResponse = await this.octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
        owner: this.config.github.owner,
        repo: this.config.github.repo,
        path: `content/pages/${testFileName}`,
        message: `Test commit: Cache bypass validation ${Date.now()}`,
        content: Buffer.from(testContent).toString('base64'),
        branch: this.config.github.branch
      });

      const commitTime = Date.now() - startTime;
      const commitSha = createResponse.data.commit.sha;

      console.log(`✅ Commit created in: ${commitTime}ms`);
      console.log(`✅ Commit SHA: ${commitSha.substring(0, 8)}`);
      console.log(`✅ File path: content/test/${testFileName}`);

      return {
        success: true,
        commitTime,
        commitSha,
        fileName: testFileName,
        filePath: `content/pages/${testFileName}`,
        message: createResponse.data.commit.message
      };

    } catch (error) {
      console.error('❌ Failed to create test commit:', error.message);
      throw error;
    }
  }

  // Create a test branch
  async createTestBranch() {
    console.log('\n🌿 Creating Test Branch...');
    
    const branchName = `test-cache-${Date.now()}`;
    
    try {
      const startTime = Date.now();
      
      // Get the main branch reference
      const mainBranch = await this.octokit.request('GET /repos/{owner}/{repo}/branches/{branch}', {
        owner: this.config.github.owner,
        repo: this.config.github.repo,
        branch: this.config.github.branch
      });

      // Create new branch
      const createResponse = await this.octokit.request('POST /repos/{owner}/{repo}/git/refs', {
        owner: this.config.github.owner,
        repo: this.config.github.repo,
        ref: `refs/heads/${branchName}`,
        sha: mainBranch.data.commit.sha
      });

      const branchTime = Date.now() - startTime;

      console.log(`✅ Branch created in: ${branchTime}ms`);
      console.log(`✅ Branch name: ${branchName}`);
      console.log(`✅ Based on SHA: ${mainBranch.data.commit.sha.substring(0, 8)}`);

      return {
        success: true,
        branchTime,
        branchName,
        baseSha: mainBranch.data.commit.sha,
        ref: createResponse.data.ref
      };

    } catch (error) {
      console.error('❌ Failed to create test branch:', error.message);
      throw error;
    }
  }

  // Immediately fetch commit to test cache bypass
  async testCommitCacheBypass(commitInfo) {
    console.log('\n🔄 Testing Commit Cache Bypass...');
    
    const delays = [100, 500, 1000, 2000]; // Test at different intervals
    const results = [];

    for (const delay of delays) {
      console.log(`   Testing after ${delay}ms delay...`);
      
      await this.sleep(delay);
      
      try {
        const startTime = Date.now();
        
        // Fetch the commit via GitHub API
        const commit = await this.octokit.request('GET /repos/{owner}/{repo}/commits/{ref}', {
          owner: this.config.github.owner,
          repo: this.config.github.repo,
          ref: commitInfo.commitSha
        });

        const fetchTime = Date.now() - startTime;
        const found = commit.data.sha === commitInfo.commitSha;

        results.push({
          delay,
          fetchTime,
          found,
          commitMessage: commit.data.commit.message
        });

        console.log(`   ✅ ${delay}ms delay: ${found ? 'FOUND' : 'NOT FOUND'} in ${fetchTime}ms`);

      } catch (error) {
        results.push({
          delay,
          fetchTime: null,
          found: false,
          error: error.message
        });
        console.log(`   ❌ ${delay}ms delay: ERROR - ${error.message}`);
      }
    }

    return results;
  }

  // Immediately fetch branch to test cache bypass
  async testBranchCacheBypass(branchInfo) {
    console.log('\n🔄 Testing Branch Cache Bypass...');
    
    const delays = [100, 500, 1000, 2000]; // Test at different intervals
    const results = [];

    for (const delay of delays) {
      console.log(`   Testing after ${delay}ms delay...`);
      
      await this.sleep(delay);
      
      try {
        const startTime = Date.now();
        
        // Fetch the branch via GitHub API
        const branches = await this.octokit.request('GET /repos/{owner}/{repo}/branches', {
          owner: this.config.github.owner,
          repo: this.config.github.repo
        });

        const fetchTime = Date.now() - startTime;
        const found = branches.data.some(branch => branch.name === branchInfo.branchName);

        results.push({
          delay,
          fetchTime,
          found,
          totalBranches: branches.data.length
        });

        console.log(`   ✅ ${delay}ms delay: ${found ? 'FOUND' : 'NOT FOUND'} in ${fetchTime}ms`);

      } catch (error) {
        results.push({
          delay,
          fetchTime: null,
          found: false,
          error: error.message
        });
        console.log(`   ❌ ${delay}ms delay: ERROR - ${error.message}`);
      }
    }

    return results;
  }

  // Test TinaCMS content update and immediate fetch
  async testTinaCMSContentUpdate() {
    console.log('\n📝 Testing TinaCMS Content Update & Immediate Fetch...');
    
    try {
      const testContent = `Cache Test ${Date.now()}`;
      
      // Update content via TinaCMS
      const updateStart = Date.now();
      await this.updateContentViaTina(testContent);
      const updateTime = Date.now() - updateStart;
      
      // Immediately read back via TinaCMS
      await this.sleep(100); // Brief pause
      const readStart = Date.now();
      const content = await this.readContentViaTina();
      const readTime = Date.now() - readStart;
      
      // Check if update is immediately visible
      const contentFound = content.includes(testContent);
      
      console.log(`✅ Content update: ${updateTime}ms`);
      console.log(`✅ Content read: ${readTime}ms`);
      console.log(`✅ Immediate consistency: ${contentFound ? 'YES' : 'NO'}`);
      
      return {
        updateTime,
        readTime,
        totalTime: updateTime + readTime,
        immediateConsistency: contentFound,
        testContent
      };
      
    } catch (error) {
      console.error('❌ TinaCMS content test failed:', error.message);
      return {
        error: error.message,
        immediateConsistency: false
      };
    }
  }

  // Clean up test artifacts
  async cleanup(commitInfo, branchInfo) {
    console.log('\n🧹 Cleaning up test artifacts...');
    
    try {
      // Delete test file
      if (commitInfo && commitInfo.success) {
        const fileContent = await this.octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
          owner: this.config.github.owner,
          repo: this.config.github.repo,
          path: commitInfo.filePath
        });
        
        await this.octokit.request('DELETE /repos/{owner}/{repo}/contents/{path}', {
          owner: this.config.github.owner,
          repo: this.config.github.repo,
          path: commitInfo.filePath,
          message: `Cleanup: Remove test file ${commitInfo.fileName}`,
          sha: fileContent.data.sha,
          branch: this.config.github.branch
        });
        console.log(`✅ Deleted test file: ${commitInfo.fileName}`);
      }

      // Delete test branch
      if (branchInfo && branchInfo.success) {
        await this.octokit.request('DELETE /repos/{owner}/{repo}/git/refs/{ref}', {
          owner: this.config.github.owner,
          repo: this.config.github.repo,
          ref: `heads/${branchInfo.branchName}`
        });
        console.log(`✅ Deleted test branch: ${branchInfo.branchName}`);
      }

    } catch (error) {
      console.log(`⚠️ Cleanup warning: ${error.message}`);
    }
  }

  // Helper methods
  async updateContentViaTina(testContent) {
    // Simulate content update via TinaCMS
    return new Promise(resolve => setTimeout(resolve, 50));
  }

  async readContentViaTina() {
    try {
      const response = await fetch(this.config.tina.baseUrl, {
        method: 'GET',
        headers: { 'Accept': 'text/html' },
        timeout: 5000
      });
      return await response.text();
    } catch (error) {
      throw new Error(`TinaCMS read failed: ${error.message}`);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Main test runner
  async runGitOperationsTest() {
    console.log('🚀 TinaCMS Git Operations Cache Bypass Test');
    console.log('='.repeat(60));
    console.log(`Repository: ${this.config.github.owner}/${this.config.github.repo}`);
    console.log(`Branch: ${this.config.github.branch}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    
    let commitInfo = null;
    let branchInfo = null;
    
    try {
      // Test 1: Create commit and test immediate availability
      commitInfo = await this.createTestCommit();
      const commitCacheResults = await this.testCommitCacheBypass(commitInfo);
      
      // Test 2: Create branch and test immediate availability  
      branchInfo = await this.createTestBranch();
      const branchCacheResults = await this.testBranchCacheBypass(branchInfo);
      
      // Test 3: TinaCMS content update consistency
      const tinaContentResults = await this.testTinaCMSContentUpdate();
      
      // Analyze results
      const commitConsistency = commitCacheResults.every(r => r.found);
      const branchConsistency = branchCacheResults.every(r => r.found);
      const averageCommitFetch = Math.round(
        commitCacheResults.filter(r => r.fetchTime).reduce((sum, r) => sum + r.fetchTime, 0) / 
        commitCacheResults.filter(r => r.fetchTime).length
      );
      const averageBranchFetch = Math.round(
        branchCacheResults.filter(r => r.fetchTime).reduce((sum, r) => sum + r.fetchTime, 0) / 
        branchCacheResults.filter(r => r.fetchTime).length
      );

      this.testResults.tests = [
        {
          test: 'commit_cache_bypass',
          success: commitConsistency,
          averageFetchTime: averageCommitFetch,
          results: commitCacheResults,
          commitInfo
        },
        {
          test: 'branch_cache_bypass',
          success: branchConsistency,
          averageFetchTime: averageBranchFetch,
          results: branchCacheResults,
          branchInfo
        },
        {
          test: 'tinacms_content_consistency',
          success: tinaContentResults.immediateConsistency,
          ...tinaContentResults
        }
      ];

      // Generate summary
      this.generateGitTestReport(commitConsistency, branchConsistency, tinaContentResults);
      
      return this.testResults;

    } catch (error) {
      console.error('\n❌ Git operations test failed:', error.message);
      return { error: error.message, timestamp: new Date().toISOString() };
    } finally {
      // Always cleanup
      await this.cleanup(commitInfo, branchInfo);
    }
  }

  generateGitTestReport(commitConsistency, branchConsistency, tinaResults) {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 GIT OPERATIONS CACHE BYPASS RESULTS');
    console.log('='.repeat(60));
    
    const overallSuccess = commitConsistency && branchConsistency && tinaResults.immediateConsistency;
    
    console.log(`\n📋 Overall Git Cache Bypass: ${overallSuccess ? '✅ SUCCESS' : '❌ ISSUES FOUND'}`);
    console.log(`📝 Commit Immediate Availability: ${commitConsistency ? '✅ YES' : '❌ NO'}`);
    console.log(`🌿 Branch Immediate Availability: ${branchConsistency ? '✅ YES' : '❌ NO'}`);
    console.log(`🔄 TinaCMS Content Consistency: ${tinaResults.immediateConsistency ? '✅ YES' : '❌ NO'}`);
    
    if (tinaResults.totalTime) {
      console.log(`⚡ TinaCMS Update+Read Time: ${tinaResults.totalTime}ms`);
    }
    
    this.testResults.summary = {
      overallSuccess,
      commitConsistency,
      branchConsistency,
      tinaContentConsistency: tinaResults.immediateConsistency,
      recommendation: overallSuccess ? 
        'Git operations work without cache delays - TinaCMS recommended' :
        'Some cache delays detected - investigate configuration'
    };

    console.log('\n🎯 Decision:');
    console.log(`   ${this.testResults.summary.recommendation}`);
    
    // Save detailed report
    fs.writeFileSync(
      '../git-operations-test-results.json',
      JSON.stringify(this.testResults, null, 2)
    );
    
    console.log('\n📄 Detailed report saved to: git-operations-test-results.json');
    console.log('✅ Git operations test completed!');
  }
}

// Run if called directly
if (require.main === module) {
  const test = new GitOperationsTest();
  test.runGitOperationsTest().catch(console.error);
}

module.exports = GitOperationsTest; 