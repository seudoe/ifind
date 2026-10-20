export function ScoreCard({
    icon,
    label,
    score,
    getScoreColor,
    getScoreLabel,
}: {
    icon: React.ReactNode;
    label: string;
    score: number;
    getScoreColor: (score: number) => string;
    getScoreLabel: (score: number) => string;
}) {
    const baseColor = getScoreColor(score);
    
    return (
        <div className={`relative rounded-xl border-2 p-5 transition-all hover:scale-105 hover:shadow-lg ${baseColor}`}>
            <div className="flex flex-col h-full">
                <div className="flex items-center gap-2 mb-3">
                    <div className="opacity-70">
                        {icon}
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider opacity-75">{label}</span>
                </div>
                <div className="flex-1 flex flex-col justify-end">
                    <div className="mb-1">
                        <p className="text-4xl font-bold leading-none">{score}</p>
                    </div>
                    <p className="text-xs font-medium opacity-75">{getScoreLabel(score)}</p>
                </div>
            </div>
        </div>
    );
}
