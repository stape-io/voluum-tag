# Voluum Tag for GTM Server-Side

This server-side tag allows you to track Voluum conversions via server-to-server (S2S) postbacks and handle Click ID storage directly from your Google Tag Manager Server container.

## Features

- **Event Support**: Handles **Page View** (for storing Click IDs) and **Conversion** (for postbacks with Redirect Linking).
- **Cookie Management**: Automatically extracts the Click ID from the URL during a Page View and stores it as a first-party cookie.
- **Flexible Parameters**: Supports sending multiple custom parameters, including Payout, Transaction ID, Currency, and Event Type.
- **Optimistic Scenario**: Option to trigger `gtmOnSuccess()` immediately without waiting for the API response.

## Configuration

- **Page View**: Fires when a user reaches the landing page to store the Click ID.
  - **Click ID URL Parameter Name**: The query parameter key for your Click ID (e.g., `clickid`).
  - **Cookie Settings**: Define **Expiration** (days), **Domain**, **SameSite** attribute, and **HttpOnly** flag for the Click ID cookie (`_voluum_cid`).

- **Conversion**: Sends a postback to Voluum.
  - **Click ID Value**: The unique tracking ID (defaults to reading from the `voluum_cid` cookie or URL parameter).
  - **Conversion Postback Tracking Domain**: Your Offer's postback domain (e.g., `your.voluum.tracking.domain`).
  - **Use Optimistic Scenario**: Check to fire the tag success trigger regardless of the actual API result.
  - **Additional Parameters**: Map specific parameters such as `payout`, `txid`, `et`, `currency`, and `param1`-`param5`.
  - **Auto-map**: Quickly map `payout`, `txid`, and `currency` from standard Event Data variables.

## Useful Resources

- [Track Voluum Conversions Using S2S Postback URL](https://doc.voluum.com/article/track-conversions-using-s2s-postback-url)
- [Parameters for S2S Postback URLs](https://doc.voluum.com/article/parameters-in-postback-urls)
- [Parameters for Custom Conversion](https://doc.voluum.com/article/custom-conversions#ii-get-the-postback-url)

## Open Source

The **Voluum Tag by Stape** is developed and maintained by the [Stape Team](https://stape.io/) under the Apache 2.0 license.

### GTM Gallery Status
🟢 [Listed](https://tagmanager.google.com/gallery/#/owners/stape-io/templates/voluum-tag)
