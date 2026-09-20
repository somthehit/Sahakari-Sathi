import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  Search, 
  FileText, 
  Upload, 
  Zap, 
  Brain, 
  RefreshCw, 
  ExternalLink, 
  User, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Image as ImageIcon
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  sources?: { title?: string; uri?: string }[];
}

export const GeminiAiAssistantView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'search' | 'image' | 'fast' | 'thinking'>('chat');
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'model',
      content: 'Namaste! I am SahakariSathi AI, your cooperative intelligence copilot. How can I assist with SACCOS loan appraisals, PEARLS monitoring, or accounting vouchers today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Search grounded state
  const [searchPrompt, setSearchPrompt] = useState('What are current Nepal Rastra Bank regulatory liquidity guidelines for saving and credit cooperatives (SACCOS)?');
  const [searchResult, setSearchResult] = useState<{ text: string; sources: { title?: string; uri?: string }[] } | null>(null);
  const [isSearchLoading, setIsSearchLoading] = useState(false);

  // Image analysis state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState('Extract voucher entries, amount, member account number, and check for signature or official stamp.');
  const [imageAnalysisResult, setImageAnalysisResult] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);

  // Fast assist state
  const [fastPrompt, setFastPrompt] = useState('What is the difference between Mandatory Savings and Optional Savings in a Nepal SACCOS?');
  const [fastResult, setFastResult] = useState<string | null>(null);
  const [isFastLoading, setIsFastLoading] = useState(false);

  // Deep think state
  const [thinkPrompt, setThinkPrompt] = useState('Analyze loan delinquency risk and recommend corrective action plan for a branch with NPL ratio at 8.5% and loan loss provision shortfall of NPR 2.5 Million.');
  const [thinkResult, setThinkResult] = useState<string | null>(null);
  const [isThinkLoading, setIsThinkLoading] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsChatLoading(true);

    try {
      const apiMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          systemInstruction: 'You are SahakariSathi AI, an expert Financial Cooperative and Banking Operations Assistant for Nepal SACCOS. Answer with professional financial accuracy and clarity.',
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: data.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: `⚠️ System Note: Unable to complete AI request (${err.message || 'Server connection error'}). Please verify GEMINI_API_KEY environment variable in settings.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleExecuteSearch = async () => {
    if (!searchPrompt.trim() || isSearchLoading) return;
    setIsSearchLoading(true);
    setSearchResult(null);

    try {
      const response = await fetch('/api/ai/search-grounded', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: searchPrompt }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setSearchResult(data);
    } catch (err: any) {
      setSearchResult({
        text: `Error executing search query: ${err.message}`,
        sources: [],
      });
    } finally {
      setIsSearchLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyzeImage = async () => {
    if (!selectedImage || isImageLoading) return;
    setIsImageLoading(true);
    setImageAnalysisResult(null);

    try {
      const response = await fetch('/api/ai/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: selectedImage,
          prompt: imagePrompt,
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setImageAnalysisResult(data.text);
    } catch (err: any) {
      setImageAnalysisResult(`Failed to analyze image: ${err.message}`);
    } finally {
      setIsImageLoading(false);
    }
  };

  const handleQuickAssist = async () => {
    if (!fastPrompt.trim() || isFastLoading) return;
    setIsFastLoading(true);
    setFastResult(null);

    try {
      const response = await fetch('/api/ai/quick-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fastPrompt }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setFastResult(data.text);
    } catch (err: any) {
      setFastResult(`Quick assist error: ${err.message}`);
    } finally {
      setIsFastLoading(false);
    }
  };

  const handleDeepThink = async () => {
    if (!thinkPrompt.trim() || isThinkLoading) return;
    setIsThinkLoading(true);
    setThinkResult(null);

    try {
      const response = await fetch('/api/ai/deep-think', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: thinkPrompt }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setThinkResult(data.text);
    } catch (err: any) {
      setThinkResult(`Deep thinking model error: ${err.message}`);
    } finally {
      setIsThinkLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-teal-900 text-slate-800 p-6 rounded-2xl shadow-md border border-emerald-800/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </span>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">SahakariSathi AI Copilot Suite</h1>
          </div>
          <p className="text-slate-600 text-xs md:text-sm">
            Powered by Google Gemini 3.5 & 3.1 models with real-time web search grounding, document understanding, and thinking mode.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold">
            gemini-3.5-flash
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-indigo-950 text-indigo-300 border border-indigo-800 font-semibold">
            gemini-3.1-pro-preview
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-amber-950 text-amber-300 border border-amber-800 font-semibold">
            gemini-3.1-flash-lite
          </span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-slate-200 pb-2 text-xs font-medium">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition cursor-pointer ${ activeTab === 'chat' ? 'bg-emerald-700 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200' }`}
        >
          <Bot className="w-4 h-4" /> Multi-Turn AI Chatbot
        </button>

        <button
          onClick={() => setActiveTab('search')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition cursor-pointer ${ activeTab === 'search' ? 'bg-emerald-700 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200' }`}
        >
          <Search className="w-4 h-4" /> Google Search Grounding
        </button>

        <button
          onClick={() => setActiveTab('image')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition cursor-pointer ${ activeTab === 'image' ? 'bg-emerald-700 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200' }`}
        >
          <ImageIcon className="w-4 h-4" /> Document & Voucher OCR
        </button>

        <button
          onClick={() => setActiveTab('fast')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition cursor-pointer ${ activeTab === 'fast' ? 'bg-emerald-700 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200' }`}
        >
          <Zap className="w-4 h-4 text-amber-300" /> Low-Latency Fast Assist
        </button>

        <button
          onClick={() => setActiveTab('thinking')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition cursor-pointer ${ activeTab === 'thinking' ? 'bg-emerald-700 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200' }`}
        >
          <Brain className="w-4 h-4 text-indigo-300" /> High Thinking Risk Audit
        </button>
      </div>

      {/* Tab 1: Multi-Turn Chatbot */}
      {activeTab === 'chat' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[580px]">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                <Bot className="w-5 h-5" />
              </span>
              <div>
                <h2 className="font-bold text-slate-900 text-sm">Interactive Cooperative Operations Chatbot</h2>
                <p className="text-slate-500 text-[11px]">System Role: Nepal SACCOS Regulations & Banking Copilot</p>
              </div>
            </div>
            <button
              onClick={() => setMessages([messages[0]])}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-lg cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Clear History
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50 custom-scrollbar">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${ m.role === 'user' ? 'bg-white text-white' : 'bg-emerald-700 text-white' }`}
                >
                  {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div
                  className={`p-3.5 rounded-2xl text-xs space-y-1.5 ${ m.role === 'user' ? 'bg-white text-slate-800 rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-xs' }`}
                >
                  <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                  <div className={`text-[10px] text-right ${m.role === 'user' ? 'text-slate-500' : 'text-slate-500'}`}>
                    {m.timestamp}
                  </div>
                </div>
              </div>
            ))}
            {isChatLoading && (
              <div className="flex gap-3 max-w-[80%]">
                <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center text-xs font-bold">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-slate-500 text-xs flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-700" />
                  <span>SahakariSathi AI is analyzing and generating response...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendChat} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask about SACCOS loan classification, interest calculation, cash management..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isChatLoading}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Send className="w-4 h-4" /> Send
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Google Search Grounding */}
      {activeTab === 'search' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="space-y-1">
            <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Search className="w-4 h-4 text-emerald-700" /> Real-Time Google Search Grounded Query
            </h2>
            <p className="text-slate-500 text-xs">
              Retrieves up-to-date live market information, NRB circulars, and Department of Cooperatives notices with citations.
            </p>
          </div>

          <div className="space-y-2">
            <textarea
              rows={3}
              value={searchPrompt}
              onChange={(e) => setSearchPrompt(e.target.value)}
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleExecuteSearch}
              disabled={isSearchLoading}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-xs"
            >
              {isSearchLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Execute Search Grounded Request
            </button>
          </div>

          {searchResult && (
            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <h3 className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-1.5">Grounded Answer Output</h3>
              <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">{searchResult.text}</div>

              {searchResult.sources && searchResult.sources.length > 0 && (
                <div className="pt-2 border-t border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Citations & Web Sources:</span>
                  <div className="flex flex-wrap gap-2">
                    {searchResult.sources.map((s, idx) => (
                      <a
                        key={idx}
                        href={s.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-emerald-800 hover:underline bg-white border border-slate-200 px-2.5 py-1 rounded-lg"
                      >
                        <ExternalLink className="w-3 h-3" /> {s.title || s.uri}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Document & Image Analysis */}
      {activeTab === 'image' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="space-y-1">
            <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-emerald-700" /> Document & Voucher OCR Analysis (Gemini 3.1 Pro)
            </h2>
            <p className="text-slate-500 text-xs">
              Upload payment vouchers, citizenship cards, land ownership collateral certificates (Lalpurja), or receipts for instant extraction.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700">Select or Drag Document Image</label>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center space-y-2 hover:border-emerald-500 transition bg-slate-50">
                <Upload className="w-8 h-8 text-slate-500 mx-auto" />
                <input type="file" accept="image/*" onChange={handleImageUpload} className="text-xs text-slate-600" />
              </div>

              {selectedImage && (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 max-h-48 flex items-center justify-center bg-black/5">
                  <img src={selectedImage} alt="Document preview" className="object-contain max-h-48" />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Extraction Prompt Instructions</label>
                <input
                  type="text"
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
                />
              </div>

              <button
                onClick={handleAnalyzeImage}
                disabled={!selectedImage || isImageLoading}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
              >
                {isImageLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Analyze Document & Extract Fields
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <h3 className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-1.5">Extraction Results</h3>
              {imageAnalysisResult ? (
                <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">{imageAnalysisResult}</div>
              ) : (
                <p className="text-xs text-slate-500 italic">No document image analyzed yet. Select a voucher image and click analyze.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Low-Latency Fast Assist */}
      {activeTab === 'fast' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="space-y-1">
            <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-600" /> Ultra Fast Low-Latency Copilot (Gemini 3.1 Flash Lite)
            </h2>
            <p className="text-slate-500 text-xs">
              Provides instant, low-latency micro responses for rapid cashier validation and quick definition lookups.
            </p>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              value={fastPrompt}
              onChange={(e) => setFastPrompt(e.target.value)}
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleQuickAssist}
              disabled={isFastLoading}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-xs"
            >
              {isFastLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Get Instant Response
            </button>
          </div>

          {fastResult && (
            <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl text-xs text-slate-900 leading-relaxed">
              {fastResult}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: High Thinking Risk Audit */}
      {activeTab === 'thinking' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="space-y-1">
            <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Brain className="w-4 h-4 text-indigo-700" /> High Thinking Level Deep Audit (Gemini 3.1 Pro)
            </h2>
            <p className="text-slate-500 text-xs">
              Uses high reasoning depth (`thinkingLevel: HIGH`) for multi-branch risk modeling, PEARLS ratio analysis, and credit loss provision strategy.
            </p>
          </div>

          <div className="space-y-2">
            <textarea
              rows={3}
              value={thinkPrompt}
              onChange={(e) => setThinkPrompt(e.target.value)}
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleDeepThink}
              disabled={isThinkLoading}
              className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-xs"
            >
              {isThinkLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              Run Deep Reasoning Audit
            </button>
          </div>

          {thinkResult && (
            <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl text-xs text-slate-900 leading-relaxed whitespace-pre-wrap">
              {thinkResult}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
