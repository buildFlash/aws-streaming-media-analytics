/**
 * mpd-parser
 * @version 0.6.1
 * @copyright 2018 Brightcove, Inc
 * @license Apache-2.0
 */
import URLToolkit from 'url-toolkit';
import window from 'global/window';

var version = "0.6.1";

var formatAudioPlaylist = function formatAudioPlaylist(_ref) {
  var _attributes;

  var attributes = _ref.attributes,
      segments = _ref.segments;

  var playlist = {
    attributes: (_attributes = {
      NAME: attributes.id,
      BANDWIDTH: attributes.bandwidth,
      CODECS: attributes.codecs
    }, _attributes['PROGRAM-ID'] = 1, _attributes),
    uri: '',
    endList: (attributes.type || 'static') === 'static',
    timeline: attributes.periodIndex,
    resolvedUri: '',
    targetDuration: attributes.duration,
    segments: segments,
    mediaSequence: segments.length ? segments[0].number : 1
  };

  if (attributes.contentProtection) {
    playlist.contentProtection = attributes.contentProtection;
  }

  return playlist;
};

var formatVttPlaylist = function formatVttPlaylist(_ref2) {
  var _attributes2;

  var attributes = _ref2.attributes,
      segments = _ref2.segments;

  if (typeof segments === 'undefined') {
    // vtt tracks may use single file in BaseURL
    segments = [{
      uri: attributes.baseUrl,
      timeline: attributes.periodIndex,
      resolvedUri: attributes.baseUrl || '',
      duration: attributes.sourceDuration,
      number: 0
    }];
    // targetDuration should be the same duration as the only segment
    attributes.duration = attributes.sourceDuration;
  }
  return {
    attributes: (_attributes2 = {
      NAME: attributes.id,
      BANDWIDTH: attributes.bandwidth
    }, _attributes2['PROGRAM-ID'] = 1, _attributes2),
    uri: '',
    endList: (attributes.type || 'static') === 'static',
    timeline: attributes.periodIndex,
    resolvedUri: attributes.baseUrl || '',
    targetDuration: attributes.duration,
    segments: segments,
    mediaSequence: segments.length ? segments[0].number : 1
  };
};

var organizeAudioPlaylists = function organizeAudioPlaylists(playlists) {
  return playlists.reduce(function (a, playlist) {
    var role = playlist.attributes.role && playlist.attributes.role.value || 'main';
    var language = playlist.attributes.lang || '';

    var label = 'main';

    if (language) {
      label = playlist.attributes.lang + ' (' + role + ')';
    }

    // skip if we already have the highest quality audio for a language
    if (a[label] && a[label].playlists[0].attributes.BANDWIDTH > playlist.attributes.bandwidth) {
      return a;
    }

    a[label] = {
      language: language,
      autoselect: true,
      'default': role === 'main',
      playlists: [formatAudioPlaylist(playlist)],
      uri: ''
    };

    return a;
  }, {});
};

var organizeVttPlaylists = function organizeVttPlaylists(playlists) {
  return playlists.reduce(function (a, playlist) {
    var label = playlist.attributes.lang || 'text';

    // skip if we already have subtitles
    if (a[label]) {
      return a;
    }

    a[label] = {
      language: label,
      'default': false,
      autoselect: false,
      playlists: [formatVttPlaylist(playlist)],
      uri: ''
    };

    return a;
  }, {});
};

var formatVideoPlaylist = function formatVideoPlaylist(_ref3) {
  var _attributes3;

  var attributes = _ref3.attributes,
      segments = _ref3.segments;

  //in DASH framerate from mpd is specified as 30000/1001
  var tempFrameRate = attributes.frameRate.split("/");
  var frameRate = tempFrameRate[0] / tempFrameRate[1];
  frameRate = frameRate.toFixed(3);
  // let frameRate = eval(attributes.frameRate).toFixed(3);

  var playlist = {
    attributes: (_attributes3 = {
      NAME: attributes.id,
      AUDIO: 'audio',
      SUBTITLES: 'subs',
      RESOLUTION: {
        width: attributes.width,
        height: attributes.height
      },
      CODECS: attributes.codecs,
      BANDWIDTH: attributes.bandwidth
    }, _attributes3['PROGRAM-ID'] = 1, _attributes3['FRAME-RATE'] = frameRate, _attributes3),
    uri: '',
    endList: (attributes.type || 'static') === 'static',
    timeline: attributes.periodIndex,
    resolvedUri: '',
    targetDuration: attributes.duration,
    segments: segments,
    mediaSequence: segments.length ? segments[0].number : 1
  };

  if (attributes.contentProtection) {
    playlist.contentProtection = attributes.contentProtection;
  }

  return playlist;
};

var toM3u8 = function toM3u8(dashPlaylists) {
  var _mediaGroups;

  if (!dashPlaylists.length) {
    return {};
  }

  // grab all master attributes
  var _dashPlaylists$0$attr = dashPlaylists[0].attributes,
      duration = _dashPlaylists$0$attr.sourceDuration,
      _dashPlaylists$0$attr2 = _dashPlaylists$0$attr.minimumUpdatePeriod,
      minimumUpdatePeriod = _dashPlaylists$0$attr2 === undefined ? 0 : _dashPlaylists$0$attr2;


  var videoOnly = function videoOnly(_ref4) {
    var attributes = _ref4.attributes;
    return attributes.mimeType === 'video/mp4' || attributes.contentType === 'video';
  };
  var audioOnly = function audioOnly(_ref5) {
    var attributes = _ref5.attributes;
    return attributes.mimeType === 'audio/mp4' || attributes.contentType === 'audio';
  };
  var vttOnly = function vttOnly(_ref6) {
    var attributes = _ref6.attributes;
    return attributes.mimeType === 'text/vtt' || attributes.contentType === 'text';
  };

  var videoPlaylists = dashPlaylists.filter(videoOnly).map(formatVideoPlaylist);
  var audioPlaylists = dashPlaylists.filter(audioOnly);
  var vttPlaylists = dashPlaylists.filter(vttOnly);

  var master = {
    allowCache: true,
    discontinuityStarts: [],
    segments: [],
    endList: true,
    mediaGroups: (_mediaGroups = {
      AUDIO: {},
      VIDEO: {}
    }, _mediaGroups['CLOSED-CAPTIONS'] = {}, _mediaGroups.SUBTITLES = {}, _mediaGroups),
    uri: '',
    duration: duration,
    playlists: videoPlaylists,
    minimumUpdatePeriod: minimumUpdatePeriod * 1000
  };

  if (audioPlaylists.length) {
    master.mediaGroups.AUDIO.audio = organizeAudioPlaylists(audioPlaylists);
  }

  if (vttPlaylists.length) {
    master.mediaGroups.SUBTITLES.subs = organizeVttPlaylists(vttPlaylists);
  }

  return master;
};

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
  return typeof obj;
} : function (obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
};

