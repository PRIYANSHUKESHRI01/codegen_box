"use client";

import { useState } from "react";
import { Check, Copy, Cpu, Globe, Laptop, Network, ShieldCheck, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { formatDateTime } from "./types";
import { eventMeta, formatLocation, type SuperadminLoginLog } from "./superadminSecurityTypes";

interface LoginTelemetryDetailModalProps {
  log: SuperadminLoginLog;
  onClose: () => void;
  onTrustDevice?: (log: SuperadminLoginLog) => void;
}

function DetailItem({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-control border border-border-subtle bg-elevated/50 px-3 py-2">
      <span className="text-3xs font-bold uppercase tracking-wider text-text-muted">{label}</span>
      <span className={cn("text-xs text-primary break-all", mono && "font-mono")}>{value ?? "—"}</span>
    </div>
  );
}

export function LoginTelemetryDetailModal({ log, onClose, onTrustDevice }: LoginTelemetryDetailModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const meta = eventMeta(log.event);

  const copyText = async (field: string, text: string | null) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Login Security Telemetry"
      subtitle={`${log.user_name ? `${log.user_name} · ` : ""}${log.email ?? "Unknown"} · ${formatDateTime(log.created_at)}`}
      icon={ShieldCheck}
      size="2xl"
      footer={
        <>
          {onTrustDevice && log.user_id && (log.ip_address || log.device_fingerprint) && (
            <button
              type="button"
              onClick={() => onTrustDevice(log)}
              className="inline-flex items-center gap-1.5 rounded-control border border-accent-primary/40 bg-accent-primary/10 px-4 py-2 text-xs font-bold text-accent-primary hover:bg-accent-primary/20"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Trust this Laptop &amp; IP
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-control bg-accent-primary px-4 py-2 text-xs font-bold text-white hover:bg-accent-primary-hover"
          >
            Close
          </button>
        </>
      }
    >
      <div className="space-y-5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full border px-2.5 py-0.5 text-3xs font-bold", meta.badge)}>{meta.label}</span>
          {log.portal && (
            <span className="rounded-full border border-border-subtle bg-elevated px-2.5 py-0.5 text-3xs font-semibold text-text-secondary">
              Portal: {log.portal}
            </span>
          )}
          {log.reason && (
            <span className="rounded-full border border-status-danger/30 bg-status-danger/10 px-2.5 py-0.5 text-3xs font-semibold text-status-danger">
              Reason: {log.reason}
            </span>
          )}
          {log.token_id && (
            <span className="rounded-full border border-border-subtle bg-elevated px-2.5 py-0.5 font-mono text-3xs text-text-muted">
              Session Token #{log.token_id}
            </span>
          )}
        </div>

        {/* Network & IP */}
        <section className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-2xs font-extrabold uppercase tracking-wider text-text-secondary">
            <Network className="h-3.5 w-3.5 text-accent-primary" />
            IP &amp; Network Details
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            <DetailItem
              label="IP Address"
              mono
              value={
                log.ip_address ? (
                  <span className="inline-flex items-center gap-1.5">
                    {log.ip_address}
                    <button
                      type="button"
                      onClick={() => void copyText("ip", log.ip_address)}
                      className="text-text-muted hover:text-primary"
                      title="Copy IP"
                    >
                      {copiedField === "ip" ? <Check className="h-3 w-3 text-status-success" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <DetailItem label="Forwarded / Proxy Chain" value={log.forwarded_for ?? "Direct connection"} mono />
            <DetailItem label="Network Scope" value={log.is_private_ip ? "Private / Loopback IP" : "Public Internet IP"} />
            <DetailItem label="ISP / Carrier" value={log.isp ?? "—"} />
            <DetailItem label="ASN / Network Org" value={[log.asn, log.network_org].filter(Boolean).join(" · ") || "—"} />
            <DetailItem
              label="Geo Location"
              value={
                <span className="inline-flex items-center gap-1">
                  <Globe className="h-3 w-3 text-text-muted shrink-0" />
                  {formatLocation(log)}
                </span>
              }
            />
            <DetailItem label="Reverse DNS / Hostname" value={log.hostname ?? "—"} mono />
            <DetailItem
              label="Connection & Speed"
              value={
                <span className="inline-flex items-center gap-1">
                  <Wifi className="h-3 w-3 text-text-muted shrink-0" />
                  {[
                    log.network_type,
                    log.effective_type?.toUpperCase(),
                    log.downlink_mbps !== null ? `${log.downlink_mbps} Mbps` : null,
                    log.rtt_ms !== null ? `${log.rtt_ms}ms RTT` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </span>
              }
            />
            <DetailItem label="Timezone & Language" value={[log.timezone, log.language].filter(Boolean).join(" · ") || "—"} />
          </div>
        </section>

        {/* Laptop & Browser */}
        <section className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-2xs font-extrabold uppercase tracking-wider text-text-secondary">
            <Laptop className="h-3.5 w-3.5 text-accent-primary" />
            Laptop, Browser &amp; Hardware
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            <DetailItem label="Device Summary" value={log.device_label ?? "—"} />
            <DetailItem label="Device Form Factor" value={log.device_type ? log.device_type.toUpperCase() : "—"} />
            <DetailItem label="Operating System" value={[log.os, log.os_version].filter(Boolean).join(" ") || "—"} />
            <DetailItem label="Browser & Version" value={[log.browser, log.browser_version].filter(Boolean).join(" ") || "—"} />
            <DetailItem label="Platform & Arch" value={[log.platform, log.architecture].filter(Boolean).join(" · ") || "—"} />
            <DetailItem
              label="CPU & Memory"
              value={
                <span className="inline-flex items-center gap-1">
                  <Cpu className="h-3 w-3 text-text-muted shrink-0" />
                  {[
                    log.cpu_cores ? `${log.cpu_cores} cores` : null,
                    log.device_memory_gb ? `${log.device_memory_gb} GB RAM` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </span>
              }
            />
            <DetailItem label="Screen Resolution" value={log.screen_resolution ?? "—"} mono />
            <DetailItem label="GPU Vendor" value={log.gpu_vendor ?? "—"} />
            <DetailItem label="GPU Renderer" value={log.gpu_renderer ?? "—"} />
          </div>
        </section>

        {/* Hardware Fingerprints for Future Strict Binding */}
        <section className="space-y-2">
          <h4 className="text-2xs font-extrabold uppercase tracking-wider text-text-secondary">
            Laptop Binding Identifiers (SHA-256 Hardware Fingerprint &amp; Client ID)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <DetailItem
              label="Hardware Fingerprint (SHA-256)"
              mono
              value={
                log.device_fingerprint ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span>{log.device_fingerprint}</span>
                    <button
                      type="button"
                      onClick={() => void copyText("fp", log.device_fingerprint)}
                      className="text-text-muted hover:text-primary shrink-0"
                      title="Copy fingerprint"
                    >
                      {copiedField === "fp" ? <Check className="h-3 w-3 text-status-success" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <DetailItem label="Browser Installation ID" value={log.device_id ?? "—"} mono />
          </div>
        </section>

        {/* Raw User-Agent & Client Hints */}
        <section className="space-y-2">
          <h4 className="text-2xs font-extrabold uppercase tracking-wider text-text-secondary">Raw User-Agent &amp; Client Hints</h4>
          <div className="rounded-control border border-border-subtle bg-elevated/50 p-3 font-mono text-3xs text-text-secondary break-all space-y-2">
            <div>{log.user_agent ?? "No User-Agent recorded."}</div>
            {log.client_hints && Object.keys(log.client_hints).length > 0 && (
              <pre className="overflow-x-auto border-t border-border-subtle pt-2 text-3xs text-text-muted">
                {JSON.stringify(log.client_hints, null, 2)}
              </pre>
            )}
          </div>
        </section>
      </div>
    </Modal>
  );
}
