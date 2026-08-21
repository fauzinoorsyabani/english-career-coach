import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, Mic, Square, Volume2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

function toBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Unable to prepare the recording."));
    reader.readAsDataURL(blob);
  });
}

export function VoiceRoleplayInput({ conversationId, onTranscript, disabled }: { conversationId: string; onTranscript: (text: string) => void; disabled?: boolean }) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const transcribe = trpc.voice.transcribe.useMutation({ onSuccess: data => { toast.success("Voice response transcribed and sent to your coach."); onTranscript(data.text); }, onError: error => toast.error(error.message) });

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { toast.error("Voice recording is not supported in this browser. Please type your response instead."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined;
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = event => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const mimeType = (recorder.mimeType || "audio/webm").split(";")[0];
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size === 0) { toast.error("No spoken response was captured. Please try again."); return; }
        if (blob.size > 5 * 1024 * 1024) { toast.error("Please keep the voice response under 5 MB."); return; }
        try { transcribe.mutate({ conversationId, audioBase64: await toBase64(blob), mimeType: mimeType as "audio/webm" | "audio/ogg" | "audio/wav" | "audio/mpeg" | "audio/mp4" }); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to prepare the recording."); }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch { toast.error("Microphone access was not granted. You can still type your response."); }
  };

  const stop = () => { recorderRef.current?.stop(); setRecording(false); };
  return <div className="border-b border-border/70 bg-[#E4F0F4]/55 px-5 py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="rounded-lg bg-card p-1.5 text-[#34718A]"><Volume2 className="size-4" /></span><div><p className="text-xs font-bold text-primary">Speak your role-play response</p><p className="text-[11px] text-muted-foreground">Your recording is transcribed, then sent to your coach for feedback.</p></div></div><Button size="sm" onClick={recording ? stop : start} disabled={disabled || transcribe.isPending} className={`rounded-lg ${recording ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-[#34718A] text-white hover:bg-[#2B6178]"}`}>{transcribe.isPending ? <><Loader2 className="mr-1 size-4 animate-spin" />Transcribing…</> : recording ? <><Square className="mr-1 size-3.5" />Stop recording</> : <><Mic className="mr-1 size-4" />Speak response</>}</Button></div></div>;
}
