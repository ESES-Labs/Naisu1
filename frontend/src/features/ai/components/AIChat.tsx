import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useMutateAIChat } from '@/features/ai'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Send, Loader2, Bot, ArrowRight } from 'lucide-react'

interface AIChatProps {
    onIntentFound: (data: any) => void
}

export function AIChat({ onIntentFound }: AIChatProps) {
    const [input, setInput] = useState('')
    const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string; intent?: any }[]>([])
    const chatMutation = useMutateAIChat()

    const handleSend = async () => {
        if (!input.trim()) return

        const userMsg = input
        setInput('')
        setMessages(prev => [...prev, { role: 'user', content: userMsg }])

        try {
            const res = await chatMutation.mutateAsync({ message: userMsg })
            // Don't auto-call onIntentFound. Just store it in the message.
            setMessages(prev => [...prev, { role: 'ai', content: res.reply, intent: res.intent }])
        } catch (e) {
            setMessages(prev => [...prev, { role: 'ai', content: "Sorry, I couldn't process that request." }])
        }
    }

    return (
        <Card padding="lg" className="w-full h-full flex flex-col">
            <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                    <Bot className="h-6 w-6 text-indigo-400" />
                    <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">Naisu Agent</span>
                </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col gap-4 min-h-[300px]">
                {/* Messages Area */}
                <div className="flex-1 space-y-4 overflow-y-auto pr-2 max-h-[400px]">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-white/[0.3] space-y-3">
                            <Sparkles className="h-8 w-8" />
                            <p className="text-sm text-center max-w-[200px]">Try: "Find me the best USDC yield on Sui"</p>
                        </div>
                    )}

                    <AnimatePresence>
                        {messages.map((m, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                            >
                                <div className={`
                  max-w-[80%] rounded-2xl px-4 py-3 text-sm
                  ${m.role === 'user'
                                        ? 'bg-indigo-500 text-white rounded-br-sm'
                                        : 'bg-white/[0.08] text-gray-100 rounded-bl-sm border border-white/[0.05]'}
                `}>
                                    {m.content}
                                </div>

                                {m.intent && (
                                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-2 ml-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                                            onClick={() => onIntentFound(m.intent)}
                                        >
                                            <span>Fill Intent Form</span>
                                            <ArrowRight className="ml-2 h-3 w-3" />
                                        </Button>
                                    </motion.div>
                                )}
                            </motion.div>
                        ))}
                        {chatMutation.isPending && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                                <div className="bg-white/[0.08] rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
                                    <span className="w-1.5 h-1.5 bg-white/[0.4] rounded-full animate-bounce" />
                                    <span className="w-1.5 h-1.5 bg-white/[0.4] rounded-full animate-bounce delay-100" />
                                    <span className="w-1.5 h-1.5 bg-white/[0.4] rounded-full animate-bounce delay-200" />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Input Area */}
                <div className="flex gap-2 mt-auto pt-4 border-t border-white/[0.06]">
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask anything..."
                        className="bg-transparent border-white/[0.1]"
                    />
                    <Button
                        size="icon"
                        onClick={handleSend}
                        disabled={!input.trim() || chatMutation.isPending}
                        className="shrink-0"
                    >
                        {chatMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
