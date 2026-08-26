import type { Metadata } from 'next';
import '@inventoryfy/design-tokens/tokens.css';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/components/auth-provider';

export const metadata: Metadata = {
  title: 'Inventoryfy',
  description: 'Multi-tenant e-commerce inventory management',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="app-shell">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
