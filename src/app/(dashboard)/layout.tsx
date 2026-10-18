import { AppHeader } from "@/components/dashboard/app-header";
import { AppSidebar } from "@/components/dashboard/app-sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-background text-ink">
      <div className="fixed inset-y-0 left-0 z-30 hidden lg:block">
        <AppSidebar />
      </div>

      <div className="flex min-h-full flex-col lg:pl-64">
        <AppHeader />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-6 md:px-8">
          {children}
          <footer className="mt-7 flex flex-wrap items-center justify-between gap-2 border-t border-line py-5 text-[9px] text-slate-400">
            <span>Dashboard Monitoring TPK • Kemendukbangga/BKKBN</span>
            <span>
              Kerangka layout — belum menampilkan data resmi operasional.
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
