// 게임 설정 파일
// 물건 이름, 크기, 설명 문구, 이용객 문구는 여기서 고치면 됩니다.
//
// 보드 전체가 하나의 모두의 화장실(1인 또는 보호자 동반 공간)입니다.
// 1칸은 약 25cm로 생각하고 크기를 정했습니다.
//
// 그림 교체 방법:
//   assets/items/<물건 id>.png       예) assets/items/toilet.png
//     크기는 기본 방향 기준 (가로 w칸 × 세로 h칸) × 64px. 예) 변기 128×192px
//     방향을 돌리면 그림도 함께 돌아갑니다. 기본 방향은 벽이 위쪽에 있는 모습입니다.
//   assets/items/floor.png, wall.png, entrance.png, tactile.png  (1칸 64×64px)
//   assets/visitors/<이용객 id>_normal.png, _happy.png, _sad.png
//   파일이 있으면 그림을 쓰고, 없으면 임시 그림(이모지)을 씁니다.

var MODU_CONFIG = {
  cols: 20,
  rows: 15,
  // 입구 위치 (오른쪽 아래, 4칸 폭 = 약 1m)
  entrance: [{ x: 14, y: 14 }, { x: 15, y: 14 }, { x: 16, y: 14 }, { x: 17, y: 14 }],

  // layer 종류
  //   tactile : 바닥에 까는 점자블록 (설비와 겹칠 수 있음)
  //   floor   : 바닥에 놓는 설비 (w×h칸 차지, 사람이 지나갈 수 없음)
  //   wall    : 바깥 벽에 붙이는 물건
  //   tool    : 지우개
  items: [
    { id: 'tactile', name: '점자블록', layer: 'tactile', group: '바닥',
      desc: '시각장애인이 발로 길을 알 수 있는 바닥이에요. 입구부터 변기 앞까지 이어 주세요. 설비 아래에도 깔 수 있어요.' },

    { id: 'toilet', name: '변기', layer: 'floor', group: '설비', w: 2, h: 3, rotatable: false, emoji: '🚽', color: '#ffffff',
      desc: '꼭 필요해요. 방향은 바꿀 수 없어요.' },
    { id: 'sink', name: '세면대', layer: 'floor', group: '설비', w: 3, h: 2, emoji: '🚰', color: '#ffffff',
      desc: '손을 씻는 곳이에요.' },
    { id: 'sinkLow', name: '낮은 세면대', layer: 'floor', group: '설비', w: 3, h: 2, emoji: '🚰', color: '#cfeee6',
      desc: '앉은 채로도 손이 닿는 높이예요. 휠체어 이용자, 어린이 모두 편해요.' },
    { id: 'diaper', name: '기저귀 교환대', layer: 'floor', group: '설비', w: 4, h: 3, emoji: '👶', color: '#fde9cf',
      desc: '아이를 돌보는 보호자는 성별과 상관없이 필요해요.' },
    { id: 'babySeat', name: '유아 의자', layer: 'floor', group: '설비', w: 2, h: 3, emoji: '🪑', color: '#fde9cf',
      desc: '보호자가 볼일을 보는 동안 아이가 앉아 기다리는 의자예요.' },
    { id: 'ostomy', name: '오스토미 세척대', layer: 'floor', group: '설비', w: 2, h: 2, emoji: '🚿', color: '#dfe9fb',
      desc: '장루·요루 주머니를 비우고 씻는 설비예요.' },
    { id: 'grabBar', name: '손잡이', layer: 'floor', group: '설비', w: 3, h: 1, emoji: '', color: '#f08a24',
      desc: '변기 바로 옆에 붙여 주세요. 몸을 옮기거나 일어설 때 잡아요.' },

    { id: 'braille', name: '점자 안내판', layer: 'wall', group: '벽에 붙이기',
      desc: '입구 옆 바깥 벽에 붙여 주세요. 손으로 읽는 안내판이에요.' },

    { id: 'eraser', name: '지우개', layer: 'tool', group: '도구', emoji: '🧽',
      desc: '설비, 안내판, 점자블록을 지워요. 끌면 여러 개를 지울 수 있어요.' }
  ],

  // 이용객 5명
  visitors: [
    { id: 'wheelchair', name: '휠체어 이용자', emoji: '🧑‍🦽', color: '#3d7dd8',
      needs: ['입구에서 변기 옆까지 3칸 폭의 길', '휠체어가 돌 수 있는 6×6칸 빈 공간', '변기 바로 옆 손잡이', '낮은 세면대'],
      happy: '혼자서도 편하게 이용했어요!' },
    { id: 'family', name: '아이와 함께 온 보호자', emoji: '👩‍👧', color: '#e07a2f',
      needs: ['변기', '유아 의자나 기저귀 교환대', '세면대'],
      happy: '아이와 함께 들어갈 수 있어서 좋아요!' },
    { id: 'trans', name: '트랜스젠더·논바이너리 이용자', emoji: '🧑', color: '#c2569b',
      needs: ['성별을 묻지 않는 1인 공간 (모두의 화장실이면 충분해요)', '변기', '세면대'],
      happy: '성별을 묻지 않으니 눈치 보지 않고 이용했어요!' },
    { id: 'ostomy', name: '장루·요루 이용자', emoji: '🙂', color: '#2f9e7a',
      needs: ['변기', '오스토미 세척대', '세면대'],
      happy: '주머니를 편하게 정리했어요!' },
    { id: 'blind', name: '시각장애인', emoji: '🧑‍🦯', color: '#7a5bd1',
      needs: ['입구부터 변기 앞까지 이어진 점자블록', '입구 옆 벽에 점자 안내판', '변기', '세면대'],
      happy: '길을 헤매지 않고 찾아왔어요!' }
  ]
};

if (typeof module !== 'undefined') module.exports = MODU_CONFIG;
