import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Book, Layers, Volume2, X, Check, RefreshCw, Sparkles, Edit, Eye, EyeOff, ArrowRightLeft, Search, Image as ImageIcon } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { dbService } from '../services/db';
import { DailyLesson, VocabularyItem } from '../types';
import { AdminContext } from '../App';

// Simple Markdown Bold Renderer
const FormattedText: React.FC<{ text: string, className?: string }> = ({ text, className }) => {
  const html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>')
    .replace(/\n/g, '<br />');

  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};

// --- Helper Component: 3 Thumbnail Images ---
// Uses a reliable image search service workaround (Bing Thumbnails) to generate visuals without extra API keys.
const WordImages: React.FC<{ word: string }> = ({ word }) => {
  const encodedWord = encodeURIComponent(word);
  // We use slightly different parameters to try and fetch distinct thumbnails
  const img1 = `https://tse1.mm.bing.net/th?q=${encodedWord}&w=300&h=300&c=7&rs=1&p=0`;
  const img2 = `https://tse2.mm.bing.net/th?q=${encodedWord} photo&w=300&h=300&c=7&rs=1&p=0`;
  const img3 = `https://tse3.mm.bing.net/th?q=${encodedWord} illustration&w=300&h=300&c=7&rs=1&p=0`;

  return (
    <div className="flex justify-center gap-3 my-4">
      {[img1, img2, img3].map((src, i) => (
        <div key={i} className="w-24 h-24 rounded-lg overflow-hidden border border-slate-200 shadow-sm bg-slate-100 relative group">
           <img 
              src={src} 
              alt={word} 
              className="w-full h-full object-cover transition-transform group-hover:scale-110"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
           />
           <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-10 transition-opacity" />
        </div>
      ))}
    </div>
  );
};

// Sound Effect Helper (Synthesizer)
const playFeedbackSound = (type: 'correct' | 'wrong') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'correct') {
      // High pitch "Ding"
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } else {
      // Low pitch "Buzz"
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    console.error("Audio play failed", e);
  }
};

