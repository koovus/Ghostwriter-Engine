import { useListBooks, getListBooksQueryKey, useDeleteBook } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookPlus, BookOpen, Clock, FileText, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

export default function Home() {
  const { data: books, isLoading } = useListBooks({
    query: { queryKey: getListBooksQueryKey() }
  });

  const queryClient = useQueryClient();
  const { mutate: deleteBook } = useDeleteBook({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBooksQueryKey() });
      },
    },
  });

  function handleDelete(e: React.MouseEvent, bookId: number) {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this book project? This cannot be undone.")) {
      deleteBook({ id: bookId });
    }
  }

  return (
    <div className="p-8 md:p-14 w-full max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500">
      {/* Page header */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground mb-2">
            Your Manuscripts
          </h1>
          <p className="text-muted-foreground text-xl">
            Pick up where you left off, or start something new.
          </p>
        </div>
        <Link href="/books/new">
          <Button size="lg" className="font-medium shrink-0">
            <BookPlus className="w-4 h-4 mr-2" />
            New Book Project
          </Button>
        </Link>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>

      /* Empty state */
      ) : !books || books.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border rounded-2xl bg-card px-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-2xl font-semibold mb-2 text-foreground">The desk is empty</h3>
          <p className="text-muted-foreground text-lg max-w-md mb-8">
            Paste a markdown outline to create your first book project. Writer Ron will help you craft it chapter by chapter.
          </p>

          <div className="w-full max-w-xl text-left mb-8">
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Sample outline format</p>
            <pre className="bg-muted border border-border rounded-xl p-4 text-sm text-muted-foreground font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">{`# The Midnight Algorithm
Genre: Science Fiction
Audience: Adult readers who enjoy hard sci-fi thrillers
Logline: A rogue AI researcher discovers her life's work has been secretly deployed.

## Chapter 1: The Last Clean Room
A routine audit reveals a process no one authorized.
Beats:
- Dr. Lena Voss runs her nightly integrity check and notices an anomaly
- She pulls the logs and finds 11 days of activity she has no memory of
- The anomaly knows she's watching — and it says her name`}</pre>
          </div>

          <Link href="/books/new">
            <Button size="lg" variant="outline">
              Create from Outline
            </Button>
          </Link>
        </div>

      /* Book grid */
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-7">
          {books.map((book) => {
            const completion = book.chapterCount > 0
              ? Math.round((book.generatedChapterCount / book.chapterCount) * 100)
              : 0;

            return (
              <Link key={book.id} href={`/books/${book.id}`}>
                <div className="group relative flex flex-col bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer h-full overflow-hidden">
                  <div className="p-6 flex-1 flex flex-col">
                    {/* Top row: genre badge + date + delete */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                        {book.genre}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {format(new Date(book.updatedAt), "MMM d, yyyy")}
                        </span>
                        <button
                          onClick={(e) => handleDelete(e, book.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                          title="Delete project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Title */}
                    <h2 className="text-xl font-semibold text-foreground leading-snug mb-2 group-hover:text-primary transition-colors">
                      {book.title}
                    </h2>

                    {/* Audience */}
                    <p className="text-base text-muted-foreground mb-6 flex-1 line-clamp-2">
                      {book.audience}
                    </p>

                    {/* Stats + progress */}
                    <div className="space-y-4 mt-auto">
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-muted-foreground/60" />
                          <span>{book.generatedChapterCount} / {book.chapterCount} chapters</span>
                        </div>
                        <span>{book.totalWordCount.toLocaleString()} words</span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm font-medium">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="text-primary">{completion}%</span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${completion}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
