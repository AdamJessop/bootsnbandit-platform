"use client";

/**
 * PWA install button (top bar). Hidden until the browser fires
 * `beforeinstallprompt`; we stash the deferred event and call prompt() on
 * click. Disappears again once the prompt has been used (the event is
 * single-use) or if the app is already installed (the event never fires).
 */
import { useEffect, useState } from "react";
import { Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!deferred) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        await deferred.prompt();
        setDeferred(null);
      }}
      className="flex items-center gap-1.5 rounded-md border border-border-default bg-bg-raised px-2.5 py-1.5 font-termina text-[11px] font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary"
    >
      <Download className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Install app</span>
    </button>
  );
}
