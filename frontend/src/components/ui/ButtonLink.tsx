import Link from "next/link";
import { ReactNode } from "react";
import { buttonStyles, type ButtonSize, type ButtonVariant } from "./buttonStyles";

interface ButtonLinkProps {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * A navigation CTA that looks exactly like <Button> but is a real <a> —
 * wrapping a <button> in a <Link> nests one interactive element inside
 * another, which is invalid HTML and confuses keyboard/screen-reader users.
 */
export function ButtonLink({ href, variant, size, leftIcon, rightIcon, fullWidth, className, children }: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonStyles({ variant, size, fullWidth, className })}>
      {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
      <span>{children}</span>
      {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </Link>
  );
}
