export type PhoneStatus = "valid" | "missing" | "invalid";

export type PhoneCheck = {
  status: PhoneStatus;
  /** Digits only, country code 62 when valid. */
  e164Digits: string | null;
  label: string;
  hint: string;
};

/** Validasi nomor Indonesia opsional — kosong / tidak valid tidak boleh pecah UI. */
export function checkPhone(raw: string | null | undefined): PhoneCheck {
  if (raw == null || String(raw).trim() === "") {
    return {
      status: "missing",
      e164Digits: null,
      label: "Nomor tidak tersedia",
      hint: "Telepon opsional — belum tercatat di data simulasi",
    };
  }

  const trimmed = String(raw).trim();
  const digits = trimmed.replace(/\D/g, "");

  let normalized = digits;
  if (normalized.startsWith("0")) {
    normalized = `62${normalized.slice(1)}`;
  } else if (normalized.startsWith("8") && normalized.length >= 9) {
    normalized = `62${normalized}`;
  }

  const isMobile =
    /^62(8\d{8,11})$/.test(normalized) ||
    /^628\d{8,11}$/.test(normalized);

  if (!isMobile) {
    return {
      status: "invalid",
      e164Digits: null,
      label: "Tidak valid",
      hint: "Format nomor tidak valid — hubungi via saluran lain",
    };
  }

  return {
    status: "valid",
    e164Digits: normalized,
    label: formatDisplayPhone(normalized),
    hint: "Siap dihubungi",
  };
}

export function formatDisplayPhone(e164Digits: string) {
  if (e164Digits.startsWith("62") && e164Digits.length >= 11) {
    const rest = e164Digits.slice(2);
    return `+62 ${rest.slice(0, 3)}-${rest.slice(3, 7)}-${rest.slice(7)}`.replace(
      /-$/,
      "",
    );
  }
  return `+${e164Digits}`;
}

export function telHref(e164Digits: string) {
  return `tel:+${e164Digits}`;
}

export function waHref(e164Digits: string) {
  return `https://wa.me/${e164Digits}`;
}
