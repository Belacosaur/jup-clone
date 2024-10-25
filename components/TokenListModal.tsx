import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { TokenInfo, TokenBalance } from '../types';
import TokenIcon from './TokenIcon';

interface TokenListModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokens: TokenInfo[];
  selectedToken: string;
  onSelect: (address: string) => void;
  balances: { [key: string]: TokenBalance };
  isLoading?: boolean;
}

const TokenListModal: React.FC<TokenListModalProps> = ({
  isOpen,
  onClose,
  tokens,
  selectedToken,
  onSelect,
  balances,
  isLoading = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleTokens, setVisibleTokens] = useState<TokenInfo[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);

  // Load tokens in chunks to prevent too many RPC calls
  useEffect(() => {
    if (!isOpen) return;

    const filteredTokens = tokens.filter(token => 
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.address.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Only show first 10 tokens initially
    setVisibleTokens(filteredTokens.slice(0, 10));
  }, [searchQuery, tokens, isOpen]);

  // Sort tokens: First by balance (if exists), then alphabetically
  const sortedTokens = [...visibleTokens].sort((a, b) => {
    const balanceA = balances[a.address]?.amount || 0;
    const balanceB = balances[b.address]?.amount || 0;
    
    if (balanceA === balanceB) {
      return a.symbol.localeCompare(b.symbol);
    }
    return balanceB - balanceA;
  });

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[1000]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
        bg-black/95 rounded-2xl w-[400px] max-h-[85vh] overflow-hidden 
        border border-[#00ff00]/30 shadow-[0_0_30px_rgba(0,255,0,0.1)] z-[1001]">
        
        <div className="p-4 border-b border-[#00ff00]/20">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-mono text-[#00ff00]">Select Token</h3>
            <button onClick={onClose} className="text-[#00ff00]/60 hover:text-[#00ff00]">
              ✕
            </button>
          </div>
          <input
            type="text"
            placeholder="Search tokens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/50 text-[#00ff00] border border-[#00ff00]/30 
              rounded-lg px-4 py-3 font-mono focus:outline-none focus:border-[#00ff00]/60
              placeholder-[#00ff00]/30"
          />
        </div>

        <div className="overflow-y-auto max-h-[60vh] scrollbar-thin scrollbar-track-black scrollbar-thumb-[#00ff00]/20">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-[#00ff00]/60">
              <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
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
              Loading wallet tokens...
            </div>
          ) : (
            sortedTokens.map((token) => {
              const balance = balances[token.address];
              const hasBalance = balance && Number(balance.formatted) > 0;
              const usdValue = balance?.usdValue || 0;
              
              return (
                <button
                  key={token.address}
                  onClick={() => {
                    onSelect(token.address);
                    onClose();
                  }}
                  className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800 transition-colors
                    ${selectedToken === token.address ? 'bg-gray-800' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <TokenIcon 
                      symbol={token.symbol} 
                      logoURI={token.logoURI}
                      size={32}
                    />
                    <div className="text-left">
                      <div className="font-medium text-white">{token.symbol}</div>
                      <div className="text-sm text-gray-400">{token.name}</div>
                    </div>
                  </div>
                  {hasBalance && (
                    <div className="text-right text-sm">
                      <div className="text-white">{balance.formatted}</div>
                      <div className="text-gray-400">
                        ${usdValue.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </div>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};

export default TokenListModal;
