import type { Metadata } from "next";
import { NotesView } from "@/components/notes/NotesView";

export const metadata: Metadata = { title: "Notes" };

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ id?: string | string[]; tag?: string | string[] }> }) {
  const { id, tag } = await searchParams;
  return (
    <NotesView
      initialId={typeof id === "string" && id ? id : null}
      initialTag={typeof tag === "string" && /^[a-z0-9-]{1,24}$/.test(tag) ? tag : null}
    />
  );
}
