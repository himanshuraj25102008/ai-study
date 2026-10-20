import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI STUDY — Learn beyond limits",
  description: "A focused space for notes, quizzes, and steady learning.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
