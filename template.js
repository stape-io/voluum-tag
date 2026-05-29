const computeEffectiveTldPlusOne = require('computeEffectiveTldPlusOne');
const encodeUriComponent = require('encodeUriComponent');
const getAllEventData = require('getAllEventData');
const getCookieValues = require('getCookieValues');
const getEventData = require('getEventData');
const getRequestHeader = require('getRequestHeader');
const getType = require('getType');
const JSON = require('JSON');
const logToConsole = require('logToConsole');
const makeString = require('makeString');
const makeInteger = require('makeInteger');
const makeTableMap = require('makeTableMap');
const parseUrl = require('parseUrl');
const sendHttpRequest = require('sendHttpRequest');
const setCookie = require('setCookie');

/*==============================================================================
==============================================================================*/

const eventData = getAllEventData();

if (shouldExitEarly(data, eventData)) return;

if (data.type === 'pageview') return storeClickId(data, eventData);
else {
  sendConversion(data);
}

if (data.useOptimisticScenario) {
  return data.gtmOnSuccess();
}

/*==============================================================================
  Vendor related functions
==============================================================================*/

function sendConversion(data) {
  const requestUrl = createRequestUrl(data);

  const requestOptions = {
    method: 'GET'
  };

  if (!requestUrl.match('[?&]cid=[^&]+')) {
    log({
      Name: 'Voluum',
      Type: 'Message',
      Message: '🛑 [ERROR] Malformed Postback URL. Aborting tag execution.',
      Reason: "Missing 'cid' parameter."
    });
    return data.gtmOnFailure();
  }

  return sendHttpRequest(requestUrl, requestOptions)
    .then((response) => {
      if (!data.useOptimisticScenario) {
        if (response.statusCode >= 200 && response.statusCode < 300) return data.gtmOnSuccess();
        else return data.gtmOnFailure();
      }
    })
    .catch((error) => {
      if (!data.useOptimisticScenario) return data.gtmOnFailure();
    });
}

function createRequestUrl(data) {
  const cid = getClickId(data, eventData) || '';
  const trackingDomain = formatPostbackDomain(data.postbackDomain);
  let postbackUrl = trackingDomain + '/postback?cid=' + (cid || '');
  let additionalParameters = data.additionalParameters || [];

  if (data.autoMap) {
    additionalParameters = autoMapParameters(makeTableMap(additionalParameters, 'key', 'value'));
  }

  if (additionalParameters.length) {
    additionalParameters.forEach((parameter) => {
      if (parameter.value) postbackUrl += '&' + enc(parameter.key) + '=' + enc(parameter.value);
    });
  }

  return postbackUrl;
}

function autoMapParameters(inputParams) {
  if (!inputParams) inputParams = {};
  const voluumParameters = [
    'payout',
    'txid',
    'currency',
    'et',
    'param1',
    'param2',
    'param3',
    'param4',
    'param5'
  ];

  const autoMapReturn = voluumParameters.map((parameter) => {
    switch (parameter) {
      case 'payout':
        return { key: 'payout', value: inputParams.payout || eventData.value };
      case 'txid':
        return { key: 'txid', value: inputParams.txid || eventData.transaction_id };
      case 'currency':
        return { key: 'currency', value: inputParams.currency || eventData.currency };
      default:
        return { key: parameter, value: inputParams[parameter] };
    }
  });
  return autoMapReturn;
}

function formatPostbackDomain(postbackDomain) {
  postbackDomain = makeString(postbackDomain).trim();
  postbackDomain = postbackDomain.replace('http://', '').replace('https://', '').split('/')[0];
  return 'https://' + postbackDomain;
}

function parseClickIdFromUrl(data, eventData) {
  const url = eventData.page_location || getRequestHeader('referer');
  if (!url) return;
  const urlSearchParams = parseUrl(url).searchParams;
  return urlSearchParams[data.clickIdKey];
}

function getClickId(data, eventData) {
  const clickId = data.hasOwnProperty('clickId')
    ? data.clickId
    : parseClickIdFromUrl(data, eventData) || getCookieValues('_voluum_cid')[0];
  return clickId;
}

function storeClickId(data, eventData) {
  const clickId = parseClickIdFromUrl(data, eventData);
  if (clickId) {
    const cookieOptions = {
      domain: getCookieDomain(data),
      samesite: data.cookieSameSite || 'none',
      path: '/',
      secure: true,
      httpOnly: !!data.cookieHttpOnly,
      'max-age': 60 * 60 * 24 * (makeInteger(data.cookieExpiration) || 30)
    };
    setCookie('_voluum_cid', clickId, cookieOptions, false);
  }

  return data.gtmOnSuccess();
}

/*==============================================================================
  Helpers
==============================================================================*/

function shouldExitEarly(data, eventData) {
  const url = eventData.page_location || getRequestHeader('referer');

  if (!isConsentGivenOrNotRequired(data, eventData)) {
    data.gtmOnSuccess();
    return true;
  }

  if (url && url.lastIndexOf('https://gtm-msr.appspot.com/', 0) === 0) {
    data.gtmOnSuccess();
    return true;
  }
}

function getCookieDomain(data) {
  return !data.cookieDomain || data.cookieDomain === 'auto'
    ? computeEffectiveTldPlusOne(getEventData('page_location') || getRequestHeader('referer')) ||
        'auto'
    : data.cookieDomain;
}

function enc(data) {
  if (['null', 'undefined'].indexOf(getType(data)) !== -1) data = '';
  return encodeUriComponent(makeString(data));
}

function isConsentGivenOrNotRequired(data, eventData) {
  if (data.adStorageConsent !== 'required') return true;
  if (eventData.consent_state) return !!eventData.consent_state.ad_storage;
  const xGaGcs = eventData['x-ga-gcs'] || ''; // x-ga-gcs is a string like "G110"
  return xGaGcs[2] === '1';
}

function log(rawDataToLog) {
  rawDataToLog.TraceId = getRequestHeader('trace-id');
  logToConsole(JSON.stringify(rawDataToLog));
}
