import { notFound } from "next/navigation";
import { PreviaDesign } from "./_components/previa-design";

export const dynamic = "force-dynamic";

export default function PaginaPreviaDesign() {
  if (process.env.NODE_ENV !== "development" || process.env.ATENDEIA_PREVIA_LOCAL !== "true") notFound();
  return <PreviaDesign />;
}
