export interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  description: string;
  active: boolean;
}

export interface Suggestion {
  id: string;
  text: string;
  type: 'option' | 'action' | 'revision';
}

export type ViewMode = 'chat' | 'synopsis' | 'script' | 'scene' | 'production' | 'postproduction';
export type StageType = 'idea' | 'synopsis' | 'script' | 'production' | 'postproduction';

export interface SynopsisData {
  title: string;
  subtitle: string;
  format: string;
  genre: string[];
  keyConcept: string;
  visualReference: string;
  thematicReference: string;
  logline: string;
  characters: string;
  synopsis: string;
}

export interface Cut {
  id: string;
  title: string;
  description: string;
  type: 'wide' | 'medium' | 'close' | 'detail';
  duration: number;
  image?: string;
  video?: string;
  prompt: string;
}

export interface SceneNode {
  id: string;
  title: string;
  description: string;
  type: 'intro' | 'main' | 'outro' | 'transition';
  duration: number;
  status: 'pending' | 'in-progress' | 'completed';
  image?: string;
  cuts?: Cut[];
  notes?: string;
}

export interface ScreenplayElement {
  id: string;
  type: 'scene-heading' | 'action' | 'character' | 'parenthetical' | 'dialogue' | 'transition';
  content: string;
}
