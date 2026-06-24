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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                let theme = localStorage.getItem('cloudshield-theme') || 'system';
                if (!['light', 'dark', 'system'].includes(theme)) theme = 'system';
                if (theme === 'system') {
                  theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                }
                document.documentElement.setAttribute('data-theme', theme);

                let density = localStorage.getItem('cloudshield-density') || 'standard';
                if (!['comfortable', 'standard', 'compact'].includes(density)) density = 'standard';
                document.documentElement.setAttribute('data-density', density);
              } catch (e) {}
            `
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
