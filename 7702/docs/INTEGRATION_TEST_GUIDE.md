# 🧪 Integration Testing Guide

**Purpose**: Validate end-to-end functionality with real users on Sepolia testnet
**Duration**: 1-2 weeks
**Target Users**: 10-20 beta testers

---

## 📋 Test Scenarios

### Scenario 1: First-Time User Onboarding ✅

**Objective**: Verify zero-ETH onboarding experience

**Steps**:
1. **User Setup**
   - Create new MetaMask wallet
   - Connect to Sepolia network
   - Verify wallet has 0 ETH

2. **Connect Wallet**
   - Visit http://localhost:8080
   - Click "Connect MetaMask"
   - Approve connection

3. **Check Status**
   - Click "Check Delegation Status"
   - Expected: "No delegation found"
   - Note: Response time

4. **Enable Delegation**
   - Enter daily limit (default 0.1 ETH)
   - Click "Enable Zero-Gas Delegation"
   - Sign authorization in MetaMask
   - Expected: Delegation deployed without user paying gas

5. **Verify Delegation**
   - Check delegation address returned
   - Verify on Etherscan
   - Check delegation contract owner
   - Verify daily limit set correctly

**Success Criteria**:
- ✅ User completes onboarding with 0 ETH
- ✅ Delegation contract deployed
- ✅ No errors or failed transactions
- ✅ Process completes in < 2 minutes

**Data to Collect**:
- Time to complete: _______
- Gas cost paid by system: _______
- User feedback: _______
- Issues encountered: _______

---

### Scenario 2: ERC-20 Token Transfer ✅

**Objective**: Test gasless token transfers using delegation

**Prerequisites**:
- User has delegation enabled
- User has test ERC-20 tokens
- Recipient address prepared

**Steps**:
1. **Prepare Test Tokens**
   ```bash
   # Deploy test ERC-20 token (for testing)
   forge script script/DeployTestToken.s.sol --broadcast

   # Mint tokens to test user
   cast send $TEST_TOKEN_ADDRESS \
     "mint(address,uint256)" \
     $TEST_USER_ADDRESS \
     1000000000000000000 \
     --private-key $DEPLOYER_PRIVATE_KEY
   ```

2. **Execute Transfer**
   - Go to frontend "Transfer" tab
   - Enter recipient address
   - Enter amount
   - Click "Transfer Tokens"
   - Sign transaction in MetaMask

3. **Verify Transfer**
   - Check recipient balance increased
   - Check sender balance decreased
   - Verify transaction on Etherscan
   - Check gas paid by Paymaster

**Success Criteria**:
- ✅ Transfer completes successfully
- ✅ User pays 0 ETH gas
- ✅ xPNTs deducted (if applicable)
- ✅ Transaction confirmed on-chain

**Data to Collect**:
- Transaction hash: _______
- Gas used: _______
- xPNTs deducted: _______
- Time to confirm: _______

---

### Scenario 3: Daily Limit Testing ✅

**Objective**: Verify daily spending limits work correctly

**Steps**:
1. **Set Low Limit**
   - Set daily limit to 0.01 ETH
   - Verify limit updated

2. **Execute Small Transaction**
   - Transfer 0.005 ETH worth of tokens
   - Expected: Success

3. **Execute Large Transaction**
   - Try to transfer 0.015 ETH worth
   - Expected: Rejected with "Daily limit exceeded"

4. **Wait for Next Day**
   - Fast-forward time (testing)
   - OR wait 24 hours (production)

5. **Retry Transaction**
   - Execute 0.015 ETH transfer again
   - Expected: Success (new day reset)

**Success Criteria**:
- ✅ Small transactions succeed
- ✅ Large transactions blocked
- ✅ Limit resets after 24h
- ✅ Clear error messages shown

**Data to Collect**:
- Limit enforcement working: Yes/No
- Error messages clear: Yes/No
- Reset timing accurate: Yes/No

---

### Scenario 4: SBT Integration Testing ✅

**Objective**: Verify SBT holder benefits

**Prerequisites**:
- SBT contract deployed
- Test users with/without SBTs

**Steps**:
1. **User Without SBT**
   - Try to enable delegation
   - Expected: Requires SBT or xPNTs

2. **Mint SBT**
   ```bash
   # Mint SBT to user
   cast send $SBT_CONTRACT_ADDRESS \
     "mint(address)" \
     $TEST_USER_ADDRESS \
     --private-key $DEPLOYER_PRIVATE_KEY
   ```

3. **Retry Delegation**
   - Enable delegation again
   - Expected: Success with SBT verification

4. **Execute Transaction**
   - Perform token transfer
   - Expected: Lower/no gas cost due to SBT

**Success Criteria**:
- ✅ SBT verification works
- ✅ Benefits applied correctly
- ✅ Non-holders handled properly

---

### Scenario 5: Paymaster Fallback Testing ✅

**Objective**: Test Relayer fallback mechanism

**Steps**:
1. **Drain Paymaster**
   ```bash
   # Withdraw Paymaster funds (testing only)
   cast send $PAYMASTER_ADDRESS \
     "withdrawETH(uint256)" \
     $(cast call $PAYMASTER_ADDRESS "getBalance()") \
     --private-key $DEPLOYER_PRIVATE_KEY
   ```

2. **Attempt Transaction**
   - Try to transfer tokens
   - Expected: System switches to Relayer

3. **Verify Relayer Used**
   - Check transaction sender
   - Verify Relayer paid gas
   - Check user experience unchanged

4. **Refund Paymaster**
   - Restore Paymaster balance
   - Verify system switches back

**Success Criteria**:
- ✅ Automatic fallback works
- ✅ User experience unchanged
- ✅ Seamless transition

