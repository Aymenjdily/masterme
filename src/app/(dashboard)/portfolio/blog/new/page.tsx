import { redirect } from "next/navigation";
import { sanityConfigured } from "@/lib/sanity";
import { BlogWriter } from "@/components/blog/BlogWriter";

export default function NewBlogPostPage() {
  // Without Sanity there's nowhere to send drafts; the Portfolio blog card explains how to connect it.
  if (!sanityConfigured()) redirect("/portfolio");
  return <BlogWriter />;
}
