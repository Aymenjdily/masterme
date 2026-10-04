import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sanityConfigured } from "@/lib/sanity";
import { BlogWriter } from "@/components/blog/BlogWriter";

export const metadata: Metadata = { title: "New blog post" };

export default function NewBlogPostPage() {
  // Without Sanity there's nowhere to send drafts; the Portfolio blog card explains how to connect it.
  if (!sanityConfigured()) redirect("/portfolio");
  return <BlogWriter />;
}
