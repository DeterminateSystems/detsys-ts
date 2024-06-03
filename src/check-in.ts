export type CheckIn = {
  status: StatusSummary | null;
  options: Map<string, Feature>;
};

export type StatusSummary = {
  page: Page;
  incidents: Incident[];
  scheduled_maintenance: Maintenance[];
};

export type Page = {
  name: string;
  url: string;
};

export type Incident = {
  name: string;
  status: string;
  impact: string;
  shortlink: string;
};

export type Maintenance = {
  name: string;
  status: string;
  impact: string;
  shortlink: string;
  scheduled_for: string;
  scheduled_until: string;
};

export type Feature = {
  variant: boolean | string;
  payload?: string;
};
