'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { FC } from 'react';

export const WalletConnectButton: FC = () => {
  const { publicKey } = useWallet();

  return (
    <div className="flex items-center justify-center">
      <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />
      {publicKey && (
        <p className="ml-4">
          Connected: {publicKey.toString().slice(0, 4)}...
          {publicKey.toString().slice(-4)}
        </p>
      )}
    </div>
  );
};
