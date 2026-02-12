import re
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import Deck, DeckCard
from .serializers import DeckSerializer
from .card_service import YGOCardService

@api_view(['GET'])
def search_cards(request):
    query = request.query_params.get('q', '')
    results = YGOCardService.search_cards(query)
    return Response(results)

@api_view(['POST'])
def save_deck(request):
    main_list = request.data.get('main_list', '')
    extra_list = request.data.get('extra_list', '')
    side_list = request.data.get('side_list', '')
    deck_name = request.data.get('name', 'My New Deck')
    
    if not any([main_list, extra_list, side_list]):
        return Response({"error": "No deck list provided"}, status=status.HTTP_400_BAD_REQUEST)
        
    def parse_list(raw_list, area_name):
        lines = raw_list.strip().split('\n')
        cards = []
        for line in lines:
            line = line.strip()
            if not line: continue
            match = re.search(r"(.*?)\s*[xX]\s*(\d+)$", line)
            if match:
                name = match.group(1).strip()
                quantity = int(match.group(2))
            else:
                name = line
                quantity = 1
            cards.append({"name": name, "quantity": quantity, "area": area_name})
        return cards

    all_cards_to_create = []
    all_cards_to_create.extend(parse_list(main_list, "MAIN"))
    all_cards_to_create.extend(parse_list(extra_list, "EXTRA"))
    all_cards_to_create.extend(parse_list(side_list, "SIDE"))
    
    total_count = sum(c["quantity"] for c in all_cards_to_create)

    # Obtener metadatos reales
    card_names = [c["name"] for c in all_cards_to_create]
    metadata = YGOCardService.get_cards_metadata(card_names)

    # Combinamos las listas en un solo raw_list para compatibilidad si fuera necesario, 
    # pero el modelo ahora guarda el area. Usaremos main_list como principal si existe.
    deck = Deck.objects.create(name=deck_name, raw_list=main_list, total_cards=total_count)
    
    for card_data in all_cards_to_create:
        original_name = card_data["name"]
        meta = metadata.get(original_name.lower())
        
        if not meta:
            fuzzy_match = YGOCardService.find_best_match(original_name)
            if fuzzy_match:
                meta = {
                    'type': fuzzy_match['type'],
                    'image_url': fuzzy_match['image_url'],
                    'attribute': fuzzy_match['attribute'],
                    'level': fuzzy_match['level'],
                    'atk': fuzzy_match['atk'],
                    'def': fuzzy_match['def']
                }
                card_data["name"] = fuzzy_match['name']
        
        DeckCard.objects.create(
            deck=deck,
            card_name=card_data["name"],
            area=card_data["area"],
            quantity=card_data["quantity"],
            card_type=meta.get('type', 'Unknown') if meta else 'Unknown',
            image_url=meta.get('image_url', '') if meta else '',
            attribute=meta.get('attribute', '') if meta else '',
            level=meta.get('level') if meta else None,
            atk=meta.get('atk') if meta else None,
            defense=meta.get('def') if meta else None
        )
    
    serializer = DeckSerializer(deck)
    return Response(serializer.data, status=status.HTTP_201_CREATED)

@api_view(['GET'])
def list_decks(request):
    decks = Deck.objects.all().order_by('-created_at')
    serializer = DeckSerializer(decks, many=True)
    return Response(serializer.data)

@api_view(['DELETE'])
def delete_deck(request, pk):
    try:
        deck = Deck.objects.get(pk=pk)
        deck.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    except Deck.DoesNotExist:
        return Response({"error": "Deck not found"}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET', 'PUT'])
def update_deck(request, pk):
    try:
        deck = Deck.objects.get(pk=pk)
    except Deck.DoesNotExist:
        return Response({"error": "Deck not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = DeckSerializer(deck)
        return Response(serializer.data)

    # PUT logic (Update)
    main_list = request.data.get('main_list', '')
    extra_list = request.data.get('extra_list', '')
    side_list = request.data.get('side_list', '')
    deck_name = request.data.get('name', deck.name)
    
    if not any([main_list, extra_list, side_list]):
        return Response({"error": "No deck list provided"}, status=status.HTTP_400_BAD_REQUEST)
        
    def parse_list(raw_list, area_name):
        lines = raw_list.strip().split('\n')
        cards = []
        for line in lines:
            line = line.strip()
            if not line: continue
            match = re.search(r"(.*?)\s*[xX]\s*(\d+)$", line)
            if match:
                name = match.group(1).strip()
                quantity = int(match.group(2))
            else:
                name = line
                quantity = 1
            cards.append({"name": name, "quantity": quantity, "area": area_name})
        return cards

    all_cards_to_process = []
    all_cards_to_process.extend(parse_list(main_list, "MAIN"))
    all_cards_to_process.extend(parse_list(extra_list, "EXTRA"))
    all_cards_to_process.extend(parse_list(side_list, "SIDE"))
    
    total_count = sum(c["quantity"] for c in all_cards_to_process)

    # Get metadata
    card_names = [c["name"] for c in all_cards_to_process]
    metadata = YGOCardService.get_cards_metadata(card_names)

    # Update Deck object
    deck.name = deck_name
    deck.raw_list = main_list # For backwards compatibility with older logic if any
    deck.total_cards = total_count
    deck.save()
    
    # Remove old cards
    deck.cards.all().delete()
    
    # Save new cards with metadata
    for card_data in all_cards_to_process:
        original_name = card_data["name"]
        meta = metadata.get(original_name.lower())
        
        if not meta:
            fuzzy_match = YGOCardService.find_best_match(original_name)
            if fuzzy_match:
                meta = {
                    'type': fuzzy_match['type'],
                    'image_url': fuzzy_match['image_url'],
                    'attribute': fuzzy_match['attribute'],
                    'level': fuzzy_match['level'],
                    'atk': fuzzy_match['atk'],
                    'def': fuzzy_match['def']
                }
                card_data["name"] = fuzzy_match['name']
        
        DeckCard.objects.create(
            deck=deck,
            card_name=card_data["name"],
            area=card_data["area"],
            quantity=card_data["quantity"],
            card_type=meta.get('type', 'Unknown') if meta else 'Unknown',
            image_url=meta.get('image_url', '') if meta else '',
            attribute=meta.get('attribute', '') if meta else '',
            level=meta.get('level') if meta else None,
            atk=meta.get('atk') if meta else None,
            defense=meta.get('def') if meta else None
        )
    
    serializer = DeckSerializer(deck)
    return Response(serializer.data)

@api_view(['POST'])
def update_card_tags(request, pk):
    try:
        card = DeckCard.objects.get(pk=pk)
    except DeckCard.DoesNotExist:
        return Response({"error": "Card not found"}, status=status.HTTP_404_NOT_FOUND)
    
    tags = request.data.get('tags', [])
    if isinstance(tags, list):
        import json
        card.custom_tags = json.dumps(tags)
        card.save()
        return Response({"status": "Tags updated", "tags": tags})
    
    return Response({"error": "Invalid tags format"}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
def hello_world(request):
    return Response({"message": "¡Hola desde Django y TypeScript!"})
