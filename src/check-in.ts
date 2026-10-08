export interface CheckIn {
  status: StatusSummary | null;
  options: { [k: string]: Feature };
}

export interface StatusSummary {
  page: Page;
  incidents: Incident[];
  scheduled_maintenances: Maintenance[];
}

export interface Page {
  name: string;
  url: string;
}

export interface Incident {
  name: string;
  status: string;
  impact: string;
  shortlink: string;
}

export interface Maintenance {
  name: string;
  status: string;
  impact: string;
  shortlink: string;
  scheduled_for: string;
  scheduled_until: string;
}

export interface Feature {
  variant: boolean | string;
  payload?: string;
}
