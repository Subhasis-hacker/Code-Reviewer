import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AlgoReviewer – Autonomous Code Reviewer",
  description:
    "AI-powered algorithmic code review using LangGraph, Groq LLMs, and Docker sandboxing.",
  keywords: ["algorithm", "code review", "AI", "LangGraph", "Groq", "Big-O"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
