import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CareTime',
  description: 'Care management platform',
}

// Without this, mobile browsers render at a default desktop-width viewport and
// scale the whole page down to fit — everything looks correct on screen but at
// the wrong physical size, instead of laying out at the phone's actual width.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Arial, sans-serif' }}>{children}</body>
    </html>
  )
}
