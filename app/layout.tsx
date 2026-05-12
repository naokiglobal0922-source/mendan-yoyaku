import type { Metadata, Viewport } from "next"
import { Noto_Serif_JP } from 'next/font/google'
import "./globals.css"

const notoSerifJP = Noto_Serif_JP({
  weight: ['700'],
  preload: false,
  variable: '--font-serif-jp',
  display: 'swap',
})

export const metadata: Metadata = {
  title: "EIMEI予備校面談予約システム",
  description: "EIMEI予備校の面談予約システム",
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className={notoSerifJP.variable}>
      <body>{children}</body>
    </html>
  )
}
