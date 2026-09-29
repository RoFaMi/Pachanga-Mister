import "./globals.css";

export const metadata = {
  title: "MÍSTER PACHANGA — Fantasy de Fútbol Sala 5v5",
  description: "Tu equipo. Tus colegas. Tu liga Fantasy de fútbol sala 5 contra 5.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-[#0b1310] text-slate-100">{children}</body>
    </html>
  );
}
