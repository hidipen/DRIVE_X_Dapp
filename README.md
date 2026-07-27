# ⬡ DriveX — Blockchain P2P Car Rental Platform

> A trustless, decentralised peer-to-peer car rental system built on Ethereum.
> Fraud prevention, OTP pickup verification, fuel proof on IPFS, and automatic deposit settlement — all enforced by smart contracts.

---

## 📁 Project Structure

```
drivex/
├── contracts/
│   └── CarRental.sol          # Main MVP smart contract (all phases)
├── scripts/
│   └── deploy.js              # Hardhat deployment script
├── test/
│   └── CarRental.test.js      # Full contract test suite
├── backend/
│   ├── server.js              # Express entry point
│   ├── routes/
│   │   ├── auth.routes.js     # Wallet sign-in (SIWE-lite)
│   │   ├── user.routes.js     # User data endpoints
│   │   ├── car.routes.js      # Car listing + nearby search
│   │   ├── rental.routes.js   # Rental data endpoints
│   │   ├── otp.routes.js      # OTP generation & verification
│   │   ├── ipfs.routes.js     # File upload to IPFS (Pinata)
│   │   └── admin.routes.js    # Admin actions
│   ├── services/
│   │   ├── blockchain.service.js  # ethers.js contract wrapper
│   │   ├── otp.service.js         # OTP generation & hashing
│   │   ├── ipfs.service.js        # Pinata IPFS upload
│   │   └── location.service.js    # Haversine geo-search
│   ├── models/
│   │   ├── otp.model.js           # MongoDB OTP storage
│   │   ├── nonce.model.js         # Auth nonce storage
│   │   └── notification.model.js  # In-app notifications
│   ├── middleware/
│   │   ├── auth.middleware.js     # JWT + admin guard
│   │   └── error.middleware.js    # Global error handler
│   └── jobs/
│       └── pickup.jobs.js         # Cron: monitor pickup expiry
├── frontend/
│   └── src/
│       ├── context/
│       │   ├── Web3Context.jsx    # MetaMask + ethers provider
│       │   └── AuthContext.jsx    # JWT auth state
│       ├── pages/
│       │   ├── LandingPage.jsx
│       │   ├── RegisterPage.jsx
│       │   ├── DashboardPage.jsx
│       │   ├── CarsPage.jsx
│       │   ├── CarDetailPage.jsx
│       │   ├── RegisterCarPage.jsx
│       │   ├── MyRentalsPage.jsx
│       │   ├── RentalDetailPage.jsx
│       │   └── AdminPage.jsx
│       ├── components/
│       │   ├── Navbar.jsx
│       │   ├── CarCard.jsx
│       │   ├── RentalCard.jsx
│       │   ├── RentalStatusBadge.jsx
│       │   └── FuelMeter.jsx
│       ├── hooks/
│       │   ├── useContract.js
│       │   ├── useUser.js
│       │   └── useRental.js
│       └── utils/
│           ├── api.js             # Axios instance
│           └── format.js          # ETH / timestamp formatters
├── hardhat.config.js
├── package.json
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- MongoDB running locally (or Atlas URI)
- MetaMask browser extension

### 1. Install all dependencies
```bash
npm run install:all
```

### 2. Set up environment variables

**Root `.env`** (optional, for testnet):
```
SEPOLIA_RPC_URL=...
PRIVATE_KEY=...
```

**`backend/.env`** (copy from `.env.example`):
```bash
cp backend/.env.example backend/.env
```
Fill in `MONGO_URI`, `JWT_SECRET`, and optionally `PINATA_API_KEY`.

**`frontend/.env`** (copy from `.env.example`):
```bash
cp frontend/.env.example frontend/.env
```

### 3. Compile contracts
```bash
npm run compile
```

### 4. Start local blockchain (Terminal 1)
```bash
npm run chain
```
Note the first account address — that's your **admin wallet**. Copy its private key into `backend/.env` as `ADMIN_PRIVATE_KEY`.

### 5. Deploy contract (Terminal 2)
```bash
npm run deploy:local
```
This automatically writes the ABI + address to `frontend/src/abi/CarRental.json` and `backend/abi/CarRental.json`.

Copy the printed `CONTRACT_ADDRESS` into `backend/.env`.

### 6. Start backend (Terminal 3)
```bash
npm run backend
```

### 7. Start frontend (Terminal 4)
```bash
npm run frontend
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🔄 Full Rental Flow

```
1. Owner registers → Admin verifies
2. Owner lists car (price, deposit, GPS, IPFS metadata)
3. Renter registers → Admin verifies
4. Renter browses nearby cars
5. Renter books → pays (rental cost + deposit) on-chain
6. Owner approves rental
7. At pickup time: Owner generates OTP via backend
8. Renter enters OTP + fuel photo → confirmPickup() on-chain
9. Car is ACTIVE
10. Renter returns → initiateReturn()
11. Owner uploads return fuel photo → confirmReturn()
12. Smart contract auto-calculates penalty (if fuel dropped)
13. Owner receives rental cost + penalty; Renter gets deposit minus penalty
```

---

## ⛽ Fuel Penalty Formula

```
penalty = (fuelDiff% × securityDeposit) / 100
penalty is capped at 50% of the deposit
```

Example: 20% fuel missing on a 0.05 ETH deposit → 0.01 ETH penalty.

---

## 🛡️ Security Features

| Feature | Implementation |
|---|---|
| Duplicate licence prevention | `licenseUsed` mapping on-chain |
| OTP forgery prevention | keccak256 hash verified on-chain |
| Fake pickup prevention | OTP only valid inside pickup window |
| Owner no-show | Auto-refund + reputation penalty after window expires |
| Fuel fraud | IPFS-stored photos + on-chain percentage comparison |
| Blacklisting | `blacklisted` mapping blocks all future transactions |
| Reputation | Score starts at 100, increases/decreases per action |

---

## 🧪 Running Tests

```bash
npm run test:contracts
```

---

## 🌐 Deploying to Testnet (Sepolia)

1. Add `SEPOLIA_RPC_URL` and `PRIVATE_KEY` to root `.env`
2. Uncomment the `sepolia` network in `hardhat.config.js`
3. Run:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

---

## 🔮 Next Steps (Post-MVP)

- [ ] Push notifications (Socket.io or Firebase)
- [ ] Multi-image car gallery from IPFS
- [ ] Map view (Leaflet.js) for car discovery
- [ ] Rating system after rental completion
- [ ] Mobile app (React Native + WalletConnect)
- [ ] ERC-20 stable coin payment option
- [ ] DAO governance for platform disputes
- [ ] Car damage photo comparison (AI integration)

---

## 📄 License

MIT — built with ❤️ as a Final Year Project
