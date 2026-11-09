// frontend/src/contract.js
import { BrowserProvider, Contract, JsonRpcProvider } from "ethers";
import contractData from "./contract.json";

const LOCAL_RPC_URL = "http://127.0.0.1:8545";

export async function connectReadOnly() {
  const provider = new JsonRpcProvider(LOCAL_RPC_URL);
  const network = await provider.getNetwork();

  if (network.chainId !== 31337n) {
    throw new Error("The local Hardhat blockchain is not available.");
  }

  return {
    provider,
    contract: new Contract(contractData.address, contractData.abi, provider),
  };
}

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed. Please install the MetaMask extension.");
  }

  const provider = new BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);

  const network = await provider.getNetwork();

  if (network.chainId !== 31337n) {
    throw new Error("Please switch MetaMask to Hardhat Local (Chain ID 31337).");
  }

  const signer = await provider.getSigner();
  const contract = new Contract(
    contractData.address,
    contractData.abi,
    signer
  );

  return {
    provider,
    signer,
    contract,
    account: await signer.getAddress(),
  };
}