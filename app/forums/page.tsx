import type { Metadata } from "next";
import ForumApp from "@/components/forum-app";

export const metadata: Metadata = {
  title: "Forums · Crypto Sugar Babes",
  description: "Public community discussions for Crypto Sugar Babes members and visitors."
};

export default function ForumsPage() {
  return <ForumApp/>;
}