export const LessonDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useContext(AdminContext); // Consume Context
  const [lesson, setLesson] = useState<DailyLesson | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [unknownWords, setUnknownWords] = useState<Set<string>>(new Set());
  
  // Vocab List State
  const [hideEnglishList, setHideEnglishList] = useState(false);

  // Flashcard State
  const [isFlashcardMode, setIsFlashcardMode] = useState(false);
  const [isRoundSummary, setIsRoundSummary] = useState(false);
  const [reverseFlashcards, setReverseFlashcards] = useState(false); 
  const [feedbackState, setFeedbackState] = useState<'idle' | 'correct' | 'wrong'>('idle');

  // Queue Logic for Recursive Learning
  const [queue, setQueue] = useState<number[]>([]); 
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0); 
  const [nextRoundQueue, setNextRoundQueue] = useState<number[]>([]); 
  
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  // Word Detail Modal State
  const [selectedWord, setSelectedWord] = useState<VocabularyItem | null>(null);
  const [dictionaryData, setDictionaryData] = useState<any>(null);
  const [loadingDict, setLoadingDict] = useState(false);

  useEffect(() => {
    if (id) {
      dbService.getLessonById(id).then(data => {
        if (data) {
          setLesson(data);
          
          // Updated audio logic: Prioritize Cloud URL, fallback to local blob
          if (data.audioUrl) {
            setAudioUrl(data.audioUrl);
          } else if (data.audioBlob) {
            const url = URL.createObjectURL(data.audioBlob);
            setAudioUrl(url);
          }
        } else {
          navigate('/');
        }
      });
    }
    return () => {
      // If it was a blob URL, revoke it (check if it starts with blob:)
      if (audioUrl && audioUrl.startsWith('blob:')) {
         URL.revokeObjectURL(audioUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate]);

  const toggleAudio = () => {
    if (!audioRef) return;
    if (isPlaying) {
      audioRef.pause();
    } else {
      audioRef.play();
    }
    setIsPlaying(!isPlaying);
  };

  const speakText = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const speakWordAndExample = (word: string, example: string) => {
    window.speechSynthesis.cancel();
    const u1 = new SpeechSynthesisUtterance(word);
    u1.lang = 'en-US';
    u1.rate = 0.9;
    
    const u2 = new SpeechSynthesisUtterance(example);
    u2.lang = 'en-US';
    u2.rate = 0.95;

    u1.onend = () => {
       setTimeout(() => window.speechSynthesis.speak(u2), 500);
    };
    window.speechSynthesis.speak(u1);
  };

  // --- External API for Word Detail ---
  const fetchWordDetails = async (word: string) => {
    setLoadingDict(true);
    setDictionaryData(null);
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
      if (res.ok) {
        const data = await res.json();
        setDictionaryData(data[0]);
      }
    } catch (e) {
      console.error("Failed to fetch dictionary data", e);
    } finally {
      setLoadingDict(false);
    }
  };

  const openWordDetail = async (item: VocabularyItem) => {
    setSelectedWord(item);
    fetchWordDetails(item.word);
  };

  // --- Flashcard Logic ---
  const startFlashcards = () => {
    if (!lesson) return;
    const initialIndices = lesson.vocabulary.map((_, i) => i);
    setQueue(initialIndices);
    setNextRoundQueue([]);
    setCurrentQueueIndex(0);
    setIsCardFlipped(false);
    setIsFlashcardMode(true);
    setIsRoundSummary(false);
    setFeedbackState('idle');
  };

  const handleCardResult = (known: boolean) => {
    if (!lesson) return;
    
    // Feedback Sound & Visual
    playFeedbackSound(known ? 'correct' : 'wrong');
    setFeedbackState(known ? 'correct' : 'wrong');

    const currentVocabIndex = queue[currentQueueIndex];
    const currentWord = lesson.vocabulary[currentVocabIndex].word;

    // Delay processing slightly to show animation
    setTimeout(() => {
        if (!known) {
          setNextRoundQueue(prev => [...prev, currentVocabIndex]);
          setUnknownWords(prev => new Set(prev).add(currentWord));
        }

        if (currentQueueIndex < queue.length - 1) {
          setCurrentQueueIndex(prev => prev + 1);
          setIsCardFlipped(false);
        } else {
          setIsRoundSummary(true);
        }
        setFeedbackState('idle');
    }, 400); // 400ms delay for feedback
  };

  const startNextRound = () => {
    if (nextRoundQueue.length === 0) {
      setIsFlashcardMode(false);
      return;
    }
    setQueue(nextRoundQueue);
    setNextRoundQueue([]);
    setCurrentQueueIndex(0);
    setIsCardFlipped(false);
    setIsRoundSummary(false);
  };

  // Simplified Flashcard Image Link Component (Bottom link)
  const FlashcardImageLink = () => (
    <div className="w-full text-center py-4">
       <a 
         href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(lesson?.vocabulary[queue[currentQueueIndex]].word || "")}`} 
         target="_blank" 
         rel="noreferrer" 
         onClick={(e) => e.stopPropagation()}
         className="inline-flex items-center text-sm font-medium text-blue-500 hover:text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-full transition-colors border border-blue-100"
       >
         <Search className="w-4 h-4 mr-2"/> See more on Google Images
       </a>
    </div>
  );

  if (!lesson) return <div className="p-8 text-center">Loading...</div>;

  const activeVocabIndex = queue[currentQueueIndex];
  const activeCard = lesson.vocabulary[activeVocabIndex];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 relative">
      <div className="flex justify-between items-center mb-4">
        <Button variant="ghost" onClick={() => navigate('/')} className="pl-0 hover:bg-transparent hover:text-blue-600">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Library
        </Button>
        {isAdmin && (
          <Button variant="secondary" onClick={() => navigate(`/edit/${lesson.id}`)}>
            <Edit className="w-4 h-4 mr-2" />
            Edit Lesson
          </Button>
        )}
      </div>

      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 pb-6">
        <div>
          <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{lesson.date}</span>
          <h1 className="text-3xl font-bold text-slate-900 mt-3">{lesson.story.title}</h1>
        </div>
      </header>

      {audioUrl && (
        <audio 
          ref={setAudioRef} 
          src={audioUrl} 
          onEnded={() => setIsPlaying(false)} 
          onPause={() => setIsPlaying(false)} 
          onPlay={() => setIsPlaying(true)}
          className="hidden" 
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Main Content (Story) */}
        <div className="md:col-span-2 space-y-6">
          <Card className="p-8 min-h-[500px]">
            {/* Audio Control */}
            {audioUrl && (
               <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl mb-6 border border-slate-100">
                  <div className="flex items-center text-sm font-medium text-slate-600">
                     <Volume2 className="w-5 h-5 mr-2 text-blue-500"/>
                     Lesson Audio
                  </div>
                  <Button onClick={toggleAudio} className="rounded-full px-6">
                    {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                    {isPlaying ? "Pause" : "Play"}
                  </Button>
               </div>
            )}
            
            <div className="prose prose-slate max-w-none">
              <FormattedText 
                text={lesson.story.content} 
                className="text-lg leading-relaxed text-slate-800 font-serif whitespace-pre-wrap" 
              />
            </div>
          </Card>
        </div>

        {/* Vocabulary Sidebar */}
        <div className="space-y-4">
          
          {lesson.vocabulary.length > 0 && (
             <button 
               onClick={startFlashcards}
               className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center mb-4"
             >
               <Layers className="w-5 h-5 mr-2" />
               Start Flashcards
             </button>
          )}

          <div className="flex items-center justify-between mb-2">
             <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
                <Book className="w-5 h-5 text-blue-600" />
                Vocabulary
             </div>
             {/* Toggle English Visibility Button */}
             <button 
                onClick={() => setHideEnglishList(!hideEnglishList)} 
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${hideEnglishList ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                title={hideEnglishList ? "Click to Show English" : "Click to Hide English"}
             >
                {hideEnglishList ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {hideEnglishList ? "Show English" : "Hide English"}
             </button>
          </div>

          <div className="text-sm font-semibold text-slate-500 mb-2 truncate">
            {lesson.vocabularyTitle || "Vocabulary List"}
          </div>
          
          <div className="space-y-3">
            {lesson.vocabulary.map((item, idx) => {
              const isUnknown = unknownWords.has(item.word);
              return (
                <Card 
                  key={idx} 
                  className={`p-4 transition-all border-l-4 cursor-pointer ${isUnknown ? 'border-l-orange-500 bg-orange-50' : 'border-l-transparent hover:shadow-md hover:border-l-blue-300'}`}
                >
                  <div onClick={() => openWordDetail(item)}>
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex-1">
                         {/* English Word with Blur Toggle */}
                        {hideEnglishList ? (
                           // Hidden State
                           <div className="bg-slate-200 text-transparent rounded px-2 py-1 select-none inline-block mb-1 cursor-help relative group" title="Hover to peek">
                              <span className="blur-sm">{item.word}</span>
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-white/90 text-slate-900 text-xs font-bold rounded transition-opacity">
                                {item.word}
                              </div>
                           </div>
                        ) : (
                           // Visible State
                           <span className="font-bold text-lg text-blue-700 mr-2 block">
                              {item.word}
                           </span>
                        )}
                        
                        {item.ipa && (
                           <span className={`text-slate-400 font-mono text-xs block mt-1 ${hideEnglishList ? 'opacity-0' : 'opacity-100'}`}>
                             {item.ipa}
                           </span>
                        )}
                      </div>
                      <div className="flex space-x-1">
                        <button 
                          onClick={(e) => { e.stopPropagation(); speakText(item.word); }} 
                          className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {/* Chinese Definition always visible */}
                    <div className="text-slate-600 font-medium text-sm mb-2 mt-1">{item.definition}</div>
                  </div>
                  
                  <div className="text-slate-500 text-xs italic border-t border-slate-200 pt-2 mt-1 flex items-start">
                    <button 
                        onClick={(e) => { e.stopPropagation(); speakText(item.example); }}
                        className="mr-2 mt-0.5 text-slate-400 hover:text-blue-600 flex-shrink-0"
                    >
                      <Volume2 className="w-3 h-3" />
                    </button>
                    "{item.example}"
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* WORD DETAIL MODAL */}
      {selectedWord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setSelectedWord(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
             <div className="p-6 border-b border-slate-100 flex justify-between items-start sticky top-0 bg-white z-10">
               <div>
                  <h2 className="text-3xl font-bold text-slate-900">{selectedWord.word}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-slate-500">{selectedWord.ipa}</span>
                    <button onClick={() => speakText(selectedWord.word)} className="text-blue-500 hover:bg-blue-50 p-1 rounded-full"><Volume2 className="w-5 h-5"/></button>
                  </div>
               </div>
               <button onClick={() => setSelectedWord(null)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6"/></button>
             </div>

             <div className="p-6 space-y-6">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                   <h3 className="text-xs font-bold text-blue-800 uppercase mb-2">My Definition</h3>
                   <p className="text-lg font-medium text-slate-800">{selectedWord.definition}</p>
                   <p className="mt-2 text-slate-600 italic">"{selectedWord.example}"</p>
                </div>
                
                {/* 3 Images in Detail View as well */}
                <div>
                   <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Visuals</h3>
                   <WordImages word={selectedWord.word} />
                </div>

                <div>
                   <div className="grid grid-cols-1 gap-4">
                        <div className="text-sm text-slate-400 italic py-4 text-center bg-slate-50 rounded">
                           <a href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(selectedWord.word)}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center justify-center">
                             <Search className="w-4 h-4 mr-2"/>
                             Search Images on Google
                           </a>
                        </div>
                   </div>
                </div>

                {loadingDict ? (
                   <div className="text-center py-4 text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto"/> Loading details...</div>
                ) : dictionaryData ? (
                   <div className="space-y-4">
                      <h3 className="text-xs font-bold text-slate-500 uppercase">Dictionary Meanings</h3>
                      {dictionaryData.meanings?.slice(0, 2).map((meaning: any, i: number) => (
                        <div key={i}>
                           <span className="text-xs font-bold text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded">{meaning.partOfSpeech}</span>
                           <ul className="mt-2 space-y-2 list-disc list-inside text-sm text-slate-700">
                             {meaning.definitions?.slice(0, 2).map((def: any, j: number) => (
                               <li key={j}>{def.definition}</li>
                             ))}
                           </ul>
                        </div>
                      ))}
                   </div>
                ) : (
                  <div className="text-sm text-slate-400 italic">No extra details found in dictionary.</div>
                )}
             </div>
          </div>
        </div>
      )}

      {/* FLASHCARD MODAL */}
      {isFlashcardMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg relative">
            <button 
              onClick={() => setIsFlashcardMode(false)}
              className="absolute -top-12 right-0 text-white hover:text-slate-300 transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            
            {!isRoundSummary ? (
              // CARD VIEW
              <div 
                 className={`bg-white rounded-2xl shadow-2xl overflow-hidden min-h-[600px] flex flex-col relative transition-all duration-300 
                  ${feedbackState === 'correct' ? 'ring-4 ring-green-400 bg-green-50' : ''} 
                  ${feedbackState === 'wrong' ? 'ring-4 ring-red-400 bg-red-50' : ''}`}
              >
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center text-sm text-slate-500 font-medium">
                  <div className="flex items-center gap-2">
                     <span>{lesson.vocabularyTitle}</span>
                     {/* Flashcard Reverse Mode Toggle */}
                     <button 
                       onClick={() => { setReverseFlashcards(!reverseFlashcards); setIsCardFlipped(false); }}
                       className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border font-bold transition-colors ${reverseFlashcards ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-300 text-slate-600'}`}
                       title={reverseFlashcards ? "Current: Show Chinese First" : "Current: Show English First"}
                     >
                       <ArrowRightLeft className="w-3 h-3"/>
                       {reverseFlashcards ? "CN ➔ EN+Img" : "EN+Img ➔ CN"}
                     </button>
                  </div>
                  <span>{currentQueueIndex + 1} / {queue.length}</span>
                </div>
                
                <div 
                  className="flex-1 flex flex-col items-center justify-center p-6 cursor-pointer text-center hover:bg-slate-50/50 transition-colors select-none"
                  onClick={() => setIsCardFlipped(!isCardFlipped)}
                >
                  {!isCardFlipped ? (
                    // --- FRONT SIDE ---
                    <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center justify-center h-full w-full">
                       
                       {reverseFlashcards ? (
                          // Reverse Front: Chinese Only
                          <div className="flex flex-col items-center w-full justify-center h-full">
                             <h2 className="text-3xl font-bold text-slate-800 mb-6">{activeCard.definition}</h2>
                          </div>
                       ) : (
                          // Normal Front: English Word + Images
                          <div className="flex flex-col items-center justify-between h-full py-4">
                            <div>
                                <h2 className="text-4xl font-bold text-slate-800 mb-2">{activeCard.word}</h2>
                                {activeCard.ipa && (
                                <span className="text-lg text-slate-400 font-mono mb-4 block">{activeCard.ipa}</span>
                                )}
                            </div>
                            
                            <WordImages word={activeCard.word} />
                            
                            <p className="text-slate-400 text-sm mt-4">(Tap to flip)</p>
                          </div>
                       )}
                       
                       {reverseFlashcards && <p className="text-slate-400 text-sm mt-auto">(Tap to flip)</p>}
                    </div>
                  ) : (
                    // --- BACK SIDE ---
                    <div className="animate-in fade-in zoom-in duration-300 flex flex-col h-full w-full justify-between">
                      <div className="text-center w-full pt-4">
                        
                        {reverseFlashcards ? (
                           // Reverse Back: English Word + IPA + Images
                           <div className="flex flex-col items-center">
                             <h3 className="text-3xl font-bold text-blue-600 mb-2">{activeCard.word}</h3>
                             <p className="text-lg text-slate-500 font-mono mb-4">{activeCard.ipa}</p>
                             <WordImages word={activeCard.word} />
                           </div>
                        ) : (
                           // Normal Back: Chinese
                           <div className="flex flex-col items-center justify-center h-48">
                             <h3 className="text-2xl font-bold text-blue-600 mb-2">{activeCard.word}</h3>
                             <p className="text-2xl text-slate-800 font-bold mb-4">{activeCard.definition}</p>
                           </div>
                        )}
                        
                      </div>

                      <div className="mt-auto w-full">
                        <p className="text-slate-600 italic border-t pt-4 border-slate-100 text-center mb-2 px-4">
                            "{activeCard.example}"
                        </p>
                        <FlashcardImageLink />
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Controls */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 grid grid-cols-3 gap-6">
                  <Button 
                    variant="secondary" 
                    onClick={() => handleCardResult(false)}
                    className="flex flex-col h-auto py-3 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                  >
                    <X className="w-6 h-6 mb-1" />
                    <span className="text-xs">Forgot</span>
                  </Button>
                  
                  <div className="flex justify-center gap-2 items-center">
                     <Button 
                        variant="secondary" 
                        onClick={() => speakWordAndExample(activeCard.word, activeCard.example)} 
                        className="rounded-full w-14 h-14 p-0 flex items-center justify-center shadow-sm bg-white border-blue-100 text-blue-600 hover:bg-blue-50"
                     >
                        <Volume2 className="w-6 h-6" />
                     </Button>
                  </div>

                  <Button 
                    variant="secondary" 
                    onClick={() => handleCardResult(true)}
                    className="flex flex-col h-auto py-3 border-green-200 text-green-600 hover:bg-green-50 hover:border-green-300"
                  >
                    <Check className="w-6 h-6 mb-1" />
                    <span className="text-xs">Known</span>
                  </Button>
                </div>
              </div>
            ) : (
              // SUMMARY VIEW
              <div className="bg-white rounded-2xl shadow-2xl overflow-hidden min-h-[450px] flex flex-col items-center justify-center p-8 text-center">
                {nextRoundQueue.length > 0 ? (
                  <>
                    <div className="w-16 h-16 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mb-6">
                      <RefreshCw className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Round Complete!</h2>
                    <p className="text-slate-500 mb-8">You have <span className="font-bold text-orange-600">{nextRoundQueue.length}</span> words to review.</p>
                    <Button onClick={startNextRound} className="w-full max-w-xs py-3 text-lg">
                      Start Next Round
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                      <Sparkles className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">All Words Mastered!</h2>
                    <p className="text-slate-500 mb-8">Great job! You've successfully reviewed all vocabulary.</p>
                    <Button onClick={() => setIsFlashcardMode(false)} variant="secondary" className="w-full max-w-xs py-3 text-lg">
                      Finish Review
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};