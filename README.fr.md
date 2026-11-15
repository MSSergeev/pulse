# pulse

[English](README.md) · [Русский](README.ru.md) · [Español](README.es.md) · **Français**

Un mod pour Claude Code dans le terminal : il indique quand chaque réponse est arrivée et quelle part du contexte et des limites de votre abonnement est utilisée.

- **L’heure sous chaque réponse.** Un bouton `◷ 14:32` sous le dernier texte de chaque réponse. Un clic affiche les secondes, la date, la durée de la réponse et le remplissage du contexte à ce moment-là.
- **Anneau de contexte dans la barre d’état.** `○ ◔ ◑ ◕ ●` avec un pourcentage, à droite de la ligne du bas. Un clic ouvre le panneau **Consommation** :
  - les limites de l’abonnement (5 heures, semaine) avec le temps restant avant chaque réinitialisation ;
  - le contexte, détaillé par catégorie ;
  - ce qui consomme les limites : la conversation principale et chaque type de sous-agent ;
  - les jetons de la session.

Il ne coûte rien : les chiffres arrivent avec les réponses du modèle, et le détail du contexte est une estimation locale. Les parts de « ce qui consomme les limites » sont estimées aux prix de l’API (voir `scripts/session_tokens.py`).

## Installation

Dans Claude Code, dans le terminal :

```
/plugin install pulse --marketplace MSSergeev/pulse
```

Répondez `y` pour ajouter le marketplace, puis choisissez la portée (en général user) et la langue. Depuis un shell :

```
claude plugin install pulse --marketplace MSSergeev/pulse
```

Dans l’application de bureau : + à côté de la zone de saisie → Plugins → Add marketplace `MSSergeev/pulse` → Add plugin.

Mise à jour : `claude plugin update pulse@pulse`.

## Langue

Anglais, espagnol, français et russe. L’installation demande laquelle utiliser ; pour la changer ensuite, `/config`, à la ligne de pulse. Le choix est enregistré dans `~/.claude/settings.json` et vaut pour toutes les sessions.

`auto`, le réglage par défaut, prend la langue de réponse de Claude Code (le réglage `language`), puis la langue du système (`LC_ALL`, `LC_MESSAGES`, `LANG`), et à défaut l’anglais.

## Prérequis

- Claude Code avec la prise en charge des mods (testé sur la 2.1.299 et suivantes).
- `python3`, pour les jetons de la session.

---

Une erreur dans une traduction ? Ouvrez une issue ou une pull request.
