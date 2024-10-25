import React from 'react';
import Image from 'next/image';

interface TokenInfo {
  symbol: string;
  address: string;
  decimals: number;
  logoURI?: string;
  name?: string;
}

interface TokenSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  tokens: TokenInfo[];
  editable: boolean;
  customStyles: any;
}

const TokenSelect: React.FC<TokenSelectProps> = ({
  value,
  onChange,
  amount,
  onAmountChange,
  tokens,
  editable,
  customStyles
}) => {
  const selectedToken = tokens.find(token => token.address === value);

  return (
    <div className={customStyles.tokenSelect}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-[140px]">
          <div className="w-8 h-8 relative flex-shrink-0">
            {selectedToken?.logoURI ? (
              <Image
                src={selectedToken.logoURI}
                alt={selectedToken.symbol}
                width={32}
                height={32}
                className="rounded-full object-contain bg-gray-800 p-0.5"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400">
                {selectedToken?.symbol?.[0]}
              </div>
            )}
          </div>
          <select 
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="bg-transparent text-white text-lg font-medium focus:outline-none appearance-none cursor-pointer hover:opacity-80 transition-opacity w-full"
            style={{
              WebkitAppearance: 'none',
              MozAppearance: 'none'
            }}
          >
            {tokens.map((token) => (
              <option 
                key={token.address} 
                value={token.address}
                className="bg-gray-800 text-white"
              >
                {token.symbol}
              </option>
            ))}
          </select>
          <svg 
            className="w-4 h-4 text-[#00ff00]"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>

        <input
          type="number"
          value={amount}
          onChange={(e) => editable && onAmountChange(e.target.value)}
          disabled={!editable}
          placeholder="0.00"
          className="bg-transparent text-white text-lg font-medium focus:outline-none text-right w-full"
        />
      </div>
    </div>
  );
};

export default TokenSelect;
