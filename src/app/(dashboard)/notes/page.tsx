import { NotesView } from "@/components/notes/NotesView";

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ id?: string | string[] }> }) {
  const { id } = await searchParams;
  return <NotesView initialId={typeof id === "string" && id ? id : null} />;
}
