import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bot, Save, FileAudio, Image as ImageIcon, X, Sparkles, BookOpen, Mic, FileText, Link as LinkIcon, UploadCloud } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { parseContentWithGemini } from '../services/gemini';
import { dbService } from '../services/db';
import { DailyLesson, VocabularyItem } from '../types';

export const CreateLesson: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>(); // For Edit Mode
  const [loadingVocab, setLoadingVocab] = useState(false);
  
  // Tabs
  const [activeVocabTab, setActiveVocabTab] = useState<'text' | 'image' | 'document' | 'link'>('text');

  // Drag States
  const [isDraggingVocab, setIsDraggingVocab] = useState(false);

  // --- Module 1: Vocabulary State ---
  const [vocabTitle, setVocabTitle] = useState('');
  const [vocabRawText, setVocabRawText] = useState('');
  const [vocabUrl, setVocabUrl] = useState('');
  const [vocabFile, setVocabFile] = useState<string | null>(null);
  const [vocabMimeType, setVocabMimeType] = useState('image/jpeg');
  const [vocabFileName, setVocabFileName] = useState('');
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  
  const vocabImageInputRef = useRef<HTMLInputElement>(null);
  const vocabDocInputRef = useRef<HTMLInputElement>(null);

  // --- Module 2: Story Content State (Simplified) ---
  const [storyTitle, setStoryTitle] = useState('');
  const [storyContent, setStoryContent] = useState(''); // Supports Markdown

  // --- Module 3: Audio State ---
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [existingAudioBlob, setExistingAudioBlob] = useState<Blob | undefined>(undefined);
  const [existingAudioUrl, setExistingAudioUrl] = useState<string | undefined>(undefined);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Metadata
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [cloudObjectId, setCloudObjectId] = useState<string | undefined>(undefined);

  // --- Edit Mode Initialization ---
  useEffect(() => {
    if (id) {
      const loadLesson = async () => {
        const lesson = await dbService.getLessonById(id);
        if (lesson) {
          setDate(lesson.date);
          setVocabTitle(lesson.vocabularyTitle);
          setVocabulary(lesson.vocabulary);
          setStoryTitle(lesson.story.title);
          setStoryContent(lesson.story.content);
          setExistingAudioBlob(lesson.audioBlob);
          setExistingAudioUrl(lesson.audioUrl);
          setCloudObjectId(lesson._objectId);
        }
      };
      loadLesson();
    }
  }, [id]);

  // --- Helpers ---
  const processFile = (file: File, target: 'vocab', mimePrefix: 'image' | 'application') => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setVocabFile(result);
      setVocabFileName(file.name);
      setVocabMimeType(file.type || (mimePrefix === 'application' ? 'application/pdf' : 'image/jpeg'));
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>, 
    target: 'vocab',
    mimePrefix: 'image' | 'application'
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file, target, mimePrefix);
    }
  };

  // --- Drag & Drop Handlers ---
  const handleDragOver = (e: React.DragEvent, setDragging: (val: boolean) => void) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent, setDragging: (val: boolean) => void) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  };

  const handleDrop = (
    e: React.DragEvent, 
    setDragging: (val: boolean) => void,
    target: 'vocab',
    mimePrefix: 'image' | 'application'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      // Basic validation based on tab
      if (activeVocabTab === 'image' && !file.type.startsWith('image/')) return;
      if (activeVocabTab === 'document' && file.type !== 'application/pdf') return;
      
      processFile(file, target, mimePrefix);
    }
  };


  // --- Process Vocab ---
  const handleProcessVocabAI = async () => {
    let hasContent = false;
    if (activeVocabTab === 'text' && vocabRawText.trim()) hasContent = true;
    if (activeVocabTab === 'link' && vocabUrl.trim()) hasContent = true;
    if ((activeVocabTab === 'image' || activeVocabTab === 'document') && vocabFile) hasContent = true;

    if (!hasContent) {
      alert("Please provide content in Module 1 to extract vocabulary.");
      return;
    }

    setLoadingVocab(true);
    try {
      let textToProcess = vocabRawText;
      let fileToProcess = vocabFile || undefined;
      
      if (activeVocabTab === 'link') {
        textToProcess = `Analyze content from this URL: ${vocabUrl}`;
      }

      const result = await parseContentWithGemini(
        textToProcess, 
        fileToProcess, 
        vocabMimeType
      );
      setVocabulary(result.vocabulary);
      
      if (!vocabTitle) {
         if (activeVocabTab === 'document' && vocabFileName) {
           setVocabTitle(`Vocab from ${vocabFileName}`);
         } else if (activeVocabTab === 'link') {
            setVocabTitle(`Vocab from Link`);
         } else {
            setVocabTitle(`Daily Words ${date}`);
         }
      }

    } catch (error) {
      console.error(error);
      alert("Failed to process content. Please check your API key.");
    } finally {
      setLoadingVocab(false);
    }
  };

  // --- Save ---
  const handleSave = async () => {
    if (!storyTitle) {
      alert("Please enter a Story Title in Module 2.");
      return;
    }

    const finalVocabTitle = vocabTitle || "Untitled Vocabulary";
    // Prioritize new file, then existing blob (if no new file), existing URL is handled by persistence layer if no new blob is passed
    const finalAudioBlob = audioFile || existingAudioBlob;

    const newLesson: DailyLesson = {
      id: id || crypto.randomUUID(), 
      _objectId: cloudObjectId, // Pass existing cloud ID if editing
      date,
      vocabularyTitle: finalVocabTitle,
      vocabulary,
      story: {
        title: storyTitle,
        content: storyContent, 
      },
      audioBlob: finalAudioBlob,
      audioUrl: existingAudioUrl, // Pass through existing URL so it's not lost if we don't upload new audio
      createdAt: id ? Date.now() : Date.now() // Note: DBService handles keeping original createdAt if editing
    };

    try {
      await dbService.saveLesson(newLesson);
      navigate('/');
    } catch (e) {
      console.error(e);
      alert("Failed to save lesson to cloud database.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-24">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{id ? 'Edit Lesson' : 'Create Daily Lesson'}</h1>
          <p className="text-slate-500 mt-1">Build your study set with AI assistance.</p>
        </div>
        <div className="w-full md:w-auto">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Lesson Date</label>
          <input 
            type="date" 
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full md:w-48 p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
          />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: INPUT MODULES (Span 7) */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* MODULE 1: VOCABULARY */}
          <Card className="p-6 border-t-4 border-t-blue-500 relative">
            <div className="absolute top-0 right-0 p-2 bg-blue-50 text-blue-600 rounded-bl-xl text-xs font-bold flex items-center">
              <Sparkles className="w-3 h-3 mr-1" />
              AI Vocab
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
              <span className="bg-blue-100 text-blue-700 w-8 h-8 flex items-center justify-center rounded-full mr-3 text-sm">1</span>
              Vocabulary Extraction
            </h2>
            
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Vocabulary Set Title</label>
              <input 
                type="text" 
                value={vocabTitle} 
                onChange={(e) => setVocabTitle(e.target.value)}
                placeholder="e.g. Daily Words"
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-sm"
              />
            </div>

            {/* Vocab Tabs */}
            <div className="flex space-x-4 mb-4 border-b border-slate-200 overflow-x-auto">
              {['text', 'image', 'document', 'link'].map((tab) => (
                <button 
                  key={tab}
                  onClick={() => setActiveVocabTab(tab as any)}
                  className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap capitalize ${activeVocabTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="min-h-[160px]">
              {activeVocabTab === 'text' && (
                <textarea 
                  className="w-full h-40 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm font-mono"
                  placeholder="Paste text here..."
                  value={vocabRawText}
                  onChange={(e) => setVocabRawText(e.target.value)}
                />
              )}
              {activeVocabTab === 'image' && (
                <div 
                  className={`w-full h-40 border-2 border-dashed rounded-lg flex flex-col items-center justify-center bg-slate-50 cursor-pointer transition-colors ${isDraggingVocab ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-300 hover:bg-slate-100'}`}
                  onClick={() => vocabImageInputRef.current?.click()}
                  onDragOver={(e) => handleDragOver(e, setIsDraggingVocab)}
                  onDragLeave={(e) => handleDragLeave(e, setIsDraggingVocab)}
                  onDrop={(e) => handleDrop(e, setIsDraggingVocab, 'vocab', 'image')}
                >
                  {vocabFile && vocabMimeType.startsWith('image') ? (
                    <div className="relative h-full w-full p-2 flex justify-center group">
                        <img src={vocabFile} alt="Preview" className="h-full object-contain" />
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <p className="text-white font-bold opacity-0 group-hover:opacity-100 bg-black/50 px-3 py-1 rounded-full">Change Image</p>
                        </div>
                        <button onClick={(e) => {e.stopPropagation(); setVocabFile(null)}} className="absolute top-2 right-2 bg-white p-1 rounded-full hover:bg-red-50 hover:text-red-500"><X className="w-4 h-4"/></button>
                    </div>
                  ) : (
                    <div className="text-center text-slate-400 p-4">
                      {isDraggingVocab ? (
                        <div className="text-blue-500 animate-pulse">
                          <UploadCloud className="w-10 h-10 mx-auto mb-2"/>
                          <span className="text-sm font-bold">Drop Image Here</span>
                        </div>
                      ) : (
                        <>
                          <ImageIcon className="w-8 h-8 mx-auto mb-2"/>
                          <span className="text-sm font-medium block">Click to Upload or Drag Image Here</span>
                        </>
                      )}
                    </div>
                  )}
                  <input type="file" accept="image/*" ref={vocabImageInputRef} className="hidden" onChange={(e) => handleFileUpload(e, 'vocab', 'image')} />
                </div>
              )}
              {activeVocabTab === 'document' && (
                <div 
                  className={`w-full h-40 border-2 border-dashed rounded-lg flex flex-col items-center justify-center bg-slate-50 cursor-pointer transition-colors ${isDraggingVocab ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-300 hover:bg-slate-100'}`}
                  onClick={() => vocabDocInputRef.current?.click()}
                  onDragOver={(e) => handleDragOver(e, setIsDraggingVocab)}
                  onDragLeave={(e) => handleDragLeave(e, setIsDraggingVocab)}
                  onDrop={(e) => handleDrop(e, setIsDraggingVocab, 'vocab', 'application')}
                >
                   {vocabFile && vocabMimeType === 'application/pdf' ? (
                     <div className="text-center"><FileText className="w-8 h-8 mx-auto text-red-500"/><span className="text-xs font-bold">{vocabFileName}</span></div>
                   ) : (
                    <div className="text-center text-slate-400 p-4">
                      {isDraggingVocab ? (
                        <div className="text-blue-500 animate-pulse">
                          <UploadCloud className="w-10 h-10 mx-auto mb-2"/>
                          <span className="text-sm font-bold">Drop PDF Here</span>
                        </div>
                      ) : (
                        <>
                          <FileText className="w-8 h-8 mx-auto mb-2"/>
                          <span className="text-sm font-medium block">Click or Drag & Drop PDF</span>
                        </>
                      )}
                    </div>
                   )}
                   <input type="file" accept="application/pdf" ref={vocabDocInputRef} className="hidden" onChange={(e) => handleFileUpload(e, 'vocab', 'application')} />
                </div>
              )}
              {activeVocabTab === 'link' && (
                <div className="w-full h-40 flex flex-col justify-center">
                   <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden">
                     <div className="bg-slate-50 px-3 py-2 border-r"><LinkIcon className="w-5 h-5 text-slate-400" /></div>
                     <input type="url" value={vocabUrl} onChange={(e) => setVocabUrl(e.target.value)} placeholder="https://..." className="flex-1 p-2 outline-none text-sm"/>
                   </div>
                </div>
              )}
            </div>
            
            <div className="mt-4 flex justify-end">
              <Button onClick={handleProcessVocabAI} isLoading={loadingVocab} disabled={loadingVocab}>
                <Bot className="w-4 h-4 mr-2" /> Extract Vocab
              </Button>
            </div>
          </Card>

          {/* MODULE 2: STORY & CONTENT (SIMPLIFIED) */}
          <Card className="p-6 border-t-4 border-t-indigo-500 relative">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
              <span className="bg-indigo-100 text-indigo-700 w-8 h-8 flex items-center justify-center rounded-full mr-3 text-sm">2</span>
              Story Content
            </h2>
            
            <div className="space-y-4">
               <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Story Title</label>
                <input type="text" value={storyTitle} onChange={(e) => setStoryTitle(e.target.value)} placeholder="Story Title" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-semibold"/>
              </div>

               {/* Manual Input Area Only */}
               <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Story Text (Paste here)</label>
                  <textarea 
                    value={storyContent}
                    onChange={(e) => setStoryContent(e.target.value)}
                    className="w-full h-64 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm leading-relaxed font-serif"
                    placeholder="Paste your story text here. Use **double asterisks** to bold important words."
                  />
               </div>
            </div>
          </Card>

           {/* MODULE 3: AUDIO */}
           <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                <label className="block text-xs font-bold text-slate-800 uppercase mb-2 flex items-center">
                  <Mic className="w-3 h-3 mr-1" />
                  Module 3: Audio Track
                </label>
                <div className="flex items-center space-x-3">
                  <input 
                    type="file" 
                    accept=".mp3,.wav,.flac,audio/mp3,audio/wav,audio/flac"
                    ref={audioInputRef}
                    className="hidden"
                    onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                  />
                  <Button variant="secondary" onClick={() => audioInputRef.current?.click()} className="flex-1 bg-white">
                    <FileAudio className="w-4 h-4 mr-2" />
                    {audioFile ? audioFile.name : (existingAudioBlob || existingAudioUrl ? "Keep Existing Audio" : "Upload Audio (.mp3/.wav/.flac)")}
                  </Button>
                  {(audioFile || existingAudioBlob || existingAudioUrl) && (
                    <button onClick={() => { setAudioFile(null); setExistingAudioBlob(undefined); setExistingAudioUrl(undefined); }} className="text-slate-400 hover:text-red-500">
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
            </div>
        </div>

        {/* RIGHT COLUMN: VOCABULARY RESULT */}
        <div className="lg:col-span-5">
           <Card className="p-6 h-full min-h-[500px] flex flex-col border-t-4 border-t-emerald-500 sticky top-24">
             <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center justify-between">
               <span className="flex items-center"><BookOpen className="w-5 h-5 mr-2 text-emerald-600" />Vocabulary List</span>
               <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{vocabulary.length} words</span>
             </h2>

             {vocabulary.length === 0 ? (
               <div className="flex-1 flex flex-col justify-center items-center text-slate-400 text-center p-8 border-2 border-dashed border-slate-100 rounded-lg">
                 <Sparkles className="w-12 h-12 mb-3 text-slate-300" />
                 <p className="text-sm">Run Module 1 to generate words.</p>
               </div>
             ) : (
               <div className="flex-1 overflow-y-auto pr-2 space-y-4 max-h-[calc(100vh-350px)]">
                 {vocabulary.map((item, idx) => (
                   <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                     <div className="flex gap-2 mb-2">
                        <input value={item.word} onChange={(e) => {const n=[...vocabulary];n[idx].word=e.target.value;setVocabulary(n)}} className="font-bold text-blue-700 bg-transparent border-b border-transparent focus:border-blue-300 outline-none w-1/3 text-base" />
                        <input value={item.ipa||''} onChange={(e) => {const n=[...vocabulary];n[idx].ipa=e.target.value;setVocabulary(n)}} className="text-slate-400 bg-transparent border-b border-transparent focus:border-blue-300 outline-none w-1/4 text-sm font-mono" placeholder="/ipa/" />
                        <input value={item.definition} onChange={(e) => {const n=[...vocabulary];n[idx].definition=e.target.value;setVocabulary(n)}} className="text-slate-600 bg-transparent border-b border-transparent focus:border-blue-300 outline-none w-1/3 text-right text-sm" />
                     </div>
                     <textarea value={item.example} onChange={(e) => {const n=[...vocabulary];n[idx].example=e.target.value;setVocabulary(n)}} className="w-full bg-transparent text-slate-500 text-xs italic resize-none outline-none border-b border-transparent focus:border-blue-300" rows={2}/>
                     <button onClick={() => setVocabulary(vocabulary.filter((_, i) => i !== idx))} className="text-xs text-red-300 hover:text-red-500 mt-2">Remove</button>
                   </div>
                 ))}
               </div>
             )}
             <button onClick={() => setVocabulary([...vocabulary, { word: 'New Word', ipa: '', definition: '', example: '' }])} className="mt-4 w-full py-2 border border-dashed border-blue-300 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50">+ Add Word</button>
           </Card>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-slate-200 flex justify-end items-center gap-4 z-50 shadow-lg">
        <Button variant="secondary" onClick={() => navigate('/')}>Cancel</Button>
        <Button onClick={handleSave} disabled={!storyTitle}>
          <Save className="w-4 h-4 mr-2" />
          {id ? 'Update Lesson' : 'Save to Library'}
        </Button>
      </div>
    </div>
  );
};