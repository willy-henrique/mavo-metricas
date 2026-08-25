import type { Metadata } from "next";
import "./globals.css";

const SCRIPT_TEMA = `
try {
  const salvo = localStorage.getItem("mavo-theme");
  const escuro = salvo === "dark" || (!salvo && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = escuro ? "dark" : "light";
} catch (_) {}
`;

export const metadata: Metadata = {
  title: "Mavo Gerenciamento",
  description: "Acompanhe o atendimento da sua empresa no WhatsApp",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
