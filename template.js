const BigQuery = require('BigQuery');
const computeEffectiveTldPlusOne = require('computeEffectiveTldPlusOne');
const encodeUriComponent = require('encodeUriComponent');
const getAllEventData = require('getAllEventData');
const getCookieValues = require('getCookieValues');
const getContainerVersion = require('getContainerVersion');
const getEventData = require('getEventData');
const getRequestHeader = require('getRequestHeader');
const getTimestampMillis = require('getTimestampMillis');
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
      Message: 'Malformed Postback URL. Aborting tag execution.',
      Reason: "Missing 'cid' parameter."
    });
    return data.gtmOnFailure();
  }

  log({
    Name: 'Voluum',
    Type: 'Request',
    EventName: 'Conversion',
    RequestMethod: requestOptions.method,
    RequestUrl: requestUrl
  });

  return sendHttpRequest(requestUrl, requestOptions)
    .then((response) => {
      log({
        Name: 'Voluum',
        Type: 'Response',
        EventName: 'Conversion',
        ResponseStatusCode: response.statusCode,
        ResponseHeaders: response.headers,
        ResponseBody: response.body
      });
      if (!data.useOptimisticScenario) {
        if (response.statusCode >= 200 && response.statusCode < 300) return data.gtmOnSuccess();
        else return data.gtmOnFailure();
      }
    })
    .catch((error) => {
      log({
        Name: 'Voluum',
        Type: 'Message',
        EventName: 'Conversion',
        Message: 'API call failed or timed out',
        Reason: JSON.stringify(error)
      });
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
  const logDestinationsHandlers = {};
  if (determinateIsLoggingEnabled()) logDestinationsHandlers.console = logConsole;
  if (determinateIsLoggingEnabledForBigQuery()) logDestinationsHandlers.bigQuery = logToBigQuery;

  rawDataToLog.TraceId = getRequestHeader('trace-id');

  const keyMappings = {
    // No transformation for Console is needed.
    bigQuery: {
      Name: 'tag_name',
      Type: 'type',
      TraceId: 'trace_id',
      EventName: 'event_name',
      RequestMethod: 'request_method',
      RequestUrl: 'request_url',
      RequestBody: 'request_body',
      ResponseStatusCode: 'response_status_code',
      ResponseHeaders: 'response_headers',
      ResponseBody: 'response_body'
    }
  };

  for (const logDestination in logDestinationsHandlers) {
    const handler = logDestinationsHandlers[logDestination];
    if (!handler) continue;

    const mapping = keyMappings[logDestination];
    const dataToLog = mapping ? {} : rawDataToLog;

    if (mapping) {
      for (const key in rawDataToLog) {
        const mappedKey = mapping[key] || key;
        dataToLog[mappedKey] = rawDataToLog[key];
      }
    }

    handler(dataToLog);
  }
}

function logConsole(dataToLog) {
  logToConsole(JSON.stringify(dataToLog));
}

function logToBigQuery(dataToLog) {
  const connectionInfo = {
    projectId: data.logBigQueryProjectId,
    datasetId: data.logBigQueryDatasetId,
    tableId: data.logBigQueryTableId
  };

  dataToLog.timestamp = getTimestampMillis();

  ['request_body', 'response_headers', 'response_body'].forEach((p) => {
    dataToLog[p] = JSON.stringify(dataToLog[p]);
  });

  BigQuery.insert(connectionInfo, [dataToLog], { ignoreUnknownValues: true });
}

function determinateIsLoggingEnabled() {
  const containerVersion = getContainerVersion();
  const isDebug = !!(
    containerVersion &&
    (containerVersion.debugMode || containerVersion.previewMode)
  );

  if (!data.logType) {
    return isDebug;
  }

  if (data.logType === 'no') {
    return false;
  }

  if (data.logType === 'debug') {
    return isDebug;
  }

  return data.logType === 'always';
}

function determinateIsLoggingEnabledForBigQuery() {
  if (data.bigQueryLogType === 'no') return false;
  return data.bigQueryLogType === 'always';
}
