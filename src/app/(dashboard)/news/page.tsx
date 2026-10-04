import type { Metadata } from "next";
import { NewsView } from "@/components/news/NewsView";

export const metadata: Metadata = { title: "Tech radar" };

export default function NewsPage() {
  return <NewsView />;
}
