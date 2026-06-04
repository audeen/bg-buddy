import { redirect } from "next/navigation";

export default async function TinderRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/meetups/${id}/duell`);
}
