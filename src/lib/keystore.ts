const WALLETS_KEY = 'solaever_wallets_list';
const CURRENT_WALLET_INDEX = 'solaever_current_wallet_idx';

export interface WalletInfo {
  name: string;
  mnemonic: string;
  address: string;
  password?: string;
}

// Chrome Storage 헬퍼 함수
const storage = {
  get: (key: string): Promise<any> => {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key]);
      });
    });
  },
  set: (key: string, value: any): Promise<void> => {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => {
        resolve();
      });
    });
  },
  remove: (key: string): Promise<void> => {
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, () => {
        resolve();
      });
    });
  }
};

export async function saveWallet(wallet: WalletInfo) {
  const wallets = await loadWallets();
  const exists = wallets.findIndex(w => w.address === wallet.address);
  if (exists >= 0) {
    wallets[exists] = wallet;
  } else {
    wallets.push(wallet);
  }
  await storage.set(WALLETS_KEY, wallets);
  await setCurrentWallet(wallet.address);
}

export async function loadWallets(): Promise<WalletInfo[]> {
  const data = await storage.get(WALLETS_KEY);
  return data || [];
}

export async function deleteWallet(address: string) {
  let wallets = await loadWallets();
  wallets = wallets.filter(w => w.address !== address);
  await storage.set(WALLETS_KEY, wallets);
  
  const current = await storage.get(CURRENT_WALLET_INDEX);
  if (current === address) {
    await storage.remove(CURRENT_WALLET_INDEX);
  }
}

export async function setCurrentWallet(address: string | null) {
  if (address) {
    await storage.set(CURRENT_WALLET_INDEX, address);
  } else {
    await storage.remove(CURRENT_WALLET_INDEX);
  }
}

export async function getCurrentWallet(): Promise<WalletInfo | null> {
  const address = await storage.get(CURRENT_WALLET_INDEX);
  if (!address) return null;
  const wallets = await loadWallets();
  return wallets.find(w => w.address === address) || null;
}

export async function loadMnemonic(): Promise<string | null> {
  const current = await getCurrentWallet();
  return current ? current.mnemonic : null;
}
