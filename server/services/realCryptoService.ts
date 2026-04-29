import * as bip39 from "bip39";
import * as bitcoin from "bitcoinjs-lib";
import { BIP32Factory } from "bip32";
import * as ecc from "tiny-secp256k1";
import { ethers } from "ethers";

const bip32 = BIP32Factory(ecc);

/**
 * Real Crypto Service - Testnet with Public APIs
 * Uses free public blockchain APIs (no auth keys needed)
 */

interface CryptoWallet {
  userId: string | number;
  address: string;
  network: "bitcoin" | "ethereum";
  publicKey?: string;
  derivationPath?: string;
  balance: number;
  createdAt: Date;
}

interface BlockchainTransaction {
  txHash: string;
  network: "bitcoin" | "ethereum";
  amount: number;
  fromAddress: string;
  toAddress: string;
  confirmations: number;
  status: "pending" | "confirmed" | "failed";
  blockNumber?: number;
  timestamp: Date;
}

// In-memory storage (replace with DB in production)
const wallets: Map<string, CryptoWallet> = new Map();
const transactions: Map<string, BlockchainTransaction> = new Map();

// Public APIs (no auth needed)
const BLOCKCHAIR_API = "https://api.blockchair.com";
const ETHERSCAN_API = "https://api-sepolia.etherscan.io/api";

/**
 * Generate Bitcoin testnet address and check real balance
 */
export async function generateBitcoinAddress(userId: string | number): Promise<CryptoWallet> {
  const mnemonic = bip39.generateMnemonic();
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const seedUint8Array = new Uint8Array(seed);
  const root = bip32.fromSeed(seedUint8Array, bitcoin.networks.testnet);
  const path = "m/44'/1'/0'/0/0";
  const child = root.derivePath(path);

  const { address } = bitcoin.payments.p2pkh({
    pubkey: child.publicKey,
  });

  if (!address) throw new Error("Failed to generate Bitcoin address");

  // Check real balance from blockchain
  let balance = 0;
  try {
    const response = await fetch(`${BLOCKCHAIR_API}/bitcoin/testnet/addresses/${address}`);
    const data = await response.json();
    if (data.data && data.data[address]) {
      balance = data.data[address].balance / 100000000; // Convert satoshis to BTC
    }
  } catch (error) {
    console.log("Could not fetch Bitcoin balance, starting at 0");
  }

  const wallet: CryptoWallet = {
    userId,
    address,
    network: "bitcoin",
    publicKey: child.publicKey.toString(),
    derivationPath: path,
    balance,
    createdAt: new Date(),
  };

  wallets.set(`${userId}:bitcoin`, wallet);
  return wallet;
}

/**
 * Generate Ethereum testnet address and check real balance
 */
export async function generateEthereumAddress(userId: string | number): Promise<CryptoWallet> {
  const wallet = ethers.Wallet.createRandom();

  // Check real balance from Sepolia testnet
  let balance = 0;
  try {
    const provider = new ethers.JsonRpcProvider("https://rpc.sepolia.org");
    const balanceWei = await provider.getBalance(wallet.address);
    balance = parseFloat(ethers.formatEther(balanceWei));
  } catch (error) {
    console.log("Could not fetch Ethereum balance, starting at 0");
  }

  const cryptoWallet: CryptoWallet = {
    userId,
    address: wallet.address,
    network: "ethereum",
    publicKey: wallet.publicKey,
    balance,
    createdAt: new Date(),
  };

  wallets.set(`${userId}:ethereum`, cryptoWallet);
  return cryptoWallet;
}

/**
 * Get wallet for user
 */
export function getWallet(userId: string | number, network: "bitcoin" | "ethereum"): CryptoWallet | null {
  return wallets.get(`${userId}:${network}`) || null;
}

/**
 * Refresh wallet balance from blockchain
 */
export async function refreshBalance(userId: string | number, network: "bitcoin" | "ethereum"): Promise<number> {
  const wallet = getWallet(userId, network);
  if (!wallet) throw new Error("Wallet not found");

  try {
    if (network === "bitcoin") {
      const response = await fetch(`${BLOCKCHAIR_API}/bitcoin/testnet/addresses/${wallet.address}`);
      const data = await response.json();
      if (data.data && data.data[wallet.address]) {
        wallet.balance = data.data[wallet.address].balance / 100000000;
      }
    } else {
      const provider = new ethers.JsonRpcProvider("https://rpc.sepolia.org");
      const balanceWei = await provider.getBalance(wallet.address);
      wallet.balance = parseFloat(ethers.formatEther(balanceWei));
    }
  } catch (error) {
    console.error(`Failed to refresh ${network} balance:`, error);
  }

  return wallet.balance;
}

