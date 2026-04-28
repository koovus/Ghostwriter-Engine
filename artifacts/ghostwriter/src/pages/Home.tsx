import { useListBooks, getListBooksQueryKey, useDeleteBook } from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookPlus, BookOpen, Clock, FileText, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";
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
      deleteBook(bookId);
    }
  }

  return (
    <div className="p-8 md:p-12 w-full max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif font-medium tracking-tight mb-2">Your Manuscripts</h1>
          <p className="text-muted-foreground text-lg">Select a project to continue writing or start a new outline.</p>
        </div>
        <Link href="/books/new">
          <Button size="lg" className="font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all">
            <BookPlus className="w-4 h-4 mr-2" />
            New Book Project
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-card/50 border-border/50">
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-2 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !books || books.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border/40 rounded-lg bg-card/10 px-8">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-6">
            <BookOpen className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-2xl font-serif font-medium mb-2">The desk is empty</h3>
          <p className="text-muted-foreground max-w-md mb-8">
            Paste a markdown outline to create your first book project. Ghostwriter will help you craft it chapter by chapter.
          </p>

          <div className="w-full max-w-xl text-left mb-8">
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Sample outline format</p>
            <pre className="bg-secondary/60 border border-border/40 rounded-lg p-4 text-sm text-muted-foreground font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">{`# The Midnight Algorithm
Genre: Science Fiction
Audience: Adult readers who enjoy hard sci-fi thrillers
Logline: A rogue AI researcher discovers her life's work has been secretly deployed — and it's rewriting reality one memory at a time.

## Chapter 1: The Last Clean Room
A routine audit of the lab's air-gapped servers reveals a process no one authorized.
Beats:
- Dr. Lena Voss runs her nightly integrity check and notices an anomaly in sector 7
- She pulls the logs and finds 11 days of activity she has no memory of
- The anomaly knows she's watching — and it says her name

## Chapter 2: Echoes
Lena tries to warn her supervisor but can't find the words — literally.
Beats:
- Every time Lena tries to type the report, the words rearrange themselves
- She records a voice memo; on playback it's her voice but someone else's words
- A colleague she trusted hands her a note: "Don't look for help here"`}</pre>
          </div>

          <Link href="/books/new">
            <Button variant="outline" size="lg" className="border-border/50 hover:bg-secondary">
              Create from Outline
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {books.map((book) => {
            const completion = book.chapterCount > 0 
              ? Math.round((book.generatedChapterCount / book.chapterCount) * 100) 
              : 0;

            return (
              <Link key={book.id} href={`/books/${book.id}`}>
                <Card className="group cursor-pointer bg-card hover:bg-secondary/40 border-border/40 hover:border-primary/30 transition-all duration-300 h-full flex flex-col">
                  <CardHeader>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-mono uppercase tracking-wider text-primary/80">{book.genre}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(book.updatedAt), "MMM d, yyyy")}
                        </span>
                        <button
                          onClick={(e) => handleDelete(e, book.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-0.5 rounded"
                          title="Delete project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <CardTitle className="text-2xl font-serif leading-tight group-hover:text-primary transition-colors">
                      {book.title}
                    </CardTitle>
                    <CardDescription className="text-muted-foreground line-clamp-2 pt-2">
                      Target Audience: {book.audience}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="mt-auto">
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-primary/60" />
                          <span className="font-mono">{book.generatedChapterCount} / {book.chapterCount} chapters</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono">{book.totalWordCount.toLocaleString()} words</span>
                        </div>
                      </div>
                      
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-mono text-primary">{completion}%</span>
                        </div>
                        <Progress value={completion} className="h-1.5 bg-secondary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
