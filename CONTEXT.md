# Crazy Phrases

Crazy Phrases is the game domain for the `crazyphrases.com` web app.

## Language

**Crazy Phrases**:
A turn-based hidden-column word game where players contribute concealed words or prompts, then reveal the completed rows as surprising phrases or sentences.
_Avoid_: Random phrase generator, quote app

**Game**:
One configured play instance that produces one batch of completed rows.
_Avoid_: Match, series

**Game Mode**:
A supported way of configuring and playing a game, such as Solo Game,
multiplayer Game, or a future CPU-participant Game.
_Avoid_: Primary navigation item, account surface

**Game Play Surface**:
The focused interface for a participant's current work in a Game, such as entering
assigned Entries, waiting for other participants, revealing a completed Batch, or
viewing that participant's revealed Batch.
_Avoid_: Dashboard, bucket, card, settings page

**Cancelled Game**:
An in-progress game stopped before reveal.
_Avoid_: Deleted game, abandoned game

**Pending Game**:
A multiplayer game that has been configured but is waiting for invited human participants to accept.
_Avoid_: Started game, draft game

**Asynchronous Game**:
A game designed for participants to take their turns without needing to be present at the same time.
_Avoid_: Live game, realtime game

**Batch**:
The revealed set of completed rows produced by a game.
_Avoid_: Game, round

**Reveal**:
The moment when a completed game's batch becomes visible to its participants.
_Avoid_: Partial reveal, preview

**Phrase**:
One completed row in a batch, formed from player contributions according to the game template.
_Avoid_: Sentence, result

**Phrase Rendering**:
The template-defined display of entries as a completed phrase.
_Avoid_: Entry storage, grammar correction

**Entry**:
A player-supplied value in one row and one template slot.
_Avoid_: Word, cell

**Entry Validation**:
Light checks that keep entries usable without enforcing strict grammar during private play.
_Avoid_: Grammar enforcement, spellchecking

**Slot**:
One position in a game template that expects entries of a particular kind.
_Avoid_: Column, field

**Template**:
A reusable game structure made of ordered slots and phrase-rendering rules.
_Avoid_: Prompt, sentence pattern

**Default Template**:
The built-in template offered as the starting point for MVP games.
_Avoid_: Standard template, classic template

**Prompt**:
Text that frames or guides entries for a phrase within a game.
_Avoid_: Template

**Guidance**:
Visible helper text for the player filling a specific slot, used to steer an entry without revealing concealed entries.
_Avoid_: Annotation, note

**Concealment**:
The rule that players cannot see other players' entries before the batch is revealed.
_Avoid_: Hidden state, spoiler prevention

**Participant**:
A person or automated opponent taking part in a game.
_Avoid_: Player, user

**Slot Assignment**:
The responsibility for one participant to fill one slot across the whole batch.
_Avoid_: Turn, ownership

**Turn**:
The act of completing one active slot across every row in a batch.
_Avoid_: Row turn, cell turn

**Slot Allocation**:
The process of assigning template slots to participants for a game.
_Avoid_: Turn order, player order

**Slot Order**:
The sequence in which a game's allocated slots become available to be filled.
_Avoid_: Slot allocation, row order

**Game Creator**:
The account holder who configures and starts a game.
_Avoid_: Host, owner

**Solo Game**:
A game where one human participant is responsible for all slot assignments.
_Avoid_: Practice mode, single-player generator

**CPU Participant**:
An automated participant that receives slot assignments in a game.
_Avoid_: Random word helper, bot generator

**Entry Assist**:
A tool that helps produce a candidate entry for a specific slot and row without becoming the participant responsible for that slot.
_Avoid_: CPU participant, auto-fill

**Entry Candidate**:
A generated suggestion for one entry, selected for a requested entry kind but still
editable by the participant. An Entry Candidate can be a single word, a hyphenated
word, or a curated open compound when it behaves as one lexical entry for that entry
kind.
_Avoid_: Guaranteed word, validated grammar

**Entry Assist Safety Setting**:
A signed-in Account setting that controls whether Entry Assist excludes Word Bank
candidates labelled as potentially offensive; the default excludes them, and anonymous
play always excludes them.
_Avoid_: Public-content moderation, typed-entry validation, Safety Screening

**Word Bank**:
A local or cached source of entry candidates grouped by entry kind.
_Avoid_: Live word API, LLM generator

**Word Bank Shard**:
The complete curated playable candidate list for one entry kind at a specific version.
_Avoid_: Rotating subset, exhaustive dictionary, temporary cache slice, single-token-only
list

**Personal Word List**:
A participant-owned collection of reusable words for entry assistance.
_Avoid_: Word bank, favourites

**Personal Word**:
A reusable word in a personal word list, optionally tagged with one or more entry kinds.
_Avoid_: Favourite word, word-bank entry

**Entry Kind**:
A supported category of entry expected by a slot, such as adjective, noun, article, participle, preposition, or prompt text.
_Avoid_: User-defined grammar type, field type

