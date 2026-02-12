// 보스 데이터 - 결정석 가격 기준 (2025년 2월 기준)

export type Difficulty = "easy" | "normal" | "hard" | "chaos" | "extreme";

// 난이도 순서 (쉬운 순)
export const difficultyOrder: Difficulty[] = ["easy", "normal", "hard", "chaos", "extreme"];

export interface BossDifficulty {
  difficulty: Difficulty;
  price: number; // 메소
  partySize: number; // 최대 파티원 수
}

export interface Boss {
  id: string;
  name: string;
  isMonthly?: boolean; // 월간 보스 여부
  difficulties: BossDifficulty[];
  image: string; // 보스 이미지 경로
}

// 난이도 한글 변환
export const difficultyLabels: Record<Difficulty, string> = {
  easy: "이지",
  normal: "노멀",
  hard: "하드",
  chaos: "카오스",
  extreme: "익스트림",
};


// 메소 포맷팅 (억/만 단위)
export function formatMeso(value: number): string {
  const billion = 100000000; // 1억
  const tenThousand = 10000; // 1만

  if (value >= billion) {
    const eok = Math.floor(value / billion);
    const remainder = Math.floor((value % billion) / tenThousand);
    if (remainder > 0) {
      return `${eok}억 ${remainder.toLocaleString()}만 메소`;
    }
    return `${eok}억 메소`;
  } else if (value >= tenThousand) {
    return `${Math.floor(value / tenThousand).toLocaleString()}만 메소`;
  }
  return `${value.toLocaleString()} 메소`;
}

