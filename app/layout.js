import { Geist_Mono, Space_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import Header from "./_components/Header";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { UserProfileProvider } from "@/context/UserProfileContext";
import ServiceWorkerRegistration from "./ServiceWorkerRegistration";

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
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  themeColor: "#070708",
};

export default function RootLayout({ children }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  const content = (
    <UserProfileProvider>
      <html lang="en">
        <body
          className={`${spaceMono.variable} ${geistMono.variable} antialiased`}
        >
          <Header clerkEnabled={Boolean(publishableKey)} />
          <ServiceWorkerRegistration />

          <div className="app-content">
            <ToastContainer />
            {children}
          </div>
        </body>
      </html>
    </UserProfileProvider>
  );

  // Allow Vercel preview builds without Clerk's public key to prerender
  // public/error pages. Production auth remains enabled whenever the key exists.
  return publishableKey ? (
    <ClerkProvider publishableKey={publishableKey}>{content}</ClerkProvider>
  ) : (
    content
  );
}
