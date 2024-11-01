"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { QuoteResponse, SwapResponse } from '@jup-ag/api';
import { PublicKey, Transaction, VersionedTransaction, sendAndConfirmRawTransaction, Connection, TransactionMessage, VersionedMessage } from '@solana/web3.js';
import TokenSelect from './TokenSelect';
import SlippageInput from './SlippageInput';
import TipInput from './TipInput';
import Image from 'next/image';
import debounce from 'lodash/debounce';
import { TokenInfo, TokenBalance, ConsoleMessage, SwapResponseData, QuickNodeMetisResponse } from '../types';

const popularTokens = [
  { symbol: 'SOL', address: 'So11111111111111111111111111111111111111112', decimals: 9 },
  { symbol: 'USDC', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  { symbol: 'BONK', address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5 },
  { symbol: 'DEGOD', address: 'BQedGfRa7xks1mScbzpUUBe2w8mRqNyFQ1SN4LcGBYE5', decimals: 9 },
  { symbol: 'RAY', address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', decimals: 6 },
  { symbol: 'SRM', address: 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt', decimals: 6 },
];

const defaultTipOptions = [0, 100000, 500000, 1000000]; // in lamports
const defaultJitoOptions = [0, 10, 200, 1000]; // in micro-lamports per compute unit

// Add this near the top of the file with other constants
const RPC_ENDPOINT = process.env.NEXT_PUBLIC_HELIUS_RPC || 'https://api.mainnet-beta.solana.com';

// Update the tip display to show in SOL
const formatTipDisplay = (lamports: number) => {
  return `${(lamports / 1e9).toFixed(6)} SOL`;
};

// Add retry logic for RPC calls
const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = 3, initialDelay = 1000) => {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      retries++;
      if (retries === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, initialDelay * Math.pow(2, retries - 1)));
    }
  }
};

// Add this helper function at the top with other utility functions
const getErrorMessage = (error: any): string => {
  if (typeof error === 'object' && error !== null) {
    // Check for insufficient funds error
    if (error.message?.includes('Custom:6001')) {
      return 'Insufficient SOL balance. Please ensure you have enough SOL to cover the swap and transaction fees.';
    }
    // Check for other common errors
    if (error.message?.includes('0x1')) {
      return 'Insufficient token balance for swap';
    }
    if (error.message?.includes('BlockhashNotFound')) {
      return 'Network congestion detected. Please try again.';
    }
    return error.message || 'An unknown error occurred';
  }
  return 'An unknown error occurred';
};

// Update the sendTransactionWithRetry function's error handling
const sendTransactionWithRetry = async (connection: Connection, rawTransaction: Uint8Array) => {
  try {
    const txid = await retryWithBackoff(async () => {
      return await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
        maxRetries: 3,
        preflightCommitment: 'confirmed'
      });
    });
    console.log('Transaction sent:', txid);

    const { blockhash, lastValidBlockHeight } = await retryWithBackoff(() => 
      connection.getLatestBlockhash('confirmed')
    );

    const confirmation = await retryWithBackoff(() =>
      connection.confirmTransaction({
        signature: txid,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed')
    );

    if (confirmation.value.err) {
      const error = JSON.stringify(confirmation.value.err);
      throw new Error(`Transaction failed: ${error}`);
    }

    return txid;
  } catch (error) {
    console.error('Transaction error:', error);
    // Rethrow with more specific error message
    throw new Error(getErrorMessage(error));
  }
};

// Add these helper functions
const getTokenBalance = async (connection: Connection, publicKey: PublicKey, tokenAddress: string): Promise<TokenBalance> => {
  try {
    // Handle SOL balance
    if (tokenAddress === 'So11111111111111111111111111111111111111112') {
      const balance = await connection.getBalance(publicKey);
      return {
        amount: balance,
        decimals: 9,
        formatted: (balance / 1e9).toFixed(9)
      };
    }

    // Handle SPL tokens
    const tokenMint = new PublicKey(tokenAddress);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
      mint: tokenMint
    });

    // If no token account exists, return zero balance
    if (tokenAccounts.value.length === 0) {
      const decimals = getTokenDecimals(tokenAddress);
      return {
        amount: 0,
        decimals,
        formatted: '0'
      };
    }

    // Get the token account with the highest balance
    const tokenAccount = tokenAccounts.value.reduce((prev, curr) => {
      const prevAmount = Number(prev.account.data.parsed.info.tokenAmount.amount);
      const currAmount = Number(curr.account.data.parsed.info.tokenAmount.amount);
      return prevAmount > currAmount ? prev : curr;
    });

    const { amount, decimals } = tokenAccount.account.data.parsed.info.tokenAmount;
    const numericAmount = Number(amount);
    const formatted = (numericAmount / Math.pow(10, decimals)).toFixed(decimals);

    return {
      amount: numericAmount,
      decimals,
      formatted
    };
  } catch (error) {
    console.error('Error fetching token balance:', error);
    const decimals = getTokenDecimals(tokenAddress);
    return {
      amount: 0,
      decimals,
      formatted: '0'
    };
  }
};

