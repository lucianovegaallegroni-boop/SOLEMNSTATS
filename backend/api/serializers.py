from rest_framework import serializers
from .models import Deck, DeckCard

class DeckCardSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeckCard
        fields = ['id', 'card_name', 'area', 'quantity', 'card_type', 'image_url', 'attribute', 'level', 'atk', 'defense', 'custom_tags']

class DeckSerializer(serializers.ModelSerializer):
    cards = DeckCardSerializer(many=True, read_only=True)

    class Meta:
        model = Deck
        fields = ['id', 'name', 'created_at', 'total_cards', 'raw_list', 'cards']
