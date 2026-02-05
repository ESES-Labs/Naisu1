import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import {
  createNetworkConfig,
  SuiClientProvider,
  WalletProvider as SuiWalletProvider,
} from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui/client";
import { wagmiConfig } from "@/config/wagmi";
import { NetworkProvider } from "@/contexts/NetworkContext";
import "@mysten/dapp-kit/dist/index.css";
import "./index.css";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create Query Client
const queryClient = new QueryClient();

// Create Router
const router = createRouter({ routeTree });

// Sui networks - both testnet and mainnet
const { networkConfig: suiNetworks } = createNetworkConfig({
  testnet: {
    url: import.meta.env.VITE_TESTNET_RPC_URL || getFullnodeUrl("testnet"),
  },
  mainnet: {
    url: import.meta.env.VITE_MAINNET_RPC_URL || getFullnodeUrl("mainnet"),
  },
});

// Get initial network from localStorage
const getInitialNetwork = () => {
  const saved = localStorage.getItem('naisu-network');
  if (saved === 'mainnet' || saved === 'testnet') return saved;
  return (import.meta.env.VITE_SUI_NETWORK as 'testnet' | 'mainnet') || 'testnet';
};

// Register router for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// App wrapper with network-aware Sui provider
function AppWithNetwork() {
  const [network, setNetwork] = React.useState<'testnet' | 'mainnet'>(getInitialNetwork());
  
  // Listen for network changes from NetworkProvider
  React.useEffect(() => {
    const handleStorage = () => {
      const newNetwork = localStorage.getItem('naisu-network') as 'testnet' | 'mainnet';
      if (newNetwork && newNetwork !== network) {
        setNetwork(newNetwork);
      }
    };
    
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [network]);

  return (
    <SuiClientProvider networks={suiNetworks} defaultNetwork={network}>
      <SuiWalletProvider autoConnect>
        <RouterProvider router={router} />
      </SuiWalletProvider>
    </SuiClientProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <NetworkProvider>
          <AppWithNetwork />
        </NetworkProvider>
      </WagmiProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
