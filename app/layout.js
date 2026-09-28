import { Geist_Mono, Space_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import Header from "./_components/Header";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { UserProfileProvider } from "@/context/UserProfileContext";

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Veronica",
  description: "AI-powered food safety and health analysis",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <UserProfileProvider>
        <html lang="en">
          <body
            className={`${spaceMono.variable} ${geistMono.variable} antialiased`}
          >
            <Header />

            <div className="app-content">
              <ToastContainer />
              {children}
            </div>
          </body>
        </html>
      </UserProfileProvider>
    </ClerkProvider>
  );
}