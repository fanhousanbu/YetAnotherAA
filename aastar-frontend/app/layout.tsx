import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import ServiceStatus from "@/components/ServiceStatus";
import { ThemeProvider } from "@/lib/theme";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AAStar - ERC4337 Account Abstraction",
  description: "ERC4337 Account Abstraction with BLS Signatures",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider>
          {children}
          <Toaster position="top-right" />
          <ServiceStatus />
        </ThemeProvider>
      </body>
    </html>
  );
}
