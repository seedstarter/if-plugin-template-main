export type YourGlobalConfig = Record<string, any>;

export type IFOutputYmlPathInfo = {
  pathDir: string;
  pathFile: string;
};

export type IfOutputsValues = Record<string, any>;

type errorName =
  | 'network error'
  | 'auth error'
  | 'code error'
  | 'YAMLParseError'
  | 'YAMLWarning';

export class CustomError extends Error {
  name: errorName;
  message: string;
  cause: any;
  constructor({
    name,
    message,
    description,
  }: {
    name: errorName;
    message: string;
    description?: any;
  }) {
    super();
    this.name = name;
    this.message = message;
    this.cause = description;
  }
}

interface Jobs {
  'update-readme': UpdateReadme;
}

interface UpdateReadme {
  'runs-on': string;
  steps: Step[];
}

interface Step {
  name: string;
  uses?: string;
  run?: string;
  shell?: string;
  id?: string;
  env?: Env;
}

interface Env {
  GITHUB_TOKEN: string;
}

export interface WorkflowYMLObj {
  name: string;
  on: string[];
  jobs: Jobs;
}
