
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Gravity — Your workday, focused",
  description: "One AI assistant for your Slack, GitHub, Notion and Calendar.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
