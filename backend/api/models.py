from django.db import models

class Deck(models.Model):
    name = models.CharField(max_length=255, default="New Deck")
    created_at = models.DateTimeField(auto_now_add=True)
    total_cards = models.IntegerField(default=0)
    raw_list = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name

class DeckCard(models.Model):
    deck = models.ForeignKey(Deck, related_name='cards', on_delete=models.CASCADE)
    card_name = models.CharField(max_length=255)
    area = models.CharField(max_length=10, default="MAIN") # MAIN, EXTRA, SIDE
    quantity = models.IntegerField(default=1)
    card_type = models.CharField(max_length=100, blank=True, null=True)
    image_url = models.URLField(max_length=500, blank=True, null=True)
    attribute = models.CharField(max_length=50, blank=True, null=True)
    level = models.IntegerField(blank=True, null=True)
    atk = models.IntegerField(blank=True, null=True)
    defense = models.IntegerField(blank=True, null=True)
    custom_tags = models.TextField(default="[]") # Store as JSON string for max compatibility

    def __str__(self):
        return f"{self.card_name} x{self.quantity}"
