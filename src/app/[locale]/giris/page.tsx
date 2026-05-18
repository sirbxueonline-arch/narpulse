import { setRequestLocale } from "next-intl/server";
import LoginForm from "@/components/auth/LoginForm";
import { Card } from "@/components/ui/Card";
import Logo from "@/components/brand/Logo";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <section className="flex-1 grid place-items-center px-4 py-16">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size={36} />
        </div>
        <LoginForm />
      </Card>
    </section>
  );
}
