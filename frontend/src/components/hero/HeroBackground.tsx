/**
 * The hero's backdrop: a faint grid that fades out downward and three slow aurora blobs (the Stripe/Linear "mesh"), all decoration.
 * No text lives here: anything the page says is in the content layer, where it can be read, translated and tested.
 */
export function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-grid-pattern opacity-40 [mask-image:radial-gradient(ellipse_65%_55%_at_50%_0%,black,transparent)] dark:opacity-25" />

      <div className="lp-blob-a absolute -top-24 left-[6%] h-[420px] w-[520px] rounded-full bg-accent-primary/20 blur-[90px] dark:bg-accent-primary/25" />
      <div className="lp-blob-b absolute -top-10 right-[4%] h-[400px] w-[480px] rounded-full bg-accent-secondary/20 blur-[90px] dark:bg-accent-secondary/20" />
      <div className="lp-blob-a absolute left-1/2 top-[42%] h-[320px] w-[620px] -translate-x-1/2 rounded-full bg-violet-400/15 blur-[100px] dark:bg-violet-500/15" />

      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}
