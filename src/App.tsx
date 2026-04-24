import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, ArrowUpRight, ArrowDownLeft, History as HistoryIcon, Wallet as WalletIcon, Settings, Copy, ExternalLink, CheckCircle2, X, RefreshCw, Trash2, AlertTriangle, Lock, Eye, LogOut, Maximize2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { loadWallets, getCurrentWallet, setCurrentWallet, WalletInfo, saveWallet, deleteWallet } from './lib/keystore';
import { generateMnemonic, keypairFromMnemonic } from './lib/wallet';
import { getBalance, getTransactionHistory, sendSLE } from './lib/transfer';
import { getTokenBalance, COMMON_TOKENS, sendSPLToken } from './lib/token';
import { EXPLORER_URL, connection } from './lib/connection';
import { PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import { Buffer } from 'buffer';

type View = 'welcome' | 'login' | 'create' | 'create-password' | 'restore' | 'restore-password' | 'home' | 'send' | 'receive' | 'history' | 'add-token' | 'settings' | 'view-mnemonic' | 'token-detail';

interface TokenWithBalance {
  mint: string; symbol: string; name: string; balance: number;
}

export default function App() {
  const [view, setView] = useState<View>('welcome');
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [currentWallet, setCurrentWalletState] = useState<WalletInfo | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'none', message: string }>({ type: 'none', message: '' });

  const [customTokens, setCustomTokens] = useState<Record<string, { symbol: string, name: string }>>({});
  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>({});
  const [selectedToken, setSelectedToken] = useState<TokenWithBalance | null>(null);
  
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<string>('SLE');
  const [isSending, setIsSending] = useState(false);

  const [mnemonic, setMnemonic] = useState('');
  const [walletName, setWalletName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [selectedLoginAddress, setSelectedLoginAddress] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState('');

  const [addTokenAddress, setAddTokenAddress] = useState('');
  const [tokenNameInput, setTokenNameInput] = useState('');
  const [tokenSymbolInput, setTokenSymbolInput] = useState('');
  const [isCheckingToken, setIsCheckingToken] = useState(false);

  // 메시지 자동 숨김 (3초)
  useEffect(() => {
    if (status.type !== 'none') {
      const timer = setTimeout(() => {
        setStatus({ type: 'none', message: '' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const updateAllData = useCallback(async (address: string) => {
    try {
      setBalance(await getBalance(address));
      setHistory(await getTransactionHistory(address));
      const balances: Record<string, number> = {};
      for (const mint in customTokens) {
        balances[mint] = await getTokenBalance(mint, address);
      }
      setTokenBalances(balances);
    } catch (e) {}
  }, [customTokens]);

  useEffect(() => { init(); }, []);

  useEffect(() => {
    if (currentWallet) {
      const itv = setInterval(() => updateAllData(currentWallet.address), 5000);
      return () => clearInterval(itv);
    }
  }, [currentWallet, updateAllData]);

  async function init() {
    const ws = await loadWallets();
    const cur = await getCurrentWallet();
    chrome.storage.local.get(['solaever_custom_tokens'], (res) => {
       if(res.solaever_custom_tokens) setCustomTokens(res.solaever_custom_tokens as Record<string, { symbol: string, name: string }>);
    });
    setWallets(ws);
    if (cur) { setCurrentWalletState(cur); updateAllData(cur.address); setView('home'); }
    else if (ws.length > 0) { setView('login'); setSelectedLoginAddress(ws[0].address); }
    else setView('welcome');
    setLoading(false);
  }

  const handleExpandView = () => chrome.tabs.create({ url: 'index.html' });
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const w = wallets.find(x => x.address === selectedLoginAddress);
    if (w && w.password === loginPassword) { await setCurrentWallet(w.address); init(); }
    else setStatus({ type: 'error', message: 'Incorrect password.' });
  };
  const handleLogout = async () => { await setCurrentWallet(null); setCurrentWalletState(null); setLoginPassword(''); setView('login'); };
  const handleCreateWallet = () => { setMnemonic(generateMnemonic()); setView('create'); };
  const handleSaveNewWallet = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (password !== passwordConfirm || password.length < 4) { setStatus({ type: 'error', message: 'Check passwords (min 4).' }); return; }
    const kp = await keypairFromMnemonic(mnemonic);
    await saveWallet({ name: walletName || `Wallet ${wallets.length + 1}`, mnemonic, address: kp.publicKey.toBase58(), password });
    init();
  };
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentWallet || !recipient || !amount) return;
    setIsSending(true);
    try {
      const kp = await keypairFromMnemonic(currentWallet.mnemonic);
      let sig = selectedAsset === 'SLE' ? await sendSLE(kp, recipient, parseFloat(amount)) : await sendSPLToken(kp, selectedAsset, recipient, parseFloat(amount));
      setStatus({ type: 'success', message: 'Transaction Sent Successfully!' });
      setRecipient(''); setAmount('');
      setTimeout(() => { setView('home'); }, 2000);
    } catch (e: any) { setStatus({ type: 'error', message: e.message || 'Failed.' }); }
    finally { setIsSending(false); }
  };
  const handleCheckToken = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsCheckingToken(true);
    try {
      const mintPubkey = new PublicKey(addTokenAddress.trim());
      await getMint(connection, mintPubkey, 'processed');
      const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
      const [metadataPDA] = PublicKey.findProgramAddressSync([Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer()], METADATA_PROGRAM_ID);
      const accountInfo = await connection.getAccountInfo(metadataPDA);
      if (accountInfo) {
        const name = accountInfo.data.slice(65, 97).toString('utf-8').replace(/\0/g, '').trim();
        const symbol = accountInfo.data.slice(101, 111).toString('utf-8').replace(/\0/g, '').trim();
        setTokenNameInput(name || "Custom Token"); setTokenSymbolInput(symbol || "TOKEN");
      } else {
        const s = mintPubkey.toBase58().slice(0, 4).toUpperCase();
        setTokenSymbolInput(s); setTokenNameInput(`Token ${s}`);
      }
      setStatus({ type: 'success', message: 'Metadata Found!' });
    } catch (error) { setStatus({ type: 'error', message: 'Invalid SPL Address.' }); }
    finally { setIsCheckingToken(false); }
  };
  const handleSaveToken = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const map = { ...customTokens, [addTokenAddress.trim()]: { symbol: tokenSymbolInput, name: tokenNameInput } };
    setCustomTokens(map); chrome.storage.local.set({ solaever_custom_tokens: map }); setView('home');
    updateAllData(currentWallet!.address);
  };
  const handleDeleteToken = (m: string) => {
    const { [m]: _, ...rest } = customTokens;
    setCustomTokens(rest); chrome.storage.local.set({ solaever_custom_tokens: rest }); setView('home');
  };

  if (loading) return <div className="h-[600px] w-[360px] flex items-center justify-center bg-slate-900 text-white font-bold">Loading SolaEver...</div>;

  return (
    <div className="h-[600px] w-[360px] flex flex-col bg-slate-900 text-slate-100 font-sans overflow-hidden border border-slate-800 shadow-2xl relative mx-auto">
      {/* Header - 로그아웃 버튼 제거됨 */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/80 sticky top-0 z-20 shrink-0 backdrop-blur-lg">
        <div className="flex items-center gap-3">
          <img src="/logo.png" className="w-8 h-8 rounded-lg bg-slate-800 p-1" />
          <span className="font-bold text-lg tracking-tight">SolaEver</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleExpandView} className="p-2 text-slate-400 hover:text-white transition-colors" title="Expand View">
            <Maximize2 size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-900 pb-20">
        {status.type !== 'none' && (
           <div className={`m-4 p-3 rounded-xl text-xs flex items-center gap-2 border animate-in slide-in-from-top-2 duration-300 ${status.type === 'success' ? 'bg-emerald-900/40 text-emerald-400 border-emerald-800/50' : 'bg-red-900/40 text-red-400 border-red-800/50'}`}>
             <CheckCircle2 size={14} className={status.type === 'success' ? '' : 'hidden'} />
             <AlertTriangle size={14} className={status.type === 'error' ? '' : 'hidden'} />
             <span className="flex-1">{status.message}</span>
             <button onClick={() => setStatus({ type: 'none', message: '' })}><X size={14} /></button>
           </div>
        )}

        {view === 'welcome' && (
          <div className="p-8 flex flex-col items-center justify-center h-full text-center gap-8 animate-in fade-in">
            <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent leading-tight">SolaEver Dedicated Wallet</h1>
            <div className="w-full space-y-3">
              <button onClick={handleCreateWallet} className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-bold active:scale-95 shadow-lg">Create New Wallet</button>
              <button onClick={() => setView('restore')} className="w-full py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl font-bold active:scale-95">Import Recovery Phrase</button>
            </div>
          </div>
        )}

        {view === 'login' && (
           <div className="p-8 flex flex-col items-center justify-center h-full gap-6">
             <Lock size={48} className="text-blue-500 mb-2" />
             <h2 className="text-2xl font-bold">Welcome Back</h2>
             <form onSubmit={handleLogin} className="w-full space-y-4">
               <select className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm font-bold outline-none" value={selectedLoginAddress} onChange={(e) => setSelectedLoginAddress(e.target.value)}>
                 {wallets.map(w => <option key={w.address} value={w.address}>{w.name}</option>)}
               </select>
               <input type="password" placeholder="Password" autoFocus value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
               <button type="submit" className="w-full py-4 bg-blue-600 rounded-xl font-bold shadow-lg">Unlock Wallet</button>
             </form>
           </div>
        )}

        {view === 'home' && currentWallet && (
          <div className="p-4 space-y-6 animate-in fade-in">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
              <div className="relative z-10 flex flex-col gap-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-blue-100 text-xs font-bold uppercase opacity-70">{currentWallet.name}</h2>
                    <div className="flex items-center gap-2"><span className="text-[10px] font-mono">{currentWallet.address.slice(0, 12)}...</span>
                      <button onClick={() => { navigator.clipboard.writeText(currentWallet.address); setCopied(true); setStatus({type:'success', message:'Address Copied!'}); setTimeout(() => setCopied(false), 2000); }} className="p-1 hover:bg-white/10 rounded">{copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}</button>
                    </div>
                  </div>
                  <button onClick={() => { setLoginPassword(''); setView('view-mnemonic'); }} className="bg-white/20 p-2 rounded-xl backdrop-blur-md flex items-center gap-1"><Eye size={14} /><span className="text-[10px] font-bold">Phrase</span></button>
                </div>
                <div className="text-4xl font-black">{balance.toLocaleString(undefined, { maximumFractionDigits: 4 })} <span className="text-xl font-medium text-blue-200">SLE</span></div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 px-2">
              <button onClick={() => { setView('send'); setSelectedAsset('SLE'); }} className="flex flex-col items-center gap-2 group"><div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white active:scale-90 transition-all shadow-lg shadow-orange-900/20"><ArrowUpRight size={22}/></div><span className="text-[10px] font-bold text-slate-400">Send</span></button>
              <button onClick={() => setView('receive')} className="flex flex-col items-center gap-2 group"><div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white active:scale-90 transition-all shadow-lg shadow-emerald-900/20"><ArrowDownLeft size={22}/></div><span className="text-[10px] font-bold text-slate-400">Receive</span></button>
              <button onClick={() => setView('history')} className="flex flex-col items-center gap-2 group"><div className="w-12 h-12 bg-purple-500 rounded-2xl flex items-center justify-center text-white active:scale-90 transition-all shadow-lg shadow-purple-900/20"><HistoryIcon size={22}/></div><span className="text-[10px] font-bold text-slate-400">History</span></button>
              <button onClick={() => { setAddTokenAddress(''); setTokenSymbolInput(''); setView('add-token'); }} className="flex flex-col items-center gap-2 group"><div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-white active:scale-90 transition-all shadow-lg shadow-blue-900/20"><Plus size={22}/></div><span className="text-[10px] font-bold text-slate-400">Add</span></button>
            </div>

            <div className="space-y-2 px-1 pb-10">
              <h3 className="font-black text-slate-500 text-[10px] uppercase tracking-widest ml-1">My Assets</h3>
              <div className="bg-slate-800/40 p-4 rounded-2xl flex items-center justify-between cursor-pointer group hover:bg-slate-800/60 transition-colors" onClick={() => setView('receive')}>
                <div className="flex items-center gap-4"><div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold shadow-lg">S</div><div><div className="font-bold text-sm">SolaEver</div><div className="text-[10px] text-slate-500">Native Coin</div></div></div>
                <div className="text-right font-black text-sm">{balance.toFixed(2)} SLE</div>
              </div>
              {Object.entries(customTokens).map(([mint, info]) => (
                <div key={mint} onClick={() => { setSelectedToken({ ...info, mint, balance: tokenBalances[mint] || 0 }); setView('token-detail'); }} className="bg-slate-800/40 p-4 rounded-2xl flex items-center justify-between cursor-pointer group hover:bg-slate-800/60 transition-colors animate-in slide-in-from-left-2">
                  <div className="flex items-center gap-4"><div className="w-10 h-10 bg-slate-700/50 rounded-xl flex items-center justify-center font-bold text-blue-400 text-sm">{info.symbol[0]}</div><div><div className="font-bold text-sm">{info.name}</div><div className="text-[10px] text-slate-500">{info.symbol}</div></div></div>
                  <div className="text-right font-black text-sm">{(tokenBalances[mint] || 0).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SEND (Form Support) */}
        {view === 'send' && currentWallet && (
           <form onSubmit={(e)=>{e.preventDefault();handleSend();}} className="p-6 space-y-6 animate-in slide-in-from-right-4">
             <div className="flex items-center gap-2"><button type="button" onClick={() => setView('home')} className="p-2 hover:bg-slate-800 rounded-full text-slate-400"><X size={20} /></button><h2 className="text-xl font-bold">Send</h2></div>
             <div className="space-y-4">
                <select className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm font-bold outline-none" value={selectedAsset} onChange={(e) => setSelectedAsset(e.target.value)}>
                  <option value="SLE">Native Coin (SLE)</option>
                  {Object.entries(customTokens).map(([mint, info]) => <option key={mint} value={mint}>{info.name}</option>)}
                </select>
                <input type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Recipient Address" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                <div className="relative"><input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm outline-none" />
                  <div className="absolute right-4 top-4 text-xs font-black text-blue-400">{selectedAsset === 'SLE' ? 'SLE' : (customTokens[selectedAsset]?.symbol || 'TOKEN')}</div>
                </div>
             </div>
             <button type="submit" disabled={isSending} className="w-full py-4 bg-blue-600 rounded-2xl font-black shadow-xl active:scale-95 transition-all">{isSending ? 'Transmitting...' : 'Confirm Send'}</button>
           </form>
        )}

        {/* ADD TOKEN */}
        {view === 'add-token' && (
           <div className="p-6 space-y-6">
             <div className="flex items-center gap-2"><button onClick={() => setView('home')} className="p-2 hover:bg-slate-800 rounded-full"><X size={20} /></button><h2 className="text-xl font-bold">Add Asset</h2></div>
             <form onSubmit={(e)=>{e.preventDefault();handleCheckToken();}} className="space-y-4">
                <input type="text" autoFocus value={addTokenAddress} onChange={(e) => setAddTokenAddress(e.target.value)} placeholder="SPL Token Address" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm outline-none" />
                <button type="submit" disabled={isCheckingToken} className="w-full py-4 bg-slate-800 rounded-xl font-bold">{isCheckingToken ? <RefreshCw className="animate-spin" /> : 'Fetch Metadata'}</button>
             </form>
             {tokenSymbolInput && (
                <form onSubmit={(e)=>{e.preventDefault();handleSaveToken();}} className="space-y-4 p-4 bg-slate-950 rounded-3xl border border-slate-800 animate-in zoom-in-95">
                   <input type="text" value={tokenSymbolInput} onChange={(e)=>setTokenSymbolInput(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm" />
                   <input type="text" value={tokenNameInput} onChange={(e)=>setTokenNameInput(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm" />
                   <button type="submit" className="w-full py-4 bg-blue-600 rounded-xl font-black">Add Asset</button>
                </form>
             )}
           </div>
        )}

        {/* TOKEN DETAIL */}
        {view === 'token-detail' && selectedToken && (
           <div className="p-6 space-y-6 animate-in zoom-in-95">
             <div className="flex items-center justify-between">
                <button onClick={() => setView('home')} className="p-2 hover:bg-slate-800 rounded-full"><X size={20} /></button>
                <h2 className="text-xl font-bold">Asset</h2>
                <button onClick={() => { if(confirm('Delete this token?')) handleDeleteToken(selectedToken.mint); }} className="p-2 text-red-500 hover:bg-red-900/20 rounded-full"><Trash2 size={20} /></button>
             </div>
             <div className="flex flex-col items-center py-8 bg-slate-800/30 rounded-3xl border border-slate-700/50">
                <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center text-2xl font-black text-blue-500 mb-4">{selectedToken.symbol[0]}</div>
                <div className="text-4xl font-black mb-1">{selectedToken.balance.toLocaleString()}</div>
                <div className="text-slate-400 font-bold tracking-widest">{selectedToken.symbol}</div>
             </div>
             <div className="bg-slate-950/50 p-5 rounded-3xl space-y-4 border border-slate-800">
                <div><div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Name</div><div className="text-sm font-black">{selectedToken.name}</div></div>
                <div className="h-px bg-slate-800"></div>
                <div><div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Mint</div><div className="flex items-center justify-between gap-3"><div className="text-[10px] font-mono break-all text-blue-400 flex-1">{selectedToken.mint}</div><a href={`${EXPLORER_URL}/address/${selectedToken.mint}`} target="_blank" rel="noreferrer" className="p-2 bg-slate-800 rounded-xl hover:text-blue-400 transition-all"><ExternalLink size={14} /></a></div></div>
             </div>
             <button onClick={() => { setSelectedAsset(selectedToken.mint); setView('send'); }} className="w-full py-4 bg-blue-600 rounded-2xl font-black shadow-xl active:scale-95 transition-all">Send {selectedToken.symbol}</button>
           </div>
        )}

        {/* CREATE (Mnemonic) */}
        {view === 'create' && (
          <div className="p-8 space-y-8 animate-in slide-in-from-bottom-8">
            <h2 className="text-2xl font-black">Secure Phrase</h2>
            <div className="grid grid-cols-3 gap-2 bg-slate-950 p-4 rounded-2xl border border-slate-800">
               {mnemonic ? mnemonic.split(' ').map((word, i) => (<div key={i} className="bg-slate-900 p-2 rounded text-center text-[10px] font-mono text-slate-400 border border-slate-800"><span className="text-slate-700 mr-1">{i+1}.</span>{word}</div>)) : <div>Loading...</div>}
            </div>
            <button onClick={() => setView('create-password')} className="w-full py-4 bg-blue-600 rounded-2xl font-bold shadow-xl">I've Saved It Securely</button>
          </div>
        )}

        {/* CREATE PASSWORD */}
        {view === 'create-password' && (
           <form onSubmit={handleSaveNewWallet} className="p-8 space-y-6 animate-in fade-in">
             <h2 className="text-2xl font-black">Protection</h2>
             <div className="space-y-4">
                <input type="text" placeholder="Wallet Alias" autoFocus value={walletName} onChange={(e) => setWalletName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm" />
                <input type="password" placeholder="New Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm" />
                <input type="password" placeholder="Confirm Password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm" />
             </div>
             <button type="submit" className="w-full py-4 bg-blue-600 rounded-2xl font-bold shadow-xl">Complete Setup</button>
           </form>
        )}

        {/* VIEW MNEMONIC */}
        {view === 'view-mnemonic' && currentWallet && (
           <form onSubmit={(e)=>{e.preventDefault(); if(loginPassword === currentWallet.password) setStatus({type:'success', message:'Mnemonic decrypted.'}); else setStatus({type:'error', message:'Wrong Password.'})}} className="p-8 space-y-6 animate-in fade-in">
             <div className="flex items-center gap-2"><button type="button" onClick={() => { setView('home'); setStatus({ type: 'none', message: '' }); }} className="p-2 hover:bg-slate-800 rounded-full"><X size={20} /></button><h2 className="text-xl font-bold">Security</h2></div>
             {status.message === 'Mnemonic decrypted.' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-2 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    {currentWallet.mnemonic.split(' ').map((word, i) => (<div key={i} className="bg-slate-900 p-2 rounded text-center text-[10px] font-mono text-slate-400 border border-slate-800"><span className="text-slate-700 mr-1">{i+1}.</span>{word}</div>))}
                  </div>
                  <button type="button" onClick={() => { navigator.clipboard.writeText(currentWallet.mnemonic); setStatus({ type: 'success', message: 'Mnemonic Copied!' }); }} className="w-full py-4 bg-blue-600 rounded-2xl font-black flex justify-center items-center gap-3 active:scale-95 shadow-2xl transition-all"><Copy size={18} /> Copy Mnemonic</button>
                </div>
             ) : (
                <div className="space-y-4">
                  <input type="password" autoFocus value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Password" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  <button type="submit" className="w-full py-4 bg-blue-600 rounded-2xl font-bold">Verify</button>
                </div>
             )}
           </form>
        )}

        {/* RECEIVE */}
        {view === 'receive' && currentWallet && (
           <div className="p-8 flex flex-col items-center gap-8 animate-in zoom-in-95">
              <div className="flex w-full items-center gap-2 mb-2"><button onClick={() => setView('home')} className="p-2 hover:bg-slate-800 rounded-full"><X size={20} /></button><h2 className="text-xl font-bold">Receive</h2></div>
              <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl"><QRCodeSVG value={currentWallet.address} size={160} /></div>
              <div className="bg-slate-950/50 p-5 rounded-3xl border border-slate-800 break-all font-mono text-[10px] text-blue-200 text-center">{currentWallet.address}</div>
              <button onClick={() => { navigator.clipboard.writeText(currentWallet.address); setStatus({ type: 'success', message: 'Address Copied!' }); }} className="w-full py-4 bg-blue-600 rounded-2xl font-black flex justify-center items-center gap-3 active:scale-95 shadow-xl transition-all"><Copy size={20} /> Copy Address</button>
           </div>
        )}

        {/* HISTORY */}
        {view === 'history' && (
           <div className="p-4 space-y-4 animate-in slide-in-from-left-4">
              <div className="flex items-center gap-2 mb-4"><button onClick={() => setView('home')} className="p-2 hover:bg-slate-800 rounded-full"><X size={20} /></button><h2 className="text-xl font-bold">Activity</h2></div>
              {history.length === 0 ? <div className="py-20 text-center opacity-50 uppercase tracking-widest text-xs font-bold">No activity yet.</div> : history.map((tx, i) => (
                <div key={i} className="bg-slate-800/30 p-4 rounded-2xl flex items-center justify-between border border-transparent hover:border-slate-700 group transition-all">
                   <div><div className="font-bold text-xs">Tx: {tx.signature.slice(0, 15)}...</div><div className="text-[9px] text-slate-500">{new Date(tx.blockTime * 1000).toLocaleString()}</div></div>
                   <a href={`${EXPLORER_URL}/tx/${tx.signature}`} target="_blank" rel="noreferrer" className="p-2 text-slate-500 hover:text-white transition-colors"><ExternalLink size={14} /></a>
                </div>
              ))}
           </div>
        )}
      </div>

      {/* Navigation */}
      {['home', 'history', 'send', 'receive', 'add-token', 'token-detail', 'view-mnemonic'].includes(view) && (
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-slate-900/90 border-t border-slate-800 flex justify-around items-center px-4 z-30 backdrop-blur-xl">
          <button onClick={() => setView('home')} className={`p-4 rounded-2xl transition-all ${view === 'home' ? 'text-blue-500 bg-blue-500/10 shadow-inner' : 'text-slate-500 hover:text-slate-300'}`}><WalletIcon size={20} /></button>
          <button onClick={() => setView('history')} className={`p-4 rounded-2xl transition-all ${view === 'history' ? 'text-blue-500 bg-blue-500/10 shadow-inner' : 'text-slate-500 hover:text-slate-300'}`}><HistoryIcon size={20} /></button>
          <button onClick={handleLogout} className="text-slate-500 p-4 hover:text-red-400 transition-colors"><LogOut size={20} /></button>
        </div>
      )}
    </div>
  );
}
