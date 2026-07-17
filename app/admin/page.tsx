import { AdminDashboard } from "@/components/admin-dashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Operations Console - CSB",
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

export default function AdminPage() {
  return <AdminDashboard />;
}
