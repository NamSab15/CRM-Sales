export enum LeadSource {
  WEBSITE = 'WEBSITE',
  REFERRAL = 'REFERRAL',
  COLD_CALL = 'COLD_CALL',
  EMAIL = 'EMAIL',
  OTHER = 'OTHER',
}

export enum LeadStatus {
  NEW = 'NEW',
  QUALIFIED = 'QUALIFIED',
  PROPOSAL = 'PROPOSAL',
  NEGOTIATION = 'NEGOTIATION',
  WON = 'WON',
  LOST = 'LOST',
  DELETED = 'DELETED',
}

export enum FollowUpType {
  CALL = 'CALL',
  EMAIL = 'EMAIL',
  MEETING = 'MEETING',
}

export enum FollowUpStatus {
  PENDING = 'PENDING',
  DONE = 'DONE',
  MISSED = 'MISSED',
}

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  SENT = 'SENT',
}

export enum UserRole {
  ADMIN = 'ADMIN',
  SALES_MANAGER = 'SALES_MANAGER',
  SALES_EXECUTIVE = 'SALES_EXECUTIVE',
}

export interface Lead {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  source: LeadSource;
  status: LeadStatus;
  score: number;
  assignedTo: string; // userId
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineStage {
  id: string;
  name: string;
  order: number;
  color: string;
}

export interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
  createdBy: string; // userId
}

export interface Deal {
  id: string;
  leadId: string;
  pipelineId: string;
  currentStageId: string;
  value: number;
  probability: number;
  expectedCloseDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface FollowUp {
  id: string;
  leadId: string;
  assignedTo: string; // userId
  scheduledAt: Date;
  type: FollowUpType;
  notes: string;
  status: FollowUpStatus;
  reminderSentAt?: Date | null;
  completedAt?: Date | null;
}

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  templateId: string;
  scheduledAt: Date;
  status: CampaignStatus;
  recipientCount: number;
}

export interface CallLog {
  id: string;
  leadId: string;
  userId: string;
  duration: number;
  recordingUrl?: string | null;
  notes: string;
  calledAt: Date;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teamId?: string | null;
  createdAt: Date;
}

export interface Team {
  id: string;
  name: string;
  managerId: string; // userId
  members: string[]; // array of userId
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  message: string;
  readAt?: Date | null;
  createdAt: Date;
}

export interface AILeadScore {
  leadId: string;
  score: number;
  signals: string[];
  confidence: number;
  generatedAt: Date;
}
