import React, { useState } from 'react';
import Image from 'next/image';

interface TokenIconProps {
  symbol: string;
  logoURI?: string;
  size?: number;
}

const TokenIcon: React.FC<TokenIconProps> = ({ symbol, logoURI, size = 32 }) => {
  const [imageError, setImageError] = useState(false);

  if (!logoURI || imageError) {
    return (
      <div 
        className="rounded-full bg-gray-800 flex items-center justify-center text-gray-400"
        style={{ width: size, height: size }}
      >
        {symbol[0]}
      </div>
    );
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <img
        src={logoURI}
        alt={symbol}
        className="rounded-full object-contain bg-gray-800 p-0.5"
        width={size}
        height={size}
        onError={() => setImageError(true)}
        style={{ width: size, height: size }}
      />
    </div>
  );
};

export default TokenIcon;
