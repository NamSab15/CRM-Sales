import * as React from 'react';

export const metadata = {
  title: 'SalesFlow AI CRM - Admin Dashboard',
  description: 'Administration portal for system configurations, user management, and logs.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, fontFamily: 'system-ui, sans-serif', backgroundColor: '#F3F4F6' }}>
        {children}
      </body>
    </html>
  );
}
