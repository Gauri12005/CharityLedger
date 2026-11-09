# CharityLedger – Transparent Donation Management

A blockchain-based transparent donation management platform built using Solidity, Ethereum, Hardhat, React.js, and MetaMask. CharityLedger aims to improve trust and accountability in charitable fundraising through blockchain-powered transactions, public donation tracking, and QR-code-based donation receipts.

Donors can connect their MetaMask wallets, contribute to fundraising campaigns, verify donation transactions, and access digital receipts containing blockchain transaction details.

## 🚀 Features

- **MetaMask Wallet Integration:** Connect Ethereum wallets to interact with the decentralized application.
- **Campaign Management:** Create and view fundraising campaigns with descriptions and donation goals.
- **Smart Contract Donations:** Make secure donations through Ethereum smart contracts.
- **Public Donation Tracker:** Display donation transaction hashes, donor wallet addresses, donation amounts, and timestamps.
- **Blockchain Donation Receipts:** Generate digital donation receipts containing campaign ID, amount, transaction hash, date, and QR code.
- **Transparent Fund Tracking:** Monitor campaign fundraising progress and donation records.
- **Transaction Verification:** Verify donations using blockchain transaction details.
- **Smart Contract Security:** Manage donations and campaign operations through Solidity-based contract rules.

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| Frontend | React.js, Vite |
| Styling | CSS |
| Smart Contracts | Solidity |
| Blockchain Development | Hardhat |
| Blockchain Interaction | Ethers.js |
| Wallet Integration | MetaMask |
| Blockchain Network | Hardhat Local Network |
| QR Code Generation | QR Code Library |
| Package Management | npm |
| Development Environment | VS Code |

## 📁 Project Structure

```text
CharityLedger/
│
├── blockchain/
│   ├── contracts/
│   │   └── CharityLedger.sol
│   │
│   ├── scripts/
│   │   └── deploy.js
│   │
│   ├── test/
│   │
│   ├── hardhat.config.js
│   ├── package.json
│   └── package-lock.json
│
├── frontend/
│   ├── public/
│   │
│   ├── src/
│   │   ├── assets/
│   │   ├── App.css
│   │   ├── App.jsx
│   │   ├── contract.js
│   │   ├── contract.json
│   │   ├── index.css
│   │   └── main.jsx
│   │
│   ├── .gitignore
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
│
├── .gitignore
├── LICENSE
└── README.md
```

**Note:** Generated folders such as `node_modules`, `artifacts`, `cache`, and `dist` are excluded from the repository using `.gitignore`.

## ⚙️ Installation and Setup

### Prerequisites

Make sure you have installed:

- Node.js
- npm
- Git
- MetaMask browser extension
- Visual Studio Code (recommended)

### 1. Clone the Repository

```bash
git clone https://github.com/Gauri12005/CharityLedger.git
cd CharityLedger
```

### 2. Install Blockchain Dependencies

```bash
cd blockchain
npm install
```

### 3. Compile the Smart Contract

```bash
npx hardhat compile
```

### 4. Start the Local Blockchain

```bash
npx hardhat node
```

Keep this terminal running. Hardhat starts a local Ethereum-compatible blockchain network.

### 5. Deploy the Smart Contract

Open another terminal:

```bash
cd blockchain
npx hardhat run scripts/deploy.js --network localhost
```

After successful deployment, the contract address and ABI are exported to:

```text
frontend/src/contract.json
```

### 6. Configure MetaMask

Add a custom network in MetaMask using the following details:

| Setting | Value |
|---|---|
| Network Name | Hardhat Local |
| RPC URL | http://127.0.0.1:8545 |
| Chain ID | 31337 |
| Currency Symbol | ETH |

Import one of the test accounts provided by Hardhat using its private key.

**Important:** Use only local test accounts. Never import a real wallet's private key.

### 7. Install Frontend Dependencies

Open another terminal and navigate to the frontend directory:

```bash
cd frontend
npm install
```

### 8. Start the Frontend Application

```bash
npm run dev
```

Open the URL displayed in your terminal, usually:

```text
http://localhost:5173/
```

Connect MetaMask to the Hardhat Local network to start interacting with CharityLedger.

## 🔍 How CharityLedger Works

1. A campaign creator connects their MetaMask wallet.
2. The creator creates a fundraising campaign using the smart contract.
3. Donors connect their wallets and select a campaign.
4. Donations are submitted to the CharityLedger smart contract.
5. Blockchain events record donation information.
6. The Public Donation Tracker displays transaction hashes, donor addresses, amounts, and timestamps.
7. A QR-code-based donation receipt is generated after a confirmed donation.
8. Donors can use transaction details to independently verify their donations on the blockchain.

## 🔐 Blockchain Concepts Used

- Ethereum Blockchain
- Solidity Smart Contracts
- Decentralized Applications (DApps)
- MetaMask Wallet Integration
- Blockchain Events
- Transaction Hashes
- Immutable Transaction Records
- Smart Contract Deployment
- Blockchain Transaction Verification

## 🔮 Future Enhancements

- Campaign deadlines and automatic status checks
- Refund mechanism for unsuccessful campaigns
- Milestone-based fund withdrawal
- Verified charity and campaign profiles
- Donor leaderboard and contribution analytics
- AI-assisted suspicious campaign detection
- Multi-chain donation support

## 🎯 Project Objective

The main objective of CharityLedger is to develop a transparent and accountable donation management platform using blockchain technology.

By recording donations on the blockchain, providing public transaction tracking, and generating QR-code-based receipts, the platform helps donors independently verify their contributions and improves transparency in charitable fundraising.

## ⚠️ Disclaimer

CharityLedger is developed for educational and demonstration purposes. The current implementation uses a local Hardhat blockchain network and test ETH. It is not intended for handling real charitable funds.

## 👩‍💻 Author

**Gauri Jadhav**

GitHub: [@Gauri12005](https://github.com/Gauri12005)

---

⭐ If you find this project useful or interesting, consider giving the repository a star!
