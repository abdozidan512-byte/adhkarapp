import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { azkarCategories } from "@/data/azkar";
import { ZikrCarousel } from "@/components/ZikrCarousel";

export const Route = createFileRoute("/azkar/$id")({
  component: AzkarDetail,
  loader: ({ params }) => {
    const cat = azkarCategories.find((c) => c.id === params.id);
    if (!cat) throw notFound();
    return cat;
  },
  notFoundComponent: () => (
    <div className="p-8 text-center">
      <p>الفئة غير موجودة</p>
      <Link to="/azkar" className="mt-4 inline-block text-primary underline">عودة</Link>
    </div>
  ),
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.title ?? "أذكار"} — نور` }],
  }),
});

function AzkarDetail() {
  const cat = Route.useLoaderData();
  return (
    <div className="flex h-[100dvh] flex-col" style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}>
      <div className="flex items-center justify-between px-4 pt-4">
        <Link
          to="/azkar"
          className="flex h-10 w-10 items-center justify-center rounded-full border bg-card"
          aria-label="رجوع"
        >
          <ChevronRight className="h-5 w-5" />
        </Link>
        <h1 className="text-base font-extrabold">{cat.title}</h1>
        <div className="w-10" />
      </div>
      <div className="mt-2 flex-1 overflow-hidden">
        <ZikrCarousel items={cat.items} title={cat.title} />
      </div>
    </div>
  );
}
