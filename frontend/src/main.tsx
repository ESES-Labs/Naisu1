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
import "@mysten/dapp-kit/dist/index.css";
import "./index.css";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create Query Client
const queryClient = new QueryClient();

// Create Router
const router = createRouter({ routeTree });

// Sui networks
// Use env variable to override RPC if ISP blocks default endpoint
// Set VITE_SUI_TESTNET_RPC in .env.local if needed
const { networkConfig: suiNetworks } = createNetworkConfig({
  testnet: {
    url: getFullnodeUrl("testnet"),
  },
});

// Register router for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <SuiClientProvider networks={suiNetworks} defaultNetwork="testnet">
          <SuiWalletProvider autoConnect>
            <RouterProvider router={router} />
          </SuiWalletProvider>
        </SuiClientProvider>
      </WagmiProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
