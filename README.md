# Send SMS with TextKit

A GitHub Action that sends a text message with the [TextKit](https://jointextkit.com?ref=gh-send-sms-action) SMS API. Use it to text yourself when a deploy fails, a release ships, or a scheduled job breaks.

No dependencies and no build step: one `fetch` to `POST https://api.jointextkit.com/v1/messages`.

## Usage

1. Get an API key at [jointextkit.com/console](https://jointextkit.com/console?ref=gh-send-sms-action). Test keys (`ssms_sk_test_...`) work right away against the sandbox.
2. Add it to the repo as a secret named `TEXTKIT_API_KEY` (Settings → Secrets and variables → Actions).
3. Add a step:

```yaml
- uses: textkithq/textkit-send-sms-action@v1
  with:
    api-key: ${{ secrets.TEXTKIT_API_KEY }}
    to: '+15551234567'
    body: 'Hello from GitHub Actions'
```

### Text me when a deploy fails

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./deploy.sh

      - name: Text on-call
        if: failure()
        uses: textkithq/textkit-send-sms-action@v1
        with:
          api-key: ${{ secrets.TEXTKIT_API_KEY }}
          to: ${{ vars.ONCALL_PHONE }}
          body: >-
            Deploy failed: ${{ github.repository }}@${{ github.ref_name }}
            ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

### Use the outputs

```yaml
- id: sms
  uses: textkithq/textkit-send-sms-action@v1
  with:
    api-key: ${{ secrets.TEXTKIT_API_KEY }}
    to: '+15551234567'
    from: '+15557654321'
    body: 'Release ${{ github.ref_name }} is live'

- run: echo "Sent ${{ steps.sms.outputs.message-id }} (${{ steps.sms.outputs.status }})"
```

## Inputs

| Input | Required | Description |
| --- | --- | --- |
| `api-key` | yes | TextKit API key. Pass it from a secret. |
| `to` | yes | Recipient in E.164 format, e.g. `+15551234567`. |
| `body` | yes | Message text. |
| `from` | no | Sending number in E.164 format. Optional when your account has exactly one sending number. |
| `base-url` | no | API base URL. Defaults to `https://api.jointextkit.com/v1`. |

## Outputs

| Output | Description |
| --- | --- |
| `message-id` | The message id (`msg_...`). |
| `status` | Status at creation: `queued`, `sent`, `delivered`, `failed` or `blocked`. |

## Errors

The step fails on any non-2xx response and prints the API's error code and message, for example:

```
HTTP 401 (invalid_api_key): Missing or malformed API key. Pass it as: Authorization: Bearer ssms_sk_...
```

It also fails when the message comes back `failed` or `blocked` (for example, the recipient opted out). Error codes are listed in the [API reference](https://jointextkit.com/docs?ref=gh-send-sms-action).

## License

MIT
