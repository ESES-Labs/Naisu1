import { useAccount, useDisconnect, useConnect } from 'wagmi'
import { ConnectButton as SuiConnectButton } from '@mysten/dapp-kit'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { truncateAddress } from '@/lib/utils'
import { Wallet, LogOut, ChevronDown, X } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

function EVMWalletButton() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { connectAsync, connectors, isPending } = useConnect()
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  // Close modal when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowModal(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleConnect = async (connector: typeof connectors[0]) => {
    setError(null)
    try {
      await connectAsync({ connector })
      setShowModal(false)
    } catch (err) {
      console.error('Failed to connect:', err)
      const message = err instanceof Error ? err.message : 'Failed to connect'
      // Don't show error if user rejected
      if (!message.includes('rejected')) {
        setError(message)
      }
    }
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="primary">EVM</Badge>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => disconnect()}
          className="gap-2"
        >
          <Wallet className="h-4 w-4" />
          {truncateAddress(address)}
          <LogOut className="h-3 w-3 opacity-50" />
        </Button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setShowModal(true)}
        disabled={isPending}
        className="gap-2"
      >
        <Wallet className="h-4 w-4" />
        {isPending ? 'Connecting...' : 'Connect EVM'}
        <ChevronDown className="h-3 w-3 opacity-50" />
      </Button>

      {/* Wallet Selection Modal */}
      {showModal && (
        <div
          ref={modalRef}
          className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-xl z-50"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-white">Select Wallet</span>
            <button
              onClick={() => setShowModal(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                onClick={() => handleConnect(connector)}
                disabled={isPending}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 transition-colors text-left disabled:opacity-50"
              >
                {connector.icon ? (
                  <img src={connector.icon} alt="" className="h-6 w-6 rounded-lg" />
                ) : (
                  <div className="h-6 w-6 rounded-lg bg-slate-700 flex items-center justify-center">
                    <Wallet className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">
                    {connector.name}
                  </div>
                  {connector.id === 'injected' && (
                    <div className="text-xs text-slate-500">Browser Wallet</div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SuiWalletButton() {
  return (
    <div className="flex items-center gap-2">
      <Badge variant="accent">Sui</Badge>
      <SuiConnectButton connectText="Connect Sui" />
    </div>
  )
}

export function WalletConnect() {
  return (
    <div className="flex items-center gap-4">
      <EVMWalletButton />
      <div className="h-6 w-px bg-slate-700" />
      <SuiWalletButton />
    </div>
  )
}
