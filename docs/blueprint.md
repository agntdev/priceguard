# Crypto Watchlist Alerts — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A private Telegram bot that allows users to maintain personal crypto watchlists with price threshold and percentage move alerts. Users can add/remove coins, set custom alert rules, receive on-demand price checks, schedule daily summaries, and configure quiet hours. The bot owner gets aggregated usage and alert statistics.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Individual crypto watchers
- Bot owner/maintainer

## Success criteria

- Users can add and remove coins from their watchlist
- Users receive accurate alerts when price thresholds or percentage moves are triggered
- Owner can view aggregated metrics and recent alerts
- Alerts are suppressed during user-configured quiet hours
- Bot handles price feed failures gracefully with retries

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu
- **Add coin** (button, actor: user, callback: add_coin:start) — Initiate adding a new coin to the watchlist
  - inputs: ticker symbol (typed) or quick button selection
  - outputs: confirmation card with resolved name and price
- **View list** (button, actor: user, callback: view_list:show) — Show current watchlist items with remove buttons
  - inputs: none
  - outputs: list of coins with inline remove buttons
- **/price** (command, actor: user, command: /price) — Request on-demand price check for a specific ticker or list of watchlist prices
  - inputs: optional ticker symbol
  - outputs: price snapshot with 1h change
- **Settings** (button, actor: user, callback: settings:open) — Access user profile settings
  - inputs: timezone, currency, quiet hours, cooldown settings
  - outputs: settings confirmation
- **Morning summary** (button, actor: user, callback: summary:configure) — Configure daily morning price summary
  - inputs: local time preference
  - outputs: summary confirmation
- **/metrics** (command, actor: owner, command: /metrics) — Show owner aggregated usage metrics
  - inputs: none
  - outputs: user count, active users, alert statistics
- **/recent-alerts** (command, actor: owner, command: /recent-alerts) — Show owner recent alert history
  - inputs: none
  - outputs: recent alert log

## Flows

### onboarding
_Trigger:_ /start

1. Greet user
2. Request timezone selection
3. Request currency selection
4. Show main menu

_Data touched:_ user profile

### add_coin
_Trigger:_ add_coin:start

1. Show popular coin buttons + 'Type ticker' option
2. Resolve ticker symbol
3. Show confirmation card with price
4. Confirm add with default alerts or custom alerts

_Data touched:_ watchlist item

### remove_coin
_Trigger:_ view_list:show

1. Display watchlist with remove buttons
2. Handle remove confirmation
3. Update watchlist

_Data touched:_ watchlist item

### set_threshold_alert
_Trigger:_ alert:threshold

1. Select direction (above/below)
2. Enter price value
3. Confirm alert rule

_Data touched:_ watchlist item

### set_percentage_alert
_Trigger:_ alert:percentage

1. Select direction (up/down/both)
2. Enter percentage value
3. Confirm alert rule

_Data touched:_ watchlist item

### price_check
_Trigger:_ /price

1. Parse optional ticker argument
2. Fetch price snapshot
3. Display price and 1h change

_Data touched:_ price snapshot

### alert_delivery
_Trigger:_ price update

1. Check all watchlist items
2. Evaluate alert rules
3. Check quiet hours
4. Check cooldown status
5. Send alert if conditions met
6. Update last alert time

_Data touched:_ watchlist item, user profile

### morning_summary
_Trigger:_ scheduled time

1. Fetch all price snapshots
2. Format summary with 1h and 24h changes
3. Send to user

_Data touched:_ price snapshot

### owner_metrics
_Trigger:_ /metrics

1. Aggregate user and alert data
2. Format metrics summary

_Data touched:_ owner metrics

### owner_recent_alerts
_Trigger:_ /recent-alerts

1. Fetch recent alert history
2. Format alert log

_Data touched:_ owner metrics

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **user profile** _(retention: persistent)_ — User-specific settings and preferences
  - fields: Telegram user id, display name, timezone, preferred currency, quiet hours start/end, morning summary time, default cooldown length, last-notification timestamps
- **watchlist item** _(retention: persistent)_ — A coin being tracked by a user with alert rules
  - fields: ticker symbol, friendly name, alert rules (threshold/percentage), enabled flag, last alert time, last observed price when alert triggered
- **price snapshot** _(retention: session)_ — Current price data for a coin
  - fields: ticker, timestamp, price in user's currency, percent change over 1h window
- **owner metrics** _(retention: persistent)_ — Aggregated usage and alert statistics
  - fields: total users, active users (last 30 days), per-ticker alert counts, per-alert-type counts, recent failures

## Integrations

- **Telegram** (required) — Bot API messaging
- **Crypto price feed** (required) — Price data source
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- /metrics
- /recent-alerts

## Notifications

- Alert notifications for price thresholds/percentage moves
- Morning summary notifications
- Owner metrics and alert logs

## Permissions & privacy

- User data is private and not shared
- Owner metrics are aggregated and anonymous
- Price data is fetched securely

## Edge cases

- Unknown ticker resolution with suggestions
- Price feed failures with retries
- Quiet hours alert queuing
- Alert cooldown enforcement
- Invalid user input handling

## Required tests

- End-to-end alert triggering and suppression
- Morning summary delivery at scheduled time
- Quiet hours alert queuing and delivery
- Price feed failure recovery
- Owner metrics aggregation accuracy

## Assumptions

- Timezone selection is required for scheduling
- USD is the default currency
- Percentage alert window is fixed to 1 hour
- Quiet hours default to 23:00-07:00
- Alert cooldown is 4 hours with 1% delta for follow-ups
- Owner identity is determined by setup-provided Telegram user id
