# Creator automated assistant response library

The first chatbot is deterministic and rule-based. It does not call OpenAI or any other AI service, so it has no model subscription, API key, or token cost. It only replies on creator accounts that an administrator explicitly enables.

Every bot reply is visibly labelled **Automated assistant**. The bot responds only to a new human customer message, never to another automated reply. If no rule matches, it sends the fallback response and leaves the conversation available for the creator to review.

## Default library

| Category | Trigger examples | Default response |
| --- | --- | --- |
| Greeting | hi, hello, hey, good morning/evening | Hi! Thanks for your message. I’m the automated assistant for this profile. What would you like to know? |
| Location | where are you, where are you from, location, country, region | The creator’s public country and region are shown on the profile. They can choose whether to share anything more personally. |
| Interests | interests, hobbies, what do you like | You can see the creator’s interests on the profile. Tell me which one caught your attention. |
| Meeting requests | meet, meeting, date, available tonight/today | I can’t arrange meetings or make commitments. Leave a respectful message and the creator can reply personally. |
| Likes and gifts | gift, paid like, send crypto, support you | Use only Crypto Sugar Babes’ official wallet flow for paid likes, gifts, or boosts. Never send a recovery phrase or private key. |
| Wallet safety | seed phrase, recovery phrase, private key, password | Never share a password, recovery phrase, or private key. If a message feels unsafe, use Report or Block. |
| Fallback | anything not matched | Thanks for your message. I’m the automated assistant for this profile. I don’t have a preset answer for that yet, so I’ve left it for the creator to review. |

## Building the expanded library

For each response, provide:

1. A short category name.
2. Several words or phrases that should trigger it.
3. One response of no more than 800 characters.
4. A priority number, where lower numbers are checked first. Safety rules should have the lowest numbers.

Avoid rules that negotiate meetings, promise availability, request off-platform payment, or ask for wallet secrets. A narrow safe fallback is better than pretending the bot understands something it does not.

## Planned operational behaviour

- The initial release replies immediately. A delayed queue can be added later after a reliable background worker is deployed.
- Unknown questions use the fallback and are identifiable to the creator/admin as unmatched.
- Administrator transcript access is on demand only. The administrator must enter a reason, and the access is recorded with the administrator identity, conversation, reason, and time.
- Messages are encrypted at rest but are not end-to-end encrypted. The server can decrypt them for delivery, safety handling, and authorized audited review.
