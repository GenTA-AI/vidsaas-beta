import { Agent } from './types';

export const AI_AGENTS: Agent[] = [
  { id: 'scene-architect', name: 'Scene Architect', emoji: '🏗️', role: '씬 구조 설계', description: '씬 구조와 전환 관리, 페이싱 조언', active: true },
  { id: 'dialogue-assistant', name: 'Dialogue Assistant', emoji: '💬', role: '대사 작성', description: '대사 옵션 제시, 톤 일관성 체크', active: true },
  { id: 'visual-director', name: 'Visual Director', emoji: '🎬', role: '시각 연출', description: '시각적 묘사, 카메라 앵글 제안', active: true },
  { id: 'continuity-keeper', name: 'Continuity Keeper', emoji: '🔗', role: '연속성 관리', description: '연속성 관리, 설정 충돌 체크', active: true },
  { id: 'creative-consultant', name: 'Creative Consultant', emoji: '✨', role: '창의성 강화', description: '창의적 아이디어 제공', active: true },
];

export const getActiveAgents = () => AI_AGENTS.filter(a => a.active);
export const getAgentById = (id: string) => AI_AGENTS.find(a => a.id === id);

export const DISCOVERY_QUESTIONS = [
  { category: '장르 톤 설정', emoji: '🎯', questions: ['어떤 느낌의 영상을 원하시나요?', '타겟 관객층은 누구인가요?', '참고할 만한 레퍼런스가 있나요?'] },
  { category: '캐릭터 구체화', emoji: '👤', questions: ['주인공의 성격과 배경은?', '주요 갈등은 무엇인가요?', '캐릭터의 변화 과정은?'] },
  { category: '중심 갈등 정의', emoji: '⚡', questions: ['핵심 갈등은 무엇인가요?', '갈등이 어떻게 해결되나요?', '클라이맥스는 어떤 장면인가요?'] },
  { category: '테마 메시지', emoji: '💡', questions: ['전달하고 싶은 메시지는?', '관객이 느끼길 원하는 감정은?', '영상의 핵심 가치는?'] },
];
