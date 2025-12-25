import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, Layers, Trash2, Headphones, GripVertical, AlertTriangle, X } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { dbService } from '../services/db';
import { DailyLesson } from '../types';
import { AdminContext } from '../App';

// --- Delete Confirmation Modal Component ---
interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
}

const DeleteConfirmModal: React.FC<DeleteModalProps> = ({ isOpen, onClose, onConfirm, title }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-600 mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Delete Lesson?</h3>
            <p className="text-sm text-slate-500 mt-1 line-clamp-2">
              Are you sure you want to delete <span className="font-bold text-slate-700">"{title}"</span>? This action cannot be undone.
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl text-slate-500 font-bold hover:bg-slate-50 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 active:scale-95 transition-all shadow-lg shadow-red-600/20 text-sm"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const LessonList: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin } = useContext(AdminContext);
  const [lessons, setLessons] = useState<DailyLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // --- Modal State ---
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null; title: string }>({
    isOpen: false,
    id: null,
    title: ''
  });

  useEffect(() => {
    loadLessons();
  }, []);

  const loadLessons = async () => {
    try {
      const data = await dbService.getAllLessons();
      setLessons(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openDeleteModal = (e: React.MouseEvent, lesson: DailyLesson) => {
    e.stopPropagation(); // Prevent navigation
    setDeleteModal({
      isOpen: true,
      id: lesson.id,
      title: lesson.vocabularyTitle || lesson.story.title || 'this lesson'
    });
  };

  const handleConfirmDelete = async () => {
    if (deleteModal.id) {
      setLoading(true);
      try {
        await dbService.deleteLesson(deleteModal.id);
        await loadLessons();
      } catch (e) {
        console.error(e);
      } finally {
        setDeleteModal({ isOpen: false, id: null, title: '' });
        setLoading(false);
      }
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return {
      day: d.getDate(),
      month: d.toLocaleString('default', { month: 'short' }).toUpperCase(),
      year: d.getFullYear()
    };
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (!isAdmin) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (!isAdmin || draggedIndex === null || draggedIndex === index) return;

    const newLessons = [...lessons];
    const draggedItem = newLessons[draggedIndex];
    newLessons.splice(draggedIndex, 1);
    newLessons.splice(index, 0, draggedItem);
    
    setDraggedIndex(index);
    setLessons(newLessons);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setDraggedIndex(null);

    const updatedLessons = lessons.map((lesson, index) => ({
      ...lesson,
      order: index
    }));
    
    setLessons(updatedLessons);
    await dbService.saveLessonsOrder(updatedLessons);
  };

  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Library</h1>
          <p className="text-slate-500 mt-1">Review your daily English progress.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => navigate('/create')}>
            <Plus className="w-5 h-5 mr-2" />
            New Daily Content
          </Button>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
        {isAdmin && (
          <div 
            onClick={() => navigate('/create')}
            className="bg-white rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[140px] text-slate-400 hover:text-blue-500 group"
          >
             <div className="bg-slate-100 group-hover:bg-blue-200 p-3 rounded-full mb-2 transition-colors">
                <Plus className="w-6 h-6" />
             </div>
             <span className="font-semibold">Create New Card</span>
          </div>
        )}

        {lessons.length === 0 && !isAdmin && (
           <div className="col-span-2 text-center py-20 text-slate-400">
              No lessons available. Please log in as admin to add content.
           </div>
        )}

        {lessons.map((lesson, index) => {
          const dateObj = formatDate(lesson.date);
          return (
            <div 
              key={lesson.id}
              draggable={isAdmin}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={handleDrop}
              onClick={() => navigate(`/lesson/${lesson.id}`)}
              className={`
                  bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden 
                  hover:shadow-md transition-all group relative flex flex-row min-h-[140px]
                  ${draggedIndex === index ? 'opacity-50 border-blue-400 border-dashed' : ''}
                  ${!isAdmin ? 'cursor-pointer' : 'cursor-move'} 
              `}
            >
              {isAdmin && (
                <div className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center cursor-move text-slate-300 hover:text-slate-500 hover:bg-slate-50 z-20"
                      onClick={(e) => e.stopPropagation()}
                >
                    <GripVertical className="w-4 h-4" />
                </div>
              )}

              <div className={`w-24 ${isAdmin ? 'ml-4' : 'ml-0'} bg-blue-50 flex flex-col items-center justify-center border-r border-blue-100 p-2 text-blue-600 flex-shrink-0 transition-all`}>
                <span className="text-xs font-bold tracking-wider opacity-80">{dateObj.month}</span>
                <span className="text-3xl font-black">{dateObj.day}</span>
                <span className="text-xs opacity-60">{dateObj.year}</span>
              </div>

              <div className="flex-1 p-5 flex flex-col justify-center min-w-0 pr-12 relative">
                {isAdmin && (
                  <button 
                    onClick={(e) => openDeleteModal(e, lesson)}
                    className="absolute top-4 right-4 p-2 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors shadow-sm z-30"
                    title="Delete Lesson"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                <h3 className="text-lg font-bold text-slate-900 mb-2 leading-tight line-clamp-2 pr-6" title={lesson.vocabularyTitle}>
                  {lesson.vocabularyTitle || "Vocabulary Set"}
                </h3>
                
                <div className="flex items-center text-slate-500 text-sm mb-4">
                  <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded mr-2 flex-shrink-0 font-medium">Story</span>
                  <span className="truncate max-w-[200px]">{lesson.story.title || "Untitled Story"}</span>
                </div>
                
                <div className="flex items-center gap-4 text-xs text-slate-400 mt-auto pt-2 border-t border-slate-50">
                  <div className="flex items-center">
                    <Layers className="w-3.5 h-3.5 mr-1" />
                    {lesson.vocabulary.length} Words
                  </div>
                  {(lesson.audioBlob || lesson.audioUrl) && (
                    <div className="flex items-center text-blue-500 font-medium">
                      <Headphones className="w-3.5 h-3.5 mr-1" />
                      Audio
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <DeleteConfirmModal 
        isOpen={deleteModal.isOpen}
        title={deleteModal.title}
        onClose={() => setDeleteModal({ isOpen: false, id: null, title: '' })}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};