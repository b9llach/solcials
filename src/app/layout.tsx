import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import WalletProvider from './components/WalletProvider';
import { ThemeProvider } from './components/ThemeProvider';

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "socials",
  description: "completely decentralized social media built on solana",
  icons: {
    icon: '/ico.png',
    shortcut: '/ico.png',
    apple: '/ico.png',
  },
  other: {
    'theme-color': '#ffffff', // white color for brand
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>
          <WalletProvider>
            {children}
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
