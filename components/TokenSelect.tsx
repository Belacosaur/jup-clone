import React, { useState } from 'react';
import TokenListModal from './TokenListModal';
import TokenIcon from './TokenIcon';
import { TokenInfo, TokenBalance } from '../types';

// Define interfaces directly since types.ts doesn't exist yet
interface TokenSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  tokens: TokenInfo[];
  balances: { [key: string]: TokenBalance };
  editable: boolean;
  customStyles: any; // You might want to type this properly
}

const TokenSelect: React.FC<TokenSelectProps> = ({
  label,
  value,
  onChange,
  amount,
  onAmountChange,
  tokens,
  balances,
  editable,
  customStyles
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const selectedTokenInfo = tokens.find(token => token.address === value);
  const balance = balances[value];

  return (
    <div className="bg-black/40 rounded-xl p-4 border border-[#00ff00]/10 hover:border-[#00ff00]/30 transition-all duration-200">
      <div className="flex flex-col gap-2">
        {/* Label and Balance Row */}
        <div className="flex justify-between items-center text-sm text-[#00ff00]/60 font-mono">
          <span>{label}</span>
          {balance && (
            <span>Balance: {balance.formatted}</span>
          )}
        </div>
        
        {/* Main Input Row */}
        <div className="flex items-center justify-between gap-4">
          {/* Token Select Button - Left side */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl 
              hover:bg-[#00ff00]/5 transition-colors border border-[#00ff00]/20
              hover:border-[#00ff00]/40 min-w-[140px]"
          >
            <TokenIcon 
              symbol={selectedTokenInfo?.symbol || '?'} 
              logoURI={selectedTokenInfo?.logoURI}
              size={32}
            />
            <span className="text-lg font-mono text-[#00ff00]">
              {selectedTokenInfo?.symbol}
            </span>
            <svg className="w-4 h-4 text-[#00ff00]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Amount Input - Right side */}
          <div className="flex-1">
            <input
              type="text"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="0.00"
              disabled={!editable}
              className="w-full bg-transparent text-[#00ff00] text-right text-2xl 
                font-mono focus:outline-none placeholder-[#00ff00]/30"
            />
          </div>
        </div>
      </div>
      
      <TokenListModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tokens={tokens}
        selectedToken={value}
        onSelect={onChange}
        balances={balances}
      />
    </div>
  );
};

export default TokenSelect;
