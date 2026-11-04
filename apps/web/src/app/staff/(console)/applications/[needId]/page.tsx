import { ApplicationReview } from '@/components/staff/ApplicationReview';

export default async function ApplicationPage({ params }: { params: Promise<{ needId: string }> }) {
  const { needId } = await params;
  return <ApplicationReview needId={needId} />;
}
