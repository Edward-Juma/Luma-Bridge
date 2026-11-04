export type Category =
  | 'EDUCATION' | 'FOOD' | 'MEDICAL' | 'RENT' | 'DISABILITY_SUPPORT'
  | 'ELDERLY' | 'ORPHANS' | 'SMALL_BUSINESS' | 'EMERGENCY_RELIEF' | 'REFUGEES';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface NeedCard {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: Category;
  priority: Priority;
  status: string;
  goalUsd: number;
  raisedUsd: number;
  percent: number;
  donationCount: number;
  deadline: string | null;
  coverUrl: string | null;
  createdAt: string;
  beneficiary: {
    name: string;
    age: number;
    gender: string;
    country: string;
    city: string;
    photoUrl: string | null;
    verificationId: string | null;
    verified: boolean;
  };
}

export interface PublicDonation {
  id: string;
  amount: number;
  currency: string;
  amountUsd: number;
  anonymous: boolean;
  donorName: string;
  donorCountry: string | null;
  message: string | null;
  createdAt: string;
}

export interface NeedDetail extends NeedCard {
  story: string;
  images: string[];
  remainingUsd: number;
  updates: { id: string; title: string; body: string; images: string[]; createdAt: string }[];
  comments: { id: string; authorName: string; body: string; createdAt: string }[];
  recentDonations: PublicDonation[];
  paymentMethods: { id: string; type: string; label: string; maskedHint: string }[];
  audit: { verificationId: string | null; verifiedAt: string | null; lastAuditAt: string | null; verifiedDocumentKinds: string[] };
  occupation: string;
  familySize: number;
  feePercent: number;
}

export interface Stats {
  totalRaisedUsd: number;
  successfulDonations: number;
  activeCampaigns: number;
  verifiedFamilies: number;
  countries: number;
}

export interface TickerItem extends PublicDonation {
  need: { title: string; slug: string; name: string; country: string };
}

export interface FeedResponse {
  items: NeedCard[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}
