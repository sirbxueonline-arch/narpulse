import { Link } from "@/i18n/navigation";
import Logo from "@/components/brand/Logo";

export default function NotFound() {
  return (
    <section className="flex-1 grid place-items-center px-4 py-24 text-center">
      <div className="space-y-6 max-w-md">
        <Logo size={48} />
        <h1 className="text-3xl font-extrabold">404</h1>
        <p className="text-[var(--muted)]">
          Bu səhifə tapılmadı / This page was not found.
        </p>
        <Link
          href="/"
          className="inline-flex items-center px-4 h-11 rounded-xl bg-[var(--accent)] text-white font-semibold"
        >
          Ana səhifə
        </Link>
      </div>
    </section>
  );
}