---

### Scenario 6: Multi-User Concurrent Testing ✅

**Objective**: Test system under load

**Setup**:
- 10 test users
- Each with delegation enabled
- Coordinated transaction timing

**Steps**:
1. **Simultaneous Transactions**
   - All 10 users submit transfers at once
   - Monitor Paymaster capacity
   - Check transaction success rate

2. **Monitor Performance**
   - Track API response times
   - Check RPC rate limits
   - Monitor gas costs

3. **Verify Results**
   - All transactions should succeed
   - Or gracefully handle failures
   - Clear error messages if any

**Success Criteria**:
- ✅ >90% transaction success rate
- ✅ Average response time <5s
- ✅ No system crashes

**Data to Collect**:
- Total transactions: _______
- Success rate: _______
- Average confirmation time: _______
- Peak gas price: _______

---

## 📊 Metrics to Track

### Performance Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Deployment Time | <2 min | _____ | ____ |
| Transaction Confirmation | <30s | _____ | ____ |
| API Response Time | <1s | _____ | ____ |
| Success Rate | >95% | _____ | ____ |

### Cost Metrics

| Operation | Target Cost | Actual Cost | Notes |
|-----------|-------------|-------------|-------|
| Deploy Delegation | <0.01 ETH | _______ | _____ |
| Execute Transfer | <0.002 ETH | _______ | _____ |
| UserOp Validation | <0.001 ETH | _______ | _____ |

### User Experience Metrics

| Metric | Scale (1-5) | Average | Notes |
|--------|-------------|---------|-------|
| Ease of Setup | ⭐⭐⭐⭐⭐ | _____ | _____ |
| Transaction Speed | ⭐⭐⭐⭐⭐ | _____ | _____ |
| UI Clarity | ⭐⭐⭐⭐⭐ | _____ | _____ |
| Error Messages | ⭐⭐⭐⭐⭐ | _____ | _____ |

---

## 🐛 Bug Tracking

### Bug Report Template

```markdown
**Bug ID**: BUG-001
**Severity**: High/Medium/Low
**Scenario**: [Which test scenario]
**Steps to Reproduce**:
1.
2.
3.

**Expected Behavior**:

**Actual Behavior**:

**Environment**:
- Network: Sepolia
- Browser: Chrome/Firefox/Safari
- MetaMask Version:
- Contract Version:

**Screenshots/Logs**:

**Status**: Open/In Progress/Resolved
```

### Common Issues Checklist

- [ ] MetaMask connection issues
- [ ] RPC rate limiting
- [ ] Gas estimation failures
- [ ] Signature validation errors
- [ ] Daily limit calculation bugs
- [ ] SBT verification failures
- [ ] Paymaster insufficient funds
- [ ] Frontend state sync issues

---

## 📝 Test Report Template

### Weekly Test Report

```markdown
# Week [X] Integration Test Report

**Date Range**: [Start] - [End]
**Test Coordinator**: [Name]
**Participants**: [Count]

## Summary
- Total Test Scenarios Run: X
- Passed: X
- Failed: X
- Blocked: X

## Key Findings
1. [Finding 1]
2. [Finding 2]
3. [Finding 3]

## Performance Metrics
[Insert metrics table]

## Issues Found
[List of issues with IDs]

## User Feedback
[Summary of user feedback]

## Recommendations
1. [Recommendation 1]
2. [Recommendation 2]

## Next Steps
- [ ] Action item 1
- [ ] Action item 2
```

---

## 🔄 Continuous Testing

### Automated Test Script

Create `scripts/integration-test.sh`:
```bash
#!/bin/bash

# Automated integration test runner

echo "🧪 Running Integration Tests..."

# Test 1: Health Check
echo "Test 1: Backend Health"
curl -s http://localhost:3001/health | jq '.'

# Test 2: Status Check
echo "Test 2: Delegation Status"
curl -s -X POST http://localhost:3001/api/eip7702/status \
  -H "Content-Type: application/json" \
  -d "{\"userAddress\":\"$TEST_USER_ADDRESS\"}" | jq '.'

# Test 3: Contract Verification
echo "Test 3: Factory Configuration"
cast call $FACTORY_ADDRESS "getConfiguration()" --rpc-url $SEPOLIA_RPC_URL

# Test 4: Paymaster Balance
echo "Test 4: Paymaster Balance"
cast call $PAYMASTER_ADDRESS "getBalance()" --rpc-url $SEPOLIA_RPC_URL

echo "✅ Tests Complete!"
```

Run daily:
```bash
chmod +x scripts/integration-test.sh
./scripts/integration-test.sh > logs/test-$(date +%Y%m%d).log
```

---

## 📞 Support During Testing

### Test Coordinator Contact
- **Email**: [Your Email]
- **Discord**: [Your Discord]
- **Office Hours**: [Time Zone]

### Issue Reporting
1. Create GitHub issue with `[TEST]` prefix
2. Use bug report template
3. Tag with `integration-test` label

### Emergency Contact
- Critical bugs: [Emergency Contact]
- System down: [Emergency Contact]

---

## ✅ Sign-Off Checklist

Before moving to next phase:

- [ ] All test scenarios executed
- [ ] Success rate > 90%
- [ ] All critical bugs fixed
- [ ] Performance metrics meet targets
- [ ] User feedback collected
- [ ] Test report submitted
- [ ] Deployment verified on Etherscan
- [ ] Monitoring tools configured
- [ ] Documentation updated

---

**Next Phase**: Short-term Improvements (2-4 weeks)
- Test coverage enhancement
- Security audit preparation
- Gas optimization
- Monitoring/analytics setup
