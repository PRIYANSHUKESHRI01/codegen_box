import { ChevronDown } from "lucide-react";

const SUPPORT_EMAIL = "support@mellowvault.com";

/** Only things that are true of how checkout and plans actually behave — see docs/payments-payu.md and docs/payments-razorpay.md. */
const ITEMS: { question: string; answer: React.ReactNode }[] = [
  {
    question: "How does billing work?",
    answer: "Each plan is a one-time purchase for a year, in rupees. Nothing renews by itself — you are never charged again unless you choose to buy again.",
  },
  {
    question: "What if I buy the plan I already have?",
    answer: "The new year is added after the days you have left, so renewing early never costs you paid time.",
  },
  {
    question: "Can I switch to a different plan?",
    answer: "Yes. Upgrading starts a fresh year of the new plan from today. If a higher plan still has time left, a cheaper one can't be bought on top of it.",
  },
  {
    question: "How do I join Mellow Academy (Grandmaster)?",
    answer:
      "Mellow Academy — the Grandmaster plan — is arranged with our team rather than bought here: choose “Contact our team” on its card and we'll walk you through the programmes, the fee and the placement terms. Once you enrol, your plan is switched on for you and covers three years.",
  },
  {
    question: "I paid but my plan hasn't changed.",
    answer: (
      <>
        It normally activates within seconds, and AptRun also re-checks every payment with the payment gateway every few minutes. If it still hasn&apos;t changed after ten minutes, write to{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-accent-primary hover:underline">
          {SUPPORT_EMAIL}
        </a>{" "}
        with your payment ID (it&apos;s in your payment history above) and we&apos;ll sort it out.
      </>
    ),
  },
  {
    question: "How do I get a refund or ask about a charge?",
    answer: (
      <>
        Write to{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-accent-primary hover:underline">
          {SUPPORT_EMAIL}
        </a>
        . A refund takes the plan back automatically.
      </>
    ),
  },
  {
    question: "My college already pays for AptRun.",
    answer: "Then you don't need to buy anything: while your college's plan is running, everything it includes is open to you, and this page says so.",
  },
];

/**
 * A short, honest FAQ under the plan cards. Native <details> — no script, fully
 * keyboard-operable — so it works even if the rest of the page is still loading.
 */
export function BillingFaq() {
  return (
    <section aria-labelledby="billing-faq-heading" className="mx-auto max-w-3xl px-4 py-10 sm:py-12">
      <h2 id="billing-faq-heading" className="text-lg font-extrabold tracking-tight text-primary">
        Billing questions
      </h2>
      <div className="mt-4 divide-y divide-border-subtle rounded-panel border border-border-subtle bg-surface">
        {ITEMS.map((item) => (
          <details key={item.question} className="group px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-primary marker:hidden [&::-webkit-details-marker]:hidden">
              {item.question}
              <ChevronDown className="h-4 w-4 shrink-0 text-text-muted transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="pt-2 text-xs leading-relaxed text-text-secondary">{item.answer}</div>
          </details>
        ))}
      </div>
    </section>
  );
}
