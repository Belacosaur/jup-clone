import React from 'react';

interface Token {
  symbol: string;
  address: string;
  decimals: number;
}

interface TokenSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  amount: string;
  onAmountChange: (amount: string) => void;
  tokens: Array<Token>;
  editable: boolean;
  customStyles?: Record<string, string>;
}

const TokenSelect: React.FC<TokenSelectProps> = ({
  label,
  value,
  onChange,
  amount,
  onAmountChange,
  tokens,
  editable,
  customStyles = {}
}) => {
  return (
    <div className={customStyles.tokenSelect || ''}>
      <label className="text-sm font-medium text-gray-300">{label}</label>
      <div className="flex items-center mt-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-gray-700 text-white rounded-lg px-3 py-1.5 mr-2"
        >
          {tokens.map((token) => (
            <option key={token.address} value={token.address}>
              {token.symbol}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={amount}
          onChange={(e) => editable && onAmountChange(e.target.value)}
          disabled={!editable}
          placeholder="0.00"
          className={customStyles.input}
        />
      </div>
    </div>
  );
};

export default TokenSelect;
