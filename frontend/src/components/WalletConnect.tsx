import { useAccount, useDisconnect, useConnect } from 'wagmi'
import { ConnectButton as SuiConnectButton } from '@mysten/dapp-kit'
import { Button } from './ui/Button'
import { Badge } from './ui/Badge'
import { truncateAddress } from '@/lib/utils'
import { Wallet, LogOut } from 'lucide-react'
import { injected } from 'wagmi/connectors'

function EVMWalletButton() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { connect } = useConnect()

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
    <Button
      variant="secondary"
      size="sm"
      onClick={() => connect({ connector: injected() })}
      className="gap-2"
    >
      <Wallet className="h-4 w-4" />
      Connect EVM
    </Button>
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
