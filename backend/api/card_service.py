import requests

class YGOCardService:
    BASE_URL = "https://db.ygoprodeck.com/api/v7/cardinfo.php"

    @staticmethod
    def search_cards(query):
        """
        Busca cartas por nombre (fuzzy search) usando la API de YGOPRODeck.
        """
        if not query:
            return []
            
        params = {
            'fname': query,
            'num': 20, # Limitar a 20 resultados para rapidez
            'offset': 0
        }
        
        try:
            response = requests.get(YGOCardService.BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()
            
            # Formatear la respuesta para el frontend
            results = []
            for card in data.get('data', []):
                results.append({
                    'id': card['id'],
                    'name': card['name'],
                    'type': card['type'],
                    'desc': card['desc'],
                    'atk': card.get('atk'),
                    'def': card.get('def'),
                    'level': card.get('level'),
                    'race': card['race'],
                    'attribute': card.get('attribute'),
                    'image_url': card['card_images'][0]['image_url'],
                    'image_url_small': card['card_images'][0]['image_url_small']
                })
            return results
        except requests.exceptions.RequestException as e:
            print(f"Error calling YGOPRODeck API: {e}")
            return []

    @staticmethod
    def get_cards_metadata(names):
        """
        Obtiene metadatos detallados para una lista de nombres de cartas.
        """
        if not names:
            return {}
            
        # Unir nombres con | para consulta múltiple
        # La API de YGOPRODeck acepta hasta un límite, así que lo ideal sería dividir si son muchos
        # Para un mazo de 40-60, una sola llamada suele bastar si la URL no es excesiva.
        
        chunk_size = 20 # Dividimos por seguridad de longitud de URL
        metadata_map = {}
        
        for i in range(0, len(names), chunk_size):
            chunk = names[i:i + chunk_size]
            params = {'name': '|'.join(chunk)}
            
            try:
                response = requests.get(YGOCardService.BASE_URL, params=params)
                if response.status_code == 200:
                    data = response.json()
                    for card in data.get('data', []):
                        metadata_map[card['name'].lower()] = {
                            'type': card['type'],
                            'image_url': card['card_images'][0]['image_url'],
                            'attribute': card.get('attribute'),
                            'race': card['race']
                        }
            except Exception as e:
                print(f"Error fetching metadata chunk: {e}")
                
        return metadata_map

    @staticmethod
    def find_best_match(name):
        """
        Busca la coincidencia más cercana para un nombre dado usando el endpoint 'fname'.
        """
        if not name:
            return None
            
        params = {
            'fname': name,
            'num': 1,
            'offset': 0
        }
        
        try:
            response = requests.get(YGOCardService.BASE_URL, params=params)
            if response.status_code == 200:
                data = response.json()
                if data.get('data'):
                    card = data['data'][0]
                    return {
                        'name': card['name'],
                        'type': card['type'],
                        'image_url': card['card_images'][0]['image_url'],
                        'attribute': card.get('attribute'),
                        'level': card.get('level'),
                        'atk': card.get('atk'),
                        'def': card.get('def')
                    }
        except Exception as e:
            print(f"Error in find_best_match: {e}")
            
        return None