var isObject = function isObject(obj) {
  return !!obj && (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) === 'object';
};

var merge = function merge() {
  for (var _len = arguments.length, objects = Array(_len), _key = 0; _key < _len; _key++) {
    objects[_key] = arguments[_key];
  }

  return objects.reduce(function (result, source) {

    Object.keys(source).forEach(function (key) {

      if (Array.isArray(result[key]) && Array.isArray(source[key])) {
        result[key] = result[key].concat(source[key]);
      } else if (isObject(result[key]) && isObject(source[key])) {
        result[key] = merge(result[key], source[key]);
      } else {
        result[key] = source[key];
      }
    });
    return result;
  }, {});
};

var resolveUrl = function resolveUrl(baseUrl, relativeUrl) {
  // return early if we don't need to resolve
  if (/^[a-z]+:/i.test(relativeUrl)) {
    return relativeUrl;
  }

  // if the base URL is relative then combine with the current location
  if (!/\/\//i.test(baseUrl)) {
    baseUrl = URLToolkit.buildAbsoluteURL(window.location.href, baseUrl);
  }

  return URLToolkit.buildAbsoluteURL(baseUrl, relativeUrl);
};

/**
 * @typedef {Object} SingleUri
 * @property {string} uri - relative location of segment
 * @property {string} resolvedUri - resolved location of segment
 * @property {Object} byterange - Object containing information on how to make byte range
 *   requests following byte-range-spec per RFC2616.
 * @property {String} byterange.length - length of range request
 * @property {String} byterange.offset - byte offset of range request
 *
 * @see https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.35.1
 */

/**
 * Converts a URLType node (5.3.9.2.3 Table 13) to a segment object
 * that conforms to how m3u8-parser is structured
 *
 * @see https://github.com/videojs/m3u8-parser
 *
 * @param {string} baseUrl - baseUrl provided by <BaseUrl> nodes
 * @param {string} source - source url for segment
 * @param {string} range - optional range used for range calls, follows
 * @return {SingleUri} full segment information transformed into a format similar
 *   to m3u8-parser
 */
var urlTypeToSegment = function urlTypeToSegment(_ref) {
  var _ref$baseUrl = _ref.baseUrl,
      baseUrl = _ref$baseUrl === undefined ? '' : _ref$baseUrl,
      _ref$source = _ref.source,
      source = _ref$source === undefined ? '' : _ref$source,
      _ref$range = _ref.range,
      range = _ref$range === undefined ? '' : _ref$range;

  var init = {
    uri: source,
    resolvedUri: resolveUrl(baseUrl || '', source)
  };

  if (range) {
    var ranges = range.split('-');
    var startRange = parseInt(ranges[0], 10);
    var endRange = parseInt(ranges[1], 10);

    init.byterange = {
      length: endRange - startRange,
      offset: startRange
    };
  }

  return init;
};

/**
 * Calculates the R (repetition) value for a live stream (for the final segment
 * in a manifest where the r value is negative 1)
 *
 * @param {Object} attributes
 *        Object containing all inherited attributes from parent elements with attribute
 *        names as keys
 * @param {number} time
 *        current time (typically the total time up until the final segment)
 * @param {number} duration
 *        duration property for the given <S />
 *
 * @return {number}
 *        R value to reach the end of the given period
 */
var getLiveRValue = function getLiveRValue(attributes, time, duration) {
  var NOW = attributes.NOW,
      clientOffset = attributes.clientOffset,
      availabilityStartTime = attributes.availabilityStartTime,
      _attributes$timescale = attributes.timescale,
      timescale = _attributes$timescale === undefined ? 1 : _attributes$timescale,
      _attributes$start = attributes.start,
      start = _attributes$start === undefined ? 0 : _attributes$start,
      _attributes$minimumUp = attributes.minimumUpdatePeriod,
      minimumUpdatePeriod = _attributes$minimumUp === undefined ? 0 : _attributes$minimumUp;

  var now = (NOW + clientOffset) / 1000;
  var periodStartWC = availabilityStartTime + start;
  var periodEndWC = now + minimumUpdatePeriod;
  var periodDuration = periodEndWC - periodStartWC;

  return Math.ceil((periodDuration * timescale - time) / duration);
};

/**
 * Uses information provided by SegmentTemplate.SegmentTimeline to determine segment
 * timing and duration
 *
 * @param {Object} attributes
 *        Object containing all inherited attributes from parent elements with attribute
 *        names as keys
 * @param {Object[]} segmentTimeline
 *        List of objects representing the attributes of each S element contained within
 *
 * @return {{number: number, duration: number, time: number, timeline: number}[]}
 *         List of Objects with segment timing and duration info
 */
var parseByTimeline = function parseByTimeline(attributes, segmentTimeline) {
  var _attributes$type = attributes.type,
      type = _attributes$type === undefined ? 'static' : _attributes$type,
      _attributes$minimumUp2 = attributes.minimumUpdatePeriod,
      minimumUpdatePeriod = _attributes$minimumUp2 === undefined ? 0 : _attributes$minimumUp2,
      _attributes$media = attributes.media,
      media = _attributes$media === undefined ? '' : _attributes$media,
      sourceDuration = attributes.sourceDuration,
      _attributes$timescale2 = attributes.timescale,
      timescale = _attributes$timescale2 === undefined ? 1 : _attributes$timescale2,
      _attributes$startNumb = attributes.startNumber,
      startNumber = _attributes$startNumb === undefined ? 1 : _attributes$startNumb,
      timeline = attributes.periodIndex;

  var segments = [];
  var time = -1;

  for (var sIndex = 0; sIndex < segmentTimeline.length; sIndex++) {
    var S = segmentTimeline[sIndex];
    var duration = S.d;
    var repeat = S.r || 0;
    var segmentTime = S.t || 0;

    if (time < 0) {
      // first segment
      time = segmentTime;
    }

    if (segmentTime && segmentTime > time) {
      // discontinuity

      // TODO: How to handle this type of discontinuity
      // timeline++ here would treat it like HLS discontuity and content would
      // get appended without gap
      // E.G.
      //  <S t="0" d="1" />
      //  <S d="1" />
      //  <S d="1" />
      //  <S t="5" d="1" />
      // would have $Time$ values of [0, 1, 2, 5]
      // should this be appened at time positions [0, 1, 2, 3],(#EXT-X-DISCONTINUITY)
      // or [0, 1, 2, gap, gap, 5]? (#EXT-X-GAP)
      // does the value of sourceDuration consider this when calculating arbitrary
      // negative @r repeat value?
      // E.G. Same elements as above with this added at the end
      //  <S d="1" r="-1" />
      //  with a sourceDuration of 10
      // Would the 2 gaps be included in the time duration calculations resulting in
      // 8 segments with $Time$ values of [0, 1, 2, 5, 6, 7, 8, 9] or 10 segments
      // with $Time$ values of [0, 1, 2, 5, 6, 7, 8, 9, 10, 11] ?

      time = segmentTime;
    }

    var count = void 0;

    if (repeat < 0) {
      var nextS = sIndex + 1;

      if (nextS === segmentTimeline.length) {
        // last segment
        if (type === 'dynamic' && minimumUpdatePeriod > 0 && media.indexOf('$Number$') > 0) {
          count = getLiveRValue(attributes, time, duration);
        } else {
          // TODO: This may be incorrect depending on conclusion of TODO above
          count = (sourceDuration * timescale - time) / duration;
        }
      } else {
        count = (segmentTimeline[nextS].t - time) / duration;
      }
    } else {
      count = repeat + 1;
    }

    var end = startNumber + segments.length + count;
    var number = startNumber + segments.length;

    while (number < end) {
      segments.push({ number: number, duration: duration / timescale, time: time, timeline: timeline });
      time += duration;
      number++;
    }
  }

  return segments;
};

