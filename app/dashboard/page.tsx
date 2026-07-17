import { MemberDashboard } from "@/components/member-dashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Member dashboard · Crypto Sugar Babes",
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

export default function DashboardPage() {
  return <MemberDashboard/>;
}
