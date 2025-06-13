export type CheckIn = {
  status: StatusSummary | null;
  options: { [k: string]: Feature };
};

export type StatusSummary = {
  page: Page;
  incidents: Incident[];
  // biome-ignore lint/style/useNamingConvention: API JSON field
  scheduled_maintenances: Maintenance[];
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
  // biome-ignore lint/style/useNamingConvention: API JSON field
  scheduled_for: string;
  // biome-ignore lint/style/useNamingConvention: API JSON field
  scheduled_until: string;
};

export type Feature = {
  variant: boolean | string;
  payload?: string;
};
