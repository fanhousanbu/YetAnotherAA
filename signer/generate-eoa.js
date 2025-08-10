#!/usr/bin/env node
/**
 * Generate a new random EOA account and update config.json
 */

import { ethers } from 'ethers';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function generateNewEOA() {
    try {
        // Generate random wallet
        const wallet = ethers.Wallet.createRandom();
        
        console.log('🔐 Generated new EOA account:');
        console.log(`Address: ${wallet.address}`);
        console.log(`Private Key: ${wallet.privateKey}`);
        
        // Read current config
        const configPath = join(__dirname, 'config.json');
        const config = JSON.parse(readFileSync(configPath, 'utf8'));
        
        // Update AA account
        config.aaAccount = {
            privateKey: wallet.privateKey,
            address: wallet.address,
            description: "EOA account for AA signature verification"
        };
        
        // Write back to config
        writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        console.log('\n✅ Config updated successfully!');
        console.log(`AA Account Address: ${wallet.address}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

generateNewEOA().catch(console.error);