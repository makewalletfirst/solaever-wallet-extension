import {
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  Keypair,
  Finality
} from '@solana/web3.js';
import { connection, RPC_ENDPOINT } from './connection';

export async function sendSLE(
  sender: Keypair,
  toAddress: string,
  amount: number
): Promise<string> {
  const toPubkey = new PublicKey(toAddress);
  const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
  const { blockhash } = await connection.getLatestBlockhash('processed');

  const transaction = new Transaction({
    feePayer: sender.publicKey,
    recentBlockhash: blockhash,
  }).add(
    SystemProgram.transfer({
      fromPubkey: sender.publicKey,
      toPubkey,
      lamports,
    })
  );

  const signature = await connection.sendTransaction(transaction, [sender], {
    skipPreflight: true,
    preflightCommitment: 'processed',
  });

  return signature;
}

export async function getBalance(address: string): Promise<number> {
  try {
    const response = await fetch(RPC_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [address, { commitment: 'processed' }]
      }),
    });
    const json = await response.json();
    return json.result.value / LAMPORTS_PER_SOL;
  } catch (error: any) {
    return 0;
  }
}

export async function getTransactionHistory(address: string) {
  try {
    const owner = new PublicKey(address);
    const signatures = await connection.getSignaturesForAddress(owner, { limit: 20 }, 'confirmed');
    return signatures;
  } catch (error: any) {
    console.error("History fetch failed:", error);
    return [];
  }
}
