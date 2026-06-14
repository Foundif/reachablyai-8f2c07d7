import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// Web Speech API types
interface SpeechRecognitionEvent {
  results: { [key: number]: { [key: number]: { transcript: string } } };
  resultIndex: number;
}

const VoiceAssistant = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const recognitionRef = useRef<any>(null);

  const getSpeechLang = () => {
    switch (language) {
      case 'hi': return 'hi-IN';
      case 'ta': return 'ta-IN';
      default: return 'en-US';
    }
  };

  const processCommand = useCallback(async (text: string) => {
    setIsProcessing(true);
    setResponse('');
    
    try {
      const { data, error } = await supabase.functions.invoke('voice-command', {
        body: { command: text, language },
      });

      if (error) throw error;

      const result = data;
      setResponse(result.message || result.response);

      // Execute navigation commands
      if (result.action === 'navigate') {
        const routes: Record<string, string> = {
          home: '/', dashboard: '/', products: '/products', sales: '/sales',
          purchases: '/purchases', customers: '/customers', suppliers: '/suppliers',
          analytics: '/analytics', alerts: '/alerts', settings: '/profile',
          profile: '/profile', 'new sale': '/sales/new', pos: '/sales/new',
          billing: '/sales/new',
        };
        const route = routes[result.target?.toLowerCase()];
        if (route) {
          setTimeout(() => { navigate(route); setIsOpen(false); }, 1000);
        }
      } else if (result.action === 'add_product') {
        setTimeout(() => { navigate('/products'); setIsOpen(false); }, 1000);
      }

      // Speak the response using speech synthesis
      if (result.message || result.response) {
        const utterance = new SpeechSynthesisUtterance(result.message || result.response);
        utterance.lang = getSpeechLang();
        utterance.rate = 0.9;
        speechSynthesis.speak(utterance);
      }
    } catch (err: any) {
      console.error('Voice command error:', err);
      setResponse('Sorry, I could not process that command. Please try again.');
      toast.error('Voice command failed');
    } finally {
      setIsProcessing(false);
    }
  }, [language, navigate]);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech recognition is not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = getSpeechLang();
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.resultIndex];
      const text = result[0].transcript;
      setTranscript(text);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (transcript.trim()) {
        processCommand(transcript.trim());
      }
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event.error !== 'no-speech') {
        toast.error(`Speech recognition error: ${event.error}`);
      }
    };

    recognitionRef.current = recognition;
    setTranscript('');
    setResponse('');
    recognition.start();
  }, [processCommand, transcript]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return (
    <>
      {/* Floating mic button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
        whileTap={{ scale: 0.9 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <Mic className="w-6 h-6" />
      </motion.button>

      {/* Voice modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center p-6"
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4"
              onClick={() => { setIsOpen(false); stopListening(); speechSynthesis.cancel(); }}
            >
              <X className="w-6 h-6" />
            </Button>

            <div className="text-center max-w-md w-full space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">{t('voice.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('voice.hint')}</p>
              </div>

              {/* Mic button with pulse animation */}
              <div className="flex justify-center">
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={isProcessing}
                  className={cn(
                    'w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300',
                    isListening
                      ? 'bg-risk-high text-white animate-pulse shadow-[0_0_40px_rgba(239,68,68,0.4)]'
                      : isProcessing
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-primary text-primary-foreground hover:scale-105 shadow-[0_0_30px_rgba(var(--primary),0.3)]'
                  )}
                >
                  {isProcessing ? (
                    <Loader2 className="w-10 h-10 animate-spin" />
                  ) : isListening ? (
                    <MicOff className="w-10 h-10" />
                  ) : (
                    <Mic className="w-10 h-10" />
                  )}
                </button>
              </div>

              <p className="text-sm font-medium text-muted-foreground">
                {isListening ? t('voice.listening') : isProcessing ? t('voice.processing') : t('voice.tapToSpeak')}
              </p>

              {/* Transcript */}
              {transcript && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card p-4 text-left"
                >
                  <p className="text-xs text-muted-foreground mb-1">You said:</p>
                  <p className="text-foreground font-medium">{transcript}</p>
                </motion.div>
              )}

              {/* Response */}
              {response && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card p-4 text-left border-primary/20"
                >
                  <p className="text-xs text-primary mb-1">Assistant:</p>
                  <p className="text-foreground">{response}</p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default VoiceAssistant;
