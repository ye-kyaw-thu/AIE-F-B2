import { requireProfile } from "@/lib/auth/session";
import { LiveWorkspace } from "@/components/tracking/live-workspace";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const profile=await requireProfile();
  return <LiveWorkspace userId={profile.id} role={profile.role}>{children}</LiveWorkspace>;
}
