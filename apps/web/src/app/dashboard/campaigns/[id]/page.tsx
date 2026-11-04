import { ManageNeed } from '@/components/dashboard/NeedEditor';

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ManageNeed id={id} />;
}
