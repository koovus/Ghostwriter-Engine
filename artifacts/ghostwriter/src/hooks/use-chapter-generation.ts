import { useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

interface GenerationResult {
  wordCount: number;
  openerTechnique: string;
}

/**
 * Scan accumulated streaming text for structural beat boundaries.
 *
 * Beat transitions in prose are signalled by:
 *   1. Double paragraph breaks (\n\n) separating substantial text blocks
 *   2. Scene-separator markers on their own line: ***, ---, ###, ~~~
 *
 * A "substantial" section is one with at least MIN_WORDS_PER_SECTION words —
 * this filters out accidental blank lines after a single short sentence or
 * at the very start of the stream.
 *
 * Returns how many beats are estimated to be complete, capped at
 * (beatCount - 1) so the final beat only marks done when data.done fires.
 */
function detectCompletedBeats(text: string, beatCount: number): number {
  if (beatCount <= 1 || !text.trim()) return 0;

  const MIN_WORDS_PER_SECTION = 40;

  // Split on double-newline paragraph breaks OR scene-separator lines
  const sections = text
    .split(/\n\n+|\n[ \t]*(?:\*{3,}|-{3,}|#{3,}|~{3,})[ \t]*\n/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= MIN_WORDS_PER_SECTION);

  if (sections.length <= 1) return 0;

  // Each section transition is a potential beat boundary.
  // sections.length - 1 == number of detected transitions so far.
  return Math.min(sections.length - 1, beatCount - 1);
}

export function useChapterGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [beatsCompleted, setBeatsCompleted] = useState(0);
  const [activeBeatCount, setActiveBeatCount] = useState(0);
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  const generate = useCallback(
    async (
      bookId: number,
      chapterNumber: number,
      beatCount: number,
      onComplete: (data: GenerationResult, fullText: string) => void
    ) => {
      setIsGenerating(true);
      setStreamingText("");
      setBeatsCompleted(0);
      setActiveBeatCount(beatCount);

      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(`/api/books/${bookId}/chapters/${chapterNumber}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to start generation");
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader available");

        const decoder = new TextDecoder();
        let buffer = "";
        let fullGeneratedText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  fullGeneratedText += data.content;
                  setStreamingText(fullGeneratedText);

                  if (beatCount > 0) {
                    setBeatsCompleted(
                      detectCompletedBeats(fullGeneratedText, beatCount)
                    );
                  }
                }
                if (data.done) {
                  if (beatCount > 0) {
                    setBeatsCompleted(beatCount);
                  }
                  onComplete(
                    {
                      wordCount: data.wordCount,
                      openerTechnique: data.openerTechnique,
                    },
                    fullGeneratedText
                  );
                }
              } catch (e) {
                console.error("Error parsing SSE JSON:", e);
              }
            }
          }
        }
      } catch (error: unknown) {
        const isAbort = error instanceof DOMException && error.name === "AbortError";
        if (!isAbort) {
          console.error("Generation error:", error);
          toast({
            title: "Generation failed",
            description: error instanceof Error ? error.message : "An unexpected error occurred.",
            variant: "destructive",
          });
        }
      } finally {
        setIsGenerating(false);
        setActiveBeatCount(0);
        setBeatsCompleted(0);
        abortControllerRef.current = null;
      }
    },
    [toast]
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
      setActiveBeatCount(0);
      setBeatsCompleted(0);
    }
  }, []);

  return {
    generate,
    cancel,
    isGenerating,
    streamingText,
    beatsCompleted,
    activeBeatCount,
  };
}