// Add this helper function near other utility functions
const getTokenDecimals = (address: string): number => {
  const token = popularTokens.find(token => token.address === address);
  if (!token) {
    console.warn(`Token decimals not found for address ${address}, defaulting to 9`);
    return 9; // Default to 9 decimals (SOL's decimal places) if token not found
  }
  return token.decimals;
};

// Add this helper function if it's not already present
const getTokenSymbol = (address: string): string => {
  const token = popularTokens.find(token => token.address === address);
  return token?.symbol || 'Unknown';
};

// Update the styles object
const styles = {
  // Matrix theme colors
  primary: "text-[#00ff00]",
  secondary: "text-[#003300]",
  accent: "text-[#00cc00]",
  
  // Layout styles
  mainContainer: "min-h-screen flex flex-col relative z-10 overflow-hidden bg-black/90",
  header: "w-full flex justify-between items-center px-6 py-4 border-b border-[#00ff00]/20",
  headerTitle: "text-[#00ff00] font-mono text-3xl tracking-wider font-bold",
  container: "flex-1 flex items-start justify-center gap-6 p-4 pt-[100px] min-h-screen",
  swapWrapper: `w-[420px] 
    bg-black/95 rounded-2xl 
    shadow-[0_0_20px_rgba(0,255,0,0.15)] 
    backdrop-blur-lg 
    border border-[#00ff00]/30
    flex flex-col`,
  
  innerContainer: `bg-[#0a0f0a] rounded-2xl p-4 
    backdrop-blur-md
    flex flex-col
    min-h-[500px]`,

  // Component styles
  swapCard: "space-y-2 relative",
  tokenSelect: `bg-black/80 rounded-xl p-4 
    border border-[#00ff00]/20 
    hover:border-[#00ff00]/40 
    transition-all duration-200`,
  input: "w-full bg-transparent text-[#00ff00] text-right text-2xl font-mono focus:outline-none placeholder-[#00ff00]/30",
  exchangeRate: "text-sm text-[#00ff00]/60 ml-3 mt-2 font-mono",

  // Settings styles
  settingsContainer: `bg-black/90 rounded-xl p-4 mb-4 
    border border-[#00ff00]/20`,
  settingsGroup: "flex items-center space-x-1 bg-black/50 rounded-lg p-1 border border-[#00ff00]/10",
  settingsButton: "flex items-center space-x-1 px-3 py-1.5 rounded-lg hover:bg-[#00ff00]/10 transition-all duration-200 text-[#00ff00]/80 hover:text-[#00ff00] text-sm font-mono",
  
  // Button styles
  button: `w-full bg-black text-[#00ff00] py-3 px-4 rounded-xl font-mono
    border border-[#00ff00]/50 transition-all duration-200 
    hover:shadow-[0_0_20px_rgba(0,255,0,0.2)] hover:border-[#00ff00]
    active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none`,
  
  // Popup styles
  popup: "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/95 rounded-xl border border-[#00ff00]/30 shadow-[0_0_30px_rgba(0,255,0,0.1)] p-6 w-[380px] backdrop-blur-xl z-[1001]",
  popupOverlay: "fixed inset-0 bg-black/80 backdrop-blur-sm z-[1000]",
  
  // Token list styles
  tokenListContainer: "bg-black/95 border border-[#00ff00]/30 rounded-xl shadow-[0_0_30px_rgba(0,255,0,0.1)]",
  tokenListHeader: "border-b border-[#00ff00]/20 p-4",
  tokenListSearch: "bg-black/50 text-[#00ff00] border border-[#00ff00]/30 rounded-lg px-4 py-3 w-full font-mono focus:outline-none focus:border-[#00ff00]/60 placeholder-[#00ff00]/30",
  tokenListItem: "px-4 py-3 hover:bg-[#00ff00]/5 transition-colors flex items-center justify-between",
  tokenListItemActive: "bg-[#00ff00]/10",
  
  // Percentage buttons
  percentageContainer: "flex justify-end space-x-2 mb-2",
  percentageButton: "px-3 py-1.5 text-xs rounded-md bg-black/50 hover:bg-[#00ff00]/10 text-[#00ff00]/70 hover:text-[#00ff00] transition-all duration-200 border border-[#00ff00]/20 font-mono",
  percentageButtonActive: "bg-[#00ff00]/20 text-[#00ff00] border-[#00ff00]/50",

  // Loading spinner
  spinner: "animate-spin h-5 w-5 text-[#00ff00]",

  // Matrix styles
  matrixContainer: "fixed inset-0 bg-black overflow-hidden z-0",
  matrixCanvas: "opacity-[0.15]", // Slightly increase matrix opacity

  // Fee button styles
  feeButton: "px-3 py-1.5 rounded-lg transition-all duration-200 text-sm font-mono",
  feeButtonActive: "bg-[#00ff00]/20 text-[#00ff00] border-[#00ff00]/50",
  feeButtonInactive: "bg-black/50 text-[#00ff00]/70 hover:text-[#00ff00] border border-[#00ff00]/20",

  // Toggle styles
  toggleButton: "px-3 py-1.5 rounded-lg text-sm font-mono transition-all duration-200",
  toggleActive: "bg-[#00ff00]/20 text-[#00ff00] border-[#00ff00]/50",
  toggleInactive: "bg-black/50 text-[#00ff00]/70 hover:text-[#00ff00] border border-[#00ff00]/20",

  // Console styles
  consoleContainer: `w-[420px] min-h-[500px] 
    bg-black/95 
    border border-[#00ff00]/30 
    rounded-2xl p-4 
    font-mono text-sm 
    flex flex-col
    shadow-[0_0_20px_rgba(0,255,0,0.15)]`,
  consoleHeader: "text-[#00ff00] mb-4 pb-2 font-bold border-b border-[#00ff00]/20",
  consoleContent: `flex-1 overflow-y-auto space-y-1 
    scrollbar-thin scrollbar-track-black scrollbar-thumb-[#00ff00]/20
    max-h-[calc(100vh-200px)]`,
  consoleMessage: "flex items-start space-x-2 break-all whitespace-pre-wrap",
  consoleText: "text-[#00ff00] font-mono break-words flex-1",
  consoleCursor: "text-[#00ff00] mr-2",
  consoleFooter: "mt-4 pt-2 border-t border-[#00ff00]/20 flex justify-center space-x-4",
  consoleSocialIcon: "text-[#00ff00]/70 hover:text-[#00ff00] transition-colors duration-200",

  // Top bar styles
  topBar: "flex justify-between items-center mb-4",
  
  // Wallet button style
  walletButton: "!bg-transparent !border !border-[#00ff00]/50 !text-[#00ff00] !font-mono hover:!bg-[#00ff00]/10 hover:!border-[#00ff00]",
};