var range = function range(start, end) {
  var result = [];

  for (var i = start; i < end; i++) {
    result.push(i);
  }

  return result;
};

var flatten = function flatten(lists) {
  return lists.reduce(function (x, y) {
    return x.concat(y);
  }, []);
};

var from = function from(list) {
  if (!list.length) {
    return [];
  }

  var result = [];

  for (var i = 0; i < list.length; i++) {
    result.push(list[i]);
  }

  return result;
};

/**
 * Functions for calculating the range of available segments in static and dynamic
 * manifests.
 */
var segmentRange = {
  /**
   * Returns the entire range of available segments for a static MPD
   *
   * @param {Object} attributes
   *        Inheritied MPD attributes
   * @return {{ start: number, end: number }}
   *         The start and end numbers for available segments
   */
  'static': function _static(attributes) {
    var duration = attributes.duration,
        _attributes$timescale = attributes.timescale,
        timescale = _attributes$timescale === undefined ? 1 : _attributes$timescale,
        sourceDuration = attributes.sourceDuration;


    return {
      start: 0,
      end: Math.ceil(sourceDuration / (duration / timescale))
    };
  },


  /**
   * Returns the current live window range of available segments for a dynamic MPD
   *
   * @param {Object} attributes
   *        Inheritied MPD attributes
   * @return {{ start: number, end: number }}
   *         The start and end numbers for available segments
   */
  dynamic: function dynamic(attributes) {
    var NOW = attributes.NOW,
        clientOffset = attributes.clientOffset,
        availabilityStartTime = attributes.availabilityStartTime,
        _attributes$timescale2 = attributes.timescale,
        timescale = _attributes$timescale2 === undefined ? 1 : _attributes$timescale2,
        duration = attributes.duration,
        _attributes$start = attributes.start,
        start = _attributes$start === undefined ? 0 : _attributes$start,
        _attributes$minimumUp = attributes.minimumUpdatePeriod,
        minimumUpdatePeriod = _attributes$minimumUp === undefined ? 0 : _attributes$minimumUp,
        _attributes$timeShift = attributes.timeShiftBufferDepth,
        timeShiftBufferDepth = _attributes$timeShift === undefined ? Infinity : _attributes$timeShift;

    var now = (NOW + clientOffset) / 1000;
    var periodStartWC = availabilityStartTime + start;
    var periodEndWC = now + minimumUpdatePeriod;
    var periodDuration = periodEndWC - periodStartWC;
    var segmentCount = Math.ceil(periodDuration * timescale / duration);
    var availableStart = Math.floor((now - periodStartWC - timeShiftBufferDepth) * timescale / duration);
    var availableEnd = Math.floor((now - periodStartWC) * timescale / duration);

    return {
      start: Math.max(0, availableStart),
      end: Math.min(segmentCount, availableEnd)
    };
  }
};

/**
 * Maps a range of numbers to objects with information needed to build the corresponding
 * segment list
 *
 * @name toSegmentsCallback
 * @function
 * @param {number} number
 *        Number of the segment
 * @param {number} index
 *        Index of the number in the range list
 * @return {{ number: Number, duration: Number, timeline: Number, time: Number }}
 *         Object with segment timing and duration info
 */

/**
 * Returns a callback for Array.prototype.map for mapping a range of numbers to
 * information needed to build the segment list.
 *
 * @param {Object} attributes
 *        Inherited MPD attributes
 * @return {toSegmentsCallback}
 *         Callback map function
 */
var toSegments = function toSegments(attributes) {
  return function (number, index) {
    var duration = attributes.duration,
        _attributes$timescale3 = attributes.timescale,
        timescale = _attributes$timescale3 === undefined ? 1 : _attributes$timescale3,
        periodIndex = attributes.periodIndex,
        _attributes$startNumb = attributes.startNumber,
        startNumber = _attributes$startNumb === undefined ? 1 : _attributes$startNumb;


    return {
      number: startNumber + number,
      duration: duration / timescale,
      timeline: periodIndex,
      time: index * duration
    };
  };
};

/**
 * Returns a list of objects containing segment timing and duration info used for
 * building the list of segments. This uses the @duration attribute specified
 * in the MPD manifest to derive the range of segments.
 *
 * @param {Object} attributes
 *        Inherited MPD attributes
 * @return {{number: number, duration: number, time: number, timeline: number}[]}
 *         List of Objects with segment timing and duration info
 */
var parseByDuration = function parseByDuration(attributes) {
  var _attributes$type = attributes.type,
      type = _attributes$type === undefined ? 'static' : _attributes$type,
      duration = attributes.duration,
      _attributes$timescale4 = attributes.timescale,
      timescale = _attributes$timescale4 === undefined ? 1 : _attributes$timescale4,
      sourceDuration = attributes.sourceDuration;

  var _segmentRange$type = segmentRange[type](attributes),
      start = _segmentRange$type.start,
      end = _segmentRange$type.end;

  var segments = range(start, end).map(toSegments(attributes));

  if (type === 'static') {
    var index = segments.length - 1;

    // final segment may be less than full segment duration
    segments[index].duration = sourceDuration - duration / timescale * index;
  }

  return segments;
};

var identifierPattern = /\$([A-z]*)(?:(%0)([0-9]+)d)?\$/g;

/**
 * Replaces template identifiers with corresponding values. To be used as the callback
 * for String.prototype.replace
 *
 * @name replaceCallback
 * @function
 * @param {string} match
 *        Entire match of identifier
 * @param {string} identifier
 *        Name of matched identifier
 * @param {string} format
 *        Format tag string. Its presence indicates that padding is expected
 * @param {string} width
 *        Desired length of the replaced value. Values less than this width shall be left
 *        zero padded
 * @return {string}
 *         Replacement for the matched identifier
 */

