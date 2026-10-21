import "./globals.css";
import BottomNav from "../components/BottomNav";

export const metadata = {
  title: "ParrillaPay",
  description: "Split expenses at social events",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">
        <div className="mx-auto min-h-screen w-full max-w-md border-x border-zinc-800 bg-black pb-20">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
