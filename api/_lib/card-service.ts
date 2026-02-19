import axios from 'axios';

const BASE_URL = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';

export interface YGOCard {
    id: number;
    name: string;
    type: string;
    desc: string;
    atk?: number;
    def?: number;
    level?: number;
    race: string;
    attribute?: string;
    image_url: string;
    image_url_small: string;
}

export interface CardMetadata {
    id: number;
    type: string;
    image_url: string;
    attribute?: string;
    race?: string;
    level?: number;
    atk?: number;
    def?: number;
}

export async function searchCards(query: string): Promise<YGOCard[]> {
    if (!query) return [];

    try {
        const response = await axios.get(BASE_URL, {
            params: { fname: query, num: 30, offset: 0 },
        });

        return (response.data.data || []).map((card: any) => ({
            id: card.id,
            name: card.name,
            type: card.type,
            desc: card.desc,
            atk: card.atk,
            def: card.def,
            level: card.level,
            race: card.race,
            attribute: card.attribute,
            image_url: card.card_images[0].image_url,
            image_url_small: card.card_images[0].image_url_small,
        }));
    } catch (error) {
        console.error('Error calling YGOPRODeck API:', error);
        return [];
    }
}

export async function getCardsMetadata(names: string[]): Promise<Record<string, CardMetadata>> {
    if (!names.length) return {};

    const chunkSize = 20;
    const metadataMap: Record<string, CardMetadata> = {};

    for (let i = 0; i < names.length; i += chunkSize) {
        const chunk = names.slice(i, i + chunkSize);
        try {
            const response = await axios.get(BASE_URL, {
                params: { name: chunk.join('|') },
            });

            if (response.status === 200) {
                for (const card of response.data.data || []) {
                    metadataMap[card.name.toLowerCase()] = {
                        id: card.id,
                        type: card.type,
                        image_url: card.card_images[0].image_url,
                        attribute: card.attribute,
                        race: card.race,
                    };
                }
            }
        } catch (error) {
            console.error('Error fetching metadata chunk:', error);
        }
    }

    return metadataMap;
}

export async function findBestMatch(name: string): Promise<CardMetadata & { name: string } | null> {
    if (!name) return null;

    try {
        const response = await axios.get(BASE_URL, {
            params: { fname: name, num: 1, offset: 0 },
        });

        if (response.status === 200 && response.data.data?.length) {
            const card = response.data.data[0];
            return {
                id: card.id,
                name: card.name,
                type: card.type,
                image_url: card.card_images[0].image_url,
                attribute: card.attribute,
                level: card.level,
                atk: card.atk,
                def: card.def,
            };
        }
    } catch (error) {
        console.error('Error in findBestMatch:', error);
    }

    return null;
}
