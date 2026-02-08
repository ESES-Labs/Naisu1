import { createFileRoute } from '@tanstack/react-router'
import { IntentBridge } from '@/features/intent/components/IntentBridge'

export const Route = createFileRoute('/intent-bridge')({
    component: IntentBridgePage,
})

function IntentBridgePage() {
    return (
        <div className="flex flex-col items-center justify-center py-12">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-white mb-2">Cross-Chain Intent Bridge</h1>
                <p className="text-white/50">Dutch Auction mechanism for optimal execution</p>
            </div>
            <IntentBridge />
        </div>
    )
}
