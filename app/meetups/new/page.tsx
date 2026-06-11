import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { MeetupForm } from "@/components/MeetupForm";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function NewMeetupPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/#login");

  return (
    <div className="container-app max-w-xl flex flex-col gap-6">
      <PageHeader eyebrow="Treffen" title="Neues Treffen" />
      <MeetupForm />
    </div>
  );
}
