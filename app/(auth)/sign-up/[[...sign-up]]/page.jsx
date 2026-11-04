import {SignUp} from "@clerk/nextjs";
export default function Page(){
  if(!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)return <main className="p-10 text-center">Authentication is not configured for this deployment.</main>;
  return <main className="flex min-h-[70vh] items-center justify-center p-6"><SignUp routing="path" path="/sign-up"/></main>;
}
