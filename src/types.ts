export interface SamplingParams {
  temperature: number;
  topK: number;
  topP: number;
}

export interface CandidateToken {
  id: number;
  text: string;
  logit: number;
}

export interface InputToken {
  id: number;
  text: string;
}

export interface TreeNode {
  id: string;
  parentId: string | null;
  prompt: string;
  inputTokens: InputToken[] | null;
  candidates: CandidateToken[] | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
}

export interface DistributionRequest {
  type: 'distribution-request';
  nodeId: string;
  prompt: string;
}

export interface DistributionResponse {
  type: 'distribution-response';
  nodeId: string;
  inputTokens: InputToken[];
  candidates: CandidateToken[];
}

export interface DistributionError {
  type: 'distribution-error';
  nodeId: string;
  error: string;
}

export interface ModelStatus {
  type: 'model-status';
  status: 'loading' | 'ready' | 'error';
  progress?: number;
  error?: string;
}

export type WorkerOutbound = DistributionResponse | DistributionError | ModelStatus;
export type WorkerInbound = DistributionRequest;
