import { 
  PublicKey, 
  Transaction, 
  Keypair 
} from '@solana/web3.js';
import { 
  getOrCreateAssociatedTokenAccount, 
  createTransferInstruction, 
  getMint 
} from '@solana/spl-token';
import { connection } from './connection';

// 기본 토큰 제거 (사용자가 직접 추가하도록 함)
export const COMMON_TOKENS: Record<string, { symbol: string, name: string }> = {};

export function getTokenInfo(mint: string) {
  return COMMON_TOKENS[mint] || { symbol: "TOKEN", name: "Unknown Token" };
}

export async function getTokenBalance(mintAddress: string, ownerAddress: string): Promise<number> {
  try {
    const mint = new PublicKey(mintAddress);
    const owner = new PublicKey(ownerAddress);
    const response = await connection.getTokenAccountsByOwner(owner, { mint });
    if (response.value.length === 0) return 0;
    const balanceInfo = await connection.getTokenAccountBalance(response.value[0].pubkey, 'processed');
    return balanceInfo.value.uiAmount || 0;
  } catch (error) {
    return 0;
  }
}

export async function sendSPLToken(
  sender: Keypair,
  mintAddress: string,
  toAddress: string,
  amount: number
): Promise<string> {
  const mint = new PublicKey(mintAddress);
  const toPubkey = new PublicKey(toAddress);
  
  const mintInfo = await getMint(connection, mint, 'processed');
  const rawAmount = Math.floor(amount * Math.pow(10, mintInfo.decimals));

  // ATA 생성 및 토큰 전송 (더 안정적인 방식)
  const fromAta = await getOrCreateAssociatedTokenAccount(connection, sender, mint, sender.publicKey, false, 'processed');
  const toAta = await getOrCreateAssociatedTokenAccount(connection, sender, mint, toPubkey, false, 'processed');

  const { blockhash } = await connection.getLatestBlockhash('processed');
  const transaction = new Transaction({
    feePayer: sender.publicKey,
    recentBlockhash: blockhash,
  }).add(
    createTransferInstruction(fromAta.address, toAta.address, sender.publicKey, rawAmount)
  );

  const signature = await connection.sendTransaction(transaction, [sender], { 
    skipPreflight: false, // 전송 전 유효성 검사 수행
    preflightCommitment: 'processed' 
  });

  return signature;
}
