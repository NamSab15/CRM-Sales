import * as React from 'react';

export const metadata = {
  title: 'SalesFlow AI CRM - Web Client',
  description: 'AI-driven CRM system for high-velocity teams.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, fontFamily: 'system-ui, sans-serif', backgroundColor: '#F9FAFB' }}>
        {children}
      </body>
    </html>
  );
}
