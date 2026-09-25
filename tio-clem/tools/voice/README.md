# Voix off

`providers.py` : `script` → `voiceover.wav`, fournisseur choisi par `TTS_PROVIDER` (`.env`).

Ordre : **ta voix enregistrée** (`assets/audio/voice/day-NN.m4a`) → synthèse si `TTS_PROVIDER`
est configuré → aucune voix (piste silencieuse, tu ajoutes un son dans TikTok).

| Fournisseur | Coût | Testé en réel |
|---|---|---|
| `none` (voix humaine ou silence) | gratuit | oui |
| `mock` (bips aux durées des phrases) | gratuit | oui, **tests uniquement** |
| `piper` (local, open source) | gratuit | non : modèle non téléchargeable pendant le développement |
| `openai` (`/v1/audio/speech`) | payant | non : API injoignable pendant le développement |
| `elevenlabs` (`/v1/text-to-speech`) | payant | non : API injoignable pendant le développement |

Les requêtes OpenAI et ElevenLabs sont vérifiées par les tests unitaires (adresse, en-têtes,
paramètres), d'après la documentation officielle. Le premier usage réel doit être écouté :
le contrôle qualité l'indique (`tested_live: false`).

Chaque voix générée est gardée dans `assets/audio/tts/` avec l'empreinte du texte : elle n'est
régénérée (et refacturée) que si le script change. Le calage des scènes et des sous-titres sur
la voix est le même pour une voix humaine ou de synthèse (`tools/subtitles/`).
