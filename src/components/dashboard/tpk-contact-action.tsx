import { MessageCircle, Phone } from "lucide-react";

import { checkPhone, telHref, waHref } from "@/lib/phone";
import { cn } from "@/lib/utils";

type ContactKind = "call" | "whatsapp";

export function TpkContactAction({
  phone,
  kind,
  size = "md",
}: {
  phone: string | null | undefined;
  kind: ContactKind;
  size?: "sm" | "md";
}) {
  const check = checkPhone(phone);
  const enabled = check.status === "valid" && check.e164Digits;
  const href =
    enabled && check.e164Digits
      ? kind === "call"
        ? telHref(check.e164Digits)
        : waHref(check.e164Digits)
      : undefined;

  const Icon = kind === "call" ? Phone : MessageCircle;
  const label =
    kind === "call"
      ? enabled
        ? `Telepon ${check.label}`
        : check.label
      : enabled
        ? `WhatsApp ${check.label}`
        : check.label;

  const className = cn(
    "inline-flex items-center justify-center rounded-xl border transition-colors",
    size === "sm" ? "size-8" : "size-9",
    enabled
      ? kind === "whatsapp"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
        : "border-blue-200 bg-blue-50 text-primary hover:bg-blue-100"
      : "cursor-not-allowed border-line bg-slate-50 text-slate-300",
  );

  if (!enabled || !href) {
    return (
      <span
        className={className}
        title={`${check.label}. ${check.hint}`}
        aria-label={`${kind === "call" ? "Telepon" : "WhatsApp"}: ${check.label}`}
        aria-disabled="true"
      >
        <Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden />
      </span>
    );
  }

  return (
    <a
      href={href}
      target={kind === "whatsapp" ? "_blank" : undefined}
      rel={kind === "whatsapp" ? "noopener noreferrer" : undefined}
      className={className}
      title={label}
      aria-label={label}
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden />
    </a>
  );
}

export function PhoneStatusHint({
  phone,
  className,
}: {
  phone: string | null | undefined;
  className?: string;
}) {
  const check = checkPhone(phone);
  if (check.status === "valid") return null;
  return (
    <span
      className={cn(
        "text-[10px] font-semibold",
        check.status === "missing" ? "text-slate-400" : "text-amber-700",
        className,
      )}
    >
      {check.label}
    </span>
  );
}