**Row Count**:
The number of phrases a game is configured to produce.
_Avoid_: Template size, batch size

**Saved Template**:
A template kept by its creator for private use in games.
_Avoid_: Draft, unpublished template

**Published Template**:
A template deliberately shared by its creator for use by the wider player base.
_Avoid_: Shared saved template, public draft

**Unpublished Template Version**:
A previously published template version removed from public discovery without breaking existing references.
_Avoid_: Deleted template, hidden template

**Template Creator**:
The account holder credited for creating a saved or published template.
_Avoid_: Owner, author

**Template Version**:
A specific published form of a template that games can use without being changed by later template edits.
_Avoid_: Latest template, mutable template

**Template Remix**:
A saved template created by copying and modifying a published template version.
_Avoid_: Clone, fork

**Template Lineage**:
The source template version and creator credit retained by a template remix.
_Avoid_: Copy history, attribution note

**Template Favourite**:
A template marked by a participant for easier reuse in future games.
_Avoid_: Favourite

**Phrase Favourite**:
A completed phrase saved by a participant for later reference, nostalgia, or sharing.
_Avoid_: Favourite

**Batch Favourite**:
A completed batch saved by a participant for later reference, nostalgia, or sharing.
_Avoid_: Favourite

**Phrase Reaction**:
A participant's positive response to one completed phrase, initially limited to laugh or like.
_Avoid_: Star rating, downvote, vote

**Leaderboard**:
A ranked public discovery surface for shared phrases, ordered by phrase reactions within a selected timespan.
_Avoid_: Scoreboard, rating table

**Feed**:
A random public discovery surface for shared phrases.
_Avoid_: Leaderboard, timeline

**Shared Phrase**:
A completed phrase deliberately made available for public discovery.
_Avoid_: Public phrase, feed item

**Unshared Phrase**:
A previously shared phrase removed from public discovery by a human participant from the original game.
_Avoid_: Deleted phrase, hidden phrase

**External Share**:
Sending phrase or batch content outside Crazy Phrases through a device or browser sharing option.
_Avoid_: Public sharing, feed publishing

**Safety Screening**:
Automated checks that shared content must pass before it can enter public discovery.
_Avoid_: Human pre-moderation, no moderation

**Content Report**:
A participant-submitted flag that asks for shared content to be reviewed after publication.
_Avoid_: Reaction, downvote

**Admin Review**:
Human review of reported or suspicious public content.
_Avoid_: Automated screening

**Phrase Provenance**:
The visible authorship context for a shared phrase, including whether entries came from human participants, CPU participants, or accepted entry candidates.
_Avoid_: Authorship, source

**Share Consent**:
Permission from every human participant in a game for a completed phrase from that game to enter public discovery.
_Avoid_: Share approval, owner permission

**Gamer Tag**:
A human participant's changeable game-facing display name, kept separate from account identity.
_Avoid_: Real name, email, username, handle

**Avatar**:
A game-facing visual marker for an account holder in games and social surfaces.
_Avoid_: Profile picture, social profile photo

**Built-in Avatar**:
An Avatar selected from the Crazy Phrases-provided visual set.
_Avoid_: Preset key, icon name, emoji name

**Uploaded Avatar**:
An Avatar supplied by the account holder as an uploaded image.
_Avoid_: Profile picture, social profile photo

**Avatar Cover Fit**:
The rendering rule that makes an Uploaded Avatar image fill its Avatar container while preserving image aspect ratio. Cover fit may visually hide image edges but does not change the stored Uploaded Avatar object.
_Avoid_: Crop editor, crop box, saved crop

**Lookup Key**:
The value entered into signed-in Account lookup. It may be a full email address already known to the participant or a Gamer Tag; lookup results show Gamer Tag and Avatar, not the email address.
_Avoid_: Public username, editable handle, raw Auth user id, provider identity id

**Anonymous Solo Game**:
A local solo game played without a user account and without durable social features.
_Avoid_: Guest account, anonymous multiplayer

**Account**:
A durable signed-in identity used for multiplayer, persistence, social features, publishing, consent, moderation, and notifications.
_Avoid_: Gamer tag, username

**Account Deletion**:
The lifecycle action that removes or anonymizes an account holder's identity while preserving collaborative game history where needed.
_Avoid_: Hard delete, profile hiding

**Friend**:
A mutual relationship between two account holders who have both accepted the connection.
_Avoid_: Follower, contact

**Game Invite**:
An invitation for an account holder to join a multiplayer game.
_Avoid_: Friend request, notification

**Nudge**:
An automatic reminder sent after a game's configured inactivity timeout.
_Avoid_: Manual poke, reminder

**In-App Notification**:
A notification shown inside the Crazy Phrases web app.
_Avoid_: Push notification, email notification

**Notification Target**:
The concrete Game, Pending Game, current section, nudge, or completed batch context that
an In-App Notification refers to.
_Avoid_: Route, page, broad destination

**Nudge Timeout**:
The inactivity period configured for a game before a nudge may be sent.
_Avoid_: Notification preference, reminder setting
