import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardNav from "@/components/dashboard/DashboardNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const shop = await prisma.shop.findUnique({
    where: { id: session.user.shopId },
    select: { name: true },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav
        shopName={shop?.name || "My Shop"}
        userName={session.user.name}
      />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
