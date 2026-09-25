import { Binary, Code2, Terminal, Cpu, Network, Database, GitBranch, Layers, Newspaper, type LucideIcon } from "lucide-react";
import type { TopicIconName } from "@/types/article";

/** Kept in eyeball-lockstep with TOPIC_ICON_NAMES in @/types/article and backend ArticleTopic::ICONS. */
export const TOPIC_ICON_MAP: Record<TopicIconName, LucideIcon> = {
  Binary,
  Code2,
  Terminal,
  Cpu,
  Network,
  Database,
  GitBranch,
  Layers,
};

export function TopicIcon({ name, className }: { name: TopicIconName | null | undefined; className?: string }) {
  const Icon = (name && TOPIC_ICON_MAP[name]) || Newspaper;
  return <Icon className={className} />;
}
