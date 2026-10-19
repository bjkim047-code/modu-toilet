// 게임 설정 파일
// 물건 이름, 설명 문구, 이용객 문구는 여기서 고치면 됩니다.
//
// 그림 교체 방법:
//   assets/items/<물건 id>.png       예) assets/items/toilet.png
//   assets/visitors/<이용객 id>_normal.png, _happy.png, _sad.png
//   파일이 있으면 그림을 쓰고, 없으면 임시 그림(이모지)을 씁니다.
//   1칸 = 64x64px, 배경이 투명한 PNG를 권장합니다.

var MODU_CONFIG = {
  cols: 30,
  rows: 20,
  // 입구 위치 (맨 아래 테두리, 2칸 폭)
  entrance: [{ x: 14, y: 19 }, { x: 15, y: 19 }],

  // layer 종류
  //   base  : 바닥/벽 자체를 바꿈
  //   floor : 바닥 위에 놓는 설비 (사람이 지나갈 수 없음)
  //   wall  : 벽이나 칸막이에 붙이는 물건
  items: [
    { id: 'wall', name: '벽', layer: 'base', group: '공간',
      desc: '공간을 나누는 벽이에요. 벽과 문으로 둘러싸인 곳이 하나의 칸이 돼요.' },
    { id: 'partFull', name: '칸막이(천장까지)', layer: 'base', group: '공간',
      desc: '바닥부터 천장까지 막힌 칸막이예요. 틈이 없어 누구나 안심하고 쓸 수 있어요.' },
    { id: 'partLow', name: '칸막이(아래 뚫림)', layer: 'base', group: '공간',
      desc: '아래와 위가 뚫린 흔한 칸막이예요. 다른 사람의 시선이 신경 쓰이는 사람도 있어요.' },
    { id: 'door', name: '문(잠금)', layer: 'base', group: '공간',
      desc: '잠글 수 있는 문이에요. 휠체어가 지나가려면 문을 2칸 폭으로 놓아 주세요.' },
    { id: 'tactile', name: '점자블록', layer: 'base', group: '공간',
      desc: '시각장애인이 발로 길을 알 수 있는 바닥이에요. 입구부터 칸 문 앞까지 이어 주세요.', emoji: '' },

    { id: 'toilet', name: '변기', layer: 'floor', group: '설비', emoji: '🚽',
      desc: '모든 칸에 꼭 필요해요.' },
    { id: 'sink', name: '세면대', layer: 'floor', group: '설비', emoji: '🚰',
      desc: '손을 씻는 곳이에요.' },
    { id: 'sinkLow', name: '낮은 세면대', layer: 'floor', group: '설비', emoji: '🚰',
      desc: '앉은 채로도 손이 닿는 높이예요. 휠체어 이용자, 어린이 모두 편해요.' },
    { id: 'diaper', name: '기저귀 교환대', layer: 'floor', group: '설비', emoji: '👶',
      desc: '아이를 돌보는 보호자는 성별과 상관없이 필요해요.' },
    { id: 'babySeat', name: '유아 의자', layer: 'floor', group: '설비', emoji: '🪑',
      desc: '보호자가 볼일을 보는 동안 아이가 앉아 기다리는 의자예요.' },
    { id: 'ostomy', name: '오스토미 세척대', layer: 'floor', group: '설비', emoji: '🚿',
      desc: '장루·요루 주머니를 비우고 씻는 설비예요. 칸 안에 있어야 편하게 쓸 수 있어요.' },

    { id: 'grabBar', name: '손잡이', layer: 'wall', group: '벽에 붙이기',
      desc: '변기 바로 옆 벽에 붙여 주세요. 몸을 옮기거나 일어설 때 잡아요.' },
    { id: 'braille', name: '점자 안내판', layer: 'wall', group: '벽에 붙이기',
      desc: '칸 문 옆 벽에 붙여 주세요. 손으로 읽는 안내판이에요.' },
    { id: 'signMale', name: '남자 표시', layer: 'wall', group: '벽에 붙이기', emoji: '🚹',
      desc: '성별로 나눈 표시예요. 붙이면 어떤 일이 생길까요?' },
    { id: 'signFemale', name: '여자 표시', layer: 'wall', group: '벽에 붙이기', emoji: '🚺',
      desc: '성별로 나눈 표시예요. 붙이면 어떤 일이 생길까요?' },

    { id: 'eraser', name: '지우개', layer: 'tool', group: '도구', emoji: '🧽',
      desc: '설치한 물건을 지워요. 물건이 없으면 벽을 바닥으로 되돌려요.' }
  ],

  // 이용객 5명
  visitors: [
    { id: 'wheelchair', name: '휠체어 이용자', emoji: '🧑‍🦽', color: '#3d7dd8',
      needs: ['문과 길이 2칸 이상 넓어요', '칸 안에서 휠체어를 돌릴 수 있어요', '변기 바로 옆 벽에 손잡이', '낮은 세면대'],
      happy: '혼자서도 편하게 이용했어요!' },
    { id: 'family', name: '아이와 함께 온 보호자', emoji: '👩‍👧', color: '#e07a2f',
      needs: ['둘이 함께 들어가는 넓은 칸(빈 바닥 6칸 이상)', '칸 안에 유아 의자나 기저귀 교환대', '세면대'],
      happy: '아이와 함께 들어갈 수 있어서 좋아요!' },
    { id: 'trans', name: '트랜스젠더·논바이너리 이용자', emoji: '🧑', color: '#c2569b',
      needs: ['성별 표시가 없는 칸', '천장까지 막힌 벽과 잠금문', '세면대'],
      happy: '눈치 보지 않고 이용했어요!' },
    { id: 'ostomy', name: '장루·요루 이용자', emoji: '🙂', color: '#2f9e7a',
      needs: ['칸 안에 오스토미 세척대', '세면대'],
      happy: '주머니를 편하게 정리했어요!' },
    { id: 'blind', name: '시각장애인', emoji: '🧑‍🦯', color: '#7a5bd1',
      needs: ['입구부터 칸 문 앞까지 이어진 점자블록', '칸 문 옆에 점자 안내판', '세면대'],
      happy: '길을 헤매지 않고 찾아왔어요!' }
  ]
};

if (typeof module !== 'undefined') module.exports = MODU_CONFIG;
