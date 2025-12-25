import React, { useState, useContext, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { LessonList } from './views/LessonList';
import { CreateLesson } from './views/CreateLesson';
import { LessonDetail } from './views/LessonDetail';
import { BookOpen, Lock, Unlock } from 'lucide-react';

// --- Context ---
interface AdminContextType {
  isAdmin: boolean;
  toggleLogin: () => void;
}

export const AdminContext = React.createContext<AdminContextType>({
  isAdmin: false,
  toggleLogin: () => {},
});

// --- Login Modal Component ---
interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setInput('');
      setError('');
      // Small timeout to allow render transition
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === '123456') {
      onSuccess();
      onClose();
    } else {
      setError('Password Incorrect');
      setInput(''); // Clear input on error
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Admin Login</h3>
            <p className="text-sm text-slate-500 mt-1">Enter password to manage content</p>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <input
                ref={inputRef}
                type="password"
                value={input}
                onChange={(e) => { setInput(e.target.value); setError(''); }}
                placeholder="Enter Password"
                className={`w-full px-4 py-3 rounded-xl border ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20'} focus:ring-4 outline-none transition-all text-slate-800 placeholder:text-slate-400 font-medium text-center tracking-widest`}
              />
              {error && (
                <p className="text-red-500 text-xs mt-2 font-bold text-center animate-pulse">
                  {error}
                </p>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-xl text-slate-500 font-bold hover:bg-slate-50 hover:text-slate-700 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-600/20 text-sm"
              >
                Confirm
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// --- Layout ---
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin, toggleLogin } = useContext(AdminContext);

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center cursor-pointer" onClick={() => window.location.hash = '#'}>
              <div className="bg-blue-600 p-2 rounded-lg mr-3">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <span className="font-bold text-xl text-slate-900">EnglishFlow</span>
            </div>
          </div>
        </div>
      </nav>
      <main className="flex-grow bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
      <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center justify-center gap-2">
          <div className="text-center text-slate-400 text-sm">
            &copy; {new Date().getFullYear()} Daily English Flow. Local-first learning.
          </div>
          <button 
            onClick={toggleLogin} 
            className={`text-xs flex items-center gap-1 transition-colors px-3 py-1 rounded-full ${isAdmin ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-slate-300 hover:text-blue-500 hover:bg-blue-50'}`}
          >
            {isAdmin ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
            {isAdmin ? 'Exit Admin Mode' : 'Admin Login'}
          </button>
        </div>
      </footer>
    </div>
  );
};

// --- Main App ---
function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('isAdmin');
    if (stored === 'true') {
      setIsAdmin(true);
    }
  }, []);

  const toggleLogin = () => {
    if (isAdmin) {
      // Logout logic
      setIsAdmin(false);
      localStorage.removeItem('isAdmin');
    } else {
      // Open Login Modal instead of prompt
      setIsModalOpen(true);
    }
  };

  const handleLoginSuccess = () => {
    setIsAdmin(true);
    localStorage.setItem('isAdmin', 'true');
  };

  return (
    <AdminContext.Provider value={{ isAdmin, toggleLogin }}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<LessonList />} />
            <Route path="/create" element={<CreateLesson />} />
            <Route path="/edit/:id" element={<CreateLesson />} />
            <Route path="/lesson/:id" element={<LessonDetail />} />
          </Routes>
        </Layout>
        
        {/* Render Modal at App Level so it overlays everything */}
        <LoginModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={handleLoginSuccess}
        />
      </Router>
    </AdminContext.Provider>
  );
}

export default App;