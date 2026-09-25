import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Nav from "@/components/Nav";
import KeyGate from "@/components/KeyGate";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Higgsview — AI Video Generator",
  description: "Free AI video & image studio: every top model at raw Kie.ai prices",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Nav />
        <KeyGate>{children}</KeyGate>
        <footer className="mt-auto py-4 text-center text-xs text-muted">
          Powered by <a href="https://zerotouchai.com" target="_blank" rel="noreferrer" className="font-semibold text-fg hover:text-lime">ZeroTouchAI.com</a>
        </footer>
      </body>
    </html>
  );
}
