import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useGetBook, getGetBookQueryKey, useUpdateChapter, useUpdateBook, useListToneSamples, getListToneSamplesQueryKey, getListBooksQueryKey, useCreateToneSample, useDeleteToneSample } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useChapterGeneration } from "@/hooks/use-chapter-generation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Play, Circle, CheckCircle2, ChevronRight, ChevronLeft, Settings2, Download, Trash2, X, RefreshCw, BookOpen, Pencil, Plus, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { BookWithChapters } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Chapter = NonNullable<BookWithChapters["chapters"]>[number];

export default function BookDetail() {
  const params = useParams();
  const bookId = parseInt(params.id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: book, isLoading } = useGetBook(bookId, {
    query: { enabled: !!bookId, queryKey: getGetBookQueryKey(bookId) }
  });

  const { data: toneSamples } = useListToneSamples(bookId, {
    query: { enabled: !!bookId, queryKey: getListToneSamplesQueryKey(bookId) }
  });

  const [activeChapterId, setActiveChapterId] = useState<number | null>(null);
  const [editedText, setEditedText] = useState("");
  const [showTonePanel, setShowTonePanel] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editGenre, setEditGenre] = useState("");
  const [editAudience, setEditAudience] = useState("");
  const [editLogline, setEditLogline] = useState("");
  const [draftBeats, setDraftBeats] = useState<string[]>([]);

  const updateBook = useUpdateBook();

  const { generate, isGenerating, streamingText, cancel } = useChapterGeneration();
  const updateChapter = useUpdateChapter();

  const activeChapter = book?.chapters?.find(c => c.id === activeChapterId);

  // Automatically select first chapter if none selected
  useEffect(() => {
    if (book?.chapters && book.chapters.length > 0 && !activeChapterId) {
      setActiveChapterId(book.chapters[0].id);
    }
  }, [book, activeChapterId]);

  // Sync edited text whenever book data refreshes or active chapter changes
  useEffect(() => {
    if (activeChapter) {
      setEditedText(activeChapter.generatedText || "");
    }
  }, [activeChapterId, book]);

  // Sync draft beats when active chapter changes
  useEffect(() => {
    if (activeChapter) {
      setDraftBeats([...(activeChapter.beatsJson as string[])]);
    }
  }, [activeChapterId, book]);

  const handleGenerate = async (chapter: Chapter) => {
    generate(bookId, chapter.chapterNumber, (_result, fullText) => {
      // Server already persisted generated text; just refresh the cache and sync local state
      setEditedText(fullText);
      queryClient.invalidateQueries({ queryKey: getGetBookQueryKey(bookId) });
      toast({ title: "Chapter generation complete" });
    });
  };

  const handleSaveEdit = () => {
    if (!activeChapter) return;
    updateChapter.mutate({
      id: bookId,
      chapterNumber: activeChapter.chapterNumber,
      data: { generatedText: editedText }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBookQueryKey(bookId) });
        toast({ title: "Edits saved" });
      }
    });
  };

  const saveBeats = () => {
    if (!activeChapter) return;
    const cleaned = draftBeats.map(b => b.trim()).filter(Boolean);
    updateChapter.mutate({
      id: bookId,
      chapterNumber: activeChapter.chapterNumber,
      data: { beatsJson: cleaned }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBookQueryKey(bookId) });
        toast({ title: "Beats updated" });
      }
    });
  };

  const cancelEditBeats = () => {
    if (activeChapter) {
      setDraftBeats([...(activeChapter.beatsJson as string[])]);
    }
  };

  const beatsAreDirty = activeChapter
    ? JSON.stringify(draftBeats) !== JSON.stringify(activeChapter.beatsJson)
    : false;

  const openEditPanel = () => {
    if (!book) return;
    setEditTitle(book.title ?? "");
    setEditGenre(book.genre ?? "");
    setEditAudience(book.audience ?? "");
    setEditLogline(book.logline ?? "");
    setShowEditPanel(true);
  };

  const handleSaveBookMetadata = () => {
    updateBook.mutate({
      id: bookId,
      data: {
        title: editTitle,
        genre: editGenre,
        audience: editAudience,
        logline: editLogline,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBookQueryKey(bookId) });
        queryClient.invalidateQueries({ queryKey: getListBooksQueryKey() });
        setShowEditPanel(false);
        toast({ title: "Book details updated" });
      },
      onError: () => {
        toast({ title: "Failed to save changes", variant: "destructive" });
      }
    });
  };

  const createToneSample = useCreateToneSample();
  const deleteToneSample = useDeleteToneSample();
  const [newSampleLabel, setNewSampleLabel] = useState("");
  const [newSampleText, setNewSampleText] = useState("");

  const handleAddSample = () => {
    if (!newSampleLabel || !newSampleText) return;
    createToneSample.mutate({
      id: bookId,
      data: { label: newSampleLabel, sampleText: newSampleText }
    }, {
      onSuccess: () => {
        setNewSampleLabel("");
        setNewSampleText("");
        queryClient.invalidateQueries({ queryKey: getListToneSamplesQueryKey(bookId) });
        toast({ title: "Tone sample added" });
      }
    });
  };

  // Computed chapter navigation
  const chapters = book?.chapters ?? [];
  const activeChapterIndex = chapters.findIndex((c) => c.id === activeChapterId);
  const prevChapter = activeChapterIndex > 0 ? chapters[activeChapterIndex - 1] : null;
  const nextChapter = activeChapterIndex < chapters.length - 1 ? chapters[activeChapterIndex + 1] : null;

  // Computed book stats
  const generatedCount = chapters.filter((c) => !!c.generatedText).length;
  const totalWordCount = chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);
  const completionPct = chapters.length > 0 ? Math.round((generatedCount / chapters.length) * 100) : 0;

  if (isLoading) return <div className="flex h-[calc(100vh-4rem)] items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;
  if (!book) return <div className="p-8 text-center text-muted-foreground">Book not found</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
      {/* Header */}
      <header className="h-16 border-b border-border/40 flex items-center justify-between px-6 shrink-0 bg-secondary/20">
        <div>
          <h2 className="text-xl font-serif font-medium">{book.title}</h2>
          <div className="text-xs text-muted-foreground font-mono tracking-wide uppercase mt-0.5">
            {book.genre} • {book.chapters?.length || 0} Chapters
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="hidden md:flex border-border/50 text-xs" onClick={() => window.location.href = `/api/books/${bookId}/export/md`}>
            <Download className="w-3.5 h-3.5 mr-2" /> MD
          </Button>
          <Button variant="outline" size="sm" className="hidden md:flex border-border/50 text-xs" onClick={() => window.location.href = `/api/books/${bookId}/export/docx`}>
            <Download className="w-3.5 h-3.5 mr-2" /> DOCX
          </Button>
          <Button variant="outline" size="sm" className="hidden md:flex border-border/50 text-xs" onClick={() => window.location.href = `/api/books/${bookId}/export/pdf`}>
            <Download className="w-3.5 h-3.5 mr-2" /> PDF
          </Button>
          <Button variant="outline" size="sm" className="hidden md:flex border-border/50 text-xs" onClick={() => window.location.href = `/api/books/${bookId}/export/epub`}>
            <Download className="w-3.5 h-3.5 mr-2" /> EPUB
          </Button>
          <div className="w-px h-6 bg-border/50 mx-2" />
          <Button variant={showEditPanel ? "secondary" : "ghost"} size="sm" onClick={() => showEditPanel ? setShowEditPanel(false) : openEditPanel()} title="Edit book details">
            <Pencil className="w-4 h-4 mr-2" /> Edit Details
          </Button>
          <Button variant={showTonePanel ? "secondary" : "ghost"} size="sm" onClick={() => setShowTonePanel(!showTonePanel)}>
            <Settings2 className="w-4 h-4 mr-2" /> Voice & Tone
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 border-r border-border/40 flex flex-col bg-secondary/10 shrink-0">
          <div className="p-4 border-b border-border/40">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Chapters</h3>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-1">
              {book.chapters?.map((chapter) => {
                const isActive = chapter.id === activeChapterId;
                const isDone = !!chapter.generatedText;
                const isCurrentlyGenerating = isGenerating && activeChapter?.id === chapter.id;

                return (
                  <button
                    key={chapter.id}
                    onClick={() => !isGenerating && setActiveChapterId(chapter.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-md text-left transition-colors ${
                      isActive ? "bg-primary/10 text-primary" : "hover:bg-secondary text-foreground"
                    } ${isGenerating && !isActive ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {isCurrentlyGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                    ) : isDone ? (
                      <CheckCircle2 className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    ) : (
                      <Circle className={`w-4 h-4 shrink-0 ${isActive ? "text-primary/50" : "text-muted-foreground/50"}`} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        Chapter {chapter.chapterNumber}
                      </div>
                      <div className={`text-xs truncate ${isActive ? "text-primary/70" : "text-muted-foreground"}`}>
                        {chapter.title}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Main Workspace */}
        <div className="flex-1 flex flex-col min-w-0 bg-background relative">
          {activeChapter ? (
            <>
              {/* Workspace Header */}
              <div className="px-8 py-6 border-b border-border/20 shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-serif mb-2">Chapter {activeChapter.chapterNumber}: {activeChapter.title}</h1>
                    {activeChapter.wordCount > 0 && (
                      <div className="text-sm font-mono text-muted-foreground">
                        {activeChapter.wordCount.toLocaleString()} words
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="border-border/50 h-9 w-9"
                      disabled={!prevChapter || isGenerating}
                      onClick={() => prevChapter && setActiveChapterId(prevChapter.id)}
                      title={prevChapter ? `Chapter ${prevChapter.chapterNumber}: ${prevChapter.title}` : "No previous chapter"}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="border-border/50 h-9 w-9"
                      disabled={!nextChapter || isGenerating}
                      onClick={() => nextChapter && setActiveChapterId(nextChapter.id)}
                      title={nextChapter ? `Chapter ${nextChapter.chapterNumber}: ${nextChapter.title}` : "No next chapter"}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <div className="w-px h-6 bg-border/50 mx-1" />
                    {isGenerating ? (
                      <Button variant="destructive" onClick={cancel} className="font-medium">
                        <X className="w-4 h-4 mr-2" /> Stop Generation
                      </Button>
                    ) : (
                      <Button 
                        onClick={() => handleGenerate(activeChapter)} 
                        className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                      >
                        {activeChapter.generatedText ? (
                          <><RefreshCw className="w-4 h-4 mr-2" /> Regenerate</>
                        ) : (
                          <><Play className="w-4 h-4 mr-2 fill-current" /> Generate Chapter</>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Beats */}
                <div className="mt-6 pt-6 border-t border-border/20">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Narrative Beats</h4>
                    {beatsAreDirty && (
                      <div className="flex gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={cancelEditBeats}
                        >
                          <X className="w-3 h-3 mr-1" /> Discard
                        </Button>
                        <Button
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={saveBeats}
                          disabled={updateChapter.isPending}
                        >
                          {updateChapter.isPending ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3 mr-1" />
                          )}
                          Save
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    {draftBeats.map((beat, idx) => (
                      <div key={idx} className="flex items-center gap-2 group/beat">
                        <span className="text-xs text-primary/40 font-mono w-4 shrink-0 text-right">{idx + 1}</span>
                        <Input
                          value={beat}
                          onChange={(e) => {
                            const next = [...draftBeats];
                            next[idx] = e.target.value;
                            setDraftBeats(next);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const next = [...draftBeats];
                              next.splice(idx + 1, 0, "");
                              setDraftBeats(next);
                            } else if (e.key === "Backspace" && beat === "" && draftBeats.length > 1) {
                              e.preventDefault();
                              const next = draftBeats.filter((_, i) => i !== idx);
                              setDraftBeats(next);
                            }
                          }}
                          disabled={isGenerating}
                          className="flex-1 h-8 text-sm bg-secondary/30 border-border/40 focus:border-primary/40"
                          placeholder={`Beat ${idx + 1}…`}
                          autoFocus={idx === draftBeats.length - 1 && beat === ""}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground/0 group-hover/beat:text-muted-foreground hover:!text-destructive transition-colors"
                          onClick={() => {
                            if (draftBeats.length > 1) {
                              setDraftBeats(draftBeats.filter((_, i) => i !== idx));
                            }
                          }}
                          disabled={draftBeats.length <= 1 || isGenerating}
                          title="Delete beat"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-dashed border-border/40 text-xs text-muted-foreground h-7 mt-1"
                      onClick={() => setDraftBeats([...draftBeats, ""])}
                      disabled={isGenerating}
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Beat
                    </Button>
                  </div>
                </div>
              </div>

              {/* Editor/Stream Area */}
              <div className="flex-1 p-8 overflow-y-auto custom-scrollbar relative">
                {isGenerating ? (
                  <div className="max-w-3xl mx-auto font-serif text-lg leading-loose text-foreground/90 whitespace-pre-wrap pb-24">
                    {streamingText}
                    <span className="inline-block w-2 h-5 ml-1 bg-primary animate-pulse align-middle" />
                  </div>
                ) : activeChapter.generatedText ? (
                  <div className="max-w-3xl mx-auto pb-24 relative">
                    <Textarea
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      onBlur={handleSaveEdit}
                      className="min-h-[600px] w-full resize-none font-serif text-lg leading-loose bg-transparent border-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
                      placeholder="Start writing..."
                    />
                    {editedText !== activeChapter.generatedText && (
                      <div className="fixed bottom-8 right-8 animate-in fade-in slide-in-from-bottom-4">
                        <Button onClick={handleSaveEdit} size="sm" className="shadow-lg">
                          Save Changes
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <p className="font-serif text-xl italic opacity-50">This chapter is waiting to be written.</p>
                  </div>
                )}
              </div>

            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <BookOpen className="w-12 h-12 opacity-20" />
              <p className="font-serif text-lg italic opacity-50">Select a chapter to begin writing.</p>
            </div>
          )}

          {/* Export Panel — always visible at the bottom */}
          <div className="shrink-0 border-t border-border/20 bg-secondary/10 px-8 py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BookOpen className="w-4 h-4 text-primary/60" />
                  <span className="font-medium text-foreground">{generatedCount}</span>
                  <span>/ {chapters.length} chapters written</span>
                </div>
                {totalWordCount > 0 && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{totalWordCount.toLocaleString()}</span>
                    {" "}total words
                  </div>
                )}
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-border/40 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${completionPct}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{completionPct}%</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:block mr-1">Export:</span>
                {[
                  { fmt: "md", label: "MD" },
                  { fmt: "docx", label: "DOCX" },
                  { fmt: "pdf", label: "PDF" },
                  { fmt: "epub", label: "EPUB" },
                ].map(({ fmt, label }) => (
                  <Button
                    key={fmt}
                    variant="outline"
                    size="sm"
                    className="border-border/50 text-xs h-7 px-2.5"
                    disabled={generatedCount === 0}
                    onClick={() => {
                      if (generatedCount < chapters.length) {
                        const ok = window.confirm(
                          `Only ${generatedCount} of ${chapters.length} chapters have been generated. The export will omit unwritten chapters. Continue?`
                        );
                        if (!ok) return;
                      }
                      window.location.href = `/api/books/${bookId}/export/${fmt}`;
                    }}
                  >
                    <Download className="w-3 h-3 mr-1.5" />{label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Edit Panel */}
        {showEditPanel && (
          <div className="w-80 border-l border-border/40 bg-secondary/10 flex flex-col shrink-0 animate-in slide-in-from-right-8 duration-300">
            <div className="p-4 border-b border-border/40 flex items-center justify-between">
              <h3 className="text-sm font-medium uppercase tracking-widest">Book Details</h3>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowEditPanel(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Update the title and metadata for this book. Changes will be reflected across all chapter generation prompts.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="edit-title" className="text-xs">Title</Label>
                  <Input
                    id="edit-title"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    placeholder="Book title"
                    className="bg-background text-sm h-8"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-genre" className="text-xs">Genre</Label>
                  <Input
                    id="edit-genre"
                    value={editGenre}
                    onChange={e => setEditGenre(e.target.value)}
                    placeholder="e.g. Science Fiction, Thriller"
                    className="bg-background text-sm h-8"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-audience" className="text-xs">Audience</Label>
                  <Input
                    id="edit-audience"
                    value={editAudience}
                    onChange={e => setEditAudience(e.target.value)}
                    placeholder="e.g. Young Adult, General adult"
                    className="bg-background text-sm h-8"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-logline" className="text-xs">Logline</Label>
                  <Textarea
                    id="edit-logline"
                    value={editLogline}
                    onChange={e => setEditLogline(e.target.value)}
                    placeholder="One-sentence hook for the book..."
                    className="bg-background text-sm min-h-[80px] resize-none"
                  />
                </div>

                <Button
                  onClick={handleSaveBookMetadata}
                  disabled={updateBook.isPending || !editTitle.trim()}
                  className="w-full text-xs"
                  size="sm"
                >
                  {updateBook.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
                  Save Changes
                </Button>
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Tone Panel */}
        {showTonePanel && (
          <div className="w-80 border-l border-border/40 bg-secondary/10 flex flex-col shrink-0 animate-in slide-in-from-right-8 duration-300">
            <div className="p-4 border-b border-border/40 flex items-center justify-between">
              <h3 className="text-sm font-medium uppercase tracking-widest">Voice Samples</h3>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowTonePanel(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Provide writing samples to train Ghostwriter on your specific prose style, tone, and pacing.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="label" className="text-xs">Sample Name</Label>
                    <Input 
                      id="label"
                      value={newSampleLabel} 
                      onChange={e => setNewSampleLabel(e.target.value)} 
                      placeholder="e.g. Dialogue Style, Action Scene" 
                      className="bg-background text-sm h-8"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="text" className="text-xs">Sample Text</Label>
                    <Textarea 
                      id="text"
                      value={newSampleText} 
                      onChange={e => setNewSampleText(e.target.value)} 
                      placeholder="Paste 500-1000 words of writing..." 
                      className="bg-background text-sm min-h-[120px] resize-none"
                    />
                  </div>
                  <Button 
                    onClick={handleAddSample} 
                    disabled={!newSampleLabel || !newSampleText || createToneSample.isPending}
                    className="w-full text-xs" size="sm"
                  >
                    {createToneSample.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
                    Add Sample
                  </Button>
                </div>

                <Separator className="bg-border/40" />

                <div className="space-y-3">
                  <h4 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Active Samples</h4>
                  {toneSamples?.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No samples added yet.</p>
                  ) : (
                    toneSamples?.map(sample => (
                      <Card key={sample.id} className="bg-background/50 border-border/40">
                        <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between space-y-0">
                          <CardTitle className="text-xs font-medium">{sample.label}</CardTitle>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteToneSample.mutate({ id: bookId, sampleId: sample.id }, {
                              onSuccess: () => queryClient.invalidateQueries({ queryKey: getListToneSamplesQueryKey(bookId) })
                            })}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                            {sample.sampleText}
                          </p>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
