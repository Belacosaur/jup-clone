import React from 'react';
import Image from 'next/image';

// Define interfaces directly since types.ts doesn't exist yet
interface TokenInfo {
  symbol: string;
  address: string;
  decimals: number;
  logoURI?: string;
}

interface TokenBalance {
  amount: number;
  decimals: number;
  formatted: string;
}

interface TokenSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  tokens: TokenInfo[];
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
  editable,
  customStyles
}) => {
  const selectedTokenInfo = tokens.find(token => token.address === value);

  return (
    <div className={customStyles.tokenSelect}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-[140px]">
          <div className="w-8 h-8 relative flex-shrink-0">
            {selectedTokenInfo?.logoURI ? (
              <Image
                src={selectedTokenInfo.logoURI}
                alt={selectedTokenInfo.symbol}
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
                {selectedTokenInfo?.symbol?.[0]}
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
        </div>

        <input
          type="text"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="0.00"
          disabled={!editable}
          className={`${customStyles.input} text-right`}
        />
      </div>
    </div>
  );
};

export default TokenSelect;
