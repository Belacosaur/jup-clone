"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { QuoteResponse, SwapResponse } from '@jup-ag/api';
import { PublicKey, Transaction, VersionedTransaction, sendAndConfirmRawTransaction, Connection, TransactionMessage, VersionedMessage } from '@solana/web3.js';
import TokenSelect from './TokenSelect';
import SlippageInput from './SlippageInput';
import TipInput from './TipInput';
import Image from 'next/image';

interface SwapResponseData {
  swapTransaction: string;
}

// Add this interface at the top with other interfaces
interface TokenInfo {
  symbol: string;
  address: string;
  decimals: number;
  logoURI?: string;
  name?: string;
}

// Add these interfaces at the top
interface ConsoleMessage {
  id: number;
  text: string;
  type: 'info' | 'success' | 'error';
  isTyping: boolean;
  displayedText: string;
}

// Add this new interface near the top with other interfaces
interface TokenBalance {
  amount: number;
  decimals: number;
  formatted: string; // Add formatted balance
}

const popularTokens = [
  { symbol: 'SOL', address: 'So11111111111111111111111111111111111111112', decimals: 9 },
  { symbol: 'USDC', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  { symbol: 'BONK', address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5 },
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

// Update the styles object to remove scrollbars and add percentage buttons
const styles = {
  // Matrix styles
  matrixContainer: "fixed inset-0 bg-black overflow-hidden z-0",
  matrixCanvas: "opacity-20",

  // Layout styles
  mainContainer: "h-screen flex flex-col relative z-10 overflow-hidden",
  header: "w-full flex justify-between items-center px-6 py-4",
  headerTitle: "text-[#00ff00] font-mono text-3xl tracking-wider font-bold",
  container: "flex-1 flex items-center justify-center gap-8",
  swapWrapper: "w-full max-w-[420px] mx-4 p-1 bg-gradient-to-br from-gray-900/90 to-black/90 rounded-2xl shadow-2xl backdrop-blur-sm", // Reduced from 460px
  innerContainer: "bg-gray-900/60 rounded-2xl p-4 backdrop-blur-md border border-[#00ff00]/20",

  // Component styles
  swapCard: "bg-gray-800/60 rounded-xl p-4 mb-4 border border-gray-700",
  tokenSelect: "bg-gray-700 hover:bg-gray-600 transition-all duration-200 rounded-lg p-3 mb-2 cursor-pointer",
  input: "bg-transparent text-white text-lg font-medium focus:outline-none w-full no-scrollbar",
  exchangeRate: "text-sm text-gray-400 ml-3 mt-2",

  // Settings styles
  settingsContainer: "bg-gray-800 rounded-xl p-4 mb-4 border border-gray-700",
  settingsGroup: "flex items-center space-x-1 bg-gray-800 rounded-lg p-1",
  settingsButton: "flex items-center space-x-1 px-2 py-1 rounded-lg hover:bg-gray-700 transition-all duration-200 text-gray-300 hover:text-white text-sm",
  
  // Button styles
  button: `w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 px-4 rounded-xl 
    font-semibold transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg 
    active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`,
  feeButton: `px-3 py-1.5 rounded-lg transition-all duration-200 text-sm font-medium`,
  feeButtonActive: "bg-orange-500 text-white shadow-lg",
  feeButtonInactive: "bg-gray-700 text-gray-300 hover:bg-gray-600",
  walletButton: "!bg-transparent !border-[#00ff00] !text-[#00ff00] !font-mono hover:!bg-[#00ff00]/10",

  // Toggle styles
  toggleContainer: "flex items-center space-x-2 mb-4 bg-gray-800 p-1 rounded-lg",
  toggleButton: "px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
  toggleActive: "bg-gray-700 text-white shadow-sm",
  toggleInactive: "text-gray-400 hover:text-gray-300",

  // Popup styles
  popup: "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-4 w-72 z-50",
  popupOverlay: "fixed inset-0 bg-black bg-opacity-50 z-40",

  // Status styles
  successText: "mt-2 text-green-400 text-center",
  errorText: "mt-2 text-red-400 text-center",

  // Misc styles
  topBar: "flex items-center space-x-2 mb-4",
  checkbox: "form-checkbox h-4 w-4 text-orange-500 rounded border-gray-600 bg-gray-700 focus:ring-orange-500",
  checkboxLabel: "text-sm font-medium text-gray-300 select-none",
  settingsIcon: "p-2 rounded-lg hover:bg-gray-700 transition-all duration-200",

  // Social styles
  socialsContainer: "mt-6 flex justify-center space-x-4",
  socialLink: "opacity-70 hover:opacity-100 transition-opacity duration-200",

  // Status styles
  statusContainer: "mt-4 p-4 rounded-xl border",
  statusSuccess: "border-green-500/20 bg-green-500/10",
  statusError: "border-red-500/20 bg-red-500/10",
  statusLoading: "border-[#00ff00]/20 bg-[#00ff00]/10",
  statusText: "text-center flex items-center justify-center gap-2",
  spinner: "animate-spin h-5 w-5",

  // Console styles
  consoleContainer: "w-[420px] bg-black/80 border border-[#00ff00]/20 rounded-2xl p-4 font-mono text-sm h-[402px] overflow-hidden flex flex-col",
  consoleHeader: "text-[#00ff00] mb-4 pb-2 font-bold border-b border-[#00ff00]/20",
  consoleContent: "flex-1 overflow-y-auto space-y-1 scrollbar-thin scrollbar-track-black scrollbar-thumb-[#00ff00]/20",
  consoleMessage: "flex items-start space-x-2 break-all whitespace-pre-wrap",
  consoleText: "text-[#00ff00] font-mono break-words flex-1",
  consoleCursor: "text-[#00ff00] mr-2",
  consoleFooter: "mt-4 pt-2 border-t border-[#00ff00]/20 flex justify-center space-x-4",
  consoleSocialIcon: "text-[#00ff00]/70 hover:text-[#00ff00] transition-colors duration-200",

  // Add percentage button styles
  percentageContainer: "flex justify-end space-x-2 mb-2",
  percentageButton: "px-2 py-1 text-xs rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-all duration-200",
  percentageButtonActive: "bg-orange-500 text-white",
};

// Add this component at the top of the file, after the imports
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

    const rainDrops: number[] = [];

    for (let x = 0; x < columns; x++) {
      rainDrops[x] = 1;
    }

    const draw = () => {
      context.fillStyle = 'rgba(0, 0, 0, 0.1)'; // Slightly more transparent for better effect
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.fillStyle = '#00ff00'; // Brighter Matrix green
      context.font = fontSize + 'px "Courier New"'; // More computer-like font

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

const SwapInterface: React.FC = () => {
  const { publicKey, signTransaction, signMessage } = useWallet();
  // Replace the default connection with our custom RPC
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
        // Fetch token list from Jupiter
        const response = await fetch('https://token.jup.ag/strict');
        if (!response.ok) throw new Error('Failed to fetch tokens');
        
        const data = await response.json();
        
        // Sort by volume/activity (assuming the API returns this info)
        // Take top 50 tokens
        const topTokens = data.slice(0, 50).map((token: any) => ({
          symbol: token.symbol,
          address: token.address,
          decimals: token.decimals,
          logoURI: token.logoURI,
          name: token.name
        }));

        setAvailableTokens(topTokens);
      } catch (error) {
        console.error('Error fetching tokens:', error);
        // Fallback to default popularTokens if fetch fails
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

  // Add this useEffect to fetch token balance when input token or wallet changes
  useEffect(() => {
    const fetchBalance = async () => {
      if (!publicKey || !inputToken) return;
      
      try {
        const balance = await getTokenBalance(connection, publicKey, inputToken);
        setInputTokenBalance(balance);
      } catch (error) {
        console.error('Error fetching balance:', error);
      }
    };

    fetchBalance();
    
    // Set up an interval to refresh the balance
    const intervalId = setInterval(fetchBalance, 10000); // Refresh every 10 seconds
    
    return () => clearInterval(intervalId);
  }, [publicKey, inputToken, connection]);

  const fetchQuote = async () => {
    if (!inputToken || !outputToken || !inputAmount || parseFloat(inputAmount) <= 0) return;

    try {
      const inputDecimals = getTokenDecimals(inputToken);
      const outputDecimals = getTokenDecimals(outputToken);
      
      const amount = (parseFloat(inputAmount) * Math.pow(10, inputDecimals)).toString();
      
      // Only include slippageBps if not using dynamic slippage
      const slippageBps = useDynamicSlippage ? undefined : Math.floor(slippage * 100);
      
      const quoteUrl = new URL('https://quote-api.jup.ag/v6/quote');
      quoteUrl.searchParams.append('inputMint', inputToken);
      quoteUrl.searchParams.append('outputMint', outputToken);
      quoteUrl.searchParams.append('amount', amount);
      quoteUrl.searchParams.append('onlyDirectRoutes', useDirectRoutes.toString());
      if (!useDynamicSlippage) {
        quoteUrl.searchParams.append('slippageBps', slippageBps!.toString());
      }
      
      const response = await fetch(quoteUrl.toString());
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const quoteData: QuoteResponse = await response.json();
      
      const outAmountFloat = parseFloat(quoteData.outAmount) / Math.pow(10, outputDecimals);
      const formattedOutputAmount = outAmountFloat.toFixed(outputDecimals);
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
      
      // Only include slippageBps if not using dynamic slippage
      const slippageBps = useDynamicSlippage ? undefined : Math.floor(slippage * 100);
      
      const quoteUrl = new URL('https://quote-api.jup.ag/v6/quote');
      quoteUrl.searchParams.append('inputMint', inputToken);
      quoteUrl.searchParams.append('outputMint', outputToken);
      quoteUrl.searchParams.append('amount', amount);
      quoteUrl.searchParams.append('onlyDirectRoutes', useDirectRoutes.toString());
      if (!useDynamicSlippage) {
        quoteUrl.searchParams.append('slippageBps', slippageBps!.toString());
      }
      
      const response = await fetch(quoteUrl.toString());
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const quoteData: QuoteResponse = await response.json();

      // Get the swap transaction
      addConsoleMessage('Requesting wallet approval...', 'info');
      const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: quoteData,
          userPublicKey: publicKey.toString(),
          wrapUnwrapSOL: true,
          prioritizationFeeLamports: tip > 0 ? tip : "auto",
          computeUnitPriceMicroLamports: jitoTip > 0 ? jitoTip : undefined,
          dynamicComputeUnitLimit: true
        })
      });

      if (!swapResponse.ok) {
        throw new Error(`Swap API error: ${swapResponse.statusText}`);
      }

      const swapData: SwapResponseData = await swapResponse.json();
      const { blockhash } = await retryWithBackoff(() => 
        connection.getLatestBlockhash('confirmed')
      );

      let transaction = VersionedTransaction.deserialize(Buffer.from(swapData.swapTransaction, 'base64'));
      transaction.message.recentBlockhash = blockhash;
      
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
                {msg.isTyping && <span className="animate-pulse">█</span>}
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
                  editable={true}
                  customStyles={styles}
                />
                
                <div className="flex justify-center -my-2">
                  <button 
                    className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-all"
                    onClick={handleSwapPair}
                  >
                    <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
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
