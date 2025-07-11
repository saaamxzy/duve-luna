import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
// import { initializeServer } from "~/server/init";

// // Initialize server-side features
// if (typeof window === "undefined") {
//   initializeServer();
// }

export const metadata: Metadata = {
  title: "Duve Helper - Lock Management System",
  description:
    "Manage your locks, reservations, and keyboard passwords with ease. Monitor daily tasks and configure your system seamlessly.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  viewport: "width=device-width, initial-scale=1",
  themeColor: "#2e026d",
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#2e026d" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Duve Helper" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