// Update the MatrixBackground component
const MatrixBackground: React.FC = () => {
  useEffect(() => {
    const canvas = document.getElementById('matrixCanvas') as HTMLCanvasElement;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const katakana = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソホモヨョロヲゴゾドボポッン';
    const latin = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const nums = '0123456789';
    const alphabet = katakana + latin + nums;

    const fontSize = 16;
    const columns = canvas.width / fontSize;
    const rainDrops = Array(Math.floor(columns)).fill(1);

    const draw = () => {
      context.fillStyle = 'rgba(0, 0, 0, 0.05)'; // More transparent fade
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.fillStyle = 'rgba(0, 255, 0, 0.35)'; // Brighter characters
      context.font = `${fontSize}px monospace`;

      for (let i = 0; i < rainDrops.length; i++) {
        const text = alphabet.charAt(Math.floor(Math.random() * alphabet.length));
        context.fillText(text, i * fontSize, rainDrops[i] * fontSize);

        if (rainDrops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          rainDrops[i] = 0;
        }
        rainDrops[i]++;
      }
    };

    const interval = setInterval(draw, 30);
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className={styles.matrixContainer}>
      <canvas id="matrixCanvas" className={styles.matrixCanvas} />
    </div>
  );
};

// Move these interfaces and constants outside the component
interface TokenPrice {
  id: string;
  mintSymbol: string;
  vsToken: string;
  vsTokenSymbol: string;
  price: number;
}

const CACHE_DURATION = 30000; // 30 seconds
const DEBOUNCE_DELAY = 1000; // 1 second

const SwapInterface: React.FC = () => {
  // Move all useState declarations inside the component
  const [tokenPrices, setTokenPrices] = useState<{ [key: string]: number }>({});
  const [walletTokens, setWalletTokens] = useState<{ [key: string]: TokenBalance }>({});
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);
  const [tokenBalances, setTokenBalances] = useState<{ [key: string]: TokenBalance }>({});
  const { publicKey, signTransaction, signMessage } = useWallet();
  const connection = new Connection(RPC_ENDPOINT, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000
  });
  const [inputToken, setInputToken] = useState<string>(popularTokens[0].address);
  const [outputToken, setOutputToken] = useState<string>(popularTokens[1].address);
  const [inputAmount, setInputAmount] = useState<string>('');
  const [outputAmount, setOutputAmount] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(1);
  const [tip, setTip] = useState<number>(100000); // 0.0001 SOL in lamports
  const [jitoTip, setJitoTip] = useState<number>(0); // Auto Jito
  const [quotePrice, setQuotePrice] = useState<string>('');
  const [isSwapping, setIsSwapping] = useState(false);
  const [useDynamicSlippage, setUseDynamicSlippage] = useState<boolean>(true); // Dynamic slippage
  const [useDirectRoutes, setUseDirectRoutes] = useState<boolean>(false); // No direct routes
  const [showPriorityFee, setShowPriorityFee] = useState(false);
  const [showJitoTip, setShowJitoTip] = useState(false);
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  const [availableTokens, setAvailableTokens] = useState<TokenInfo[]>(popularTokens);
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
  // Add this ref near other state declarations
  const initialMessageRef = useRef(false);
  const [inputTokenBalance, setInputTokenBalance] = useState<TokenBalance>({ amount: 0, decimals: 9, formatted: '0' });

  // Create a balanceCache ref instead of a global variable
  const balanceCache = useRef(new Map<string, {
    balance: TokenBalance;
    timestamp: number;
  }>());

  // Move the fetchTokenPrices function inside the component
  const fetchTokenPrices = async () => {
    try {
      const response = await fetch('https://price.jup.ag/v4/price');
      if (!response.ok) throw new Error('Failed to fetch prices');
      
      const data = await response.json();
      const prices: { [key: string]: number } = {};
      
      Object.entries(data.data).forEach(([address, priceData]: [string, any]) => {
        if (priceData.price) {
          prices[address] = priceData.price;
        }
      });

      setTokenPrices(prices);
      
      localStorage.setItem('tokenPrices', JSON.stringify(prices));
      localStorage.setItem('pricesTimestamp', Date.now().toString());
    } catch (error) {
      console.error('Error fetching prices:', error);
    }
  };

  useEffect(() => {
    if (inputToken && outputToken && inputAmount && parseFloat(inputAmount) > 0) {
      fetchQuote();
    } else {
      setOutputAmount('');
      setQuotePrice('');
    }
  }, [inputToken, outputToken, inputAmount, slippage]);

  // Add this useEffect to fetch tokens when component mounts
  useEffect(() => {
    const fetchTopTokens = async () => {
      try {
        // First check localStorage cache
        const cachedTokens = localStorage.getItem('tokenList');
        const cacheTimestamp = localStorage.getItem('tokenListTimestamp');
        const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

        if (cachedTokens && cacheTimestamp) {
          const isExpired = Date.now() - Number(cacheTimestamp) > CACHE_DURATION;
          if (!isExpired) {
            setAvailableTokens(JSON.parse(cachedTokens));
            return;
          }
        }

        // Fetch token list from Jupiter
        const response = await fetch('https://token.jup.ag/strict');
        if (!response.ok) throw new Error('Failed to fetch tokens');
        
        const data = await response.json();
        
        // Map tokens and include decimals
        const topTokens = data
          .slice(0, 50)
          .map((token: any) => ({
            symbol: token.symbol,
            address: token.address,
            decimals: token.decimals || 9, // Use provided decimals or default to 9
            logoURI: token.logoURI,
            name: token.name
          }));

        // Cache the tokens
        localStorage.setItem('tokenList', JSON.stringify(topTokens));
        localStorage.setItem('tokenListTimestamp', Date.now().toString());

        setAvailableTokens(topTokens);
      } catch (error) {
        console.error('Error fetching tokens:', error);
        setAvailableTokens(popularTokens);
      }
    };

    fetchTopTokens();
  }, []);

  // Add this useEffect near the top of the SwapInterface component
  useEffect(() => {
    // Add initial message when component mounts
    if (!initialMessageRef.current) {
      addConsoleMessage('Follow the bald head...', 'info');
      initialMessageRef.current = true;
    }
  }, []); // Empty dependency array means this runs once on mount

  // Add this function to handle token pair swapping
  const handleSwapPair = () => {
    setInputToken(outputToken);
    setOutputToken(inputToken);
    setInputAmount('');
    setOutputAmount('');
    setQuotePrice('');
  };

  // Add this function to handle percentage clicks
  const handlePercentageClick = async (percentage: number) => {
    if (!publicKey || !inputToken) return;
    
    try {
      // Fetch latest balance
      const balance = await getTokenBalance(connection, publicKey, inputToken);
      
      // Calculate the amount based on the percentage
      const amount = (Number(balance.formatted) * percentage).toFixed(balance.decimals);
      
      // Update the input amount
      setInputAmount(amount);
      
      // Update the stored balance
      setInputTokenBalance(balance);
    } catch (error) {
      console.error('Error calculating percentage:', error);
    }
  };

  // Create a memoized debounced fetch function
  const debouncedFetchBalance = useCallback(
    debounce(async (connection: Connection, publicKey: PublicKey, tokenAddress: string) => {
      const cacheKey = `${publicKey.toString()}-${tokenAddress}`;
      const cached = balanceCache.current.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setInputTokenBalance(cached.balance);
        return;
      }

      try {
        const balance = await getTokenBalance(connection, publicKey, tokenAddress);
        setInputTokenBalance(balance);
        
        // Update cache
        balanceCache.current.set(cacheKey, {
          balance,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('Error fetching balance:', error);
      }
    }, DEBOUNCE_DELAY),
    [] // Empty dependencies since we want this to be stable
  );

  // Update the balance fetching useEffect
  useEffect(() => {
    if (!publicKey || !inputToken || !connection) return;
    
    const fetchBalance = async () => {
      await debouncedFetchBalance(connection, publicKey, inputToken);
    };

    fetchBalance();
    
    // Clear the debounce on cleanup
    return () => {
      debouncedFetchBalance.cancel();
    };
  }, [publicKey, inputToken, connection, debouncedFetchBalance]);

  // Remove the interval-based balance checking
  // The balance will update when the user changes tokens or when the wallet changes

  const QUICKNODE_RPC = process.env.NEXT_PUBLIC_QUICKNODE_RPC || 'YOUR_QUICKNODE_RPC_URL';

  const fetchQuote = async () => {
    if (!inputToken || !outputToken || !inputAmount || parseFloat(inputAmount) <= 0) return;

    try {
      const inputDecimals = getTokenDecimals(inputToken);
      const amount = (parseFloat(inputAmount) * Math.pow(10, inputDecimals)).toString();
      
      const response = await fetch(process.env.NEXT_PUBLIC_QUICKNODE_RPC, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'metis',
          method: 'metis_swapQuote',
          params: {
            inputMint: inputToken,
            outputMint: outputToken,
            amount: amount,
            slippageBps: Math.floor(slippage * 100),
            onlyDirectRoutes: useDirectRoutes
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const quoteData = data.result;

      const outAmountFloat = parseFloat(quoteData.outAmount) / Math.pow(10, getTokenDecimals(outputToken));
      const formattedOutputAmount = outAmountFloat.toFixed(getTokenDecimals(outputToken));
      setOutputAmount(formattedOutputAmount);

      const inAmountFloat = parseFloat(quoteData.inAmount) / Math.pow(10, inputDecimals);
      const exchangeRate = outAmountFloat / inAmountFloat;

      const inputSymbol = getTokenSymbol(inputToken);
      const outputSymbol = getTokenSymbol(outputToken);

      setQuotePrice(`1 ${inputSymbol} = ${exchangeRate.toFixed(6)} ${outputSymbol}`);
    } catch (error) {
      console.error('Error fetching quote:', error);
      setOutputAmount('');
      setQuotePrice('');
    }
  };

  const handleSwap = async () => {
    if (!publicKey || !signTransaction) {
      addConsoleMessage('Wallet not connected', 'error');
      return;
    }

    setIsSwapping(true);

    try {
      addConsoleMessage('Building transaction...', 'info');
      const inputDecimals = getTokenDecimals(inputToken);
      const amount = Math.floor(parseFloat(inputAmount) * Math.pow(10, inputDecimals)).toString();

      const response = await fetch(process.env.NEXT_PUBLIC_QUICKNODE_RPC, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'metis',
          method: 'metis_swapTransaction',
          params: {
            userPublicKey: publicKey.toString(),
            inputMint: inputToken,
            outputMint: outputToken,
            amount: amount,
            slippageBps: Math.floor(slippage * 100),
            onlyDirectRoutes: useDirectRoutes,
            computeUnitPriceMicroLamports: jitoTip > 0 ? jitoTip : undefined,
            prioritizationFeeLamports: tip > 0 ? tip : undefined
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Swap API error: ${response.statusText}`);
      }

      const data = await response.json();
      const swapData = data.result;

      addConsoleMessage('Requesting wallet approval...', 'info');
      
      let transaction = VersionedTransaction.deserialize(Buffer.from(swapData.transaction, 'base64'));
      const signedTransaction = await signTransaction(transaction);

      addConsoleMessage('Sending transaction...', 'info');
      const txid = await sendTransactionWithRetry(connection, signedTransaction.serialize());
      localStorage.setItem('lastTxId', txid);

      addConsoleMessage(`Transaction successful! View on Solscan: https://solscan.io/tx/${txid}`, 'success');

    } catch (error) {
      addConsoleMessage(`Error: ${getErrorMessage(error)}`, 'error');
    } finally {
      setIsSwapping(false);
    }
  };

  const SlippagePopup = () => (
    <>
      <div className={styles.popupOverlay} onClick={() => setShowSlippageSettings(false)} />
      <div className={styles.popup}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-medium">Slippage Settings</h3>
          <button
            onClick={() => setShowSlippageSettings(false)}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4">
          <div className="flex space-x-2">
            <button
              className={`${styles.feeButton} ${useDynamicSlippage ? styles.feeButtonActive : styles.feeButtonInactive}`}
              onClick={() => setUseDynamicSlippage(true)}
            >
              Dynamic
            </button>
            <button
              className={`${styles.feeButton} ${!useDynamicSlippage ? styles.feeButtonActive : styles.feeButtonInactive}`}
              onClick={() => setUseDynamicSlippage(false)}
            >
              Fixed
            </button>
          </div>
          {!useDynamicSlippage && (
            <div className="mt-4">
              <SlippageInput value={slippage} onChange={setSlippage} customStyles={styles} />
            </div>
          )}
          <button
            className={`${styles.button} mt-4`}
            onClick={() => setShowSlippageSettings(false)}
          >
            Save Settings
          </button>
        </div>
      </div>
    </>
  );

  const SettingsButton: React.FC<{ onClick: () => void, icon: string, label: string }> = ({ onClick, icon, label }) => (
    <button
      className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-700 transition-all duration-200 text-gray-300 hover:text-white"
      onClick={onClick}
    >
      <span>{icon}</span>
      <span className="text-sm">{label}</span>
    </button>
  );

  const LoadingSpinner = () => (
    <svg className={styles.spinner} viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );

  const HackerConsole: React.FC<{ messages: ConsoleMessage[] }> = ({ messages }) => {
    const consoleRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (consoleRef.current) {
        consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
      }
    }, [messages]);

    const getMessageColor = (type: string) => {
      switch (type) {
        case 'success':
          return 'text-green-400';
        case 'error':
          return 'text-red-400';
        default:
          return 'text-[#00ff00]';
      }
    };

    return (
      <div className={styles.consoleContainer}>
        <div className={styles.consoleHeader}>
          {'>'} TRANSACTION LOG <span className="animate-pulse">█</span>
        </div>
        <div className={styles.consoleContent} ref={consoleRef}>
          {messages.map((msg) => (
            <div key={msg.id} className={styles.consoleMessage}>
              <span className={styles.consoleCursor}>{'>'}</span>
              <span className={`${styles.consoleText} ${getMessageColor(msg.type)}`}>
                {msg.displayedText}
                {msg.isTyping && <span className="animate-pulse"></span>}
              </span>
            </div>
          ))}
        </div>
        <div className={styles.consoleFooter}>
          <a 
            href="https://x.com/belacosaursol" 
            target="_blank" 
            rel="noopener noreferrer" 
            className={styles.consoleSocialIcon}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
          <a 
            href="https://github.com/belacosaur" 
            target="_blank" 
            rel="noopener noreferrer" 
            className={styles.consoleSocialIcon}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.463 2 11.97c0 4.404 2.865 8.14 6.839 9.458.5.092.682-.216.682-.48 0-.236-.008-.864-.013-1.695-2.782.602-3.369-1.337-3.369-1.337-.454-1.151-1.11-1.458-1.11-1.458-.908-.618.069-.606.069-.606 1.003.07 1.531 1.027 1.531 1.027.892 1.524 2.341 1.084 2.91.828.092-.643.35-1.083.636-1.332-2.22-.251-4.555-1.107-4.555-4.927 0-1.088.39-1.979 1.029-2.675-.103-.252-.446-1.266.098-2.638 0 0 .84-.268 2.75 1.022A9.607 9.607 0 0112 6.82c.85.004 1.705.114 2.504.336 1.909-1.29 2.747-1.022 2.747-1.022.546 1.372.202 2.386.1 2.638.64.696 1.028 1.587 1.028 2.675 0 3.83-2.339 4.673-4.566 4.92.359.307.678.915.678 1.846 0 1.332-.012 2.407-.012 2.734 0 .267.18.577.688.48C19.137 20.107 22 16.373 22 11.969 22 6.463 17.522 2 12 2z"/>
            </svg>
          </a>
        </div>
      </div>
    );
  };

  const addConsoleMessage = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
    const newMessage = {
      id: Date.now(),
      text,
      type,
      isTyping: true,
      displayedText: ''
    };
    
    setConsoleMessages(prev => [...prev, newMessage]);

    // Animate the text typing
    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      setConsoleMessages(prev => prev.map(msg => {
        if (msg.id === newMessage.id) {
          currentIndex++;
          const newDisplayedText = text.slice(0, currentIndex);
          const isComplete = currentIndex > text.length;
          
          if (isComplete) {
            clearInterval(typingInterval);
          }

          return {
            ...msg,
            displayedText: newDisplayedText,
            isTyping: !isComplete
          };
        }
        return msg;
      }));

      if (currentIndex > text.length) {
        clearInterval(typingInterval);
      }
    }, 30); // Adjust typing speed here (lower number = faster)
  };

  // Update your balance fetching logic to fetch all token balances
  const fetchAllBalances = async () => {
    if (!publicKey || !connection) return;
    
    // Only fetch balances for displayed tokens (input and output)
    const tokensToFetch = [inputToken, outputToken];
    const balances: { [key: string]: TokenBalance } = {};
    
    for (const tokenAddress of tokensToFetch) {
      try {
        const balance = await getTokenBalance(connection, publicKey, tokenAddress);
        balances[tokenAddress] = balance;
      } catch (error) {
        console.error(`Error fetching balance for ${tokenAddress}:`, error);
      }
    }
    
    setTokenBalances(balances);
  };

  // Add this useEffect to fetch balances when wallet connects
  useEffect(() => {
    if (publicKey) {
      fetchAllBalances();
    }
  }, [publicKey, inputToken, outputToken]); // Only refetch when these change

  // Update the fetchWalletTokens function
  const fetchWalletTokens = async () => {
    if (!publicKey || !connection) return;
    
    setIsLoadingWallet(true);
    const balances: { [key: string]: TokenBalance } = {};
    
    try {
      // Fetch prices first
      await fetchTokenPrices();

      // First get SOL balance
      const solBalance = await connection.getBalance(publicKey);
      balances[popularTokens[0].address] = {
        amount: solBalance,
        decimals: 9,
        formatted: (solBalance / 1e9).toFixed(9),
        usdValue: (solBalance / 1e9) * (tokenPrices[popularTokens[0].address] || 0)
      };

      // Get all token accounts
      const tokenAccounts = await connection.getParsedProgramAccounts(
        new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        {
          filters: [
            { dataSize: 165 },
            {
              memcmp: {
                offset: 32,
                bytes: publicKey.toBase58(),
              },
            },
          ],
        }
      );

      // Process token accounts
      for (const account of tokenAccounts) {
        const parsedAccountData: any = account.account.data;
        const tokenBalance = parsedAccountData.parsed?.info?.tokenAmount;
        const mintAddress = parsedAccountData.parsed?.info?.mint;

        if (tokenBalance && mintAddress) {
          const amount = Number(tokenBalance.amount);
          const decimals = tokenBalance.decimals;

          if (amount > 0) {
            const formatted = (amount / Math.pow(10, decimals)).toFixed(decimals);
            const price = tokenPrices[mintAddress] || 0;
            
            balances[mintAddress] = {
              amount,
              decimals,
              formatted,
              usdValue: Number(formatted) * price
            };
          }
        }
      }

      setWalletTokens(balances);
      setTokenBalances(balances);
      
    } catch (error) {
      console.error('Error fetching wallet tokens:', error);
      addConsoleMessage('Error loading wallet tokens', 'error');
    } finally {
      setIsLoadingWallet(false);
    }
  };

  // Update the wallet connection useEffect to clear cache when connecting
  useEffect(() => {
    if (publicKey) {
      // Clear cache when wallet changes
      localStorage.removeItem('walletTokens');
      localStorage.removeItem('walletTokensTimestamp');
      fetchWalletTokens();
    } else {
      setWalletTokens({});
      setTokenBalances({});
    }
  }, [publicKey]); // Only depend on publicKey changes

  return (
    <>
      <MatrixBackground />
      <div className={styles.mainContainer}>
        <header className={styles.header}>
          <h1 className={styles.headerTitle}>BelacSwap</h1>
          <WalletMultiButton className={styles.walletButton} />
        </header>
        
        <div className={styles.container}>
          <div className={styles.swapWrapper}>
            <div className={styles.innerContainer}>
              {/* Top Settings Bar */}
              <div className={styles.topBar}>
                <div className={styles.settingsGroup}>
                  <button
                    className={styles.settingsButton}
                    onClick={() => setShowSlippageSettings(true)}
                  >
                    ⚙️ {useDynamicSlippage ? 'Dynamic' : `${slippage}%`}
                  </button>
                  <button
                    className={styles.settingsButton}
                    onClick={() => setShowPriorityFee(true)}
                  >
                    💰 {tip > 0 ? formatTipDisplay(tip) : 'Auto'}
                  </button>
                  <button
                    className={styles.settingsButton}
                    onClick={() => setShowJitoTip(true)}
                  >
                    ⚡ {jitoTip > 0 ? `${jitoTip}µ◎` : 'Auto'}
                  </button>
                </div>

                <div className="flex-1" /> {/* Spacer */}

                <div className={styles.settingsGroup}>
                  <button
                    className={`${styles.toggleButton} ${useDirectRoutes ? styles.toggleActive : styles.toggleInactive}`}
                    onClick={() => setUseDirectRoutes(!useDirectRoutes)}
                  >
                    Direct Routes
                  </button>
                </div>
              </div>
              
              <div className={styles.swapCard}>
                {publicKey && (
                  <div className={styles.percentageContainer}>
                    {[0.25, 0.5, 0.75, 1].map((percentage) => (
                      <button
                        key={percentage}
                        className={`${styles.percentageButton} ${
                          inputAmount === (Number(inputTokenBalance.formatted) * percentage).toFixed(inputTokenBalance.decimals)
                            ? styles.percentageButtonActive
                            : ''
                        }`}
                        onClick={() => handlePercentageClick(percentage)}
                      >
                        {percentage * 100}%
                      </button>
                    ))}
                  </div>
                )}

                <TokenSelect
                  label="From"
                  value={inputToken}
                  onChange={setInputToken}
                  amount={inputAmount}
                  onAmountChange={setInputAmount}
                  tokens={availableTokens}
                  balances={tokenBalances}
                  editable={true}
                  customStyles={styles}
                />
                
                <div className="flex justify-center -my-2 relative z-10">
                  <button 
                    onClick={handleSwapPair}
                    className="p-2 rounded-full bg-black border border-[#00ff00]/20 
                      hover:border-[#00ff00]/40 hover:bg-[#00ff00]/5 
                      transition-all duration-200 group"
                  >
                    <svg 
                      className="w-5 h-5 text-[#00ff00] transform transition-transform duration-200 group-hover:scale-110" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                      />
                    </svg>
                  </button>
                </div>

                <TokenSelect
                  label="To (Estimated)"
                  value={outputToken}
                  onChange={setOutputToken}
                  amount={outputAmount}
                  onAmountChange={() => {}}
                  tokens={availableTokens}
                  balances={walletTokens}  // Use walletTokens instead of tokenBalances
                  editable={false}
                  customStyles={styles}
                />
                
                {quotePrice && (
                  <div className={styles.exchangeRate}>
                    {quotePrice}
                  </div>
                )}
              </div>

              <button
                className={styles.button}
                onClick={handleSwap}
                disabled={isSwapping}
              >
                {isSwapping ? (
                  <div className="flex items-center justify-center gap-2">
                    <LoadingSpinner />
                    Swapping...
                  </div>
                ) : (
                  'Swap'
                )}
              </button>
            </div>
          </div>

          {/* Console on the right */}
          <HackerConsole messages={consoleMessages} />
        </div>
      </div>
    </>
  );
};

export default SwapInterface;
