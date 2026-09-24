import { SignUp } from '@clerk/nextjs'

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
        <h1 className="text-2xl font-bold text-gray-900">Sign up disabled</h1>
        <p className="mt-3 text-gray-600">
          This local build is set to run without Clerk authentication.
        </p>
        <a
          href="/dashboard"
          className="mt-6 inline-block rounded-lg bg-green-600 px-5 py-3 font-medium text-white hover:bg-green-700"
        >
          Continue to Dashboard
        </a>
      </div>
    </div>
  );
}