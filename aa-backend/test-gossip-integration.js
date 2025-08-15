#!/usr/bin/env node

/**
 * 测试 aa-backend 与 signer 节点的 gossip 集成
 * 
 * 使用方法:
 * 1. 启动 signer 节点 (在 signer 目录): npm start
 * 2. 启动 aa-backend (在 aa-backend 目录): npm run start:dev
 * 3. 运行此测试脚本: node test-gossip-integration.js
 */

const fetch = require('node-fetch');

const AA_BACKEND_URL = 'http://localhost:3000';
const SIGNER_NODES = [
  'http://localhost:3001',
  'http://localhost:3002', 
  'http://localhost:3003'
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testEndpoint(url, description) {
  try {
    console.log(`🔍 Testing ${description}...`);
    const response = await fetch(url, { timeout: 5000 });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ ${description} - OK`);
      return data;
    } else {
      console.log(`❌ ${description} - HTTP ${response.status}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ ${description} - ${error.message}`);
    return null;
  }
}

async function testSignerNodes() {
  console.log('\n📡 Testing Signer Nodes...');
  
  for (let i = 0; i < SIGNER_NODES.length; i++) {
    const nodeUrl = SIGNER_NODES[i];
    
    // Test node info
    const nodeInfo = await testEndpoint(
      `${nodeUrl}/node/info`, 
      `Signer Node ${i + 1} Info`
    );
    
    if (nodeInfo) {
      console.log(`   Node ID: ${nodeInfo.nodeId}`);
      console.log(`   Public Key: ${nodeInfo.publicKey?.substring(0, 20)}...`);
    }
    
    // Test gossip peers
    const gossipPeers = await testEndpoint(
      `${nodeUrl}/gossip/peers`, 
      `Signer Node ${i + 1} Gossip Peers`
    );
    
    if (gossipPeers && gossipPeers.peers) {
      console.log(`   Gossip Peers: ${gossipPeers.peers.length}`);
    }
    
    // Test gossip health
    const gossipHealth = await testEndpoint(
      `${nodeUrl}/gossip/health`, 
      `Signer Node ${i + 1} Gossip Health`
    );
    
    if (gossipHealth && gossipHealth.health) {
      console.log(`   Gossip Status: ${gossipHealth.health.status}`);
      console.log(`   Active Peers: ${gossipHealth.health.peers?.active || 0}`);
    }
    
    console.log('');
  }
}

async function testAABackend() {
  console.log('\n🏗️  Testing AA Backend...');
  
  // Test basic health
  await testEndpoint(`${AA_BACKEND_URL}`, 'AA Backend Root');
  
  // Test gossip endpoints
  const gossipStats = await testEndpoint(
    `${AA_BACKEND_URL}/gossip/stats`, 
    'AA Backend Gossip Stats'
  );
  
  if (gossipStats && gossipStats.stats) {
    console.log(`   Total Peers: ${gossipStats.stats.totalPeers}`);
    console.log(`   Active Peers: ${gossipStats.stats.activePeers}`);
    console.log(`   Messages Sent: ${gossipStats.stats.messagesSent}`);
    console.log(`   Messages Received: ${gossipStats.stats.messagesReceived}`);
  }
  
  const gossipHealth = await testEndpoint(
    `${AA_BACKEND_URL}/gossip/health`, 
    'AA Backend Gossip Health'
  );
  
  if (gossipHealth && gossipHealth.health) {
    console.log(`   Health Status: ${gossipHealth.health.status}`);
    console.log(`   Has Active Peers: ${gossipHealth.health.connectivity?.hasActivePeers}`);
    console.log(`   Is Gossiping: ${gossipHealth.health.connectivity?.isGossiping}`);
  }
  
  const allNodes = await testEndpoint(
    `${AA_BACKEND_URL}/gossip/nodes`, 
    'AA Backend All Nodes'
  );
  
  if (allNodes && allNodes.nodes) {
    console.log(`   Discovered Nodes: ${allNodes.count}`);
    allNodes.nodes.forEach((node, index) => {
      console.log(`     Node ${index + 1}: ${node.nodeId} (${node.status})`);
      console.log(`       API: ${node.apiEndpoint}`);
      console.log(`       Gossip: ${node.gossipEndpoint}`);
    });
  }
  
  const activeNodes = await testEndpoint(
    `${AA_BACKEND_URL}/gossip/nodes/active`, 
    'AA Backend Active Nodes'
  );
  
  if (activeNodes && activeNodes.nodes) {
    console.log(`   Active Nodes: ${activeNodes.count}`);
  }
}

async function testSignerSelection() {
  console.log('\n🎯 Testing Signer Selection...');
  
  try {
    const response = await fetch(`${AA_BACKEND_URL}/gossip/signers/3`, { timeout: 5000 });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Signer Selection - OK`);
      
      if (data.success && data.signers) {
        console.log(`   Selected ${data.count} signers:`);
        data.signers.forEach((signer, index) => {
          console.log(`     Signer ${index + 1}: ${signer.nodeId}`);
          console.log(`       API: ${signer.apiEndpoint}`);
          console.log(`       Status: ${signer.status}`);
          console.log(`       Heartbeats: ${signer.heartbeatCount}`);
        });
      } else {
        console.log(`   Message: ${data.message}`);
      }
    } else {
      console.log(`❌ Signer Selection - HTTP ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Signer Selection - ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Starting Gossip Integration Test...\n');
  
  // Wait a bit for services to be ready
  console.log('⏳ Waiting for services to initialize...');
  await sleep(2000);
  
  await testSignerNodes();
  await testAABackend();
  await testSignerSelection();
  
  console.log('\n✨ Integration test completed!');
  console.log('\n📋 Summary:');
  console.log('- If signer nodes show gossip peers, the gossip protocol is working');
  console.log('- If AA backend discovers nodes, the integration is successful');
  console.log('- If signer selection works, the system is ready for BLS aggregation');
  console.log('\n💡 Tips:');
  console.log('- Make sure signer nodes are running on ports 3001, 3002, 3003');
  console.log('- Make sure aa-backend is running on port 3000');
  console.log('- Check the gossip endpoints are configured correctly');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testSignerNodes,
  testAABackend,
  testSignerSelection
};
