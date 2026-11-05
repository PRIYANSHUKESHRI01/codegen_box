import { Container } from "@/components/layout/Container";
import { HeroBackground } from "./HeroBackground";
import { HeroContent } from "./HeroContent";
import { HeroStage } from "./HeroStage";

export function Hero() {
  return (
    <section aria-label="AptRun" className="relative isolate w-full overflow-hidden pb-20 pt-2 sm:pb-28">
      <HeroBackground />
      <Container size="xl">
        <HeroContent />
        <div className="relative z-10 px-1 sm:px-0">
          <HeroStage />
        </div>
      </Container>
    </section>
  );
}
