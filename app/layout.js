import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import Header from "./_components/Header";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { UserProfileProvider } from "@/context/UserProfileContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
            className={`${geistSans.variable} ${geistMono.variable} antialiased`}
          >
            <Header />

            <div>
              <ToastContainer />
              {children}
            </div>
          </body>
        </html>
      </UserProfileProvider>
    </ClerkProvider>
  );
}