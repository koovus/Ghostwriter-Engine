import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateBook } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { FileDown, Sparkles, Loader2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const INSTRUCTIONS = `Format your outline in Markdown.
Use an H1 (#) for the Book Title.
Use H2 (##) for Chapters.
Use bullet points (-) for the narrative beats in each chapter.

Example:
# The Midnight Library
Genre: Fantasy
Audience: Young Adult

## Chapter 1: The Last Book
- Nora finds herself in a vast library.
- She meets Mrs. Elm, the librarian.
- They discuss the nature of regrets.`;

export default function NewBook() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [outline, setOutline] = useState("");
  
  const createBook = useCreateBook();

  const handleSubmit = async () => {
    if (!outline.trim()) {
      toast({
        title: "Outline required",
        description: "Please provide a markdown outline to create your book.",
        variant: "destructive"
      });
      return;
    }

    try {
      const book = await createBook.mutateAsync({
        data: { outlineMarkdown: outline }
      });
      
      toast({
        title: "Project created",
        description: `Successfully parsed book with chapters.`,
      });
      
      setLocation(`/books/${book.id}`);
    } catch (error: any) {
      toast({
        title: "Failed to create project",
        description: error.message || "An error occurred while parsing the outline.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="p-8 md:p-12 w-full max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="mb-8">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-6 -ml-3 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-4xl font-serif font-medium tracking-tight mb-3">Initialize Project</h1>
        <p className="text-muted-foreground text-lg">Paste your structured markdown outline below. Ghostwriter will parse the title, metadata, and chapter beats automatically.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-8">
        <div className="space-y-6">
          <div className="relative">
            <Textarea
              value={outline}
              onChange={(e) => setOutline(e.target.value)}
              placeholder="Paste your markdown outline here..."
              className="min-h-[500px] font-mono text-sm leading-relaxed p-6 bg-card border-border/50 focus-visible:ring-primary/50 resize-y"
            />
          </div>

          <div className="flex justify-end">
            <Button 
              size="lg" 
              onClick={handleSubmit} 
              disabled={createBook.isPending}
              className="px-8 font-medium bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {createBook.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Parsing Outline...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" /> Initialize Manuscript
                </>
              )}
            </Button>
          </div>
        </div>

        <div>
          <Card className="bg-secondary/30 border-border/30 sticky top-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileDown className="w-5 h-5 text-primary" />
                Formatting Rules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground space-y-4">
                <p>Ghostwriter expects a specific markdown structure to correctly parse your book:</p>
                <div className="p-4 bg-background/50 rounded border border-border/50 font-mono text-xs whitespace-pre-wrap">
                  {INSTRUCTIONS}
                </div>
                <p>The metadata fields (Genre, Audience, Logline) are optional but highly recommended for better generation quality.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
