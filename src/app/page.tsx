import type { Metadata } from "next";
import LoginForm from "@/components/shadcn-space/blocks/login-01/login";

// The root layout's title template only applies to nested pages, so spell it out here.
export const metadata: Metadata = { title: { absolute: "Sign in · MasterMe" } };

export default function HomePage() {
  return <LoginForm />;
}
