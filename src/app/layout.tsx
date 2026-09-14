import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MM — Form that keeps living",
  description:
    "An artistic Conway’s Game of Life. Black field, liquid white cells, the classic setups.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full bg-black antialiased">
      <body className="min-h-full bg-black text-white">{children}</body>
    </html>
  );
}
