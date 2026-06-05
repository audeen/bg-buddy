import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { MeetupForm } from "@/components/MeetupForm";

export const dynamic = "force-dynamic";

export default async function NewMeetupPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/#login");

  return (
    <div className="container-app max-w-xl flex flex-col gap-4">
      <h1 className="page-title">Neues Treffen</h1>
      <MeetupForm />
    </div>
  );
}