/**
 * Returns a function to be used as a callback for String.prototype.replace to replace
 * template identifiers
 *
 * @param {Obect} values
 *        Object containing values that shall be used to replace known identifiers
 * @param {number} values.RepresentationID
 *        Value of the Representation@id attribute
 * @param {number} values.Number
 *        Number of the corresponding segment
 * @param {number} values.Bandwidth
 *        Value of the Representation@bandwidth attribute.
 * @param {number} values.Time
 *        Timestamp value of the corresponding segment
 * @return {replaceCallback}
 *         Callback to be used with String.prototype.replace to replace identifiers
 */
var identifierReplacement = function identifierReplacement(values) {
  return function (match, identifier, format, width) {
    if (match === '$$') {
      // escape sequence
      return '$';
    }

    if (typeof values[identifier] === 'undefined') {
      return match;
    }

    var value = '' + values[identifier];

    if (identifier === 'RepresentationID') {
      // Format tag shall not be present with RepresentationID
      return value;
    }

    if (!format) {
      width = 1;
    } else {
      width = parseInt(width, 10);
    }

    if (value.length >= width) {
      return value;
    }

    return '' + new Array(width - value.length + 1).join('0') + value;
  };
};

/**
 * Constructs a segment url from a template string
 *
 * @param {string} url
 *        Template string to construct url from
 * @param {Obect} values
 *        Object containing values that shall be used to replace known identifiers
 * @param {number} values.RepresentationID
 *        Value of the Representation@id attribute
 * @param {number} values.Number
 *        Number of the corresponding segment
 * @param {number} values.Bandwidth
 *        Value of the Representation@bandwidth attribute.
 * @param {number} values.Time
 *        Timestamp value of the corresponding segment
 * @return {string}
 *         Segment url with identifiers replaced
 */
var constructTemplateUrl = function constructTemplateUrl(url, values) {
  return url.replace(identifierPattern, identifierReplacement(values));
};

/**
 * Generates a list of objects containing timing and duration information about each
 * segment needed to generate segment uris and the complete segment object
 *
 * @param {Object} attributes
 *        Object containing all inherited attributes from parent elements with attribute
 *        names as keys
 * @param {Object[]|undefined} segmentTimeline
 *        List of objects representing the attributes of each S element contained within
 *        the SegmentTimeline element
 * @return {{number: number, duration: number, time: number, timeline: number}[]}
 *         List of Objects with segment timing and duration info
 */
var parseTemplateInfo = function parseTemplateInfo(attributes, segmentTimeline) {
  if (!attributes.duration && !segmentTimeline) {
    // if neither @duration or SegmentTimeline are present, then there shall be exactly
    // one media segment
    return [{
      number: attributes.startNumber || 1,
      duration: attributes.sourceDuration,
      time: 0,
      timeline: attributes.periodIndex
    }];
  }

  if (attributes.duration) {
    return parseByDuration(attributes);
  }

  return parseByTimeline(attributes, segmentTimeline);
};

/**
 * Generates a list of segments using information provided by the SegmentTemplate element
 *
 * @param {Object} attributes
 *        Object containing all inherited attributes from parent elements with attribute
 *        names as keys
 * @param {Object[]|undefined} segmentTimeline
 *        List of objects representing the attributes of each S element contained within
 *        the SegmentTimeline element
 * @return {Object[]}
 *         List of segment objects
 */
var segmentsFromTemplate = function segmentsFromTemplate(attributes, segmentTimeline) {
  var templateValues = {
    RepresentationID: attributes.id,
    Bandwidth: attributes.bandwidth || 0
  };

  var _attributes$initializ = attributes.initialization,
      initialization = _attributes$initializ === undefined ? { sourceURL: '', range: '' } : _attributes$initializ;


  var mapSegment = urlTypeToSegment({
    baseUrl: attributes.baseUrl,
    source: constructTemplateUrl(initialization.sourceURL, templateValues),
    range: initialization.range
  });

  var segments = parseTemplateInfo(attributes, segmentTimeline);

  return segments.map(function (segment) {
    templateValues.Number = segment.number;
    templateValues.Time = segment.time;

    var uri = constructTemplateUrl(attributes.media || '', templateValues);

    return {
      uri: uri,
      timeline: segment.timeline,
      duration: segment.duration,
      resolvedUri: resolveUrl(attributes.baseUrl || '', uri),
      map: mapSegment,
      number: segment.number
    };
  });
};

var errors = {
  INVALID_NUMBER_OF_PERIOD: 'INVALID_NUMBER_OF_PERIOD',
  DASH_EMPTY_MANIFEST: 'DASH_EMPTY_MANIFEST',
  DASH_INVALID_XML: 'DASH_INVALID_XML',
  NO_BASE_URL: 'NO_BASE_URL',
  MISSING_SEGMENT_INFORMATION: 'MISSING_SEGMENT_INFORMATION',
  SEGMENT_TIME_UNSPECIFIED: 'SEGMENT_TIME_UNSPECIFIED',
  UNSUPPORTED_UTC_TIMING_SCHEME: 'UNSUPPORTED_UTC_TIMING_SCHEME'
};

/**
 * Converts a <SegmentUrl> (of type URLType from the DASH spec 5.3.9.2 Table 14)
 * to an object that matches the output of a segment in videojs/mpd-parser
 *
 * @param {Object} attributes
 *   Object containing all inherited attributes from parent elements with attribute
 *   names as keys
 * @param {Object} segmentUrl
 *   <SegmentURL> node to translate into a segment object
 * @return {Object} translated segment object
 */
var SegmentURLToSegmentObject = function SegmentURLToSegmentObject(attributes, segmentUrl) {
  var baseUrl = attributes.baseUrl,
      _attributes$initializ = attributes.initialization,
      initialization = _attributes$initializ === undefined ? {} : _attributes$initializ;


  var initSegment = urlTypeToSegment({
    baseUrl: baseUrl,
    source: initialization.sourceURL,
    range: initialization.range
  });

  var segment = urlTypeToSegment({
    baseUrl: baseUrl,
    source: segmentUrl.media,
    range: segmentUrl.mediaRange
  });

  segment.map = initSegment;

  return segment;
};

/**
 * Generates a list of segments using information provided by the SegmentList element
 * SegmentList (DASH SPEC Section 5.3.9.3.2) contains a set of <SegmentURL> nodes.  Each
 * node should be translated into segment.
 *
 * @param {Object} attributes
 *   Object containing all inherited attributes from parent elements with attribute
 *   names as keys
 * @param {Object[]|undefined} segmentTimeline
 *        List of objects representing the attributes of each S element contained within
 *        the SegmentTimeline element
 * @return {Object.<Array>} list of segments
 */
