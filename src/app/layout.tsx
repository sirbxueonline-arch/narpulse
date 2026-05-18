import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NarPulse — Rayonun nəbzi",
  description:
    "Nərimanovun nəbzini tut: kəsintilər, növbələr və təhlükəsizlik xəritəsi bir yerdə.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
