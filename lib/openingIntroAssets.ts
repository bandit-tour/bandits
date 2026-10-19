/**
 * Native Mix / opening bottle clip.
 * Current bytes: 3D CGI message-in-bottle (not live ocean throw). See asset audit.
 */
export const BOTTLE_VIDEO = require('@/assets/images/local-friend-bottle.mov');
export const BOTTLE_POSTER = require('@/assets/images/brand/banditour-bottle-sky.png');

/**
 * PLAY hotel branding (`public/videos/play-intro.mp4`). Not used by the opening intro,
 * and not used by banDiTEAM / Local Friend submit playback.
 */
export const BOTTLE_VIDEO_WEB_URI = '/videos/play-intro.mp4' as const;

/**
 * Web playback of the opening-intro master (`assets/images/local-friend-bottle.mov`).
 * Container-only stream copy: same H.264 frames, same AAC, same 568×320, no re-encode.
 * banDiTEAM report + Local Friend submit (`BottleSubmitVideo.web`) only.
 */
export const BOTTLE_INTRO_WEB_URI = '/videos/local-friend-bottle.mp4' as const;

/**
 * Web Mix loading only (`TravelBottleMixLoading.web`) — H.264 re-wrap of `local-friend-bottle.mov`
 * (same family as native intro `BOTTLE_VIDEO`). Not PLAY branding; not live ocean throw.
 */
export const BOTTLE_MIX_VIDEO_WEB_URI = '/videos/bottle-mix-loop.mp4' as const;