var segmentsFromList = function segmentsFromList(attributes, segmentTimeline) {
  var duration = attributes.duration,
      _attributes$segmentUr = attributes.segmentUrls,
      segmentUrls = _attributes$segmentUr === undefined ? [] : _attributes$segmentUr;

  // Per spec (5.3.9.2.1) no way to determine segment duration OR
  // if both SegmentTimeline and @duration are defined, it is outside of spec.

  if (!duration && !segmentTimeline || duration && segmentTimeline) {
    throw new Error(errors.SEGMENT_TIME_UNSPECIFIED);
  }

  var segmentUrlMap = segmentUrls.map(function (segmentUrlObject) {
    return SegmentURLToSegmentObject(attributes, segmentUrlObject);
  });
  var segmentTimeInfo = void 0;

  if (duration) {
    segmentTimeInfo = parseByDuration(attributes);
  }

  if (segmentTimeline) {
    segmentTimeInfo = parseByTimeline(attributes, segmentTimeline);
  }

  var segments = segmentTimeInfo.map(function (segmentTime, index) {
    if (segmentUrlMap[index]) {
      var segment = segmentUrlMap[index];

      segment.timeline = segmentTime.timeline;
      segment.duration = segmentTime.duration;
      segment.number = segmentTime.number;
      return segment;
    }
    // Since we're mapping we should get rid of any blank segments (in case
    // the given SegmentTimeline is handling for more elements than we have
    // SegmentURLs for).
  }).filter(function (segment) {
    return segment;
  });

  return segments;
};

/**
 * Translates SegmentBase into a set of segments.
 * (DASH SPEC Section 5.3.9.3.2) contains a set of <SegmentURL> nodes.  Each
 * node should be translated into segment.
 *
 * @param {Object} attributes
 *   Object containing all inherited attributes from parent elements with attribute
 *   names as keys
 * @return {Object.<Array>} list of segments
 */
var segmentsFromBase = function segmentsFromBase(attributes) {
  var baseUrl = attributes.baseUrl,
      _attributes$initializ = attributes.initialization,
      initialization = _attributes$initializ === undefined ? {} : _attributes$initializ,
      sourceDuration = attributes.sourceDuration,
      _attributes$timescale = attributes.timescale,
      timescale = _attributes$timescale === undefined ? 1 : _attributes$timescale,
      _attributes$indexRang = attributes.indexRange,
      indexRange = _attributes$indexRang === undefined ? '' : _attributes$indexRang,
      duration = attributes.duration;

  // base url is required for SegmentBase to work, per spec (Section 5.3.9.2.1)

  if (!baseUrl) {
    throw new Error(errors.NO_BASE_URL);
  }

  var initSegment = urlTypeToSegment({
    baseUrl: baseUrl,
    source: initialization.sourceURL,
    range: initialization.range
  });
  var segment = urlTypeToSegment({ baseUrl: baseUrl, source: baseUrl, range: indexRange });

  segment.map = initSegment;

  // If there is a duration, use it, otherwise use the given duration of the source
  // (since SegmentBase is only for one total segment)
  if (duration) {
    var segmentTimeInfo = parseByDuration(attributes);

    if (segmentTimeInfo.length) {
      segment.duration = segmentTimeInfo[0].duration;
      segment.timeline = segmentTimeInfo[0].timeline;
    }
  } else if (sourceDuration) {
    segment.duration = sourceDuration / timescale;
    segment.timeline = 0;
  }

  // This is used for mediaSequence
  segment.number = 0;

  return [segment];
};

var generateSegments = function generateSegments(_ref) {
  var attributes = _ref.attributes,
      segmentInfo = _ref.segmentInfo;

  var segmentAttributes = void 0;
  var segmentsFn = void 0;

  if (segmentInfo.template) {
    segmentsFn = segmentsFromTemplate;
    segmentAttributes = merge(attributes, segmentInfo.template);
  } else if (segmentInfo.base) {
    segmentsFn = segmentsFromBase;
    segmentAttributes = merge(attributes, segmentInfo.base);
  } else if (segmentInfo.list) {
    segmentsFn = segmentsFromList;
    segmentAttributes = merge(attributes, segmentInfo.list);
  }

  if (!segmentsFn) {
    return { attributes: attributes };
  }

  var segments = segmentsFn(segmentAttributes, segmentInfo.timeline);

  // The @duration attribute will be used to determin the playlist's targetDuration which
  // must be in seconds. Since we've generated the segment list, we no longer need
  // @duration to be in @timescale units, so we can convert it here.
  if (segmentAttributes.duration) {
    var _segmentAttributes = segmentAttributes,
        duration = _segmentAttributes.duration,
        _segmentAttributes$ti = _segmentAttributes.timescale,
        timescale = _segmentAttributes$ti === undefined ? 1 : _segmentAttributes$ti;


    segmentAttributes.duration = duration / timescale;
  } else if (segments.length) {
    // if there is no @duration attribute, use the largest segment duration as
    // as target duration
    segmentAttributes.duration = segments.reduce(function (max, segment) {
      return Math.max(max, Math.ceil(segment.duration));
    }, 0);
  } else {
    segmentAttributes.duration = 0;
  }

  return {
    attributes: segmentAttributes,
    segments: segments
  };
};

var toPlaylists = function toPlaylists(representations) {
  return representations.map(generateSegments);
};

var findChildren = function findChildren(element, name) {
  return from(element.childNodes).filter(function (_ref) {
    var tagName = _ref.tagName;
    return tagName === name;
  });
};

var getContent = function getContent(element) {
  return element.textContent.trim();
};

var parseDuration = function parseDuration(str) {
  var SECONDS_IN_YEAR = 365 * 24 * 60 * 60;
  var SECONDS_IN_MONTH = 30 * 24 * 60 * 60;
  var SECONDS_IN_DAY = 24 * 60 * 60;
  var SECONDS_IN_HOUR = 60 * 60;
  var SECONDS_IN_MIN = 60;

  // P10Y10M10DT10H10M10.1S
  var durationRegex = /P(?:(\d*)Y)?(?:(\d*)M)?(?:(\d*)D)?(?:T(?:(\d*)H)?(?:(\d*)M)?(?:([\d.]*)S)?)?/;
  var match = durationRegex.exec(str);

  if (!match) {
    return 0;
  }

  var _match$slice = match.slice(1),
      year = _match$slice[0],
      month = _match$slice[1],
      day = _match$slice[2],
      hour = _match$slice[3],
      minute = _match$slice[4],
      second = _match$slice[5];

  return parseFloat(year || 0) * SECONDS_IN_YEAR + parseFloat(month || 0) * SECONDS_IN_MONTH + parseFloat(day || 0) * SECONDS_IN_DAY + parseFloat(hour || 0) * SECONDS_IN_HOUR + parseFloat(minute || 0) * SECONDS_IN_MIN + parseFloat(second || 0);
};

var parseDate = function parseDate(str) {
  // Date format without timezone according to ISO 8601
  // YYY-MM-DDThh:mm:ss.ssssss
  var dateRegex = /^\d+-\d+-\d+T\d+:\d+:\d+(\.\d+)?$/;

  // If the date string does not specifiy a timezone, we must specifiy UTC. This is
  // expressed by ending with 'Z'
  if (dateRegex.test(str)) {
    str += 'Z';
  }

  return Date.parse(str);
};

