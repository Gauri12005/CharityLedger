# CharityLedger

CharityLedger is a React and Vite frontend for creating blockchain-backed
fundraising campaigns, tracking donations, and withdrawing raised funds.

## Run locally

Open separate terminals from the project folders:

1. Start the local Hardhat blockchain:

   ```powershell
   cd ..\blockchain
   .\node_modules\.bin\hardhat.cmd node
   ```

2. Deploy the contract to that blockchain (run once for each fresh chain):

   ```powershell
   .\node_modules\.bin\hardhat.cmd run --network localhost scripts\deploy.js
   ```

   This writes the deployed address and ABI to `frontend\src\contract.json`.

3. Start the frontend:

   ```powershell
   cd ..\frontend
   npm run dev -- --host 127.0.0.1
   ```

   Open the local URL printed by Vite. Connect MetaMask to Hardhat Local
   (`http://127.0.0.1:8545`, chain ID `31337`) to create campaigns, donate, and
   withdraw.

## Campaign deadlines

New campaigns require a future local date and time. The contract rejects
donations at or after the deadline, and its status view reports whether the
campaign is open, expired, or has reached its funding goal. Expiry is computed
from the blockchain timestamp when the contract is queried; no separate
background transaction is needed.

Existing campaigns created through the original `createCampaign` contract
function have no deadline. Deploying a new contract creates a fresh campaign
ledger; campaign data from a previous local deployment is not copied.

## Donor leaderboard and statistics

The public leaderboard aggregates confirmed `DonationReceived` events by donor
wallet and ranks the top ten contributors by their total donations. Overall
average donation is total donated divided by confirmed donation transactions.
Each campaign card also displays its donation count, unique contributor count,
and average donation, read from `getCampaignStatistics`. The `getDonationAmount`
view returns a wallet's total contribution to a campaign. These statistics are
updated on-chain with every successful donation.

## Checks

Run the frontend checks from `frontend`:

```powershell
npm run lint
npm run build
```

Run the contract tests from `blockchain`:

```powershell
.\node_modules\.bin\hardhat.cmd test
```
