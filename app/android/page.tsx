import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Android app · Crypto Sugar Babes",
  description: "Download and install the official Crypto Sugar Android app directly from the Crypto Sugar website."
};

export default function AndroidDownloadPage() {
  const apkUrl = process.env.ANDROID_APK_URL?.trim();
  const version = process.env.ANDROID_APP_VERSION?.trim() || "Private beta";
  const checksum = process.env.ANDROID_APK_SHA256?.trim();
  return <LegalPage
    eyebrow="ANDROID APP"
    title="Crypto Sugar on Android."
    intro={apkUrl
      ? "Download the official, signed Android app directly from Crypto Sugar. A Google Play listing is not required."
      : "The private Android beta is being prepared. The verified download will appear here after production signing and device testing are complete."}
    updated="July 20, 2026"
    sections={[
      {
        title: apkUrl ? `Download ${version}` : "Private beta status",
        paragraphs: apkUrl
          ? ["Only install the app from this page. Android will ask you to allow installs from your browser before it shows the final installation confirmation.", checksum ? `APK SHA-256: ${checksum}` : "A SHA-256 checksum will be published with every production APK."]
          : ["The application shell, messaging integration, and notification infrastructure are in active testing. No unsigned or debug build is offered for public download."],
        action: apkUrl ? { label: "Download signed APK", href: apkUrl } : undefined
      },
      {
        title: "Installation",
        items: [
          "Download the APK on your Android phone.",
          "When Android prompts you, allow app installation from this browser.",
          "Confirm the Crypto Sugar installation, then turn that browser permission off again if you prefer.",
          "Open the app, sign in, and choose whether to enable private message notifications."
        ]
      },
      {
        title: "Authenticity and updates",
        paragraphs: ["Every official release is signed with the same permanent Crypto Sugar key. Android rejects an update if its signature does not match the installed app.", "Updates will be announced inside the app and downloaded from this HTTPS website. Never install an APK sent through a direct message or email attachment."]
      }
    ]}
  />;
}