// TODO: maybe order these in some way that makes it easy to find specific attributes
var parsers = {
  /**
   * Specifies the duration of the entire Media Presentation. Format is a duration string
   * as specified in ISO 8601
   *
   * @param {string} value
   *        value of attribute as a string
   * @return {number}
   *         The duration in seconds
   */
  mediaPresentationDuration: function mediaPresentationDuration(value) {
    return parseDuration(value);
  },


  /**
   * Specifies the Segment availability start time for all Segments referred to in this
   * MPD. For a dynamic manifest, it specifies the anchor for the earliest availability
   * time. Format is a date string as specified in ISO 8601
   *
   * @param {string} value
   *        value of attribute as a string
   * @return {number}
   *         The date as seconds from unix epoch
   */
  availabilityStartTime: function availabilityStartTime(value) {
    return parseDate(value) / 1000;
  },


  /**
   * Specifies the smallest period between potential changes to the MPD. Format is a
   * duration string as specified in ISO 8601
   *
   * @param {string} value
   *        value of attribute as a string
   * @return {number}
   *         The duration in seconds
   */
  minimumUpdatePeriod: function minimumUpdatePeriod(value) {
    return parseDuration(value);
  },


  /**
   * Specifies the duration of the smallest time shifting buffer for any Representation
   * in the MPD. Format is a duration string as specified in ISO 8601
   *
   * @param {string} value
   *        value of attribute as a string
   * @return {number}
   *         The duration in seconds
   */
  timeShiftBufferDepth: function timeShiftBufferDepth(value) {
    return parseDuration(value);
  },


  /**
   * Specifies the PeriodStart time of the Period relative to the availabilityStarttime.
   * Format is a duration string as specified in ISO 8601
   *
   * @param {string} value
   *        value of attribute as a string
   * @return {number}
   *         The duration in seconds
   */
  start: function start(value) {
    return parseDuration(value);
  },


  /**
   * Specifies the width of the visual presentation
   *
   * @param {string} value
   *        value of attribute as a string
   * @return {number}
   *         The parsed width
   */
  width: function width(value) {
    return parseInt(value, 10);
  },


  /**
   * Specifies the height of the visual presentation
   *
   * @param {string} value
   *        value of attribute as a string
   * @return {number}
   *         The parsed height
   */
  height: function height(value) {
    return parseInt(value, 10);
  },


  /**
   * Specifies the bitrate of the representation
   *
   * @param {string} value
   *        value of attribute as a string
   * @return {number}
   *         The parsed bandwidth
   */
  bandwidth: function bandwidth(value) {
    return parseInt(value, 10);
  },


  /**
   * Specifies the number of the first Media Segment in this Representation in the Period
   *
   * @param {string} value
   *        value of attribute as a string
   * @return {number}
   *         The parsed number
   */
  startNumber: function startNumber(value) {
    return parseInt(value, 10);
  },


  /**
   * Specifies the timescale in units per seconds
   *
   * @param {string} value
   *        value of attribute as a string
   * @return {number}
   *         The aprsed timescale
   */
  timescale: function timescale(value) {
    return parseInt(value, 10);
  },


  /**
   * Specifies the constant approximate Segment duration
   * NOTE: The <Period> element also contains an @duration attribute. This duration
   *       specifies the duration of the Period. This attribute is currently not
   *       supported by the rest of the parser, however we still check for it to prevent
   *       errors.
   *
   * @param {string} value
   *        value of attribute as a string
   * @return {number}
   *         The parsed duration
   */
  duration: function duration(value) {
    var parsedValue = parseInt(value, 10);

    if (isNaN(parsedValue)) {
      return parseDuration(value);
    }

    return parsedValue;
  },


  /**
   * Specifies the Segment duration, in units of the value of the @timescale.
   *
   * @param {string} value
   *        value of attribute as a string
   * @return {number}
   *         The parsed duration
   */
  d: function d(value) {
    return parseInt(value, 10);
  },


  /**
   * Specifies the MPD start time, in @timescale units, the first Segment in the series
   * starts relative to the beginning of the Period
   *
   * @param {string} value
   *        value of attribute as a string
   * @return {number}
   *         The parsed time
   */
  t: function t(value) {
    return parseInt(value, 10);
  },


  /**
   * Specifies the repeat count of the number of following contiguous Segments with the
   * same duration expressed by the value of @d
   *
   * @param {string} value
   *        value of attribute as a string
   * @return {number}
   *         The parsed number
   */
  r: function r(value) {
    return parseInt(value, 10);
  },


  /**
   * Default parser for all other attributes. Acts as a no-op and just returns the value
   * as a string
   *
   * @param {string} value
   *        value of attribute as a string
   * @return {string}
   *         Unparsed value
   */
  DEFAULT: function DEFAULT(value) {
    return value;
  }
};

/**
 * Gets all the attributes and values of the provided node, parses attributes with known
 * types, and returns an object with attribute names mapped to values.
 *
 * @param {Node} el
 *        The node to parse attributes from
 * @return {Object}
 *         Object with all attributes of el parsed
 */
var parseAttributes = function parseAttributes(el) {
  if (!(el && el.attributes)) {
    return {};
  }

  return from(el.attributes).reduce(function (a, e) {
    var parseFn = parsers[e.name] || parsers.DEFAULT;

    a[e.name] = parseFn(e.value);

    return a;
  }, {});
};

function decodeB64ToUint8Array(b64Text) {
  var decodedString = window.atob(b64Text);
  var array = new Uint8Array(decodedString.length);

  for (var i = 0; i < decodedString.length; i++) {
    array[i] = decodedString.charCodeAt(i);
  }
  return array;
}

var keySystemsMap = {
  'urn:uuid:1077efec-c0b2-4d02-ace3-3c1e52e2fb4b': 'org.w3.clearkey',
  'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed': 'com.widevine.alpha',
  'urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95': 'com.microsoft.playready',
  'urn:uuid:f239e769-efa3-4850-9c16-a903c6932efb': 'com.adobe.primetime'
};

/**
 * Builds a list of urls that is the product of the reference urls and BaseURL values
 *
 * @param {string[]} referenceUrls
 *        List of reference urls to resolve to
 * @param {Node[]} baseUrlElements
 *        List of BaseURL nodes from the mpd
 * @return {string[]}
 *         List of resolved urls
 */
var buildBaseUrls = function buildBaseUrls(referenceUrls, baseUrlElements) {
  if (!baseUrlElements.length) {
    return referenceUrls;
  }

  return flatten(referenceUrls.map(function (reference) {
    return baseUrlElements.map(function (baseUrlElement) {
      return resolveUrl(reference, getContent(baseUrlElement));
    });
  }));
};

