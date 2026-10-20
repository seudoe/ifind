// Helper function to format markdown-style text
export function formatRecommendationText(text: string) {
    // Split by ** to find bold sections
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    
    return (
        <>
            {parts.map((part, idx) => {
                // Check if this part should be bold
                if (part.startsWith('**') && part.endsWith('**')) {
                    // Remove ** and make bold
                    const boldText = part.slice(2, -2);
                    return <strong key={idx} className="font-semibold text-[var(--text)]">{boldText}</strong>;
                }
                // Regular text
                return <span key={idx}>{part}</span>;
            })}
        </>
    );
}
