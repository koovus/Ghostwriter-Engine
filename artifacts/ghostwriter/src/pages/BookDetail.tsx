import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useGetBook, getGetBookQueryKey, useUpdateChapter, useListToneSamples, getListToneSamplesQueryKey, useCreateToneSample, useDeleteToneSample } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useChapterGeneration } from "@/hooks/use-chapter-generation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Play, Circle, CheckCircle2, ChevronRight, Settings2, Download, Trash2, X, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Chapter } from "@workspace/api-client-react/src/generated/api.schemas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  const { generate, isGenerating, streamingText, cancel } = useChapterGeneration();
  const updateChapter = useUpdateChapter();

  const activeChapter = book?.chapters?.find(c => c.id === activeChapterId);

  // Automatically select first chapter if none selected
  useEffect(() => {
    if (book?.chapters && book.chapters.length > 0 && !activeChapterId) {
      setActiveChapterId(book.chapters[0].id);
    }
  }, [book, activeChapterId]);

  // Sync edited text when active chapter changes
  useEffect(() => {
    if (activeChapter) {
      setEditedText(activeChapter.generatedText || "");
    }
  }, [activeChapterId, book]);

  const handleGenerate = async (chapter: Chapter) => {
    generate(bookId, chapter.chapterNumber, (result, fullText) => {
      // Done
      updateChapter.mutate({
        id: bookId,
        chapterNumber: chapter.chapterNumber,
        data: { generatedText: fullText }
      }, {
        onSuccess: (updatedChap) => {
          setEditedText(updatedChap.generatedText || "");
          queryClient.invalidateQueries({ queryKey: getGetBookQueryKey(bookId) });
          toast({ title: "Chapter generation complete" });
        },
        onError: () => {
          toast({ title: "Failed to save generated chapter", variant: "destructive" });
        }
      });
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
                  <div>
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
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">Narrative Beats</h4>
                  <ul className="space-y-2">
                    {activeChapter.beatsJson.map((beat, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-foreground/80">
                        <ChevronRight className="w-4 h-4 text-primary/50 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{beat}</span>
                      </li>
                    ))}
                  </ul>
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
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Select a chapter to begin
            </div>
          )}
        </div>

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
