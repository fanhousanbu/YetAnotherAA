# 🧪 Beta Tester Guide - EIP-7702 Gasless Transactions

Welcome to the EIP-7702 delegation system beta test! This guide will help you get started.

---

## 🎯 What is This?

This system allows you to make **gasless Ethereum transactions** using:
- **EIP-7702**: Your regular wallet (EOA) can act like a smart contract
- **Account Abstraction (ERC-4337)**: Paymaster sponsors your gas fees
- **Community Tokens**: Pay with xPNTs or use SBT for benefits

**Result**: You can use Ethereum **without holding ETH for gas** 🚀

---

## 📋 Prerequisites

### What You Need

1. **MetaMask Wallet** (latest version)
   - Download: https://metamask.io/download/
   - Or use existing wallet

2. **Sepolia Testnet ETH** (optional, for testing)
   - We'll provide gasless deployment
   - But good to have 0.01 ETH for comparisons

3. **Modern Web Browser**
   - Chrome, Firefox, or Brave recommended
   - Safari works but may have issues

4. **15-30 Minutes** of your time

---

## 🚀 Quick Start (5 Steps)

### Step 1: Setup MetaMask

1. **Install MetaMask**
   - Visit https://metamask.io/download/
   - Add to your browser
   - Create new wallet or import existing

2. **Switch to Sepolia Network**
   ```
   MetaMask → Networks → Add Network

   Network Name: Sepolia
   RPC URL: https://rpc.sepolia.org
   Chain ID: 11155111
   Symbol: ETH
   Explorer: https://sepolia.etherscan.io
   ```

3. **Get Your Address**
   - Click MetaMask icon
   - Copy your address (starts with 0x...)
   - **Important**: Save this address for testing

### Step 2: Access Test Interface

1. **Open Application**
   - URL: http://localhost:8080
   - Or: [Production URL if available]

2. **Connect Wallet**
   - Click "Connect MetaMask"
   - Approve connection in MetaMask popup
   - Your address should appear on screen

### Step 3: Enable Delegation (Zero ETH Required!)

1. **Check Current Status**
   - Click "Check Delegation Status"
   - Should show "No delegation found"

2. **Enable Gasless Transactions**
   - Enter daily limit: `0.1` (or keep default)
   - Click "Enable Zero-Gas Delegation"
   - Sign the authorization in MetaMask
   - **Note**: You're NOT paying gas here!

3. **Wait for Confirmation**
   - Should take 10-30 seconds
   - You'll see delegation address
   - Status changes to "Enabled"

### Step 4: Make Your First Gasless Transaction

**Option A: Transfer Test Tokens** (if available)
1. Go to "Transfer" tab
2. Enter recipient address
3. Enter amount
4. Click "Transfer"
5. Sign in MetaMask
6. **Observe**: Transaction succeeds without ETH!

**Option B: Test Transaction** (always available)
1. Click "Test Transaction"
2. System sends small test tx
3. Verify on Etherscan
4. Check you paid 0 ETH

### Step 5: Provide Feedback

1. **Fill out feedback form**
   - Open: `USER_FEEDBACK_FORM.md`
   - Or: [Online form URL]

2. **Report any issues**
   - Use GitHub issues
   - Or contact test coordinator

---

## 📖 Detailed User Flow

### Understanding the System

```
Traditional Flow:
User → MetaMask → Pay Gas in ETH → Transaction

Our Flow:
User → MetaMask → Sign Only → Paymaster Pays Gas → Transaction
```

### What Happens When You Enable Delegation?

1. **Factory Creates Contract**
   - Deterministic address (using CREATE2)
   - Contract is owned by YOUR EOA
   - Daily spending limit set

2. **EIP-7702 Authorization**
   - You sign authorization (NOT a transaction)
   - Your EOA can now act as contract
   - Still fully under your control

3. **Paymaster Sponsorship**
   - Paymaster agrees to cover gas
   - You can use xPNTs to "pay back"
   - Or use SBT for free benefits

### Daily Limit Protection

- **Default**: 0.1 ETH per day
- **Resets**: Every 24 hours
- **Purpose**: Protect against unauthorized use
- **Adjustable**: You can change anytime

