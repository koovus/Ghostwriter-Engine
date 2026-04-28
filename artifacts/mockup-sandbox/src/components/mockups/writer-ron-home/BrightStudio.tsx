import React, { useState } from 'react';
import { Plus, Trash2, BookOpen, Clock, FileText } from 'lucide-react';

const MOCK_BOOKS = [
  {
    id: 1,
    title: "The Stoic Legionnaire's Guide to AI",
    genre: "Self-Help",
    audience: "For professionals navigating modern challenges",
    chaptersDone: 1,
    chaptersTotal: 12,
    words: "2,518",
    progress: 8,
  },
  {
    id: 2,
    title: "The Crystal Throne",
    genre: "Fantasy",
    audience: "Young adult epic fantasy readers",
    chaptersDone: 2,
    chaptersTotal: 2,
    words: "3,325",
    progress: 100,
  },
  {
    id: 3,
    title: "Echoes of Tomorrow",
    genre: "Science Fiction",
    audience: "Fans of hard sci-fi and cyberpunk",
    chaptersDone: 0,
    chaptersTotal: 2,
    words: "0",
    progress: 0,
  },
  {
    id: 4,
    title: "The Iron Sea",
    genre: "Fantasy",
    audience: "Adult dark fantasy readers",
    chaptersDone: 0,
    chaptersTotal: 2,
    words: "0",
    progress: 0,
  },
  {
    id: 5,
    title: "The Glass Mountain",
    genre: "Literary Fiction",
    audience: "Readers of contemporary literary fiction",
    chaptersDone: 1,
    chaptersTotal: 2,
    words: "20",
    progress: 50,
  }
];

export function BrightStudio() {
  const [books, setBooks] = useState(MOCK_BOOKS);

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    setBooks(books.filter(b => b.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#F8F8F5] text-slate-900 font-['Inter',sans-serif] p-8 md:p-16">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900 mb-2">
              Your Manuscripts
            </h1>
            <p className="text-slate-500 text-lg">
              Pick up where you left off.
            </p>
          </div>
          <button className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 bg-indigo-600 text-white hover:bg-indigo-700 h-11 px-6 shadow-sm">
            <Plus className="mr-2 h-4 w-4" />
            New Book Project
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {books.map((book) => (
            <div
              key={book.id}
              className="group relative flex flex-col bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 border border-slate-100 overflow-hidden cursor-pointer"
            >
              <div className="p-6 md:p-8 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                    {book.genre}
                  </span>
                  <button
                    onClick={(e) => handleDelete(e, book.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                    aria-label="Delete book"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <h2 className="text-2xl font-semibold text-slate-900 leading-tight mb-2">
                  {book.title}
                </h2>
                
                <p className="text-sm text-slate-500 mb-8 flex-1">
                  {book.audience}
                </p>

                <div className="space-y-4 mt-auto">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="h-4 w-4 text-slate-400" />
                      <span>{book.chaptersDone} / {book.chaptersTotal} chapters</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-slate-400" />
                      <span>{book.words} words</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-500">Progress</span>
                      <span className="text-indigo-600">{book.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${book.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {books.length === 0 && (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <BookOpen className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-lg font-medium text-slate-900 mb-1">No manuscripts found</p>
              <p>Create a new book project to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
