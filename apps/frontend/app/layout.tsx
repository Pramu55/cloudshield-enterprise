import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CloudShield Enterprise",
  description: "AWS security posture, cost governance, and compliance evidence platform"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
