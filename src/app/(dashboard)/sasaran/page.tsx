import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/dashboard/page-placeholder";
import { navItems } from "@/lib/navigation";

const page = navItems.find((item) => item.href === "/sasaran")!;

export const metadata: Metadata = {
  title: page.title,
};

export default function SasaranPage() {
  return (
    <PagePlaceholder
      title={page.title}
      description={page.description}
      icon={page.icon}
      note={page.note}
    />
  );
}
