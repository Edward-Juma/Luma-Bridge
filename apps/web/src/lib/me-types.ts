import type { Category, Priority } from './types';

export type VerificationStatus = 'DRAFT' | 'PENDING' | 'NEEDS_INFO' | 'APPROVED' | 'REJECTED';
export type NeedStatus = 'DRAFT' | 'PENDING' | 'NEEDS_INFO' | 'ACTIVE' | 'FUNDED' | 'CLOSED' | 'REJECTED' | 'SUSPENDED';

export interface MyNeed {
  id: string;
  slug: string;
  title: string;
  summary: string;
  story: string;
  category: Category;
  priority: Priority;
  status: NeedStatus;
  goalUsd: number;
  raisedUsd: number;
  donationCount: number;
  deadline: string | null;
  images: string[];
  coverUrl: string | null;
  createdAt: string;
}

export interface MyDocument {
  id: string;
  kind: string;
  mime: string;
  sizeBytes: number;
  createdAt: string;
  verified: boolean;
  needId: string | null;
}

export interface MyPaymentMethod {
  id: string;
  type: string;
  label: string;
  maskedHint: string;
  display: boolean;
}

export interface MyDonation {
  id: string;
  amount: number;
  currency: string;
  amountUsd: number;
  anonymous: boolean;
  donorName: string;
  donorCountry: string | null;
  message: string | null;
  needTitle: string;
  thankYouNote: string | null;
  createdAt: string;
}

export interface MyProfile {
  id: string;
  fullName: string;
  nationalIdMasked: string;
  phone: string;
  country: string;
  city: string;
  address: string | null;
  photoUrl: string | null;
  occupation: string;
  incomeLevel: 'NONE' | 'VERY_LOW' | 'LOW' | 'LOWER_MIDDLE' | 'MIDDLE';
  familySize: number;
  emergencyContactName: string;
  emergencyContactPhone: string;
  about: string;
  verificationStatus: VerificationStatus;
  verificationId: string | null;
  verifiedAt: string | null;
  profileCompletion: number;
}

export interface DashboardData {
  profile: MyProfile;
  feedback: { decision: 'REQUEST_INFO' | 'REJECT'; notes: string; at: string } | null;
  needs: MyNeed[];
  documents: MyDocument[];
  paymentMethods: MyPaymentMethod[];
  donations: MyDonation[];
  remainingUsd: number;
  unreadNotifications: number;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

// ───────── Staff ─────────
export interface StaffOverview {
  pending: number;
  needsInfo: number;
  alerts: number;
  criticalAlerts: number;
  reports: number;
  decidedToday: number;
  suspended: number;
}

export interface QueueItem {
  needId: string;
  title: string;
  category: Category;
  priority: Priority;
  goalUsd: number;
  submittedAt: string;
  applicant: { id: string; name: string; country: string; city: string };
  fraudScore: number;
  documentCount: number;
  lowestDocScore: number | null;
  reports: number;
  returning: boolean;
}

export interface Checklist {
  identity: boolean;
  documents: boolean;
  location: boolean;
  legitimacy: boolean;
  income: boolean;
  references: boolean;
  videoInterview: boolean;
  fieldVisit: boolean;
  governmentVerified: boolean;
  ngoVerified: boolean;
  communityLeader: boolean;
  employer: boolean;
  hospital: boolean;
  school: boolean;
}

export interface FraudAlertRow {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  score: number;
  details: { reasons?: { code: string; weight: number; detail: string }[] } | null;
  resolved: boolean;
  createdAt: string;
  beneficiary: { id: string; fullName: string; country: string } | null;
  need: { id: string; title: string } | null;
}

export interface ApplicationDetail {
  need: {
    id: string; title: string; summary: string; story: string; category: Category; priority: Priority;
    status: NeedStatus; goalUsd: number; deadline: string | null; images: string[]; createdAt: string;
  };
  applicant: {
    id: string; fullName: string; nationalId: string; phone: string; email: string; gender: string; dateOfBirth: string;
    country: string; city: string; address: string | null; photoUrl: string | null; incomeLevel: string; occupation: string;
    familySize: number; emergencyContactName: string; emergencyContactPhone: string; about: string;
    verificationStatus: VerificationStatus; verificationId: string | null; accountStatus: string;
    signupIp: string | null; lastIp: string | null; joinedAt: string;
  };
  documents: { id: string; kind: string; mime: string; sizeBytes: number; aiScore: number | null; aiNotes: string | null; verified: boolean; needId: string | null; createdAt: string }[];
  paymentMethods: { id: string; type: string; label: string; maskedHint: string; details: Record<string, string> }[];
  risk: { score: number; reasons: { code: string; weight: number; detail: string }[] };
  alerts: FraudAlertRow[];
  reports: { id: string; reason: string; details: string | null; status: string; createdAt: string }[];
  related: { id: string; fullName: string; verificationStatus: string; country: string }[];
  history: { id: string; decision: string; notes: string; checklist: Partial<Checklist>; auditor: string; createdAt: string; needId: string | null }[];
}

export interface ReportRow {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  need: { id: string; title: string; slug: string };
}

export interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  meta: unknown;
  ip: string | null;
  createdAt: string;
  actor: { email: string; role: string } | null;
}
