export type RagIconName = "documents" | "search" | "answer" | "citation" | "check" | "graph";
const paths: Record<RagIconName, string> = {
  documents: "M7 3h9l4 4v14H7z M16 3v5h4 M3 7v14 M10 12h7 M10 16h7",
  search: "M15.5 15.5L21 21 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0 M6 10h8 M10 6v8",
  answer: "M3 3h18v14H9l-6 4z M7 8h10 M7 12h7",
  citation: "M9 8L6 5l-4 4 6 6 4-4 M15 16l3 3 4-4-6-6-4 4 M8 16l8-8",
  check: "M5 3h14v18H5z M8 8l2 2 5-5 M8 15l2 2 5-5",
  graph: "M3 3h6v6H3z M15 15h6v6h-6z M3 15h6v6H3z M6 9v6 M9 6h9v9",
};
export function RagIconGlyph({ name }: { name: RagIconName }) { return <path d={paths[name]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />; }
export default function RagIcon({ name }: { name: RagIconName }) { return <svg className="rag-icon" viewBox="0 0 24 24" aria-hidden="true"><RagIconGlyph name={name} /></svg>; }
