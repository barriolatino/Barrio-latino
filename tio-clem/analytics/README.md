# Analytics

`metrics.csv` : une ligne par relevé de statistiques TikTok.

| Champ | Sens |
|---|---|
| `date` | date du relevé (AAAA-MM-JJ) |
| `post_id` | identifiant du post, ex. `001-ceviche` |
| `views`, `likes`, `comments`, `shares`, `saves` | compteurs TikTok |
| `watch_time` | durée moyenne de visionnage, en secondes |
| `completion_rate` | part des vues regardées jusqu'au bout, en % |
| `followers_gained` | abonnés gagnés grâce au post |

Aujourd'hui, `/stats` enregistre déjà vues, likes, commentaires, partages et enregistrements dans
`content/published.json`, et la sélection des idées en tient compte. L'analyse automatique de
`metrics.csv` est prévue en V2.
