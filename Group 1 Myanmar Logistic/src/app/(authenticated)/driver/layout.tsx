import { requireRole } from "@/lib/auth/session";
import { DriverShell } from "@/components/layout/driver-shell";

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const profile=await requireRole("driver");
  return <DriverShell name={profile.full_name}>{children}</DriverShell>;
}
