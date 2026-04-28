import React from "react";
import { Plus, Trash2, BookOpen, PenTool, LayoutTemplate, Hash, BarChart } from "lucide-react";

interface Book {
  id: string;
  title: string;
  genre: string;
  audience: string;
  chaptersCompleted: number;
  chaptersTotal: number;
  wordCount: number;
  progress: number;
}

const BOOKS: Book[] = [
  {
    id: "1",
    title: "The Stoic Legionnaire's Guide to AI",
    genre: "Self-Help",
    audience: "Tech professionals seeking mental resilience",
    chaptersCompleted: 1,
    chaptersTotal: 12,
    wordCount: 2518,
    progress: 8,
  },
  {
    id: "2",
    title: "The Crystal Throne",
    genre: "Fantasy",
    audience: "Young adult high fantasy readers",
    chaptersCompleted: 2,
    chaptersTotal: 2,
    wordCount: 3325,
    progress: 100,
  },
  {
    id: "3",
    title: "Echoes of Tomorrow",
    genre: "Science Fiction",
    audience: "Hard sci-fi fans who love time dilation",
    chaptersCompleted: 0,
    chaptersTotal: 2,
    wordCount: 0,
    progress: 0,
  },
  {
    id: "4",
    title: "The Iron Sea",
    genre: "Fantasy",
    audience: "Epic fantasy readers",
    chaptersCompleted: 0,
    chaptersTotal: 2,
    wordCount: 0,
    progress: 0,
  },
  {
    id: "5",
    title: "The Glass Mountain",
    genre: "Literary Fiction",
    audience: "Contemporary fiction readers",
    chaptersCompleted: 1,
    chaptersTotal: 2,
    wordCount: 20,
    progress: 50,
  },
];

export function Command() {
  return (
    <div className="min-h-screen bg-[#0a0a0e] text-slate-300 font-sans selection:bg-[#00D9C0] selection:text-[#0a0a0e] p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-800/60 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full bg-[#00D9C0] animate-pulse"></div>
              <h2 className="text-xs font-mono tracking-[0.2em] text-[#00D9C0] uppercase">System Dashboard</h2>
            </div>
            <h1 className="text-3xl font-medium text-slate-100 tracking-tight">Your Manuscripts</h1>
            <p className="text-sm text-slate-500 mt-1 max-w-xl">
              Active directory of all generated works, word counts, and structural progress.
            </p>
          </div>
          
          <button className="group relative flex items-center justify-center gap-2 px-5 py-2.5 bg-transparent border border-[#00D9C0]/40 text-[#00D9C0] text-sm font-medium hover:bg-[#00D9C0]/10 transition-colors focus:outline-none focus:ring-1 focus:ring-[#00D9C0]">
            <div className="absolute inset-0 bg-[#00D9C0]/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Plus className="w-4 h-4" />
            <span>New Book Project</span>
          </button>
        </header>

        {/* Grid Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {BOOKS.map((book) => (
            <div 
              key={book.id} 
              className="group relative flex flex-col bg-[#111116] border border-slate-800 hover:border-[#00D9C0]/30 transition-colors overflow-hidden"
            >
              {/* Delete Action (Hover) */}
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button 
                  className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  aria-label="Delete project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Card Header */}
              <div className="p-5 pb-4 border-b border-slate-800/50">
                <div className="text-[10px] font-mono tracking-widest text-[#00D9C0] uppercase mb-3">
                  {book.genre}
                </div>
                <h3 className="text-lg font-medium text-slate-100 leading-tight mb-2 pr-8">
                  {book.title}
                </h3>
                <div className="flex items-start gap-2 text-xs text-slate-500">
                  <LayoutTemplate className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-60" />
                  <span className="line-clamp-2 leading-relaxed">{book.audience}</span>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-2 divide-x divide-slate-800/50 border-b border-slate-800/50 bg-[#0a0a0e]/50">
                <div className="p-4 flex flex-col gap-1">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Chapters</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-medium text-slate-200">{book.chaptersCompleted}</span>
                    <span className="text-xs text-slate-600">/ {book.chaptersTotal}</span>
                  </div>
                </div>
                <div className="p-4 flex flex-col gap-1">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Words</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-medium text-slate-200">{book.wordCount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Progress Footer */}
              <div className="p-5 mt-auto bg-[#111116]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Overall Progress</span>
                  <span className="text-xs font-mono font-medium text-[#00D9C0]">{book.progress}%</span>
                </div>
                <div className="h-1 w-full bg-slate-800/50 overflow-hidden">
                  <div 
                    className="h-full bg-[#00D9C0] transition-all duration-1000 ease-out"
                    style={{ width: `${book.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
