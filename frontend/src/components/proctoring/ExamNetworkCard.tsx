"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, Network, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";

interface ExamNetwork {
  ranges: string[];
  your_address: string | null;
  your_address_class: string;
  applies_everywhere: boolean;
}

/**
 * The TPO's "exam network" setting: students can only START a proctored attempt from these address ranges. Leaving it
 * empty means no restriction. The card shows the address the TPO is on RIGHT NOW because, in practice, the way to fill
 * it in is to sit in the exam lab and press "Add this network".
 */
export function ExamNetworkCard() {
  const [data, setData] = useState<ExamNetwork | null>(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<ExamNetwork>("/tpo/exam-network");
      setData(res);
      setText(res.ranges.join("\n"));
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof ApiError ? err.message : "Couldn't load the exam network." });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const ranges = text.split(/[\s,;]+/).filter(Boolean);
      const res = await api.put<ExamNetwork>("/tpo/exam-network", { ranges });
      setData(res);
      setText(res.ranges.join("\n"));
      setMessage({ tone: "ok", text: res.ranges.length ? "Saved. Students can start proctored attempts only from these networks." : "Saved. There is no restriction: students can start from anywhere." });
    } catch (err) {
      const first = err instanceof ApiError ? Object.values(err.errors ?? {})[0]?.[0] : undefined;
      setMessage({ tone: "error", text: first ?? (err instanceof ApiError ? err.message : "Couldn't save.") });
    } finally {
      setSaving(false);
    }
  };

  const addMine = () => {
    if (!data?.your_address) return;
    const lines = text.split(/\s+/).filter(Boolean);
    if (!lines.includes(data.your_address)) setText([...lines, data.your_address].join("\n"));
  };

  if (!data) {
    return message ? (
      <div role="alert" className="rounded-panel border border-status-danger/25 bg-status-danger/10 p-3 text-2xs text-status-danger">{message.text}</div>
    ) : (
      <div className="flex items-center gap-2 rounded-panel border border-border-subtle bg-surface p-4 text-xs text-text-muted" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…</div>
    );
  }

  const private_ = data.your_address_class !== "public";

  return (
    <section aria-label="Exam network" className="space-y-3 rounded-panel border border-border-subtle bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-accent-primary/10 text-accent-primary"><Network className="h-4.5 w-4.5" aria-hidden /></span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-primary">Exam network</h2>
          <p className="text-2xs text-text-muted">
            Students can only <strong>start</strong> a proctored contest, test or interview from these networks — an attempt begun from home, a hostel or a café is refused. Leave it empty for no restriction.
          </p>
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">Allowed addresses and ranges (one per line)</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} spellCheck={false} placeholder={"203.0.113.0/24\n198.51.100.7"} className="w-full rounded-control border border-border-subtle bg-background p-2.5 font-mono text-xs text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/40" />
      </label>

      <div className="flex flex-wrap items-center gap-2 text-2xs text-text-secondary">
        <span>You are on <code className="rounded bg-elevated px-1.5 py-0.5 font-mono text-primary">{data.your_address ?? "unknown"}</code></span>
        <button type="button" onClick={addMine} className="inline-flex items-center gap-1 rounded-control border border-accent-primary/40 bg-accent-primary/10 px-2 py-1 font-bold text-accent-primary hover:bg-accent-primary/20"><Plus className="h-3 w-3" /> Add this network</button>
      </div>
      {private_ && (
        <p className="flex items-start gap-1.5 text-2xs text-status-warning"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> This looks like a private or local address ({data.your_address_class.replace("_", " ")}). Students reach AptRun through your college&apos;s <em>public</em> address — add it from a computer on the lab network, or ask your network team for it.</p>
      )}
      {data.applies_everywhere && <p className="text-2xs text-text-muted">The platform also has its own allowed networks, which apply to every college on top of yours.</p>}

      {message && <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-2xs font-semibold text-status-danger" : "text-2xs font-semibold text-status-success"}>{message.text}</p>}

      <Button onClick={save} isLoading={saving}>Save exam network</Button>
    </section>
  );
}
