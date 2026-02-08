/**
 * Root Route
 *
 * Layout wrapper for all routes
 */

import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { WalletConnect } from '@/features/wallet';
import { NetworkSwitcher } from '@/components/NetworkSwitcher';
import { Toaster } from 'react-hot-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Beaker } from "lucide-react";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] relative overflow-hidden">
      {/* Gradient Orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-[20%] w-[550px] h-[550px] bg-indigo-600 rounded-full opacity-[0.07] blur-[140px]" />
        <div className="absolute top-[40%] -right-24 w-[420px] h-[420px] bg-cyan-500 rounded-full opacity-[0.05] blur-[120px]" />
        <div className="absolute bottom-[-80px] left-[35%] w-[380px] h-[380px] bg-purple-600 rounded-full opacity-[0.04] blur-[110px]" />
      </div>

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-50 sticky top-0 border-b border-white/[0.06] bg-[#0a0e1a]/75 backdrop-blur-xl"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">
              Naisu<span className="text-indigo-400">.</span>
            </span>
          </div>

          {/* Nav */}
          <nav className="hidden items-center gap-6 md:flex">
            <a href="/" className="text-sm font-medium text-white/70 hover:text-white transition-colors">Intent</a>
            <a href="/swap" className="text-sm font-medium text-indigo-400/70 hover:text-indigo-400 transition-colors">Swap</a>
            <a href="/pools" className="text-sm font-medium text-white/50 hover:text-white/70 transition-colors">Pools</a>
            <a href="/zap" className="text-sm font-medium text-purple-400/70 hover:text-purple-400 transition-colors">Zap ⚡</a>
            <a href="/intent-bridge" className="text-sm font-medium text-cyan-400/70 hover:text-cyan-400 transition-colors">Intent Bridge</a>


            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-white/35 hover:text-white/50 transition-colors outline-none data-[state=open]:text-white/70">
                Debug
                <ChevronDown className="h-3 w-3 opacity-50" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <a href="/test-cetus" className="w-full cursor-pointer flex items-center gap-2">
                    <Beaker className="h-4 w-4 text-indigo-400" />
                    <span>Test Dashboard</span>
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="/test-cetus-simple" className="w-full cursor-pointer flex items-center gap-2">
                    <div className="h-4 w-4 flex items-center justify-center rounded-full bg-white/10 text-[10px]">1</div>
                    <span>Simple Open</span>
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="/test-cetus-integrate" className="w-full cursor-pointer flex items-center gap-2">
                    <div className="h-4 w-4 flex items-center justify-center rounded-full bg-white/10 text-[10px]">2</div>
                    <span>Full Integration</span>
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="/test-cetus-core" className="w-full cursor-pointer flex items-center gap-2">
                    <div className="h-4 w-4 flex items-center justify-center rounded-full bg-indigo-500/20 text-[10px]">C</div>
                    <span>CLMM Core Test</span>
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="/test-open-position" className="w-full cursor-pointer flex items-center gap-2">
                    <div className="h-4 w-4 flex items-center justify-center rounded-full bg-emerald-500/20 text-[10px]">✨</div>
                    <span>Open Position (Clean)</span>
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="/test-close-position" className="w-full cursor-pointer flex items-center gap-2">
                    <div className="h-4 w-4 flex items-center justify-center rounded-full bg-red-500/20 text-[10px]">🗑️</div>
                    <span>Close Position</span>
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="/test-swap" className="w-full cursor-pointer flex items-center gap-2">
                    <div className="h-4 w-4 flex items-center justify-center rounded-full bg-blue-500/20 text-[10px]">🔄</div>
                    <span>Swap (SUI↔USDC)</span>
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="/test-claim-fees" className="w-full cursor-pointer flex items-center gap-2">
                    <div className="h-4 w-4 flex items-center justify-center rounded-full bg-amber-500/20 text-[10px]">💰</div>
                    <span>Claim Fees</span>
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="/smart-swap" className="w-full cursor-pointer flex items-center gap-2">
                    <div className="h-4 w-4 flex items-center justify-center rounded-full bg-pink-500/20 text-[10px]">🧠</div>
                    <span>Smart Swap</span>
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="/test-create-pool" className="w-full cursor-pointer flex items-center gap-2">
                    <div className="h-4 w-4 flex items-center justify-center rounded-full bg-cyan-500/20 text-[10px]">🏭</div>
                    <span>Create Pool</span>
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <div className="flex items-center gap-3">
            <NetworkSwitcher />
            <WalletConnect />
          </div>
        </div>
      </motion.header>

      {/* Page */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex flex-col items-center justify-between gap-3 md:flex-row">
          <p className="text-xs text-white/25">© 2025 Naisu. Built on Uniswap V4, Wormhole CCTP, and Sui.</p>
          <div className="flex items-center gap-5">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-xs text-white/25 hover:text-white/50 transition-colors">GitHub</a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-xs text-white/25 hover:text-white/50 transition-colors">Twitter</a>
          </div>
        </div>
      </footer>

      {import.meta.env.DEV && <TanStackRouterDevtools />}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#333',
            color: '#fff',
          },
        }}
      />
    </div>
  );
}
