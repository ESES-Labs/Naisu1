import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { WalletConnect } from '@/components/WalletConnect'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

function RootLayout() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] relative overflow-hidden">
      {/* Gradient Orbs (maneki / justbeep style) */}
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
            <a href="/" className="text-sm font-medium text-white/70 hover:text-white transition-colors">Swap</a>
            <a href="#" className="text-sm font-medium text-white/35 hover:text-white/60 transition-colors">Positions</a>
            <a href="#" className="text-sm font-medium text-white/35 hover:text-white/60 transition-colors">Docs</a>
          </nav>

          <WalletConnect />
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
    </div>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
})
