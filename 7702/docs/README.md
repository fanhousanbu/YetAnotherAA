# EIP-7702 Delegation System

A zero ETH threshold EIP-7702 delegation system with Paymaster sponsorship + Relayer backup solution.

## ✨ Features

- ✅ **Zero ETH Threshold**: Users can use EIP-7702 delegation without ETH
- 🔄 **Hybrid Solution**: Paymaster priority + Relayer fallback
- 🔒 **Secure Authentication**: WebAuthn integration support
- 📊 **Real-time Status**: Complete delegation status monitoring
- 🚀 **Fast Deployment**: Vite + Express one-click startup

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Start Services

#### Using Startup Script
```bash
./start.sh
```

#### Manual Start
```bash
# Start backend service (port 3001)
cd backend && npm start &

# Start frontend service (port 8080)
cd frontend && npm run dev &
```

### 3. Access Application

- **Frontend Interface**: http://localhost:8080
- **Simple Test**: http://localhost:8080/simple-test.html
- **Full Test**: http://localhost:8080/test.html
- **Backend API**: http://localhost:3001
- **Test Interface**: http://localhost:3001/api/test

## 📋 System Requirements

- Node.js 18+
- npm 8+
- MetaMask Browser Extension
- Sepolia Test Network

## 🔧 Environment Configuration

### Backend Environment Variables

```bash
# .env file
NODE_ENV=production
PORT=3001
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/Bx4QRW1-vnwJUePSAAD7N
DEPLOYER_PRIVATE_KEY=0x...
RELAYER_PRIVATE_KEY=0x...
```

### Frontend Configuration

Automatic proxy to backend API:
- `http://localhost:8080/api/*` → `http://localhost:3001/api/*`

## 🎯 User Guide

### 1. Connect Wallet

- Install MetaMask
- Connect to Sepolia test network
- Click "Connect MetaMask" button

### 2. Check Delegation Status

- Enter user address (supports default test address)
- Click "Check Status" to view current delegation status

### 3. Enable Delegation

- Set daily limit (default 0.1 ETH)
- Click "Enable Zero-Gas Delegation"
- System automatically selects optimal approach

### 4. Solution Explanation

#### Paymaster Solution
- Priority use of ERC-4337 Paymaster
- User pays no fees
- Requires UserOperation signature

#### Relayer Solution
- Used when Paymaster unavailable
- Relayer pays gas fees on behalf
- Requires user transaction signature

## 📊 API Endpoints

### Health Check
```
GET /health
```

### Check Delegation Status
```
POST /api/eip7702/status
{
  "userAddress": "0x..."
}
```

### Enable Delegation
```
POST /api/eip7702/enable
{
  "userAddress": "0x...",
  "dailyLimit": "100000000000000000"
}
```

### Broadcast Transaction
```
POST /api/relayer/broadcast
{
  "signedTx": "0x...",
  "userAddress": "0x..."
}
```

### Test Interface
```
GET /api/test
```

## 🧪 Test Addresses

### Contract Addresses
- **DelegationFactory**: 0x91Cb993E50e959C10b4600CB825A93740b79FeA9
- **SponsorPaymaster**: 0x91Cb993E50e959C10b4600CB825A93740b79FeA9

### Test User
- **Address**: 0xc8d1Ae1063176BEBC750D9aD5D057BA4A65daf3d

## 🏗️ Project Structure

```
7702/
├── backend/                 # Express backend service
│   ├── src/
│   │   └── index.js        # Main server file
│   └── package.json
├── frontend/               # Vite frontend application
│   ├── test.html          # Test page
│   ├── package.json
│   └── vite.config.js
├── script/                 # Deployment scripts
├── src/                   # Smart contracts
├── backend/.env           # Environment configuration
├── backend/.env.example   # Example configuration
├── docs/                  # Documentation
│   ├── README.md          # Project documentation
│   └── CHANGELOG.md       # Version history
├── start.sh              # Startup script
└── README.md             # Root documentation
```

## 🔍 Troubleshooting

### Common Issues

1. **Backend Won't Start**
   - Check if port 3001 is occupied
   - Verify environment variables are configured correctly

2. **Frontend Can't Connect**
   - Ensure backend service is running
   - Check MetaMask is connected to Sepolia network

3. **Transaction Failed**
   - Check user address balance
   - Confirm network connection status

### Log Viewing

```bash
# View backend logs
tail -f backend/src/index.js

# View frontend logs (browser developer tools)
# Or check console output
```

## 🚢 Deployment

### Docker Deployment
```bash
# Build images
docker build -f Dockerfile.backend -t yaaa-backend .
docker build -f Dockerfile.frontend -t yaaa-frontend .

# Start services
docker-compose up -d
```

### Production Environment

1. Configure production environment variables
2. Build frontend production version
3. Use PM2 or similar tool for process management

## 📄 License

MIT License

## 🤝 Contributing

Welcome to submit Issues and Pull Requests!

## 📞 Contact

For questions, please submit an Issue or contact the maintainers.