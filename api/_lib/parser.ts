export interface ParsedCard {
    name: string;
    quantity: number;
    area: string;
}

export function parseDeckList(rawList: string, area: string): ParsedCard[] {
    if (!rawList || !rawList.trim()) return [];

    return rawList
        .trim()
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
            const trimmed = line.trim();
            const match = trimmed.match(/(.*?)\s*[xX]\s*(\d+)$/);
            if (match) {
                return { name: match[1].trim(), quantity: parseInt(match[2]), area };
            }
            return { name: trimmed, quantity: 1, area };
        });
}
