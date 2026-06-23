import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useCreateBook } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileDown, Sparkles, Loader2, ArrowLeft, Upload, FileText, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const EXAMPLE_FLAT = `# The Midnight Library
Genre: Fantasy
Audience: Young Adult
Logline: Every book in this library contains a life Nora could have lived.

## Chapter 1: The Last Book
- Nora finds herself in a vast library at the moment of her death
- She meets Mrs. Elm, the librarian who guided her through school
- They discuss the nature of regrets and second chances

## Chapter 2: Another Life
- Nora opens her first book and slides into a parallel life
- She discovers what success without passion feels like
- Cliffhanger: she hears her name called from another shelf`;

const EXAMPLE_STRUCTURED = `# My Book Title
**Genre:** Science & Nature
**Target Audience:** Non-technical founders

## INTRODUCTION

### Opening Hook
One sentence that grabs the reader.

### Core Premise
The central argument of the book.

---
## CHAPTER 1: Chapter Title

### Sub-Chapters

#### 1.1 — Sub-chapter Name

**Key Points:**
First key point,Second key point,Third key point

**Supporting Examples/Evidence:**
A short description of the evidence.`;

interface DetectedChapter {
  number: number;
  title: string;
  beats: number;
}

function parsePreview(md: string): { title: string; chapters: DetectedChapter[] } {
  const lines = md.split("\n");
  let title = "";
  const chapters: DetectedChapter[] = [];
  let currentChapter: DetectedChapter | null = null;

  const isStructured = lines.some(l => /^####\s+[\d.]+\s*[–—\-]/.test(l.trim()));
  let chapterNum = 0;
  let awaitingKeyPoints = false;

  for (const raw of lines) {
    const t = raw.trim();

    if (t.startsWith("# ") && !title) {
      title = t.slice(2).trim();
      continue;
    }

    if (isStructured) {
      if (t.match(/^##\s+INTRODUCTION$/i)) {
        if (currentChapter) chapters.push(currentChapter);
        currentChapter = { number: 0, title: "Introduction", beats: 0 };
        awaitingKeyPoints = false;
        continue;
      }
      if (t.match(/^##\s+CHAPTER\s+\d+/i)) continue;
      if (t.match(/^###\s+Sub-Chapters?$/i)) continue;

      const h4Match = t.match(/^####\s+[\d.]+\s*[–—\-]+\s*(.+)$/);
      if (h4Match) {
        if (currentChapter) chapters.push(currentChapter);
        chapterNum++;
        currentChapter = { number: chapterNum, title: h4Match[1].trim(), beats: 0 };
        awaitingKeyPoints = false;
        continue;
      }
      if (currentChapter && t.match(/^\*\*Key Points:\*\*\s*$/i)) {
        awaitingKeyPoints = true;
        continue;
      }
      if (awaitingKeyPoints && currentChapter && t && !t.startsWith("#") && !t.startsWith("**") && !t.startsWith("*Target:")) {
        currentChapter.beats += t.split(",").filter(p => p.trim().length > 0).length;
        awaitingKeyPoints = false;
        continue;
      }
      if (t.startsWith("**") && awaitingKeyPoints) {
        awaitingKeyPoints = false;
      }
    } else {
      const h2 = t.match(/^##\s+(?:Chapter\s+)?(\d+)[:\s–-]+(.+)$/i);
      const h3 = t.match(/^###\s+(?:Chapter\s+)?(\d+)[:\s–-]+(.+)$/i);
      const match = h2 || h3;
      if (match) {
        if (currentChapter) chapters.push(currentChapter);
        currentChapter = { number: parseInt(match[1], 10), title: match[2].trim(), beats: 0 };
        continue;
      }
      if (currentChapter && (t.startsWith("- ") || t.startsWith("* ") || t.match(/^\*\*Beat/i))) {
        currentChapter.beats++;
      }
    }
  }
  if (currentChapter) chapters.push(currentChapter);
  return { title, chapters };
}

export default function NewBook() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [outline, setOutline] = useState("");
  const [titleOverride, setTitleOverride] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createBook = useCreateBook();

  const preview = parsePreview(outline);

  // Pre-populate title from parsed outline when it changes
  const handleOutlineChange = (text: string) => {
    setOutline(text);
    const parsed = parsePreview(text);
    if (parsed.title && !titleOverride) {
      setTitleOverride(parsed.title);
    }
  };

  const handleFile = useCallback((file: File) => {
    if (!file.name.match(/\.(md|txt|markdown)$/i)) {
      toast({ title: "Unsupported file type", description: "Please upload a .md or .txt file.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setOutline(text || "");
      const parsed = parsePreview(text || "");
      if (parsed.title) setTitleOverride(parsed.title);
    };
    reader.readAsText(file);
  }, [toast]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleSubmit = async () => {
    if (!outline.trim()) {
      toast({ title: "Outline required", description: "Paste your markdown outline or upload a file.", variant: "destructive" });
      return;
    }
    if (preview.chapters.length === 0) {
      toast({ title: "No chapters detected", description: "Use ## Chapter 1: Title or the structured #### 1.1 — Sub-chapter format.", variant: "destructive" });
      return;
    }

    // If user overrode the title, inject it into the outline as the H1
    let finalOutline = outline;
    const effectiveTitle = titleOverride.trim() || preview.title;
    if (effectiveTitle && effectiveTitle !== preview.title) {
      const firstH1 = /^#\s+.+$/m;
      if (firstH1.test(finalOutline)) {
        finalOutline = finalOutline.replace(firstH1, `# ${effectiveTitle}`);
      } else {
        finalOutline = `# ${effectiveTitle}\n\n${finalOutline}`;
      }
    }

    try {
      const book = await createBook.mutateAsync({ data: { outlineMarkdown: finalOutline } });
      toast({ title: "Project created", description: `Parsed ${preview.chapters.length} chapter${preview.chapters.length !== 1 ? "s" : ""} successfully.` });
      setLocation(`/books/${book.id}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An error occurred while parsing the outline.";
      toast({ title: "Failed to create project", description: message, variant: "destructive" });
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
        <p className="text-muted-foreground text-lg">Paste your structured markdown outline, or upload a .md or .txt file. Writer Ron parses the title, metadata, and chapter beats automatically.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-8">
        <div className="space-y-4">
          <div
            className={`relative rounded-md border-2 border-dashed transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-border/40 bg-transparent"}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Textarea
              data-testid="outline-textarea"
              value={outline}
              onChange={(e) => handleOutlineChange(e.target.value)}
              placeholder="Paste your markdown outline here, or drag and drop a .md file..."
              className="min-h-[420px] font-mono text-sm leading-relaxed p-6 bg-transparent border-0 focus-visible:ring-0 resize-y"
            />
            {isDragging && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-md pointer-events-none">
                <div className="flex flex-col items-center gap-2 text-primary">
                  <Upload className="w-10 h-10" />
                  <span className="text-sm font-medium">Drop to upload</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.txt,.markdown"
              onChange={handleFileInput}
              className="hidden"
              data-testid="file-input"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="border-border/50 text-muted-foreground hover:text-foreground"
              data-testid="upload-file-btn"
            >
              <Upload className="w-4 h-4 mr-2" /> Upload File (.md / .txt)
            </Button>
            <span className="text-xs text-muted-foreground">or drag and drop onto the text area</span>
          </div>

          {preview.chapters.length > 0 && (
            <Card className="bg-secondary/20 border-border/30" data-testid="chapter-preview">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Detected {preview.chapters.length} chapter{preview.chapters.length !== 1 ? "s" : ""}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1 custom-scrollbar" data-testid="chapter-list-preview">
                  {preview.chapters.map((ch) => (
                    <li key={`${ch.number}-${ch.title}`} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ChevronRight className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
                      <span>
                        <span className="text-foreground font-medium">
                          {ch.number === 0 ? ch.title : `Chapter ${ch.number}: ${ch.title}`}
                        </span>
                        {ch.beats > 0 && <span className="ml-2 text-xs opacity-60">{ch.beats} beat{ch.beats !== 1 ? "s" : ""}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {preview.chapters.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="book-title-override" className="text-sm font-medium">
                Book Title
              </Label>
              <Input
                id="book-title-override"
                data-testid="book-title-input"
                value={titleOverride}
                onChange={(e) => setTitleOverride(e.target.value)}
                placeholder="Enter your book title..."
                className="bg-secondary/30 border-border/50 text-base font-serif"
              />
              <p className="text-xs text-muted-foreground">Auto-detected from your outline — edit to rename.</p>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              data-testid="create-book-btn"
              size="lg"
              onClick={handleSubmit}
              disabled={createBook.isPending || preview.chapters.length === 0}
              className="px-8 font-medium bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {createBook.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Parsing Outline...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Initialize Manuscript</>
              )}
            </Button>
          </div>
        </div>

        <div>
          <Card className="bg-secondary/30 border-border/30 sticky top-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileDown className="w-5 h-5 text-primary" />
                Formatting Guide
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground space-y-4">
                <p className="font-medium text-foreground">Flat format</p>
                <div className="p-4 bg-background/50 rounded border border-border/50 font-mono text-xs whitespace-pre-wrap leading-relaxed">
                  {EXAMPLE_FLAT}
                </div>
                <p className="font-medium text-foreground">Structured sub-chapter format</p>
                <div className="p-4 bg-background/50 rounded border border-border/50 font-mono text-xs whitespace-pre-wrap leading-relaxed">
                  {EXAMPLE_STRUCTURED}
                </div>
                <p className="text-xs opacity-70">Both formats are supported. Genre, Audience, and Logline are optional but improve AI output quality.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
