import { redirect } from "next/navigation";
import { UserScope } from "@/components/auth/user-scope";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { getSessionUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-aurora">
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]" />
      <UserScope userId={user.id} />
      <AppSidebar user={{ name: user.name, email: user.email }} />
      <main className="relative min-h-screen pt-16 lg:pl-[264px] lg:pt-0">
        <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
