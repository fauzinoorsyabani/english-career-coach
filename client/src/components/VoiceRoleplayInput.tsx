import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, Mic, Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

function toBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Unable to prepare the recording."));
    reader.readAsDataURL(blob);
  });
}

export function VoiceRoleplayInput({
  conversationId,
  onTranscript,
  disabled,
}: {
  conversationId: string;
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const transcribe = trpc.voice.transcribe.useMutation({
    onSuccess: data => {
      toast.success("Voice response transcribed and sent to your coach.");
      onTranscript(data.text);
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Voice recording is not supported in this browser. Please type your response instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferred = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined;
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        const mimeType = (recorder.mimeType || "audio/webm").split(";")[0];
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size === 0) {
          toast.error("No spoken response was captured. Please try again.");
          return;
        }
        if (blob.size > 5 * 1024 * 1024) {
          toast.error("Please keep the voice response under 5 MB.");
          return;
        }
        try {
          transcribe.mutate({
            conversationId,
            audioBase64: await toBase64(blob),
            mimeType: mimeType as "audio/webm" | "audio/ogg" | "audio/wav" | "audio/mpeg" | "audio/mp4",
          });
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Unable to prepare the recording.");
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      toast.error("Microphone access was not granted. You can still type your response.");
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="border-b border-border/70 bg-accent-soft/40 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`grid size-8 shrink-0 place-items-center rounded-md border ${
              recording
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-border bg-card text-accent-ink"
            }`}
          >
            <Volume2 className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-foreground">
              Speak your role-play response
              {recording && (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                  <span className="soft-pulse size-1.5 rounded-full bg-destructive" aria-hidden="true" />
                  Recording
                </span>
              )}
            </p>
            <p className="text-[11px] leading-4 text-muted-foreground">
              Your recording is transcribed, then sent to your coach for feedback.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={recording ? "destructive" : "default"}
          onClick={recording ? stop : start}
          disabled={disabled || transcribe.isPending}
          aria-pressed={recording}
        >
          {transcribe.isPending ? (
            <>
              <Loader2 className="mr-1 size-4 animate-spin" aria-hidden="true" />
              Transcribing…
            </>
          ) : recording ? (
            <>
              <Square className="mr-1 size-3.5" aria-hidden="true" />
              Stop recording
            </>
          ) : (
            <>
              <Mic className="mr-1 size-4" aria-hidden="true" />
              Speak response
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
