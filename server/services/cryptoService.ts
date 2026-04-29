import * as bip39 from "bip39";
import * as bitcoin from "bitcoinjs-lib";
import { BIP32Factory } from "bip32";
import * as ecc from "tiny-secp256k1";
import { ethers } from "ethers";

const bip32 = BIP32Factory(ecc);

/**
 * Crypto Service - Testnet Bitcoin & Ethereum
 * Generates wallets, tracks addresses, and monitors blockchain confirmations
 */

interface CryptoAddress {
  address: string;
  network: "bitcoin" | "ethereum";
  publicKey?: string;
  derivationPath?: string;
  createdAt: Date;
}

interface CryptoTransaction {
  txHash: string;
  network: "bitcoin" | "ethereum";
  amount: number;
  fromAddress: string;
  toAddress: string;
  confirmations: number;
  status: "pending" | "confirmed" | "failed";
  createdAt: Date;
}

// In-memory storage for demo (replace with DB in production)
const addressBook: Map<string, CryptoAddress> = new Map();
const transactionLog: Map<string, CryptoTransaction> = new Map();

/**
 * Generate a new Bitcoin testnet address
 */
export async function generateBitcoinAddress(userId: string | number): Promise<CryptoAddress> {
  // Generate mnemonic
  const mnemonic = bip39.generateMnemonic();
  const seed = await bip39.mnemonicToSeed(mnemonic);

  // Derive BIP44 path for Bitcoin testnet: m/44'/1'/0'/0/0
  const seedUint8Array = new Uint8Array(seed);
  const root = bip32.fromSeed(seedUint8Array, bitcoin.networks.testnet);
  const path = "m/44'/1'/0'/0/0";
  const child = root.derivePath(path);

  // Generate address
  const { address } = bitcoin.payments.p2pkh({
    pubkey: child.publicKey,
  });

  if (!address) throw new Error("Failed to generate Bitcoin address");

  const cryptoAddress: CryptoAddress = {
    address,
    network: "bitcoin",
    publicKey: child.publicKey.toString(),
    derivationPath: path,
    createdAt: new Date(),
  };

  addressBook.set(`${userId}:bitcoin`, cryptoAddress);
  return cryptoAddress;
}

/**
 * Generate a new Ethereum testnet (Sepolia) address
 */
export async function generateEthereumAddress(userId: string | number): Promise<CryptoAddress> {
  // Generate random wallet
  const wallet = ethers.Wallet.createRandom();

  const cryptoAddress: CryptoAddress = {
    address: wallet.address,
    network: "ethereum",
    publicKey: wallet.publicKey,
    createdAt: new Date(),
  };

  addressBook.set(`${userId}:ethereum`, cryptoAddress);
  return cryptoAddress;
}

/**
 * Get existing address for user
 */
export function getAddress(userId: string | number, network: "bitcoin" | "ethereum"): CryptoAddress | null {
  return addressBook.get(`${userId}:${network}`) || null;
}

/**
 * Simulate a crypto deposit (testnet)
 * In production, this would call a faucet API or trigger a real transaction
 */
export async function simulateDeposit(
  userId: string | number,
  network: "bitcoin" | "ethereum",
  amount: number
): Promise<CryptoTransaction> {
  const address = getAddress(userId, network);
  if (!address) throw new Error("No address found for user");

  // Generate fake tx hash
  const txHash = `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;

  const tx: CryptoTransaction = {
    txHash,
    network,
    amount,
    fromAddress: "faucet",
    toAddress: address.address,
    confirmations: 0,
    status: "pending",
    createdAt: new Date(),
  };

  transactionLog.set(txHash, tx);

  // Simulate confirmations over time
  simulateConfirmations(txHash, network);

  return tx;
}

/**
 * Simulate blockchain confirmations
 * In production, this would poll the actual blockchain
 */
function simulateConfirmations(txHash: string, network: "bitcoin" | "ethereum") {
  let confirmations = 0;
  const maxConfirmations = network === "bitcoin" ? 6 : 12;

  const interval = setInterval(() => {
    const tx = transactionLog.get(txHash);
    if (!tx) {
      clearInterval(interval);
      return;
    }

    confirmations++;
    tx.confirmations = confirmations;

    if (confirmations >= maxConfirmations) {
      tx.status = "confirmed";
      clearInterval(interval);
    }
  }, 5000); // Update every 5 seconds for demo
}

/**
 * Get transaction status
 */
export function getTransactionStatus(txHash: string): CryptoTransaction | null {
  return transactionLog.get(txHash) || null;
}

/**
 * Simulate a crypto withdrawal (testnet)
 * In production, this would create a real blockchain transaction
 */
export async function simulateWithdrawal(
  userId: string | number,
  network: "bitcoin" | "ethereum",
  toAddress: string,
  amount: number
): Promise<CryptoTransaction> {
  const fromAddress = getAddress(userId, network);
  if (!fromAddress) throw new Error("No address found for user");

  // Validate address format (basic check)
  if (!toAddress || toAddress.length < 20) {
    throw new Error("Invalid destination address");
  }

  // Generate fake tx hash
  const txHash = `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;

  const tx: CryptoTransaction = {
    txHash,
    network,
    amount,
    fromAddress: fromAddress.address,
    toAddress,
    confirmations: 0,
    status: "pending",
    createdAt: new Date(),
  };

  transactionLog.set(txHash, tx);
  simulateConfirmations(txHash, network);

  return tx;
}

/**
 * Get all transactions for a user
 */
export function getUserTransactions(userId: string | number): CryptoTransaction[] {
  const bitcoinAddr = getAddress(userId, "bitcoin");
  const ethAddr = getAddress(userId, "ethereum");

  return Array.from(transactionLog.values()).filter(
    (tx) =>
      (bitcoinAddr && tx.toAddress === bitcoinAddr.address) ||
      (ethAddr && tx.toAddress === ethAddr.address) ||
      (bitcoinAddr && tx.fromAddress === bitcoinAddr.address) ||
      (ethAddr && tx.fromAddress === ethAddr.address)
  );
}

/**
 * Get crypto balance (sum of confirmed deposits - withdrawals)
 */
export function getCryptoBalance(userId: string | number, network: "bitcoin" | "ethereum"): number {
  const address = getAddress(userId, network);
  if (!address) return 0;

  return Array.from(transactionLog.values())
    .filter(
      (tx) =>
        tx.network === network &&
        tx.status === "confirmed" &&
        (tx.toAddress === address.address ? 1 : tx.fromAddress === address.address ? -1 : 0)
    )
    .reduce((sum, tx) => {
      if (tx.toAddress === address.address) return sum + tx.amount;
      if (tx.fromAddress === address.address) return sum - tx.amount;
      return sum;
    }, 0);
}
