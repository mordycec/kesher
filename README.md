# Kesher

*Kesher* (קשר) means connection. It's a game for two: one of you answers a question about yourself, the other guesses what you said, and then you talk about it. No points, just the conversation.

Pick the mood each round: keep it light, a bit of everything, or go deeper. Answers you reveal are saved on your phone so you can look back on them.

## Put it on your home screen

- **iPhone:** open the game link in Safari, tap the Share button, then **Add to Home Screen**.
- **Android:** open the link in Chrome, tap the menu, then **Install app** (or **Add to Home screen**).

## Play on two phones

1. One of you taps **Play on two phones**. A 4-letter code appears.
2. The other taps **Join with a code** and types it in.
3. Each of you answers on your own phone, and the answers are revealed on both at the same time.

You can also play on one phone and pass it back and forth.

## How it works

- `questions.js` holds the questions. Each has a tone (light or deeper), a type (pick one or open answer) and a follow-up to talk about. Add your own the same way.
- `game.js` has the rules and the two-phone connection, `ui.js` draws the screens, and `style.css` is the look.
- Two-phone play connects the phones directly using [PeerJS](https://peerjs.com) (MIT licensed, loaded from jsDelivr) and its free public connection server. No accounts, and answers are only stored on your own phones.
- `manifest.webmanifest`, `sw.js` and `icons/` make it installable. When you change a file, bump `CACHE` in `sw.js` so phones load the new version.
