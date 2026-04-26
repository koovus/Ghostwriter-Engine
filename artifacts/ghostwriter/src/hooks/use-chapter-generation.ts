import { useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

interface GenerationResult {
  wordCount: number;
  openerTechnique: string;
}

export function useChapterGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  const generate = useCallback(
    async (
      bookId: number,
      chapterNumber: number,
      onComplete: (data: GenerationResult, fullText: string) => void
    ) => {
      setIsGenerating(true);
      setStreamingText("");
      
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
                }
                if (data.done) {
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
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("Generation error:", error);
          toast({
            title: "Generation failed",
            description: error.message,
            variant: "destructive",
          });
        }
      } finally {
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
    },
    [toast]
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
  }, []);

  return {
    generate,
    cancel,
    isGenerating,
    streamingText,
  };
}
