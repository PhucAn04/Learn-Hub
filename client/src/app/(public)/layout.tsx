'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 w-full relative flex flex-col">{children}</main>
      <Footer />
    </div>
  );
}
