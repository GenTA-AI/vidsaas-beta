# Design System — GenTA Studio

## Product Context
- **What this is:** AI 영상 제작 SaaS. 브리프 → 기획 → 시나리오 → 이미지/영상 생성 → 후보정까지 5단계 파이프라인.
- **Who it's for:** B2B 클라이언트 (브랜드, 에이전시). 영상 제작 전문가 + 비전문가 모두 사용.
- **Space/industry:** AI video generation (Runway, Pika, Descript, CapCut 경쟁)
- **Project type:** Web app (dashboard + editor hybrid)

## Aesthetic Direction
- **Direction:** Luxury/Refined + Industrial, Apple Liquid Glass 가미
- **Decoration level:** Intentional — glass는 구조적 요소(헤더, 사이드바, 모달)에만 선택적 사용. 카드/콘텐츠는 solid surface.
- **Mood:** "이 도구는 진지한 제작 툴이다." 절제된 프로페셔널 + 미묘한 깊이감.
- **Reference:** Runway의 절제미 + Apple visionOS의 liquid glass
- **Anti-patterns:** heavy glass everywhere, gradient buttons, colored circles around icons, centered-everything layouts

## Typography
- **Display/Hero:** Satoshi (Variable, fontshare.com) — 기하학적이고 현대적. 헤딩, 큰 숫자, 로고 텍스트에 사용.
- **Body:** DM Sans (Google Fonts) — 가독성 높고 깔끔한 산세리프. 본문, 설명, 라벨.
- **Mono:** JetBrains Mono (Google Fonts) — 프롬프트, 코드, 상태 표시, 메타 정보.
- **Korean:** Pretendard Variable (fallback) — 한글 가독성 최적.
- **Loading:** Satoshi via fontshare CDN, DM Sans + JetBrains Mono via Google Fonts, Pretendard via jsdelivr CDN.
- **Scale:** 11px(mono-small) / 13px(body-small) / 15px(body) / 18px(h3) / 24px(h2) / 36px(h1) / 48px(display)

## Color
- **Approach:** Restrained — 단일 액센트 + glow. 그라디언트 없음.
- **Background:** #0a0a0a
- **Surface:** #141414 (card, panel)
- **Elevated:** #1a1a1a (hover, elevated card)
- **Glass:** rgba(255,255,255,0.04) + backdrop-filter: blur(20px) saturate(1.2)
- **Glass Strong:** rgba(255,255,255,0.06) + backdrop-filter: blur(30px) saturate(1.4)
- **Glass Border:** rgba(255,255,255,0.12)
- **Border:** rgba(255,255,255,0.08)
- **Text Primary:** #ffffff
- **Text Secondary:** #a0a0a0
- **Text Muted:** #555555
- **Accent:** #5B7FFF (단일색, 그라디언트 없음)
- **Accent Glow:** rgba(91,127,255,0.08) — box-shadow, focus ring에 사용
- **Success:** #34D399
- **Warning:** #FBBF24
- **Error:** #EF4444
- **Dark mode:** 기본이자 유일한 모드. 영상 콘텐츠가 잘 보이려면 필수.

## Spacing
- **Base unit:** 8px
- **Density:** Comfortable
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64)

## Layout
- **Approach:** Grid-disciplined — Sidebar(220px) + Main(flex) + Right Panel(260px)
- **Max content width:** 1200px (marketing), full-width (app)
- **Border radius:** sm:6px, md:10px, lg:14px, xl:20px

## Liquid Glass Rules
- **WHERE to use glass:** Header bar, Sidebar, Modal/Dialog, Command Palette, Tooltips
- **WHERE NOT to use glass:** Content cards, Scene cards, Input fields, Buttons, Alerts
- **Glass = "이것은 환경(system UI)이다"** vs **Solid = "이것은 콘텐츠다"**
- **Glass properties:**
  - Light: `background: rgba(255,255,255,0.03); backdrop-filter: blur(20px) saturate(1.2); border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 1px 2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04);`
  - Strong: `background: rgba(255,255,255,0.06); backdrop-filter: blur(30px) saturate(1.4); border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06);`
- **Accent glow:** Primary buttons and accent elements get `box-shadow: 0 0 12px rgba(91,127,255,0.08)`
- **Focus ring:** `box-shadow: 0 0 0 3px rgba(91,127,255,0.08)`

## Motion
- **Approach:** Minimal-functional — 전환과 상태 변화만. 장식 애니메이션 없음.
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(100ms) short(150ms) medium(200ms)
- **Rules:** hover 색상 변화만. fadeIn/slideIn 같은 entrance animation 제거. 스크롤 기반 애니메이션 없음.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-31 | Initial design system | Runway-inspired minimal + Apple Liquid Glass. /design-consultation research. |
| 2026-03-31 | Glass = structural only | Apple 원칙: glass는 system UI(헤더,사이드바,모달), 콘텐츠는 solid. |
| 2026-03-31 | #5B7FFF single accent | Pika의 블루-퍼플 그라디언트와 차별화. 단일색 + glow로 성숙한 느낌. |
| 2026-03-31 | Satoshi + DM Sans | 기하학적 디스플레이(Satoshi) + 가독성 본문(DM Sans). Pretendard는 한글 fallback. |
| 2026-03-31 | No gradients anywhere | 그라디언트 제거로 Pika 시각적 분리 + 프로 신뢰감. |