/**
 * Contains all Segment information for its containing AdaptationSet
 *
 * @typedef {Object} SegmentInformation
 * @property {Object|undefined} template
 *           Contains the attributes for the SegmentTemplate node
 * @property {Object[]|undefined} timeline
 *           Contains a list of atrributes for each S node within the SegmentTimeline node
 * @property {Object|undefined} list
 *           Contains the attributes for the SegmentList node
 * @property {Object|undefined} base
 *           Contains the attributes for the SegmentBase node
 */

/**
 * Returns all available Segment information contained within the AdaptationSet node
 *
 * @param {Node} adaptationSet
 *        The AdaptationSet node to get Segment information from
 * @return {SegmentInformation}
 *         The Segment information contained within the provided AdaptationSet
 */
var getSegmentInformation = function getSegmentInformation(adaptationSet) {
  var segmentTemplate = findChildren(adaptationSet, 'SegmentTemplate')[0];
  var segmentList = findChildren(adaptationSet, 'SegmentList')[0];
  var segmentUrls = segmentList && findChildren(segmentList, 'SegmentURL').map(function (s) {
    return merge({ tag: 'SegmentURL' }, parseAttributes(s));
  });
  var segmentBase = findChildren(adaptationSet, 'SegmentBase')[0];
  var segmentTimelineParentNode = segmentList || segmentTemplate;
  var segmentTimeline = segmentTimelineParentNode && findChildren(segmentTimelineParentNode, 'SegmentTimeline')[0];
  var segmentInitializationParentNode = segmentList || segmentBase || segmentTemplate;
  var segmentInitialization = segmentInitializationParentNode && findChildren(segmentInitializationParentNode, 'Initialization')[0];

  // SegmentTemplate is handled slightly differently, since it can have both
  // @initialization and an <Initialization> node.  @initialization can be templated,
  // while the node can have a url and range specified.  If the <SegmentTemplate> has
  // both @initialization and an <Initialization> subelement we opt to override with
  // the node, as this interaction is not defined in the spec.
  var template = segmentTemplate && parseAttributes(segmentTemplate);

  if (template && segmentInitialization) {
    template.initialization = segmentInitialization && parseAttributes(segmentInitialization);
  } else if (template && template.initialization) {
    // If it is @initialization we convert it to an object since this is the format that
    // later functions will rely on for the initialization segment.  This is only valid
    // for <SegmentTemplate>
    template.initialization = { sourceURL: template.initialization };
  }

  var segmentInfo = {
    template: template,
    timeline: segmentTimeline && findChildren(segmentTimeline, 'S').map(function (s) {
      return parseAttributes(s);
    }),
    list: segmentList && merge(parseAttributes(segmentList), {
      segmentUrls: segmentUrls,
      initialization: parseAttributes(segmentInitialization)
    }),
    base: segmentBase && merge(parseAttributes(segmentBase), {
      initialization: parseAttributes(segmentInitialization)
    })
  };

  Object.keys(segmentInfo).forEach(function (key) {
    if (!segmentInfo[key]) {
      delete segmentInfo[key];
    }
  });

  return segmentInfo;
};

/**
 * Contains Segment information and attributes needed to construct a Playlist object
 * from a Representation
 *
 * @typedef {Object} RepresentationInformation
 * @property {SegmentInformation} segmentInfo
 *           Segment information for this Representation
 * @property {Object} attributes
 *           Inherited attributes for this Representation
 */

/**
 * Maps a Representation node to an object containing Segment information and attributes
 *
 * @name inheritBaseUrlsCallback
 * @function
 * @param {Node} representation
 *        Representation node from the mpd
 * @return {RepresentationInformation}
 *         Representation information needed to construct a Playlist object
 */

/**
 * Returns a callback for Array.prototype.map for mapping Representation nodes to
 * Segment information and attributes using inherited BaseURL nodes.
 *
 * @param {Object} adaptationSetAttributes
 *        Contains attributes inherited by the AdaptationSet
 * @param {string[]} adaptationSetBaseUrls
 *        Contains list of resolved base urls inherited by the AdaptationSet
 * @param {SegmentInformation} adaptationSetSegmentInfo
 *        Contains Segment information for the AdaptationSet
 * @return {inheritBaseUrlsCallback}
 *         Callback map function
 */
var inheritBaseUrls = function inheritBaseUrls(adaptationSetAttributes, adaptationSetBaseUrls, adaptationSetSegmentInfo) {
  return function (representation) {
    var repBaseUrlElements = findChildren(representation, 'BaseURL');
    var repBaseUrls = buildBaseUrls(adaptationSetBaseUrls, repBaseUrlElements);
    var attributes = merge(adaptationSetAttributes, parseAttributes(representation));
    var representationSegmentInfo = getSegmentInformation(representation);

    return repBaseUrls.map(function (baseUrl) {
      return {
        segmentInfo: merge(adaptationSetSegmentInfo, representationSegmentInfo),
        attributes: merge(attributes, { baseUrl: baseUrl })
      };
    });
  };
};

/**
 * Tranforms a series of content protection nodes to
 * an object containing pssh data by key system
 *
 * @param {Node[]} contentProtectionNodes
 *        Content protection nodes
 * @return {Object}
 *        Object containing pssh data by key system
 */
var generateKeySystemInformation = function generateKeySystemInformation(contentProtectionNodes) {
  return contentProtectionNodes.reduce(function (acc, node) {
    var attributes = parseAttributes(node);
    var keySystem = keySystemsMap[attributes.schemeIdUri];

    if (keySystem) {
      acc[keySystem] = { attributes: attributes };

      var psshNode = findChildren(node, 'cenc:pssh')[0];

      if (psshNode) {
        var pssh = getContent(psshNode);
        var psshBuffer = pssh && decodeB64ToUint8Array(pssh);

        acc[keySystem].pssh = psshBuffer;
      }
    }

    return acc;
  }, {});
};

/**
 * Maps an AdaptationSet node to a list of Representation information objects
 *
 * @name toRepresentationsCallback
 * @function
 * @param {Node} adaptationSet
 *        AdaptationSet node from the mpd
 * @return {RepresentationInformation[]}
 *         List of objects containing Representaion information
 */

/**
 * Returns a callback for Array.prototype.map for mapping AdaptationSet nodes to a list of
 * Representation information objects
 *
 * @param {Object} periodAttributes
 *        Contains attributes inherited by the Period
 * @param {string[]} periodBaseUrls
 *        Contains list of resolved base urls inherited by the Period
 * @param {string[]} periodSegmentInfo
 *        Contains Segment Information at the period level
 * @return {toRepresentationsCallback}
 *         Callback map function
 */
