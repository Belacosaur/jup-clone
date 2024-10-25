"use client";

import React, { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { QuoteResponse, SwapResponse } from '@jup-ag/api';
import { PublicKey, Transaction, VersionedTransaction, sendAndConfirmRawTransaction, Connection, TransactionMessage, VersionedMessage } from '@solana/web3.js';
import TokenSelect from './TokenSelect';
import SlippageInput from './SlippageInput';
import TipInput from './TipInput';

interface SwapResponseData {
  swapTransaction: string;
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

// Update the tip display to show in SOL
const formatTipDisplay = (lamports: number) => {
  return `${(lamports / 1e9).toFixed(6)} SOL`;
};

// Update the RPC endpoints to more reliable ones
const HELIUS_RPC = 'https://mainnet.helius-rpc.com/?api-key=3632daae-4968-4896-9d0d-43f382188194';

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

    // Get fresh blockhash with retry
    const { blockhash, lastValidBlockHeight } = await retryWithBackoff(() => 
      connection.getLatestBlockhash('confirmed')
    );

    // Wait for confirmation with retry
    const confirmation = await retryWithBackoff(() =>
      connection.confirmTransaction({
        signature: txid,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed')
    );

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    return txid;
  } catch (error) {
    console.error('Transaction error:', error);
    throw error;
  }
};

// Add these CSS classes at the top of your file
const styles = {
  container: "max-w-[440px] mx-auto mt-10 p-1 bg-gradient-to-br from-gray-900 to-black rounded-2xl shadow-2xl",
  innerContainer: "bg-gray-900 rounded-2xl p-4",
  title: "text-2xl font-bold mb-6 text-white flex items-center justify-between",
  swapCard: "bg-gray-800 rounded-xl p-4 mb-4 border border-gray-700",
  tokenSelect: "bg-gray-700 hover:bg-gray-600 transition-all duration-200 rounded-lg p-3 mb-2 cursor-pointer",
  input: "bg-transparent text-white text-lg font-medium focus:outline-none w-full",
  exchangeRate: "text-sm text-gray-400 ml-3 mt-2",
  settingsContainer: "bg-gray-800 rounded-xl p-4 mb-4 border border-gray-700",
  checkbox: "form-checkbox h-4 w-4 text-orange-500 rounded border-gray-600 bg-gray-700 focus:ring-orange-500",
  checkboxLabel: "text-sm font-medium text-gray-300 select-none",
  button: `w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 px-4 rounded-xl 
    font-semibold transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg 
    active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`,
  feeButton: `px-3 py-1.5 rounded-lg transition-all duration-200 text-sm font-medium`,
  feeButtonActive: "bg-orange-500 text-white shadow-lg",
  feeButtonInactive: "bg-gray-700 text-gray-300 hover:bg-gray-600",
  successText: "mt-2 text-green-400 text-center",
  errorText: "mt-2 text-red-400 text-center",
  toggleContainer: "flex items-center space-x-2 mb-4 bg-gray-800 p-1 rounded-lg",
  toggleButton: "px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
  toggleActive: "bg-gray-700 text-white shadow-sm",
  toggleInactive: "text-gray-400 hover:text-gray-300",
  settingsIcon: "p-2 rounded-lg hover:bg-gray-700 transition-all duration-200",
  popup: "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-4 w-72 z-50",
  popupOverlay: "fixed inset-0 bg-black bg-opacity-50 z-40",
  topBar: "flex items-center space-x-2 mb-4",
  settingsGroup: "flex items-center space-x-1 bg-gray-800 rounded-lg p-1",
  settingsButton: "flex items-center space-x-1 px-2 py-1 rounded-lg hover:bg-gray-700 transition-all duration-200 text-gray-300 hover:text-white text-sm",
};

const SwapInterface: React.FC = () => {
  const { publicKey, signTransaction, signMessage } = useWallet();
  const { connection } = useConnection();
  const [inputToken, setInputToken] = useState<string>(popularTokens[0].address);
  const [outputToken, setOutputToken] = useState<string>(popularTokens[1].address);
  const [inputAmount, setInputAmount] = useState<string>('');
  const [outputAmount, setOutputAmount] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(1);
  const [tip, setTip] = useState<number>(100000); // 0.0001 SOL in lamports
  const [jitoTip, setJitoTip] = useState<number>(0); // Auto Jito
  const [quotePrice, setQuotePrice] = useState<string>('');
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapStatus, setSwapStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [useDynamicSlippage, setUseDynamicSlippage] = useState<boolean>(true); // Dynamic slippage
  const [useDirectRoutes, setUseDirectRoutes] = useState<boolean>(false); // No direct routes
  const [showPriorityFee, setShowPriorityFee] = useState(false);
  const [showJitoTip, setShowJitoTip] = useState(false);
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);

  useEffect(() => {
    if (inputToken && outputToken && inputAmount && parseFloat(inputAmount) > 0) {
      fetchQuote();
    } else {
      setOutputAmount('');
      setQuotePrice('');
    }
  }, [inputToken, outputToken, inputAmount, slippage]);

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

  const getTokenSymbol = (address: string) => {
    return popularTokens.find(token => token.address === address)?.symbol || 'Unknown';
  };

  const getTokenDecimals = (address: string) => {
    return popularTokens.find(token => token.address === address)?.decimals || 9;
  };

  const handleSwap = async () => {
    if (!publicKey || !signTransaction || !connection) {
      setErrorMessage('Wallet not connected');
      return;
    }

    setIsSwapping(true);
    setSwapStatus('processing');
    setErrorMessage(null);

    try {
      // Get blockhash with retry
      const { blockhash } = await retryWithBackoff(() => 
        connection.getLatestBlockhash('confirmed')
      );
      
      const inputDecimals = getTokenDecimals(inputToken);
      const amount = Math.floor(parseFloat(inputAmount) * Math.pow(10, inputDecimals)).toString();
      
      // Get quote with retry
      const quoteData = await retryWithBackoff(async () => {
        const quoteUrl = new URL('https://quote-api.jup.ag/v6/quote');
        quoteUrl.searchParams.append('inputMint', inputToken);
        quoteUrl.searchParams.append('outputMint', outputToken);
        quoteUrl.searchParams.append('amount', amount);
        quoteUrl.searchParams.append('onlyDirectRoutes', useDirectRoutes.toString());
        if (!useDynamicSlippage) {
          quoteUrl.searchParams.append('slippageBps', (slippage * 100).toString());
        }

        const response = await fetch(quoteUrl.toString());
        if (!response.ok) throw new Error(`Quote API error: ${response.statusText}`);
        return await response.json();
      });

      // Get swap transaction with retry
      const swapData = await retryWithBackoff(async () => {
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

        if (!swapResponse.ok) throw new Error(`Swap API error: ${swapResponse.statusText}`);
        return await swapResponse.json();
      });
      
      let transaction = VersionedTransaction.deserialize(Buffer.from(swapData.swapTransaction, 'base64'));
      transaction.message.recentBlockhash = blockhash;
      
      const signedTransaction = await signTransaction(transaction);
      const txid = await sendTransactionWithRetry(connection, signedTransaction.serialize());
      
      setSwapStatus('success');
      console.log('Swap successful! Transaction ID:', txid);

    } catch (error) {
      console.error('Swap error:', error);
      setSwapStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
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

  return (
    <div className={styles.container}>
      <div className={styles.innerContainer}>
        <h2 className={styles.title}>
          <span>Swap Tokens</span>
          <span className="text-orange-500">🔥</span>
        </h2>
        
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
          <TokenSelect
            label="From"
            value={inputToken}
            onChange={setInputToken}
            amount={inputAmount}
            onAmountChange={setInputAmount}
            tokens={popularTokens}
            editable={true}
            customStyles={styles}
          />
          
          <div className="flex justify-center -my-2">
            <button className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-all">
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
            tokens={popularTokens}
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
          {isSwapping ? 'Swapping...' : 'Swap'}
        </button>

        {swapStatus === 'success' && (
          <div className={styles.successText}>Swap successful!</div>
        )}
        {swapStatus === 'error' && errorMessage && (
          <div className={styles.errorText}>{errorMessage}</div>
        )}
      </div>

      {showSlippageSettings && <SlippagePopup />}

      {showPriorityFee && (
        <>
          <div className={styles.popupOverlay} onClick={() => setShowPriorityFee(false)} />
          <div className={styles.popup}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-medium">Priority Fee</h3>
              <button
                onClick={() => setShowPriorityFee(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {defaultTipOptions.map((option) => (
                <button
                  key={option}
                  className={`${styles.feeButton} ${tip === option ? styles.feeButtonActive : styles.feeButtonInactive}`}
                  onClick={() => {
                    setTip(option);
                    setShowPriorityFee(false);
                  }}
                >
                  {formatTipDisplay(option)}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {showJitoTip && (
        <>
          <div className={styles.popupOverlay} onClick={() => setShowJitoTip(false)} />
          <div className={styles.popup}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-medium">Jito Tip (µ◎/CU)</h3>
              <button
                onClick={() => setShowJitoTip(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {defaultJitoOptions.map((option) => (
                <button
                  key={option}
                  className={`${styles.feeButton} ${jitoTip === option ? styles.feeButtonActive : styles.feeButtonInactive}`}
                  onClick={() => {
                    setJitoTip(option);
                    setShowJitoTip(false);
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SwapInterface;
