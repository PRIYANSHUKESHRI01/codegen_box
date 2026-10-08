"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { TalkToTeamModal } from "@/components/marketing-site/TalkToTeamModal";
import { AUDIENCE_META, type FeatureAudience } from "@/data/featureAudience";
import { cn } from "@/lib/utils";

interface FeatureCtaProps {
  audience: FeatureAudience;
  className?: string;
}

/**
 * Primary + secondary call to action for a feature page. Students go
 * straight to sign-up; colleges and recruiters open the contact form already
 * set to the right audience, because those accounts are set up by our team.
 */
export function FeatureCta({ audience, className }: FeatureCtaProps) {
  const [open, setOpen] = useState(false);
  const meta = AUDIENCE_META[audience];

  return (
    <>
      <div className={cn("flex flex-col sm:flex-row items-stretch sm:items-center gap-3", className)}>
        {meta.cta === "signup" ? (
          <ButtonLink href="/signup" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />} className="hp-btn-sheen justify-center">
            {meta.ctaLabel}
          </ButtonLink>
        ) : (
          <Button size="lg" rightIcon={<ArrowRight className="w-4 h-4" />} onClick={() => setOpen(true)} className="hp-btn-sheen justify-center">
            {meta.ctaLabel}
          </Button>
        )}
        <ButtonLink href="/pricing" variant="secondary" size="lg" className="justify-center">
          See Pricing
        </ButtonLink>
      </div>
      <TalkToTeamModal
        open={open}
        onClose={() => setOpen(false)}
        defaultAudience={meta.cta === "recruit" ? "company" : "institution"}
      />
    </>
  );
}