/**
 * Get transaction from blockchain
 */
export async function getBlockchainTransaction(
  txHash: string,
  network: "bitcoin" | "ethereum"
): Promise<BlockchainTransaction | null> {
  try {
    if (network === "bitcoin") {
      const response = await fetch(`${BLOCKCHAIR_API}/bitcoin/testnet/transactions/${txHash}`);
      const data = await response.json();
      if (data.data && data.data[txHash]) {
        const tx = data.data[txHash];
        return {
          txHash,
          network,
          amount: tx.output_total / 100000000,
          fromAddress: "blockchain",
          toAddress: "blockchain",
          confirmations: tx.confirmations || 0,
          status: tx.confirmations > 0 ? "confirmed" : "pending",
          blockNumber: tx.block_id,
          timestamp: new Date(tx.time),
        };
      }
    } else {
      // Ethereum - use Etherscan API
      const response = await fetch(
        `${ETHERSCAN_API}?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=YourApiKeyToken`
      );
      const data = await response.json();
      if (data.result) {
        const tx = data.result;
        const amount = parseFloat(ethers.formatEther(tx.value));
        return {
          txHash,
          network,
          amount,
          fromAddress: tx.from,
          toAddress: tx.to,
          confirmations: tx.blockNumber ? 1 : 0,
          status: tx.blockNumber ? "confirmed" : "pending",
          blockNumber: parseInt(tx.blockNumber, 16),
          timestamp: new Date(),
        };
      }
    }
  } catch (error) {
    console.error(`Failed to fetch ${network} transaction:`, error);
  }

  return null;
}

/**
 * Get all transactions for a wallet
 */
export async function getWalletTransactions(
  userId: string | number,
  network: "bitcoin" | "ethereum"
): Promise<BlockchainTransaction[]> {
  const wallet = getWallet(userId, network);
  if (!wallet) return [];

  const txs: BlockchainTransaction[] = [];

  try {
    if (network === "bitcoin") {
      const response = await fetch(`${BLOCKCHAIR_API}/bitcoin/testnet/addresses/${wallet.address}/transactions`);
      const data = await response.json();
      if (data.data && data.data[wallet.address]) {
        for (const txHash of data.data[wallet.address]) {
          const tx = await getBlockchainTransaction(txHash, network);
          if (tx) txs.push(tx);
        }
      }
    } else {
      // For Ethereum, would need to use Etherscan API with address
      // This is a simplified version
      const response = await fetch(
        `${ETHERSCAN_API}?module=account&action=txlist&address=${wallet.address}&startblock=0&endblock=99999999&sort=desc&apikey=YourApiKeyToken`
      );
      const data = await response.json();
      if (data.result && Array.isArray(data.result)) {
        for (const tx of data.result) {
          const amount = parseFloat(ethers.formatEther(tx.value));
          txs.push({
            txHash: tx.hash,
            network,
            amount,
            fromAddress: tx.from,
            toAddress: tx.to,
            confirmations: parseInt(tx.confirmations),
            status: parseInt(tx.confirmations) > 0 ? "confirmed" : "pending",
            blockNumber: parseInt(tx.blockNumber),
            timestamp: new Date(parseInt(tx.timeStamp) * 1000),
          });
        }
      }
    }
  } catch (error) {
    console.error(`Failed to fetch ${network} transactions:`, error);
  }

  return txs;
}

/**
 * Track a withdrawal transaction
 */
export function trackTransaction(tx: BlockchainTransaction): void {
  transactions.set(tx.txHash, tx);
}

/**
 * Get transaction status
 */
export async function getTransactionStatus(txHash: string, network: "bitcoin" | "ethereum"): Promise<BlockchainTransaction | null> {
  // First check in-memory cache
  let tx = transactions.get(txHash);
  if (tx) {
    // Refresh from blockchain
    const updated = await getBlockchainTransaction(txHash, network);
    if (updated) {
      transactions.set(txHash, updated);
      return updated;
    }
    return tx;
  }

  // Fetch from blockchain
  return await getBlockchainTransaction(txHash, network);
}

/**
 * Get current wallet balance
 */
export async function getBalance(userId: string | number, network: "bitcoin" | "ethereum"): Promise<number> {
  const wallet = getWallet(userId, network);
  if (!wallet) return 0;
  return await refreshBalance(userId, network);
}
