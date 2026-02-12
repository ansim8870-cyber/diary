import { Difficulty, difficultyLabels } from "@/data/bossData";

interface DifficultyBadgeProps {
  difficulty: Difficulty;
  size?: "sm" | "md" | "lg";
}

const sizeStyles = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-3 py-1 text-sm",
  lg: "px-4 py-1.5 text-base",
};

const difficultyStyles: Record<Difficulty, string> = {
  easy: "bg-[#8a8a8a] text-white border-2 border-transparent",
  normal: "bg-[#6bb8b8] text-white border-2 border-transparent",
  hard: "bg-[#b34d7f] text-white border-2 border-transparent",
  chaos: "bg-black text-[#d4a843] border-2 border-[#d4a843]",
  extreme: "bg-black text-[#e63946] border-2 border-[#e63946]",
};

export function DifficultyBadge({ difficulty, size = "md" }: DifficultyBadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center justify-center
        rounded-full font-bold
        ${sizeStyles[size]}
        ${difficultyStyles[difficulty]}
      `}
    >
      {difficultyLabels[difficulty]}
    </span>
  );
}
