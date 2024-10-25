import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletContextProvider } from '../contexts/WalletContextProvider';
import Header from '../components/Header';
import ClientErrorBoundary from '../components/ClientErrorBoundary';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: "Belacswap",
  description: "A Jupiter clone for token swaps on Solana",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ClientErrorBoundary>
          <WalletContextProvider>
            <Header />
            {children}
          </WalletContextProvider>
        </ClientErrorBoundary>
      </body>
    </html>
  );
}
