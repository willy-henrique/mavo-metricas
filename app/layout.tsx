import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mavo Gerenciamento",
  description: "Acompanhe o atendimento da sua empresa no WhatsApp",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
