// 보스 데이터 - 결정석 가격 기준 (2025년 기준)

export type Difficulty = "easy" | "normal" | "hard" | "chaos" | "extreme";

// 난이도 순서 (어려운 순)
export const difficultyOrder: Difficulty[] = ["extreme", "chaos", "hard", "normal", "easy"];

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
  image?: string; // 나중에 추가
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

// 보스 목록 데이터 (난이도는 어려운 순으로 정렬)
export const bossData: Boss[] = [
  {
    id: "seren",
    name: "선택받은 세렌",
    difficulties: [
      { difficulty: "extreme", price: 504000000, partySize: 6 },
      { difficulty: "hard", price: 252000000, partySize: 6 },
      { difficulty: "normal", price: 151000000, partySize: 6 },
    ],
  },
  {
    id: "kalos",
    name: "감시자 칼로스",
    difficulties: [
      { difficulty: "extreme", price: 756000000, partySize: 6 },
      { difficulty: "chaos", price: 420000000, partySize: 6 },
      { difficulty: "normal", price: 210000000, partySize: 6 },
      { difficulty: "easy", price: 168000000, partySize: 6 },
    ],
  },
  {
    id: "kaling",
    name: "카링",
    difficulties: [
      { difficulty: "extreme", price: 5670000000, partySize: 6 },
      { difficulty: "hard", price: 630000000, partySize: 6 },
      { difficulty: "normal", price: 315000000, partySize: 6 },
      { difficulty: "easy", price: 189000000, partySize: 6 },
    ],
  },
  {
    id: "ominous_star",
    name: "찬란한 흉성",
    difficulties: [
      { difficulty: "hard", price: 350000000, partySize: 6 },
      { difficulty: "normal", price: 180000000, partySize: 6 },
    ],
  },
  {
    id: "limbo",
    name: "림보",
    difficulties: [
      { difficulty: "hard", price: 1080000000, partySize: 6 },
      { difficulty: "normal", price: 360000000, partySize: 6 },
    ],
  },
  {
    id: "baldrix",
    name: "발드릭스",
    difficulties: [
      { difficulty: "hard", price: 400000000, partySize: 6 },
      { difficulty: "normal", price: 200000000, partySize: 6 },
    ],
  },
  {
    id: "lotus",
    name: "스우",
    difficulties: [
      { difficulty: "extreme", price: 177000000, partySize: 6 },
      { difficulty: "hard", price: 56700000, partySize: 6 },
      { difficulty: "normal", price: 17600000, partySize: 6 },
    ],
  },
  {
    id: "damien",
    name: "데미안",
    difficulties: [
      { difficulty: "hard", price: 59200000, partySize: 6 },
      { difficulty: "normal", price: 18400000, partySize: 6 },
    ],
  },
  {
    id: "lucid",
    name: "루시드",
    difficulties: [
      { difficulty: "hard", price: 94500000, partySize: 6 },
      { difficulty: "normal", price: 40400000, partySize: 6 },
      { difficulty: "easy", price: 31400000, partySize: 6 },
    ],
  },
  {
    id: "will",
    name: "윌",
    difficulties: [
      { difficulty: "hard", price: 108000000, partySize: 6 },
      { difficulty: "normal", price: 46200000, partySize: 6 },
      { difficulty: "easy", price: 34000000, partySize: 6 },
    ],
  },
  {
    id: "gloom",
    name: "더스크",
    difficulties: [
      { difficulty: "chaos", price: 105000000, partySize: 6 },
      { difficulty: "normal", price: 52500000, partySize: 6 },
    ],
  },
  {
    id: "verus_hilla",
    name: "진 힐라",
    difficulties: [
      { difficulty: "hard", price: 126000000, partySize: 6 },
      { difficulty: "normal", price: 56700000, partySize: 6 },
    ],
  },
  {
    id: "dunkel",
    name: "듄켈",
    difficulties: [
      { difficulty: "hard", price: 144000000, partySize: 6 },
      { difficulty: "normal", price: 63000000, partySize: 6 },
    ],
  },
  {
    id: "guardian_angel_slime",
    name: "가디언 엔젤 슬라임",
    difficulties: [
      { difficulty: "chaos", price: 76600000, partySize: 6 },
      { difficulty: "normal", price: 26800000, partySize: 6 },
    ],
  },
  {
    id: "cygnus",
    name: "시그너스",
    difficulties: [
      { difficulty: "normal", price: 7500000, partySize: 6 },
      { difficulty: "easy", price: 4550000, partySize: 6 },
    ],
  },
  {
    id: "blackmage",
    name: "검은 마법사",
    isMonthly: true,
    difficulties: [
      { difficulty: "extreme", price: 2520000000, partySize: 6 },
      { difficulty: "hard", price: 1200000000, partySize: 6 },
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
