# AAStar Frontend

A modern web interface for ERC-4337 Account Abstraction with BLS Aggregate
Signatures.

## Features

🚀 **Complete User Flow**

- User registration and authentication
- ERC-4337 smart account creation
- Balance viewing and account management
- Transfer execution with BLS signatures
- Transfer history and status tracking

🎨 **Modern UI/UX**

- Responsive design with Tailwind CSS
- Toast notifications for user feedback
- Loading states and error handling
- Mobile-friendly interface

🔧 **Technical Stack**

- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Heroicons** for icons
- **Axios** for API communication
- **React Hot Toast** for notifications

## Getting Started

### Prerequisites

Make sure the backend API is running:

```bash
cd ../aastar
npm run start:dev
```

The backend should be available at `http://localhost:3000/api/v1`

### Installation

```bash
npm install
```

### Environment Setup

Create `.env.local` file (already provided):

```env
NEXT_PUBLIC_API_URL=/api/v1
```

**Note**: The frontend uses Next.js rewrites to proxy API requests, eliminating
CORS issues.

### Development

```bash
npm run dev
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

### Building for Production

```bash
npm run build
npm start
```

## User Journey

### 1. **Landing Page** (`/`)

- Welcome screen with feature highlights
- Sign in / Create account buttons
- Auto-redirects if already authenticated

### 2. **Authentication** (`/auth/*`)

- **Register** (`/auth/register`): Create new account
- **Login** (`/auth/login`): Sign in to existing account
- Form validation and error handling
- JWT token management

### 3. **Dashboard** (`/dashboard`)

- Account overview and balance display
- Smart account creation (if not exists)
- Account funding options
- Recent transfer history
- Quick action buttons

### 4. **Transfer** (`/transfer`)

- Send ETH to any address
- Select BLS signature nodes (minimum 3)
- Gas estimation before sending
- Real-time transfer status
- Transaction hash display

### 5. **Transfer History** (`/transfer/history`)

- Complete transfer history
- Status filtering and pagination
- Transaction details
- Node selection history

## API Integration

The frontend integrates with the AAStar backend API:

```typescript
// Authentication
POST /auth/register
POST /auth/login
GET  /auth/profile

// Account Management
POST /account/create
GET  /account
GET  /account/balance
POST /account/fund

// Transfers
POST /transfer/execute
POST /transfer/estimate
GET  /transfer/status/:id
GET  /transfer/history

// BLS Signatures
GET  /bls/nodes
POST /bls/sign
```

## Testing the Complete Flow

1. **Start Both Services**:

   ```bash
   # Terminal 1: Backend
   cd aastar && npm run start:dev

   # Terminal 2: Frontend
   cd aastar-frontend && npm run dev
   ```

2. **Complete User Flow**:
   - Visit http://localhost:8080
   - Register a new account
   - Create ERC-4337 smart account
   - Fund the account
   - Send a test transfer
   - View transfer history

3. **API Integration**:
   - All data flows through the backend API
   - Real-time updates via API polling
   - Error handling with user notifications

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

## File Structure

```
app/
├── auth/
│   ├── login/page.tsx     # Login form
│   └── register/page.tsx  # Registration form
├── dashboard/page.tsx     # Main dashboard
├── transfer/
│   ├── page.tsx          # Send transfer
│   └── history/page.tsx  # Transfer history
├── layout.tsx            # Root layout
└── page.tsx             # Landing page

components/
└── Layout.tsx           # App layout wrapper

lib/
├── api.ts              # API client
├── auth.ts             # Auth utilities
└── types.ts            # TypeScript definitions
```
