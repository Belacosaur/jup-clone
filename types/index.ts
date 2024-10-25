export interface TokenInfo {
  symbol: string;
  address: string;
  decimals: number;
  logoURI?: string;
  name?: string;
  price?: number;
}

export interface TokenBalance {
  amount: number;
  decimals: number;
  formatted: string;
  usdValue?: number;
}

export interface ConsoleMessage {
  id: number;
  text: string;
  type: 'info' | 'success' | 'error';
  isTyping: boolean;
  displayedText: string;
}

// Add this new interface for the swap response
export interface SwapResponseData {
  swapTransaction: string;
  lastValidBlockHeight?: number;
  prioritizationFeeLamports?: number;
  computeUnitLimit?: number;
  computeUnitPrice?: number;
}
