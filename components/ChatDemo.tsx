import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User as UserIcon, Loader2, RefreshCw } from 'lucide-react';
import { chatWithEkki } from '../services/geminiService';
import { Message } from '../types';

interface ChatDemoProps {
  ownerId: string;
}

export const ChatDemo: React.FC<ChatDemoProps> = ({ ownerId }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'model',
      text: 'Namaste! Main hoon Ekki. Kaise madad kar sakti hoon aaj aapki? (Hello! I am Ekki. How can I help you today?)',
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      // Format history for Gemini
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      // Pass ownerId to the service
      const responseText = await chatWithEkki(userMsg.text, history, ownerId);

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error("Chat error", error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([{
      id: '1',
      role: 'model',
      text: 'Namaste! Chat reset kar di gayi hai. (Chat has been reset.)',
      timestamp: new Date()
    }]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-pink-600 rounded-full flex items-center justify-center relative">
            <Bot className="text-white w-6 h-6" />
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-800 rounded-full"></span>
          </div>
          <div>
            <h2 className="font-bold text-white">Ekki Preview</h2>
            <p className="text-xs text-pink-400">Online | AI Powered</p>
          </div>
        </div>
        <button 
          onClick={clearChat}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          title="Reset Chat"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl p-4 flex items-start space-x-3 ${
                msg.role === 'user'
                  ? 'bg-pink-600 text-white rounded-br-none'
                  : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700'
              }`}
            >
              {msg.role === 'model' && <Bot className="w-5 h-5 mt-1 shrink-0 opacity-70" />}
              <div>
                <p className="leading-relaxed text-sm md:text-base">{msg.text}</p>
                <p className="text-[10px] mt-2 opacity-50 text-right">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {msg.role === 'user' && <UserIcon className="w-5 h-5 mt-1 shrink-0 opacity-70" />}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 rounded-2xl p-4 rounded-bl-none border border-slate-700 flex items-center space-x-2">
              <Loader2 className="w-4 h-4 text-pink-500 animate-spin" />
              <span className="text-sm text-slate-400">Ekki is typing...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 bg-slate-800 border-t border-slate-700 flex space-x-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message (e.g., 'Hello Ekki', 'Kick @user')..."
          className="flex-1 bg-slate-900 text-white border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all placeholder-slate-500"
        />
        <button
          type="submit"
          disabled={isLoading || !inputText.trim()}
          className="bg-pink-600 hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 rounded-xl transition-colors flex items-center justify-center"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};