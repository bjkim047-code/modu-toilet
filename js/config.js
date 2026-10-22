// 게임 설정 파일
// 물건 이름, 크기, 설명 문구, 이용객 문구는 여기서 고치면 됩니다.
//
// 보드 전체가 하나의 모두의 화장실(1인 또는 보호자 동반 공간)입니다.
// 1칸은 약 25cm로 생각하고 크기를 정했습니다.
//
// 그림 교체 방법:
//   assets/items/<물건 id>.png       예) assets/items/toilet.png
//     크기는 기본 방향 기준 (가로 w칸 × 세로 h칸) × 128px. 예) 변기 256×384px (64px 단위도 됨)
//     방향을 돌리면 그림도 함께 돌아갑니다. 기본 방향은 벽이 위쪽에 있는 모습입니다.
//   assets/items/floor.png, wall.png, entrance.png, tactile.png, braille.png  (1칸, 정사각형)
//   assets/visitors/<이용객 id>_normal.png, _happy.png, _sad.png
//   마름모 보기용 방향별 그림 (있으면 위 그림 대신 씀):
//     assets/items/<id>_iso_a.png : 왼쪽 아래를 보는 모습 (오른쪽 위 벽에 붙음, 기본 방향)
//     assets/items/<id>_iso_b.png : 오른쪽 아래를 보는 모습 (왼쪽 위 벽에 붙음)
//   rotations: 돌릴 수 있는 방향 목록 (0=기본, 1, 2, 3 = 시계 방향 90도씩). 없으면 네 방향 모두
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
    { id: 'select', name: '선택', layer: 'tool', group: '도구', emoji: '👆',
      desc: '놓은 설비를 눌러 고르고, 끌어서 옮기거나 위쪽 버튼으로 돌리기·지우기를 해요.' },
    { id: 'eraser', name: '지우개', layer: 'tool', group: '도구', emoji: '🧽',
      desc: '설비, 안내판, 점자블록을 지워요. 끌면 여러 개를 지울 수 있어요.' },

    { id: 'tactile', name: '점자블록', layer: 'tactile', group: '바닥',
      desc: '시각장애인이 발로 길을 알 수 있는 바닥이에요. 입구부터 변기 앞까지 이어 주세요. 설비 아래에도 깔 수 있어요.' },

    { id: 'toilet', name: '변기', layer: 'floor', group: '설비', w: 2, h: 3, rotations: [0, 3], emoji: '🚽', color: '#ffffff',
      desc: '꼭 필요해요. 오른쪽 위 벽이나 왼쪽 위 벽에 붙여 놓을 수 있어요.' },
    // anchor: 'center' = 그림 가운데를 차지한 칸들의 가운데 위에 둠 (벽에서 앞으로 튀어나온 큰 벽걸이 물건)
    // 실제 약 35 × 50cm
    { id: 'childToilet', name: '아동용 변기', layer: 'floor', group: '설비', w: 2, h: 2, rotations: [0, 3], emoji: '🚽', color: '#fff3c4',
      desc: '아이 몸에 맞는 작은 변기예요. 보호자와 함께 온 아이가 혼자 앉을 수 있어요.' },
    { id: 'sink', name: '세면대', layer: 'floor', mount: true, bands: [2], group: '설비', w: 3, h: 2, rotations: [0, 3], anchor: 'center', isoW: 2.3, emoji: '🚰', color: '#ffffff',
      desc: '벽에 거는 세면대예요. 뒤쪽 벽 바로 옆에 가운데 높이로 붙고, 아래가 비어 있어 휠체어도 다가갈 수 있어요.' },
    { id: 'sinkLow', name: '낮은 세면대', layer: 'floor', mount: true, bands: [1], group: '설비', w: 3, h: 2, rotations: [0, 3], anchor: 'center', isoW: 2.3, emoji: '🚰', color: '#cfeee6',
      desc: '벽 아래 단에 거는 낮은 세면대예요. 앉은 채로 손이 닿고, 아래가 비어 있어 휠체어 무릎이 들어가요. 어린이도 편해요.' },
    { id: 'diaper', name: '기저귀 교환대', layer: 'floor', mount: true, bands: [2], group: '설비', w: 3, h: 2, rotations: [0, 3, 2, 1], anchor: 'center', isoW: 2.3, emoji: '👶', color: '#fde9cf',
      desc: '벽에 거는 접이식 교환대예요. 네 벽 어디든(입구 앞 제외) 바로 옆에 가운데 높이로 붙어요. 아이를 돌보는 보호자는 성별과 상관없이 필요해요.' },
    { id: 'babySeat', name: '유아 의자', layer: 'floor', mount: true, bands: [2], group: '설비', w: 1, h: 2, rotations: [0, 3, 2, 1], anchor: 'center', isoW: 1.05, emoji: '🪑', color: '#fde9cf',
      desc: '벽에 거는 접이식 의자예요. 보호자가 볼일을 보는 동안 아이가 앉아 기다려요. 네 벽 어디든(입구 앞 제외) 바로 옆에 가운데 높이로 붙어요.' },
    // 실제 제품은 약 가로 60 × 깊이 65cm. 벽 판까지 생각해 벽을 따라 3칸, 깊이 2칸
    { id: 'ostomy', name: '오스토미 세척대', layer: 'floor', group: '설비', w: 3, h: 2, rotations: [0, 3, 2, 1], emoji: '🚿', color: '#dfe9fb',
      desc: '장루·요루 주머니를 비우고 씻는 설비예요. 네 방향 어느 벽이든 등지게 돌려 놓을 수 있어요.' },
    { id: 'grabBar', name: '손잡이', layer: 'floor', group: '설비', w: 1, h: 3, emoji: '', color: '#f08a24',
      desc: '변기 바로 옆에 붙여 주세요. 몸을 옮기거나 일어설 때 잡아요.' },

    { id: 'braille', name: '점자 안내판', layer: 'wall', group: '벽에 붙이기',
      desc: '입구 옆 바깥 벽에 붙여 주세요. 손으로 읽는 안내판이에요.' },
    // mount: 뒤쪽 벽 바로 옆 칸의 벽에 붙는 물건. bands: 붙일 수 있는 벽 높이 단 (1=아래, 2=가운데, 3=위)
    //   높이 단이 다르면 같은 칸에 겹쳐 놓을 수 있고, 바닥 설비와도 겹칠 수 있음
    { id: 'bell', name: '비상벨', layer: 'floor', mount: true, bands: [1, 2, 3], group: '벽에 붙이기', w: 1, h: 1, rotations: [0, 3], along: true, isoW: 0.42, emoji: '🚨', color: '#ffffff',
      desc: '위급할 때 누르는 벨이에요. 뒤쪽 벽 바로 옆 칸에 붙이고, 높이(아래·가운데·위)를 고를 수 있어요.' },
    { id: 'paperHolder', name: '휴지걸이', layer: 'floor', mount: true, bands: [2], group: '벽에 붙이기', w: 1, h: 1, rotations: [0, 3], emoji: '🧻', color: '#ffffff',
      desc: '뒤쪽 벽 바로 옆 칸에 붙여요. 벽 가운데 높이라 변기 같은 설비와 같은 칸에 겹쳐 놓을 수 있어요.' },
    // along: 벽을 따라 길게 붙는 물건 (그림 가운데를 벽 선에 맞춤). isoW: 마름모 보기에서 그림 너비 (칸 너비 기준)
    { id: 'towelBar', name: '수건걸이', layer: 'floor', mount: true, bands: [2], group: '벽에 붙이기', w: 2, h: 1, rotations: [0, 3], along: true, isoW: 1.15, emoji: '🧺', color: '#ffffff',
      desc: '뒤쪽 벽을 따라 2칸에 걸쳐 붙여요. 휴지걸이와 같은 벽 가운데 높이라 휴지걸이와는 겹칠 수 없어요.' },

    // 꾸미기용 벽 스티커. 판정에는 영향 없음. 높이(아래·가운데·위)를 고를 수 있음
    { id: 'rainbow', name: '무지개 스티커', layer: 'floor', mount: true, bands: [3, 2, 1], group: '벽에 붙이기', w: 2, h: 1, rotations: [0, 3], along: true, isoW: 1.25, emoji: '🌈', color: '#ffffff',
      desc: '벽에 붙이는 무지개 스티커예요. 모두를 환영한다는 표시가 돼요. 높이를 고를 수 있어요.' },

  ],

  // 이용객 5명
  visitors: [
    { id: 'wheelchair', name: '휠체어 이용자', emoji: '🧑‍🦽', color: '#3d7dd8',
      needs: ['입구에서 변기 옆까지 3칸 폭의 길', '휠체어가 돌 수 있는 6×6칸 빈 공간', '변기 바로 옆 손잡이', '낮은 세면대'],
      happy: '혼자서도 편하게 이용했어요!' },
    // scale: 캐릭터 그림 크기 배율 (기본 1). 1.36이면 휠체어 이용자 그림과 같은 높이
    { id: 'family', name: '아이와 함께 온 보호자', emoji: '👩‍👧', color: '#e07a2f', scale: 1.36,
      needs: ['변기', '아동용 변기', '유아 의자나 기저귀 교환대', '아이 손이 닿는 낮은 세면대'],
      happy: '아이와 함께 들어갈 수 있어서 좋아요!' },
    { id: 'trans', name: '트랜스젠더·논바이너리 이용자', emoji: '🧑', color: '#c2569b', scale: 1.36,
      needs: ['성별을 묻지 않는 1인 공간 (모두의 화장실이면 충분해요)', '변기', '세면대'],
      happy: '성별을 묻지 않으니 눈치 보지 않고 이용했어요!' },
    { id: 'ostomy', name: '장루·요루 이용자', emoji: '🙂', color: '#2f9e7a', scale: 1.36,
      needs: ['변기', '오스토미 세척대', '세면대'],
      happy: '주머니를 편하게 정리했어요!' },
    { id: 'blind', name: '시각장애인', emoji: '🧑‍🦯', color: '#7a5bd1', scale: 1.36,
      needs: ['입구부터 변기 앞까지 이어진 점자블록', '입구 옆 벽에 점자 안내판', '변기', '세면대'],
      happy: '길을 헤매지 않고 찾아왔어요!' }
  ]
};

if (typeof module !== 'undefined') module.exports = MODU_CONFIG;