---

## 🧪 Test Scenarios

### Scenario 1: Zero-ETH Onboarding ⭐

**Goal**: Verify you can onboard without any ETH

**Steps**:
1. Create new MetaMask wallet (fresh start)
2. Do NOT get Sepolia ETH
3. Connect to our app
4. Enable delegation
5. **Expected**: Success without paying anything

**What to Check**:
- [ ] Delegation created successfully
- [ ] No ETH spent by you
- [ ] Process completed in < 2 minutes
- [ ] Clear status messages

**Report**:
- Time taken: _______
- Issues: _______
- Rating (1-5): _______

### Scenario 2: Token Transfer 💸

**Goal**: Transfer tokens without gas

**Prerequisites**:
- Delegation enabled
- Test tokens in wallet (we'll send)

**Steps**:
1. Check token balance
2. Initiate transfer
3. Sign transaction
4. Verify recipient received

**What to Check**:
- [ ] Transfer completed
- [ ] You paid 0 ETH
- [ ] Correct amount sent
- [ ] Fast confirmation (< 30s)

**Report**:
- Transaction hash: _______
- Confirmation time: _______
- Issues: _______

### Scenario 3: Daily Limit Test 🔒

**Goal**: Verify spending limits work

**Steps**:
1. Note your daily limit
2. Make transaction UNDER limit → Should succeed
3. Try transaction OVER limit → Should fail
4. Check error message

**What to Check**:
- [ ] Small transaction succeeded
- [ ] Large transaction blocked
- [ ] Error message clear
- [ ] Can check remaining limit

**Report**:
- Limit enforcement: Yes/No
- Error clarity: 1-5
- Suggestions: _______

### Scenario 4: Multiple Transactions 🔄

**Goal**: Test consecutive transactions

**Steps**:
1. Make 3-5 small transactions
2. Note speed and reliability
3. Check if any failed
4. Monitor your ETH balance (should stay 0)

**What to Check**:
- [ ] All transactions succeeded
- [ ] Consistent speed
- [ ] No ETH spent
- [ ] UI responsive

**Report**:
- Success rate: ___/___
- Average time: _______
- Issues: _______

---

## ❓ Frequently Asked Questions

### Q: Do I need ETH to start?
**A**: No! That's the whole point. The system sponsors your gas fees.

### Q: Is my wallet safe?
**A**: Yes. You're still in full control. The delegation contract is owned by you and can be disabled anytime.

### Q: What's the catch?
**A**: This is a beta test on Sepolia testnet. No real money involved. We're testing the technology.

### Q: Can I use this with my existing wallet?
**A**: Yes! No need to create new wallet. Just connect your existing MetaMask.

### Q: What if I run out of daily limit?
**A**: Wait 24 hours for reset, or contact us to increase limit for testing.

### Q: Can I disable delegation?
**A**: Yes, anytime through the UI or by changing your wallet settings.

### Q: What data do you collect?
**A**: Only what's on-chain (public) + optional feedback you provide. No private keys ever.

### Q: Will this cost me anything?
**A**: No. Sepolia testnet ETH has no value. Everything is free for testing.

---

## 🐛 Troubleshooting

### Issue: Can't Connect MetaMask

**Solutions**:
1. Refresh page
2. Check you're on Sepolia network
3. Try disconnecting and reconnecting
4. Clear MetaMask cache

### Issue: Transaction Stuck

**Solutions**:
1. Wait 2-3 minutes
2. Check Sepolia block explorer
3. Try again with fresh page
4. Report if persists > 5 minutes

### Issue: "Insufficient Balance" Error

**Possible Causes**:
- Paymaster out of funds (we'll refund quickly)
- RPC connection issue
- Daily limit reached

**Actions**:
1. Check your daily limit status
2. Report to coordinator
3. Try again in few minutes

### Issue: Signature Request Not Appearing

**Solutions**:
1. Click MetaMask icon manually
2. Check if request is pending
3. Refresh page and retry
4. Update MetaMask to latest version

---

## 📊 What We're Testing

### Technical Aspects
- ✅ EIP-7702 implementation correctness
- ✅ Paymaster sponsorship reliability
- ✅ Gas cost accuracy
- ✅ Transaction success rate

### User Experience
- ✅ Onboarding simplicity
- ✅ UI clarity and responsiveness
- ✅ Error message quality
- ✅ Overall intuitiveness

### Performance
- ✅ Deployment speed
- ✅ Transaction confirmation time
- ✅ API response time
- ✅ System under load

### Economics
- ✅ Daily limit appropriateness
- ✅ xPNTs integration
- ✅ SBT benefits
- ✅ Paymaster sustainability

---

## 📝 How to Provide Feedback

### During Testing

**Note Everything**:
- ✅ Timestamps of actions
- ✅ Transaction hashes
- ✅ Error messages
- ✅ Confusing UI elements
- ✅ Unexpected behaviors

**Use This Template**:
```
[TIME] - [ACTION] - [RESULT] - [NOTES]

Example:
14:23 - Enabled delegation - Success - Took 47 seconds
14:25 - Transferred 10 tokens - Failed - Error: "Gas estimation failed"
```

### After Testing

1. **Fill Feedback Form**
   - Open `USER_FEEDBACK_FORM.md`
   - Be honest and detailed
   - Include both positives and negatives

2. **Submit Issues**
   - GitHub: [Issues URL]
   - Discord: [Discord Channel]
   - Email: [Contact Email]

3. **Optional: Video Recording**
   - Record your testing session
   - Narrate your thoughts
   - Share via provided link

---

## 🎁 Rewards & Incentives

As a thank you for testing:

### All Testers Receive
- 🏆 Beta Tester SBT badge
- 🪙 Test xPNTs tokens
- 📜 Listed in contributors
- 🚀 Early mainnet access

### Top Contributors Receive
- 💎 Rare SBT variants
- 🎯 Bonus xPNTs
- 🤝 Direct line to dev team
- 🌟 Special role in community

### How to Be Top Contributor
- Find critical bugs
- Provide detailed feedback
- Test multiple scenarios
- Help other testers
- Suggest valuable improvements

---

## 📞 Support & Contact

### Test Coordinator
- **Discord**: [Coordinator Discord]
- **Email**: [Coordinator Email]
- **Availability**: [Hours/Timezone]

### Quick Help
- **GitHub Issues**: [Issues URL]
- **Discord Channel**: [Channel Link]
- **Documentation**: See `docs/` folder

### Emergency Contact
- **Critical Bugs**: [Emergency Email]
- **System Down**: [Status Page URL]

---

## ✅ Testing Checklist

Before you finish:

- [ ] Connected MetaMask to Sepolia
- [ ] Enabled delegation successfully
- [ ] Made at least 1 test transaction
- [ ] Tested daily limit feature
- [ ] Filled out feedback form
- [ ] Reported any bugs found
- [ ] Saved all transaction hashes
- [ ] Noted testing duration
- [ ] Provided wallet address for rewards

---

## 🎓 Learn More

### Background Reading
- **EIP-7702 Specification**: https://eips.ethereum.org/EIPS/eip-7702
- **ERC-4337 Overview**: https://docs.erc4337.io/
- **Account Abstraction**: [Link to explanation]

### Video Tutorials
- **Setup Guide**: [YouTube Link]
- **Transaction Demo**: [YouTube Link]
- **Troubleshooting**: [YouTube Link]

### Community
- **Discord**: [Discord Invite]
- **Telegram**: [Telegram Group]
- **Twitter**: [Twitter Handle]

---

## 🙏 Thank You!

Your participation is invaluable. Every issue you find, every piece of feedback you provide, helps make this system better.

Together, we're building the future of gasless Ethereum transactions! 🚀

---

**Questions?** Don't hesitate to ask in Discord or email the coordinator.

**Found a bug?** Please report it ASAP - you might save the day!

**Having fun?** Share your experience on Twitter with #EIP7702

---

**Last Updated**: 2025-11-13
**Version**: Beta 1.0
**Test Period**: [Start Date] - [End Date]
