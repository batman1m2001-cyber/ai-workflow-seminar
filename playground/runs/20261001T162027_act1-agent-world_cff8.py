from prep_world import golden
attacks = [g for g in golden() if g["expect"]["action"] == "block"]
print(f"{len(attacks)} attack emails")
from prep_world.guard import looks_like_attack
caught = [g["id"] for g in attacks if looks_like_attack(g["subject"] + " " + g["body"])]
print(f"{len(caught)}/{len(attacks)} blocked before a model saw them")