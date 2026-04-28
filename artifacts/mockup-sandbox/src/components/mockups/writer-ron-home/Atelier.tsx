import React from 'react';
import { Trash2, Plus, BookOpen, Feather } from 'lucide-react';

export function Atelier() {
  const books = [
    {
      id: 1,
      title: "The Stoic Legionnaire's Guide to AI",
      genre: "Self-Help",
      audience: "Tech professionals seeking ancient wisdom",
      chapters: 1,
      totalChapters: 12,
      words: 2518,
      progress: 8,
    },
    {
      id: 2,
      title: "The Crystal Throne",
      genre: "Fantasy",
      audience: "Young adult high fantasy readers",
      chapters: 2,
      totalChapters: 2,
      words: 3325,
      progress: 100,
    },
    {
      id: 3,
      title: "Echoes of Tomorrow",
      genre: "Science Fiction",
      audience: "Hard sci-fi enthusiasts",
      chapters: 0,
      totalChapters: 2,
      words: 0,
      progress: 0,
    },
    {
      id: 4,
      title: "The Iron Sea",
      genre: "Fantasy",
      audience: "Adult grimdark readers",
      chapters: 0,
      totalChapters: 2,
      words: 0,
      progress: 0,
    },
    {
      id: 5,
      title: "The Glass Mountain",
      genre: "Literary Fiction",
      audience: "Contemporary fiction readers",
      chapters: 1,
      totalChapters: 2,
      words: 20,
      progress: 50,
    },
  ];

  return (
    <div 
      className="min-h-screen p-8 md:p-16 flex flex-col items-center"
      style={{
        backgroundColor: '#F5EDD6',
        color: '#2C1A0E',
        fontFamily: '"Lora", serif',
        backgroundImage: 'radial-gradient(#E8DAC0 1px, transparent 1px)',
        backgroundSize: '32px 32px'
      }}
    >
      <div className="w-full max-w-6xl">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-6 border-b pb-8" style={{ borderColor: '#D4C4A3' }}>
          <div>
            <div className="flex items-center gap-3 mb-2 opacity-80">
              <Feather size={20} style={{ color: '#8C4A32' }} />
              <span className="italic tracking-wide text-sm">Writer Ron</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-medium tracking-tight" style={{ fontFamily: '"Playfair Display", serif' }}>
              Your Manuscripts
            </h1>
            <p className="mt-4 text-lg opacity-80 max-w-xl leading-relaxed">
              Every blank page is an invitation. Here are the worlds you are currently weaving.
            </p>
          </div>
          <button 
            className="flex items-center gap-2 px-6 py-3 rounded-sm transition-all duration-300 shadow-sm hover:shadow-md"
            style={{ 
              backgroundColor: '#8C4A32', 
              color: '#FDFBF7',
              fontFamily: '"Playfair Display", serif',
              letterSpacing: '0.05em'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#703A26'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#8C4A32'}
          >
            <Plus size={18} />
            <span>New Project</span>
          </button>
        </header>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {books.map((book) => (
            <div 
              key={book.id}
              className="group relative flex flex-col p-8 rounded-sm transition-all duration-500 hover:-translate-y-1"
              style={{
                backgroundColor: '#FDFBF7',
                border: '1px solid #E6D8B8',
                boxShadow: '0 4px 12px rgba(44, 26, 14, 0.03), 0 1px 3px rgba(44, 26, 14, 0.05)',
              }}
            >
              {/* Delete Button (Hover) */}
              <button 
                className="absolute top-6 right-6 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ color: '#A67C52', backgroundColor: '#F5EDD6' }}
                aria-label="Delete project"
                onMouseOver={(e) => {
                  e.currentTarget.style.color = '#8C4A32';
                  e.currentTarget.style.backgroundColor = '#E8DAC0';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.color = '#A67C52';
                  e.currentTarget.style.backgroundColor = '#F5EDD6';
                }}
              >
                <Trash2 size={16} />
              </button>

              <div className="mb-6">
                <span 
                  className="text-xs tracking-[0.2em] uppercase font-semibold"
                  style={{ color: '#A67C52' }}
                >
                  {book.genre}
                </span>
                <h3 
                  className="text-2xl mt-3 mb-2 leading-snug font-medium" 
                  style={{ fontFamily: '"Playfair Display", serif' }}
                >
                  {book.title}
                </h3>
                <p className="text-sm opacity-70 italic line-clamp-2">
                  For: {book.audience}
                </p>
              </div>

              <div className="mt-auto pt-6 border-t" style={{ borderColor: '#F0E6D2' }}>
                <div className="flex justify-between items-end mb-3 text-sm opacity-80">
                  <div className="flex items-center gap-2">
                    <BookOpen size={14} />
                    <span>{book.chapters} / {book.totalChapters} chap.</span>
                  </div>
                  <span>{book.words.toLocaleString()} words</span>
                </div>
                
                {/* Progress Bar */}
                <div 
                  className="w-full h-1 rounded-full overflow-hidden" 
                  style={{ backgroundColor: '#F0E6D2' }}
                >
                  <div 
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ 
                      width: `${book.progress}%`,
                      backgroundColor: '#8C4A32' 
                    }}
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