var toRepresentations = function toRepresentations(periodAttributes, periodBaseUrls, periodSegmentInfo) {
  return function (adaptationSet) {
    var adaptationSetAttributes = parseAttributes(adaptationSet);
    var adaptationSetBaseUrls = buildBaseUrls(periodBaseUrls, findChildren(adaptationSet, 'BaseURL'));
    var role = findChildren(adaptationSet, 'Role')[0];
    var roleAttributes = { role: parseAttributes(role) };

    var attrs = merge(periodAttributes, adaptationSetAttributes, roleAttributes);

    var contentProtection = generateKeySystemInformation(findChildren(adaptationSet, 'ContentProtection'));

    if (Object.keys(contentProtection).length) {
      attrs = merge(attrs, { contentProtection: contentProtection });
    }

    var segmentInfo = getSegmentInformation(adaptationSet);
    var representations = findChildren(adaptationSet, 'Representation');
    var adaptationSetSegmentInfo = merge(periodSegmentInfo, segmentInfo);

    return flatten(representations.map(inheritBaseUrls(attrs, adaptationSetBaseUrls, adaptationSetSegmentInfo)));
  };
};

/**
 * Maps an Period node to a list of Representation inforamtion objects for all
 * AdaptationSet nodes contained within the Period
 *
 * @name toAdaptationSetsCallback
 * @function
 * @param {Node} period
 *        Period node from the mpd
 * @param {number} periodIndex
 *        Index of the Period within the mpd
 * @return {RepresentationInformation[]}
 *         List of objects containing Representaion information
 */

/**
 * Returns a callback for Array.prototype.map for mapping Period nodes to a list of
 * Representation information objects
 *
 * @param {Object} mpdAttributes
 *        Contains attributes inherited by the mpd
 * @param {string[]} mpdBaseUrls
 *        Contains list of resolved base urls inherited by the mpd
 * @return {toAdaptationSetsCallback}
 *         Callback map function
 */
var toAdaptationSets = function toAdaptationSets(mpdAttributes, mpdBaseUrls) {
  return function (period, periodIndex) {
    var periodBaseUrls = buildBaseUrls(mpdBaseUrls, findChildren(period, 'BaseURL'));
    var periodAtt = parseAttributes(period);
    var periodAttributes = merge(mpdAttributes, periodAtt, { periodIndex: periodIndex });
    var adaptationSets = findChildren(period, 'AdaptationSet');
    var periodSegmentInfo = getSegmentInformation(period);

    return flatten(adaptationSets.map(toRepresentations(periodAttributes, periodBaseUrls, periodSegmentInfo)));
  };
};

/**
 * Traverses the mpd xml tree to generate a list of Representation information objects
 * that have inherited attributes from parent nodes
 *
 * @param {Node} mpd
 *        The root node of the mpd
 * @param {Object} options
 *        Available options for inheritAttributes
 * @param {string} options.manifestUri
 *        The uri source of the mpd
 * @param {number} options.NOW
 *        Current time per DASH IOP.  Default is current time in ms since epoch
 * @param {number} options.clientOffset
 *        Client time difference from NOW (in milliseconds)
 * @return {RepresentationInformation[]}
 *         List of objects containing Representation information
 */
var inheritAttributes = function inheritAttributes(mpd) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var _options$manifestUri = options.manifestUri,
      manifestUri = _options$manifestUri === undefined ? '' : _options$manifestUri,
      _options$NOW = options.NOW,
      NOW = _options$NOW === undefined ? Date.now() : _options$NOW,
      _options$clientOffset = options.clientOffset,
      clientOffset = _options$clientOffset === undefined ? 0 : _options$clientOffset;

  var periods = findChildren(mpd, 'Period');

  if (periods.length !== 1) {
    // TODO add support for multiperiod
    throw new Error(errors.INVALID_NUMBER_OF_PERIOD);
  }

  var mpdAttributes = parseAttributes(mpd);
  var mpdBaseUrls = buildBaseUrls([manifestUri], findChildren(mpd, 'BaseURL'));

  mpdAttributes.sourceDuration = mpdAttributes.mediaPresentationDuration || 0;
  mpdAttributes.NOW = NOW;
  mpdAttributes.clientOffset = clientOffset;

  return flatten(periods.map(toAdaptationSets(mpdAttributes, mpdBaseUrls)));
};

var stringToMpdXml = function stringToMpdXml(manifestString) {
  if (manifestString === '') {
    throw new Error(errors.DASH_EMPTY_MANIFEST);
  }

  var parser = new window.DOMParser();
  var xml = parser.parseFromString(manifestString, 'application/xml');
  var mpd = xml && xml.documentElement.tagName === 'MPD' ? xml.documentElement : null;

  if (!mpd || mpd && mpd.getElementsByTagName('parsererror').length > 0) {
    throw new Error(errors.DASH_INVALID_XML);
  }

  return mpd;
};

/**
 * Parses the manifest for a UTCTiming node, returning the nodes attributes if found
 *
 * @param {string} mpd
 *        XML string of the MPD manifest
 * @return {Object|null}
 *         Attributes of UTCTiming node specified in the manifest. Null if none found
 */
var parseUTCTimingScheme = function parseUTCTimingScheme(mpd) {
  var UTCTimingNode = findChildren(mpd, 'UTCTiming')[0];

  if (!UTCTimingNode) {
    return null;
  }

  var attributes = parseAttributes(UTCTimingNode);

  switch (attributes.schemeIdUri) {
    case 'urn:mpeg:dash:utc:http-head:2014':
    case 'urn:mpeg:dash:utc:http-head:2012':
      attributes.method = 'HEAD';
      break;
    case 'urn:mpeg:dash:utc:http-xsdate:2014':
    case 'urn:mpeg:dash:utc:http-iso:2014':
    case 'urn:mpeg:dash:utc:http-xsdate:2012':
    case 'urn:mpeg:dash:utc:http-iso:2012':
      attributes.method = 'GET';
      break;
    case 'urn:mpeg:dash:utc:direct:2014':
    case 'urn:mpeg:dash:utc:direct:2012':
      attributes.method = 'DIRECT';
      attributes.value = Date.parse(attributes.value);
      break;
    case 'urn:mpeg:dash:utc:http-ntp:2014':
    case 'urn:mpeg:dash:utc:ntp:2014':
    case 'urn:mpeg:dash:utc:sntp:2014':
    default:
      throw new Error(errors.UNSUPPORTED_UTC_TIMING_SCHEME);
  }

  return attributes;
};

var VERSION = version;

var parse = function parse(manifestString, options) {
  return toM3u8(toPlaylists(inheritAttributes(stringToMpdXml(manifestString), options)));
};

/**
 * Parses the manifest for a UTCTiming node, returning the nodes attributes if found
 *
 * @param {string} manifestString
 *        XML string of the MPD manifest
 * @return {Object|null}
 *         Attributes of UTCTiming node specified in the manifest. Null if none found
 */
var parseUTCTiming = function parseUTCTiming(manifestString) {
  return parseUTCTimingScheme(stringToMpdXml(manifestString));
};

export { VERSION, parse, parseUTCTiming };