// 보스 목록 데이터 (가장 낮은 난이도 결정석 가격 기준 내림차순, 월간 보스 맨 위)
export const bossData: Boss[] = [
  // === 월간 보스 ===
  {
    id: "blackmage",
    name: "검은 마법사",
    isMonthly: true,
    image: "/images/bosses/검은마법사.png",
    difficulties: [
      { difficulty: "hard", price: 700000000, partySize: 6 },
      { difficulty: "extreme", price: 9200000000, partySize: 6 },
    ],
  },
  // === 주간 보스 (가장 낮은 난이도 가격 기준 내림차순) ===
  {
    id: "jupiter",
    name: "유피테르",
    image: "/images/bosses/유피테르.png",
    difficulties: [
      { difficulty: "normal", price: 1700000000, partySize: 6 },
      { difficulty: "hard", price: 5100000000, partySize: 6 },
    ],
  },
  {
    id: "baldrix",
    name: "발드릭스",
    image: "/images/bosses/발드릭스.png",
    difficulties: [
      { difficulty: "normal", price: 1440000000, partySize: 6 },
      { difficulty: "hard", price: 3240000000, partySize: 6 },
    ],
  },
  {
    id: "limbo",
    name: "림보",
    image: "/images/bosses/림보.png",
    difficulties: [
      { difficulty: "normal", price: 1080000000, partySize: 6 },
      { difficulty: "hard", price: 2510000000, partySize: 6 },
    ],
  },
  {
    id: "ominous_star",
    name: "찬란한 흉성",
    image: "/images/bosses/찬란한흉성.png",
    difficulties: [
      { difficulty: "normal", price: 658000000, partySize: 6 },
      { difficulty: "hard", price: 2819000000, partySize: 6 },
    ],
  },
  {
    id: "kaling",
    name: "카링",
    image: "/images/bosses/카링.png",
    difficulties: [
      { difficulty: "easy", price: 419000000, partySize: 6 },
      { difficulty: "normal", price: 714000000, partySize: 6 },
      { difficulty: "hard", price: 1830000000, partySize: 6 },
      { difficulty: "extreme", price: 5670000000, partySize: 6 },
    ],
  },
  {
    id: "chosen_one",
    name: "최초의 대적자",
    image: "/images/bosses/최초의대적자.png",
    difficulties: [
      { difficulty: "easy", price: 324000000, partySize: 6 },
      { difficulty: "normal", price: 589000000, partySize: 6 },
      { difficulty: "hard", price: 1510000000, partySize: 6 },
      { difficulty: "extreme", price: 4960000000, partySize: 6 },
    ],
  },
  {
    id: "kalos",
    name: "감시자 칼로스",
    image: "/images/bosses/감시자칼로스.png",
    difficulties: [
      { difficulty: "easy", price: 311000000, partySize: 6 },
      { difficulty: "normal", price: 561000000, partySize: 6 },
      { difficulty: "chaos", price: 1340000000, partySize: 6 },
      { difficulty: "extreme", price: 4320000000, partySize: 6 },
    ],
  },
  {
    id: "seren",
    name: "선택받은 세렌",
    image: "/images/bosses/세렌.png",
    difficulties: [
      { difficulty: "normal", price: 266000000, partySize: 6 },
      { difficulty: "hard", price: 396000000, partySize: 6 },
      { difficulty: "extreme", price: 3150000000, partySize: 6 },
    ],
  },
  {
    id: "verus_hilla",
    name: "진 힐라",
    image: "/images/bosses/진힐라.png",
    difficulties: [
      { difficulty: "normal", price: 74900000, partySize: 6 },
      { difficulty: "hard", price: 112000000, partySize: 6 },
    ],
  },
  {
    id: "dunkel",
    name: "듄켈",
    image: "/images/bosses/듄켈.png",
    difficulties: [
      { difficulty: "normal", price: 50000000, partySize: 6 },
      { difficulty: "hard", price: 99400000, partySize: 6 },
    ],
  },
  {
    id: "gloom",
    name: "더스크",
    image: "/images/bosses/더스크.png",
    difficulties: [
      { difficulty: "normal", price: 46300000, partySize: 6 },
      { difficulty: "chaos", price: 73500000, partySize: 6 },
    ],
  },
  {
    id: "will",
    name: "윌",
    image: "/images/bosses/윌.png",
    difficulties: [
      { difficulty: "easy", price: 34000000, partySize: 6 },
      { difficulty: "normal", price: 43300000, partySize: 6 },
      { difficulty: "hard", price: 81200000, partySize: 6 },
    ],
  },
  {
    id: "lucid",
    name: "루시드",
    image: "/images/bosses/루시드.png",
    difficulties: [
      { difficulty: "easy", price: 31400000, partySize: 6 },
      { difficulty: "normal", price: 37500000, partySize: 6 },
      { difficulty: "hard", price: 66200000, partySize: 6 },
    ],
  },
  {
    id: "guardian_angel_slime",
    name: "가디언 엔젤 슬라임",
    image: "/images/bosses/가디언엔젤슬라임.png",
    difficulties: [
      { difficulty: "normal", price: 26800000, partySize: 6 },
      { difficulty: "chaos", price: 79100000, partySize: 6 },
    ],
  },
  {
    id: "damien",
    name: "데미안",
    image: "/images/bosses/데미안.png",
    difficulties: [
      { difficulty: "normal", price: 18400000, partySize: 6 },
      { difficulty: "hard", price: 51500000, partySize: 6 },
    ],
  },
  {
    id: "lotus",
    name: "스우",
    image: "/images/bosses/스우.png",
    difficulties: [
      { difficulty: "normal", price: 17600000, partySize: 6 },
      { difficulty: "hard", price: 54200000, partySize: 6 },
      { difficulty: "extreme", price: 604000000, partySize: 6 },
    ],
  },
  {
    id: "papulatus",
    name: "파풀라투스",
    image: "/images/bosses/파풀라투스.png",
    difficulties: [
      { difficulty: "chaos", price: 13800000, partySize: 6 },
    ],
  },
  {
    id: "vellum",
    name: "벨룸",
    image: "/images/bosses/벨룸.png",
    difficulties: [
      { difficulty: "chaos", price: 9280000, partySize: 6 },
    ],
  },
  {
    id: "magnus",
    name: "매그너스",
    image: "/images/bosses/매그너스.png",
    difficulties: [
      { difficulty: "hard", price: 8560000, partySize: 6 },
    ],
  },
  {
    id: "pierre",
    name: "피에르",
    image: "/images/bosses/피에르.png",
    difficulties: [
      { difficulty: "chaos", price: 8170000, partySize: 6 },
    ],
  },
  {
    id: "vonbon",
    name: "반반",
    image: "/images/bosses/반반.png",
    difficulties: [
      { difficulty: "chaos", price: 8150000, partySize: 6 },
    ],
  },
  {
    id: "bloodyqueen",
    name: "블러디퀸",
    image: "/images/bosses/블러디퀸.png",
    difficulties: [
      { difficulty: "chaos", price: 8140000, partySize: 6 },
    ],
  },
  {
    id: "zakum",
    name: "자쿰",
    image: "/images/bosses/자쿰.png",
    difficulties: [
      { difficulty: "chaos", price: 8080000, partySize: 6 },
    ],
  },
  {
    id: "pinkbean",
    name: "핑크빈",
    image: "/images/bosses/핑크빈.png",
    difficulties: [
      { difficulty: "chaos", price: 6580000, partySize: 6 },
    ],
  },
  {
    id: "hilla",
    name: "힐라",
    image: "/images/bosses/힐라.png",
    difficulties: [
      { difficulty: "hard", price: 5750000, partySize: 6 },
    ],
  },
  {
    id: "cygnus",
    name: "시그너스",
    image: "/images/bosses/시그너스.png",
    difficulties: [
      { difficulty: "easy", price: 4550000, partySize: 6 },
      { difficulty: "normal", price: 7500000, partySize: 6 },
    ],
  },
];

// 보스 ID로 찾기
export function getBossById(id: string): Boss | undefined {
  return bossData.find((boss) => boss.id === id);
}

// 주간 보스만 필터링 (월간 제외)
export function getWeeklyBosses(): Boss[] {
  return bossData.filter((boss) => !boss.isMonthly);
}

// 월간 보스만 필터링
export function getMonthlyBosses(): Boss[] {
  return bossData.filter((boss) => boss.isMonthly);
}
