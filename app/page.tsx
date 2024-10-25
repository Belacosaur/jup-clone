import Image from "next/image";
import { WalletConnectButton } from '../components/WalletConnectButton';
import SwapInterface from '../components/SwapInterface';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <SwapInterface />
    </main>
  );
}
