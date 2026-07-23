import "./globals.css";

export const metadata = {
  title: "galería",
  description: "una colección en curso.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className="dark">
      <body className="font-body min-h-screen relative">
        <div className="grain" />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
