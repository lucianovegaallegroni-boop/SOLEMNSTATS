from django.urls import path
from .views import hello_world, save_deck, list_decks, delete_deck, update_deck, search_cards, update_card_tags

urlpatterns = [
    path('hello/', hello_world, name='hello_world'),
    path('save-deck/', save_deck, name='save_deck'),
    path('list-decks/', list_decks, name='list_decks'),
    path('delete-deck/<int:pk>/', delete_deck, name='delete_deck'),
    path('get-deck/<int:pk>/', update_deck, name='update_deck'),
    path('search-cards/', search_cards, name='search_cards'),
    path('update-card-tags/<int:pk>/', update_card_tags, name='update_card_tags'),
]
