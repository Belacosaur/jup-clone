import Image from "next/image";
import { WalletConnectButton } from '../components/WalletConnectButton';
import SwapInterface from '../components/SwapInterface';

export default function Home() {
  return (
    <main className="h-screen overflow-hidden">
      <SwapInterface />
    </main>
  );
}
