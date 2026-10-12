import { Suspense } from "react";
import { HackathonDetailView } from "@/components/arena/detail/HackathonDetailView";
import { SessionLoader } from "@/components/ui/SessionLoader";

// A static export has no [slug] route, so the hackathon is read from `?slug=` — and
// useSearchParams() must sit under Suspense or the export build fails.
export default function HackathonPage() {
  return (
    <Suspense fallback={<SessionLoader />}>
      <HackathonDetailView />
    </Suspense>
  );
}
