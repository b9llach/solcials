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
  title: "solcials",
  description: "completely decentralized social media built on solana",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://solcials.com'),
  icons: {
    icon: '/ico.png',
    shortcut: '/ico.png',
    apple: '/ico.png',
  },
  openGraph: {
    title: "solcials",
    description: "completely decentralized social media built on solana",
    url: "/",
    siteName: "solcials",
    type: 'website',
    images: [
      {
        url: '/ico.png',
        width: 512,
        height: 512,
        alt: 'solcials',
      }
    ],
  },
  twitter: {
    card: 'summary',
    title: "solcials",
    description: "completely decentralized social media built on solana",
    site: '@solcials',
    creator: '@solcials',
    images: ['/ico.png'],
  },
  other: {
    'theme-color': '#ffffff', // white color for brand
    // Additional Twitter meta tags for better embedding
    'twitter:app:name:iphone': 'solcials',
    'twitter:app:name:ipad': 'solcials',
    'twitter:app:name:googleplay': 'solcials',
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
