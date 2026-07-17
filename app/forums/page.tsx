import type { Metadata } from "next";
import ForumApp from "@/components/forum-app";

export const metadata: Metadata = {
  title: "Forums · Crypto Sugar Babes",
  description: "Public community discussions for Crypto Sugar Babes members and visitors.",
  alternates: { canonical: "/forums" },
  openGraph: {
    title: "Crypto Sugar Babes Forums",
    description: "Public conversations about crypto, wallets, safety, travel, lifestyle, and respectful social discovery.",
    url: "/forums",
  },
};

export default function ForumsPage() {
  return <ForumApp/>;
}
